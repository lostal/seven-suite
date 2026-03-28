"use server";

/**
 * Calendar Data Actions compartidas
 *
 * Lógica única parametrizada por tipo de recurso.
 * Los módulos de ruta (parking, oficinas) importan buildCalendarAction
 * y reexportan con el tipo correspondiente.
 */

import { actionClient } from "@/lib/actions";
import { db } from "@/lib/db";
import { spots, reservations, cessions } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/helpers";
import { getAllResourceConfigs } from "@/lib/config";
import type {
  ResourceDayData,
  ResourceDayStatus,
} from "@/lib/calendar/resource-types";
import {
  buildMonthRange,
  computeCessionDayStatus,
  iterMonthDays,
  isOutsideBookingWindow,
  FEW_SPOTS_THRESHOLD,
} from "@/lib/calendar/calendar-utils";
import { z } from "zod/v4";
import { parseISO } from "date-fns";
import { isPast, getDayOfWeek } from "@/lib/utils";
import { getEffectiveEntityId } from "@/lib/queries/active-entity";
import { eq, and, gte, lte, ne, or, isNull } from "drizzle-orm";

type ResourceType = "parking" | "office";

type MyReservationRow = {
  id: string;
  spotId: string;
  date: string;
  spotLabel: string | null;
  startTime: string | null;
  endTime: string | null;
};

const calendarDataSchema = z.object({
  monthStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export function buildCalendarAction(resourceType: ResourceType) {
  return actionClient
    .schema(calendarDataSchema)
    .action(async ({ parsedInput }): Promise<ResourceDayData[]> => {
      const user = await getCurrentUser();
      if (!user) throw new Error("No autenticado");

      const entityId = await getEffectiveEntityId();
      const config = await getAllResourceConfigs(resourceType, entityId);
      const allowedDays: number[] = config.allowed_days;

      const monthStart = parseISO(parsedInput.monthStart);
      const { year, month, firstDay, lastDay } = buildMonthRange(monthStart);

      // Comprobar si el usuario tiene recurso asignado
      const assignedSpotConditions = [
        eq(spots.assignedTo, user.id),
        eq(spots.resourceType, resourceType),
      ];
      if (entityId) {
        assignedSpotConditions.push(
          or(eq(spots.entityId, entityId), isNull(spots.entityId))!
        );
      }

      const [assignedSpot] = await db
        .select({ id: spots.id, label: spots.label })
        .from(spots)
        .where(and(...assignedSpotConditions))
        .limit(1);

      if (assignedSpot) {
        // ── Usuario con recurso asignado: gestiona cesiones ──
        const cessionRows = await db
          .select({
            id: cessions.id,
            date: cessions.date,
            status: cessions.status,
          })
          .from(cessions)
          .where(
            and(
              eq(cessions.userId, user.id),
              eq(cessions.spotId, assignedSpot.id),
              gte(cessions.date, firstDay),
              lte(cessions.date, lastDay),
              ne(cessions.status, "cancelled")
            )
          );

        const cessionsByDate = new Map(cessionRows.map((c) => [c.date, c]));

        return Array.from(iterMonthDays(year, month)).map((dateStr) => {
          const cession = cessionsByDate.get(dateStr);
          return {
            date: dateStr,
            cessionDayStatus: computeCessionDayStatus({
              dateStr,
              allowedDays,
              minAdvanceHours: config.cession_min_advance_hours,
              cession,
            }),
            myCessionId: cession?.id,
            cessionStatus: cession?.status,
          };
        });
      } else {
        // ── Usuario sin recurso asignado: ver disponibilidad y propias reservas ──
        const spotsConditions = [
          eq(spots.isActive, true),
          eq(spots.resourceType, resourceType),
        ];
        if (entityId) {
          spotsConditions.push(
            or(eq(spots.entityId, entityId), isNull(spots.entityId))!
          );
        }

        const [allSpots, reservationRows, cessionRows, myReservationRows] =
          await Promise.all([
            db
              .select({
                id: spots.id,
                type: spots.type,
                assignedTo: spots.assignedTo,
              })
              .from(spots)
              .where(and(...spotsConditions)),
            db
              .select({ spotId: reservations.spotId, date: reservations.date })
              .from(reservations)
              .where(
                and(
                  gte(reservations.date, firstDay),
                  lte(reservations.date, lastDay),
                  eq(reservations.status, "confirmed")
                )
              ),
            db
              .select({
                spotId: cessions.spotId,
                date: cessions.date,
                status: cessions.status,
              })
              .from(cessions)
              .where(
                and(
                  gte(cessions.date, firstDay),
                  lte(cessions.date, lastDay),
                  ne(cessions.status, "cancelled")
                )
              ),
            db
              .select({
                id: reservations.id,
                spotId: reservations.spotId,
                date: reservations.date,
                startTime: reservations.startTime,
                endTime: reservations.endTime,
              })
              .from(reservations)
              .where(
                and(
                  eq(reservations.userId, user.id),
                  gte(reservations.date, firstDay),
                  lte(reservations.date, lastDay),
                  eq(reservations.status, "confirmed")
                )
              ),
          ]);

        // Etiquetas de plazas para mis reservas
        const myReservationSpotIds = new Set(
          myReservationRows.map((r) => r.spotId)
        );
        const spotLabels =
          myReservationSpotIds.size > 0
            ? await db
                .select({ id: spots.id, label: spots.label })
                .from(spots)
                .where(eq(spots.resourceType, resourceType))
            : [];
        const spotLabelById = new Map(spotLabels.map((s) => [s.id, s.label]));

        const myReservationRowsWithLabel: MyReservationRow[] =
          myReservationRows.map((r) => ({
            id: r.id,
            spotId: r.spotId,
            date: r.date,
            spotLabel: spotLabelById.get(r.spotId) ?? null,
            startTime: r.startTime ?? null,
            endTime: r.endTime ?? null,
          }));

        const allSpotIds = new Set(allSpots.map((s) => s.id));
        // "flexible" = plazas de tipo visitor: siempre disponibles sin cesión
        const flexibleSpotIds = new Set(
          allSpots.filter((s) => s.type === "visitor").map((s) => s.id)
        );
        const flexibleCount = flexibleSpotIds.size;

        const reservedByDate = new Map<string, Set<string>>();
        for (const r of reservationRows) {
          if (!allSpotIds.has(r.spotId)) continue;
          if (!reservedByDate.has(r.date))
            reservedByDate.set(r.date, new Set());
          reservedByDate.get(r.date)!.add(r.spotId);
        }

        const cededAvailableByDate = new Map<string, number>();
        for (const c of cessionRows) {
          if (
            allSpotIds.has(c.spotId) &&
            !flexibleSpotIds.has(c.spotId) &&
            c.status === "available"
          ) {
            cededAvailableByDate.set(
              c.date,
              (cededAvailableByDate.get(c.date) ?? 0) + 1
            );
          }
        }

        const myReservationByDate = new Map<
          string,
          {
            id: string;
            spotLabel?: string;
            startTime?: string | null;
            endTime?: string | null;
          }
        >();
        for (const r of myReservationRowsWithLabel) {
          if (!allSpotIds.has(r.spotId)) continue;
          myReservationByDate.set(r.date, {
            id: r.id,
            spotLabel: r.spotLabel ?? undefined,
            startTime: r.startTime,
            endTime: r.endTime,
          });
        }

        return Array.from(iterMonthDays(year, month)).map((dateStr) => {
          const dow = getDayOfWeek(dateStr);
          const myRes = myReservationByDate.get(dateStr);
          const cededAvail = cededAvailableByDate.get(dateStr) ?? 0;
          const reserved = reservedByDate.get(dateStr) ?? new Set();
          const reservedOnCeded = [...reserved].filter(
            (id) => allSpotIds.has(id) && !flexibleSpotIds.has(id)
          ).length;
          const reservedFlexible = [...reserved].filter((id) =>
            flexibleSpotIds.has(id)
          ).length;
          const totalAvailable =
            Math.max(0, cededAvail - reservedOnCeded) +
            Math.max(0, flexibleCount - reservedFlexible);

          let status: ResourceDayStatus;

          if (!allowedDays.includes(dow)) {
            status = "unavailable";
          } else if (isPast(dateStr)) {
            status = "past";
          } else if (isOutsideBookingWindow(dateStr, config.max_advance_days)) {
            status = "unavailable";
          } else if (myRes) {
            status = "reserved";
          } else if (totalAvailable <= 0) {
            status = "none";
          } else if (totalAvailable <= FEW_SPOTS_THRESHOLD) {
            status = "few";
          } else {
            status = "plenty";
          }

          const availableCount =
            status !== "unavailable" && status !== "past" && totalAvailable > 0
              ? totalAvailable
              : 0;

          return {
            date: dateStr,
            bookingStatus: status,
            availableCount,
            myReservationId: myRes?.id,
            myReservationSpotLabel: myRes?.spotLabel,
            myReservationStartTime: myRes?.startTime ?? null,
            myReservationEndTime: myRes?.endTime ?? null,
          };
        });
      }
    });
}
