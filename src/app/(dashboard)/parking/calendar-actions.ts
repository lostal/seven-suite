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
import type { CessionStatus } from "@/types";
import { z } from "zod/v4";
import { parseISO } from "date-fns";

// ─── Types ───────────────────────────────────────────────────

/** Estado de un día del calendario para un empleado */
export type EmployeeDayStatus =
  | "plenty" // Verde: hay plazas disponibles
  | "few" // Amarillo: quedan pocas (≤3)
  | "none" // Rojo: sin plazas
  | "reserved" // Azul: el usuario ya tiene reserva ese día
  | "past" // Pasado / no aplica
  | "weekend"; // Fin de semana

/** Estado de un día del calendario para un directivo */
export type ManagementDayStatus =
  | "can-cede" // Verde: puede ceder (no hay cesión)
  | "ceded-free" // Naranja: cedida y sin reservar aún
  | "ceded-taken" // Azul: cedida y ya reservada por alguien
  | "in-use" // Gris: plaza en uso (no cedida, día laboral futuro)
  | "past"
  | "weekend";

export interface CalendarDayData {
  date: string; // "yyyy-MM-dd"
  employeeStatus?: EmployeeDayStatus;
  managementStatus?: ManagementDayStatus;
  /** Plazas disponibles ese día (para empleado) */
  availableCount?: number;
  /** ID de reserva del usuario ese día (para empleado) */
  myReservationId?: string;
  /** Label de la plaza reservada por el usuario (para empleado) */
  myReservationSpotLabel?: string;
  /** ID de cesión del directivo ese día */
  myCessionId?: string;
  /** Estado de la cesión si existe */
  cessionStatus?: CessionStatus;
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Convierte un Date a "yyyy-MM-dd" usando componentes de hora LOCAL,
 * evitando el desfase UTC que causa .toISOString() en zonas UTC+N.
 */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isWeekend(dateStr: string): boolean {
  const d = parseISO(dateStr);
  const day = d.getDay();
  return day === 0 || day === 6;
}

function isPast(dateStr: string): boolean {
  return dateStr < toLocalDateStr(new Date());
}

// ─── Main Action ─────────────────────────────────────────────

const getCalendarDataSchema = z.object({
  /** Primer día del mes visible → "yyyy-MM-dd" */
  monthStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Obtiene el estado de todos los días del mes para el usuario actual.
 * La respuesta incluye tanto employeeStatus como managementStatus
 * según el rol del usuario.
 */
export const getCalendarMonthData = actionClient
  .schema(getCalendarDataSchema)
  .action(async ({ parsedInput }): Promise<CalendarDayData[]> => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");

    const role = user.profile?.role ?? "employee";
    const monthStart = parseISO(parsedInput.monthStart);
    const supabase = await createClient();

    // Rango de fechas del mes — se construye con componentes locales para
    // evitar el desfase UTC en zonas horarias positivas (ej. Europe/Madrid).
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const mm = String(month + 1).padStart(2, "0");
    const firstDay = `${year}-${mm}-01`;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const lastDay = `${year}-${mm}-${String(daysInMonth).padStart(2, "0")}`;

    if (role === "management" || role === "admin") {
      // ── Directivo: necesita su plaza asignada y sus cesiones ──
      // El trigger trg_sync_cession_status garantiza que cession.status
      // siempre es coherente con las reservas reales, por lo que podemos
      // usarlo directamente como fuente de verdad.
      const [spotResult, cessionsResult] = await Promise.all([
        supabase
          .from("spots")
          .select("id, label")
          .eq("assigned_to", user.id)
          .maybeSingle(),
        supabase
          .from("cessions")
          .select("id, date, status")
          .eq("user_id", user.id)
          .gte("date", firstDay)
          .lte("date", lastDay)
          .neq("status", "cancelled"),
      ]);

      const spotId = spotResult.data?.id ?? null;
      const cessionsByDate = new Map(
        (cessionsResult.data ?? []).map((c) => [c.date, c])
      );

      const days: CalendarDayData[] = [];

      // Iteramos todos los días del mes
      const current = new Date(year, month, 1);
      while (current.getMonth() === month) {
        const dateStr = toLocalDateStr(current);
        const cession = cessionsByDate.get(dateStr);

        let status: ManagementDayStatus;

        if (isWeekend(dateStr)) {
          status = "weekend";
        } else if (isPast(dateStr)) {
          status = "past";
        } else if (!spotId) {
          status = "in-use"; // Sin plaza asignada
        } else if (!cession) {
          status = "can-cede";
        } else if (cession.status === "available") {
          status = "ceded-free";
        } else if (cession.status === "reserved") {
          status = "ceded-taken";
        } else {
          status = "in-use";
        }

        days.push({
          date: dateStr,
          managementStatus: status,
          myCessionId: cession?.id,
          cessionStatus: cession?.status,
        });

        current.setDate(current.getDate() + 1);
      }

      return days;
    } else {
      // ── Empleado: necesita plazas disponibles + sus propias reservas ──
      const [
        spotsData,
        reservationsData,
        cessionsData,
        myReservationsData,
        visitorReservationsData,
      ] = await Promise.all([
        supabase.from("spots").select("id, type").eq("is_active", true),
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
          .select("id, date, spot:spots(label)")
          .eq("user_id", user.id)
          .gte("date", firstDay)
          .lte("date", lastDay)
          .eq("status", "confirmed"),
        // Reservas de visitantes: bloquean las plazas de tipo visitor
        supabase
          .from("visitor_reservations")
          .select("spot_id, date")
          .gte("date", firstDay)
          .lte("date", lastDay)
          .eq("status", "confirmed"),
      ]);

      const allSpots = spotsData.data ?? [];
      // Plazas no-dirección: siempre disponibles como base (visitor, standard, disabled)
      const totalOriginalSpots = allSpots.filter(
        (s) => s.type !== "management"
      ).length;

      // Mapa id→type para lookups O(1) dentro del bucle de días
      const spotTypeById = new Map(allSpots.map((s) => [s.id, s.type]));

      // Agrupa reservas por fecha
      const reservedByDate = new Map<string, Set<string>>();
      for (const r of reservationsData.data ?? []) {
        if (!reservedByDate.has(r.date)) reservedByDate.set(r.date, new Set());
        reservedByDate.get(r.date)!.add(r.spot_id);
      }

      // Agrupa cesiones activas por fecha → estas añaden disponibilidad
      const cededAvailableByDate = new Map<string, number>();
      for (const c of cessionsData.data ?? []) {
        if (c.status === "available") {
          cededAvailableByDate.set(
            c.date,
            (cededAvailableByDate.get(c.date) ?? 0) + 1
          );
        }
      }

      // Agrupa reservas de visitantes por fecha → bloquean plazas visitor
      const visitorReservedByDate = new Map<string, Set<string>>();
      for (const vr of visitorReservationsData.data ?? []) {
        if (!visitorReservedByDate.has(vr.date))
          visitorReservedByDate.set(vr.date, new Set());
        visitorReservedByDate.get(vr.date)!.add(vr.spot_id);
      }

      // Mis reservas
      const myReservationByDate = new Map<
        string,
        { id: string; spotLabel?: string }
      >();
      for (const r of myReservationsData.data ?? []) {
        const spotLabel = (r as unknown as { spot: { label: string } | null })
          .spot?.label;
        myReservationByDate.set(r.date, {
          id: r.id,
          spotLabel: spotLabel ?? undefined,
        });
      }

      const days: CalendarDayData[] = [];
      const current = new Date(year, month, 1);

      while (current.getMonth() === month) {
        const dateStr = toLocalDateStr(current);
        const myRes = myReservationByDate.get(dateStr);
        const reserved = reservedByDate.get(dateStr) ?? new Set();
        const cededAvail = cededAvailableByDate.get(dateStr) ?? 0;

        // Plazas no-dirección ocupadas por reservas de empleados
        const employeeReserved = [...reserved].filter(
          (id) => spotTypeById.get(id) !== "management"
        ).length;

        // Plazas visitor ocupadas por reservas de visitantes
        const visitorReserved = visitorReservedByDate.get(dateStr)?.size ?? 0;

        const standardAvailable =
          totalOriginalSpots - employeeReserved - visitorReserved;

        const totalAvailable = standardAvailable + cededAvail;

        let status: EmployeeDayStatus;

        if (isWeekend(dateStr)) {
          status = "weekend";
        } else if (isPast(dateStr)) {
          status = "past";
        } else if (myRes) {
          status = "reserved";
        } else if (totalAvailable <= 0) {
          status = "none";
        } else if (totalAvailable <= 3) {
          status = "few";
        } else {
          status = "plenty";
        }

        // El parking cierra los fines de semana: no hay plazas disponibles
        const availableCount =
          status !== "weekend" && status !== "past" && totalAvailable > 0
            ? totalAvailable
            : 0;

        days.push({
          date: dateStr,
          employeeStatus: status,
          availableCount,
          myReservationId: myRes?.id,
          myReservationSpotLabel: myRes?.spotLabel,
        });

        current.setDate(current.getDate() + 1);
      }

      return days;
    }
  });
