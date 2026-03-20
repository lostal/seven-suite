"use server";

/**
 * Office Calendar Data Actions
 *
 * Server Actions que alimentan la vista de calendario de oficinas.
 * Devuelven el estado de cada día del mes para pintarlo con colores según rol.
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

// ─── Schema ──────────────────────────────────────────────────

const getOfficeCalendarDataSchema = z.object({
  monthStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Obtiene el estado de todos los días del mes para el usuario actual (oficinas).
 */
export const getOfficeCalendarMonthData = actionClient
  .schema(getOfficeCalendarDataSchema)
  .action(async ({ parsedInput }): Promise<ResourceDayData[]> => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");

    const monthStart = parseISO(parsedInput.monthStart);

    const entityId = await getEffectiveEntityId();
    const config = await getAllResourceConfigs("office", entityId);
    const allowedDays: number[] = config.allowed_days;
    const { year, month, firstDay, lastDay } = buildMonthRange(monthStart);

    // Comprobar si el usuario tiene puesto asignado de oficina (en la sede activa)
    const assignedSpotConditions = [
      eq(spots.assignedTo, user.id),
      eq(spots.resourceType, "office"),
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
      // ── Usuario con puesto asignado: gestiona cesiones de oficina ──
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
      // ── Usuario sin puesto asignado: puestos disponibles + propias reservas ──
      const spotsConditions = [
        eq(spots.isActive, true),
        eq(spots.resourceType, "office"),
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

      // Get spot labels for my reservations
      const myReservationSpotIds = new Set(
        myReservationRows.map((r) => r.spotId)
      );
      const spotLabels =
        myReservationSpotIds.size > 0
          ? await db
              .select({ id: spots.id, label: spots.label })
              .from(spots)
              .where(eq(spots.resourceType, "office"))
          : [];
      const spotLabelById = new Map(spotLabels.map((s) => [s.id, s.label]));

      // Plazas flexible (visitor): siempre disponibles sin necesidad de cesión.
      const flexibleSpotIds = new Set(
        allSpots.filter((s) => s.type === "visitor").map((s) => s.id)
      );
      const flexibleCount = flexibleSpotIds.size;
      const officeSpotsSet = new Set(allSpots.map((s) => s.id));

      // Reservas confirmadas por fecha (filtradas a puestos de oficina)
      const reservedByDate = new Map<string, Set<string>>();
      for (const r of reservationRows) {
        if (!officeSpotsSet.has(r.spotId)) continue; // guardia cross-resource
        if (!reservedByDate.has(r.date)) reservedByDate.set(r.date, new Set());
        reservedByDate.get(r.date)!.add(r.spotId);
      }

      // Cesiones disponibles de puestos fijos asignados.
      const cededAvailableByDate = new Map<string, number>();
      for (const c of cessionRows) {
        if (
          officeSpotsSet.has(c.spotId) &&
          !flexibleSpotIds.has(c.spotId) &&
          c.status === "available"
        ) {
          cededAvailableByDate.set(
            c.date,
            (cededAvailableByDate.get(c.date) ?? 0) + 1
          );
        }
      }

      // Mis reservas de oficina
      const myReservationByDate = new Map<
        string,
        {
          id: string;
          spotLabel?: string;
          startTime?: string | null;
          endTime?: string | null;
        }
      >();
      for (const r of myReservationRows) {
        if (!officeSpotsSet.has(r.spotId)) continue; // ignorar reservas de otros módulos
        myReservationByDate.set(r.date, {
          id: r.id,
          spotLabel: spotLabelById.get(r.spotId) ?? undefined,
          startTime: r.startTime,
          endTime: r.endTime,
        });
      }

      return Array.from(iterMonthDays(year, month)).map((dateStr) => {
        const dow = getDayOfWeek(dateStr);
        const myRes = myReservationByDate.get(dateStr);
        const cededAvail = cededAvailableByDate.get(dateStr) ?? 0;
        // Reservas confirmadas sobre puestos cedidos/flexibles ese día
        const reserved = reservedByDate.get(dateStr) ?? new Set();
        const reservedOnCeded = [...reserved].filter(
          (id) => officeSpotsSet.has(id) && !flexibleSpotIds.has(id)
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
