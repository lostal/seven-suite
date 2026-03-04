"use server";

/**
 * Calendar Data Actions
 *
 * Server Actions que alimentan la vista unificada de calendario de parking.
 * Devuelven el estado de cada día del mes para pintarlo con colores según rol.
 */

import { actionClient } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
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

// ─── Types ───────────────────────────────────────────────────

type MyReservationRow = {
  id: string;
  spot_id: string;
  date: string;
  spot: { label: string } | null;
};

// ─── Main Action ─────────────────────────────────────────────

const getCalendarDataSchema = z.object({
  /** Primer día del mes visible → "yyyy-MM-dd" */
  monthStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Obtiene el estado de todos los días del mes para el usuario actual.
 * La respuesta incluye tanto el estado de cesión como el de reserva
 * según el rol del usuario.
 */
export const getCalendarMonthData = actionClient
  .schema(getCalendarDataSchema)
  .action(async ({ parsedInput }): Promise<ResourceDayData[]> => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");

    const config = await getAllResourceConfigs("parking");
    const allowedDays: number[] = config.allowed_days;

    const monthStart = parseISO(parsedInput.monthStart);
    const supabase = await createClient();
    const { year, month, firstDay, lastDay } = buildMonthRange(monthStart);

    // Comprobar si el usuario tiene plaza asignada de parking
    const { data: assignedSpot } = await supabase
      .from("spots")
      .select("id, label")
      .eq("assigned_to", user.id)
      .eq("resource_type", "parking")
      .maybeSingle();

    if (assignedSpot) {
      // ── Usuario con plaza asignada: gestiona cesiones ──
      // El trigger trg_sync_cession_status garantiza que cession.status
      // siempre es coherente con las reservas reales.
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
      // ── Usuario sin plaza asignada: reservar plazas disponibles ──
      const [spotsData, reservationsData, cessionsData, myReservationsData] =
        await Promise.all([
          supabase
            .from("spots")
            .select("id, type, assigned_to")
            .eq("is_active", true)
            .eq("resource_type", "parking"),
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
            .select("id, spot_id, date, spot:spots(label)")
            .eq("user_id", user.id)
            .gte("date", firstDay)
            .lte("date", lastDay)
            .eq("status", "confirmed")
            .returns<MyReservationRow[]>(),
        ]);

      const allSpots = spotsData.data ?? [];

      // Bajo el nuevo modelo, TODAS las plazas reservables vienen de cesiones activas
      // (solo plazas con propietario asignado que las liberan explícitamente).
      // No existe el concepto de plaza 'libre' sin propietario.
      const allParkingIds = new Set(allSpots.map((s) => s.id));

      // Agrupa reservas por fecha (filtradas a IDs de parking)
      const reservedByDate = new Map<string, Set<string>>();
      for (const r of reservationsData.data ?? []) {
        if (!allParkingIds.has(r.spot_id)) continue; // guardia cross-resource
        if (!reservedByDate.has(r.date)) reservedByDate.set(r.date, new Set());
        reservedByDate.get(r.date)!.add(r.spot_id);
      }

      // Cesiones disponibles de plazas con propietario = el pool de plazas reservables.
      const cededAvailableByDate = new Map<string, number>();
      for (const c of cessionsData.data ?? []) {
        if (allParkingIds.has(c.spot_id) && c.status === "available") {
          cededAvailableByDate.set(
            c.date,
            (cededAvailableByDate.get(c.date) ?? 0) + 1
          );
        }
      }

      // Mis reservas
      const myReservationByDate = new Map<
        string,
        { id: string; spotLabel?: string }
      >();
      for (const r of myReservationsData.data ?? []) {
        if (!allParkingIds.has(r.spot_id)) continue; // ignorar reservas de otros módulos
        myReservationByDate.set(r.date, {
          id: r.id,
          spotLabel: r.spot?.label ?? undefined,
        });
      }

      return Array.from(iterMonthDays(year, month)).map((dateStr) => {
        const myRes = myReservationByDate.get(dateStr);
        const cededAvail = cededAvailableByDate.get(dateStr) ?? 0;
        // Reservas confirmadas sobre plazas cedidas ese día
        const reserved = reservedByDate.get(dateStr) ?? new Set();
        const reservedOnCeded = [...reserved].filter((id) =>
          allParkingIds.has(id)
        ).length;
        const totalAvailable = Math.max(0, cededAvail - reservedOnCeded);

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
