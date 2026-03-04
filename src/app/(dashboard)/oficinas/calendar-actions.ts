"use server";

/**
 * Office Calendar Data Actions
 *
 * Server Actions que alimentan la vista de calendario de oficinas.
 * Devuelven el estado de cada día del mes para pintarlo con colores según rol.
 */

import { actionClient } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
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

// ─── Types ───────────────────────────────────────────────────

type MyOfficeReservationRow = {
  id: string;
  spot_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  spot: { label: string } | null;
};

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
    const supabase = await createClient();

    const config = await getAllResourceConfigs("office");
    const allowedDays: number[] = config.allowed_days;
    const { year, month, firstDay, lastDay } = buildMonthRange(monthStart);

    // Comprobar si el usuario tiene puesto asignado de oficina
    const { data: assignedSpot } = await supabase
      .from("spots")
      .select("id, label")
      .eq("assigned_to", user.id)
      .eq("resource_type", "office")
      .maybeSingle();

    if (assignedSpot) {
      // ── Usuario con puesto asignado: gestiona cesiones de oficina ──
      const cessionsResult = await supabase
        .from("cessions")
        .select("id, date, status")
        .eq("user_id", user.id)
        .eq("spot_id", assignedSpot.id)
        .gte("date", firstDay)
        .lte("date", lastDay)
        .neq("status", "cancelled");

      const cessionsByDate = new Map(
        (cessionsResult.data ?? []).map((c) => [c.date, c])
      );

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
      const [spotsData, reservationsData, cessionsData, myReservationsData] =
        await Promise.all([
          supabase
            .from("spots")
            .select("id, type, assigned_to")
            .eq("is_active", true)
            .eq("resource_type", "office"),
          supabase
            .from("reservations")
            .select("spot_id, date")
            .gte("date", firstDay)
            .lte("date", lastDay)
            .eq("status", "confirmed"),
          supabase
            .from("cessions")
            .select("spot_id, date, status")
            .gte("date", firstDay)
            .lte("date", lastDay)
            .neq("status", "cancelled"),
          supabase
            .from("reservations")
            .select(
              "id, spot_id, date, start_time, end_time, spot:spots(label)"
            )
            .eq("user_id", user.id)
            .gte("date", firstDay)
            .lte("date", lastDay)
            .eq("status", "confirmed")
            .eq("spots.resource_type", "office")
            .returns<MyOfficeReservationRow[]>(),
        ]);

      const allOfficeSpots = spotsData.data ?? [];
      // Bajo el nuevo modelo, TODAS las plazas reservables vienen de cesiones activas.
      // No existe el concepto de puesto "libre" sin propietario.
      const officeSpotsSet = new Set(allOfficeSpots.map((s) => s.id));

      // Reservas confirmadas por fecha (filtradas a puestos de oficina)
      const reservedByDate = new Map<string, Set<string>>();
      for (const r of reservationsData.data ?? []) {
        if (!officeSpotsSet.has(r.spot_id)) continue; // guardia cross-resource
        if (!reservedByDate.has(r.date)) reservedByDate.set(r.date, new Set());
        reservedByDate.get(r.date)!.add(r.spot_id);
      }

      // Cesiones disponibles de puestos asignados = el pool de puestos reservables
      const cededAvailableByDate = new Map<string, number>();
      for (const c of cessionsData.data ?? []) {
        if (officeSpotsSet.has(c.spot_id) && c.status === "available") {
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
      for (const r of myReservationsData.data ?? []) {
        if (!officeSpotsSet.has(r.spot_id)) continue; // ignorar reservas de otros módulos
        myReservationByDate.set(r.date, {
          id: r.id,
          spotLabel: r.spot?.label ?? undefined,
          startTime: r.start_time,
          endTime: r.end_time,
        });
      }

      return Array.from(iterMonthDays(year, month)).map((dateStr) => {
        const dow = getDayOfWeek(dateStr);
        const myRes = myReservationByDate.get(dateStr);
        const cededAvail = cededAvailableByDate.get(dateStr) ?? 0;
        // Reservas confirmadas sobre puestos cedidos ese día
        const reserved = reservedByDate.get(dateStr) ?? new Set();
        const reservedOnCeded = [...reserved].filter((id) =>
          officeSpotsSet.has(id)
        ).length;
        const totalAvailable = Math.max(0, cededAvail - reservedOnCeded);

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
