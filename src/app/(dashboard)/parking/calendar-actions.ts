"use server";

/**
 * Calendar Data Actions
 *
 * Server Actions que alimentan la vista unificada de calendario de parking.
 * Devuelven el estado de cada día del mes para pintarlo con colores según rol.
 */

import { actionClient } from "@/lib/actions";
import { db } from "@/lib/db";
import { spots, reservations, cessions } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/helpers";
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
import { getAllResourceConfigs } from "@/lib/config";
import { getEffectiveEntityId } from "@/lib/queries/active-entity";
import { eq, and, gte, lte, ne, or, isNull } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────────

type MyReservationRow = {
  id: string;
  spotId: string;
  date: string;
  spotLabel: string | null;
};

// ─── Main Action ─────────────────────────────────────────────

const getCalendarDataSchema = z.object({
  monthStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Obtiene el estado de todos los días del mes para el usuario actual.
 */
export const getCalendarMonthData = actionClient
  .schema(getCalendarDataSchema)
  .action(async ({ parsedInput }): Promise<ResourceDayData[]> => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");

    const entityId = await getEffectiveEntityId();
    const config = await getAllResourceConfigs("parking", entityId);
    const allowedDays: number[] = config.allowed_days;

    const monthStart = parseISO(parsedInput.monthStart);
    const { year, month, firstDay, lastDay } = buildMonthRange(monthStart);

    // Comprobar si el usuario tiene plaza asignada de parking
    const assignedSpotConditions = [
      eq(spots.assignedTo, user.id),
      eq(spots.resourceType, "parking"),
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
      // ── Usuario con plaza asignada: gestiona cesiones ──
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
      // ── Usuario sin plaza asignada: reservar plazas disponibles ──
      const spotsConditions = [
        eq(spots.isActive, true),
        eq(spots.resourceType, "parking"),
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
              .where(eq(spots.resourceType, "parking"))
          : [];
      const spotLabelById = new Map(spotLabels.map((s) => [s.id, s.label]));

      const myReservationRowsWithLabel: MyReservationRow[] =
        myReservationRows.map((r) => ({
          id: r.id,
          spotId: r.spotId,
          date: r.date,
          spotLabel: spotLabelById.get(r.spotId) ?? null,
        }));

      const allParkingIds = new Set(allSpots.map((s) => s.id));
      const visitorSpotIds = new Set(
        allSpots.filter((s) => s.type === "visitor").map((s) => s.id)
      );
      const visitorCount = visitorSpotIds.size;

      const reservedByDate = new Map<string, Set<string>>();
      for (const r of reservationRows) {
        if (!allParkingIds.has(r.spotId)) continue;
        if (!reservedByDate.has(r.date)) reservedByDate.set(r.date, new Set());
        reservedByDate.get(r.date)!.add(r.spotId);
      }

      const cededAvailableByDate = new Map<string, number>();
      for (const c of cessionRows) {
        if (
          allParkingIds.has(c.spotId) &&
          !visitorSpotIds.has(c.spotId) &&
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
        { id: string; spotLabel?: string }
      >();
      for (const r of myReservationRowsWithLabel) {
        if (!allParkingIds.has(r.spotId)) continue;
        myReservationByDate.set(r.date, {
          id: r.id,
          spotLabel: r.spotLabel ?? undefined,
        });
      }

      return Array.from(iterMonthDays(year, month)).map((dateStr) => {
        const myRes = myReservationByDate.get(dateStr);
        const cededAvail = cededAvailableByDate.get(dateStr) ?? 0;
        const reserved = reservedByDate.get(dateStr) ?? new Set();
        const reservedOnCeded = [...reserved].filter(
          (id) => allParkingIds.has(id) && !visitorSpotIds.has(id)
        ).length;
        const reservedVisitor = [...reserved].filter((id) =>
          visitorSpotIds.has(id)
        ).length;
        const totalAvailable =
          Math.max(0, cededAvail - reservedOnCeded) +
          Math.max(0, visitorCount - reservedVisitor);

        let status: ResourceDayStatus;

        if (!allowedDays.includes(getDayOfWeek(dateStr))) {
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
        };
      });
    }
  });
