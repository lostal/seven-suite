/**
 * Utilidades compartidas de calendario
 *
 * Lógica reutilizada por parking/calendar-actions.ts y oficinas/calendar-actions.ts.
 * Centraliza el cálculo de rangos de mes, el umbral "few" y la lógica de estado
 * de cesión por día.
 */

import type { ResourceCessionDayStatus } from "./resource-types";
import { toServerDateStr, isPast, getDayOfWeek } from "@/lib/utils";

// ─── Constantes ───────────────────────────────────────────────

/** Umbral de plazas para estado "few" (pocas plazas disponibles). */
export const FEW_SPOTS_THRESHOLD = 3;

// ─── Rango de mes ─────────────────────────────────────────────

export interface MonthRange {
  year: number;
  month: number;
  firstDay: string;
  lastDay: string;
}

/**
 * Calcula el primer y último día del mes a partir de una fecha en el mes.
 * @param monthStart - Primer día del mes como objeto Date
 */
export function buildMonthRange(monthStart: Date): MonthRange {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const mm = String(month + 1).padStart(2, "0");
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return {
    year,
    month,
    firstDay: `${year}-${mm}-01`,
    lastDay: `${year}-${mm}-${String(daysInMonth).padStart(2, "0")}`,
  };
}

// ─── Ventana de reserva ───────────────────────────────────────

/**
 * Devuelve true si la fecha supera el límite de antelación máxima.
 * Comparación en días completos (medianoche local del servidor).
 */
export function isOutsideBookingWindow(
  dateStr: string,
  /** null = sin límite de antelación */
  maxAdvanceDays: number | null
): boolean {
  if (maxAdvanceDays === null) return false;
  const today = new Date(toServerDateStr(new Date()) + "T00:00:00");
  const target = new Date(dateStr + "T00:00:00");
  const daysAhead = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  return daysAhead > maxAdvanceDays;
}

/**
 * Devuelve true si la fecha está demasiado próxima para una cesión
 * según el mínimo de antelación configurado (en horas).
 */
export function isTooSoonForCession(
  dateStr: string,
  minAdvanceHours: number
): boolean {
  if (minAdvanceHours <= 0) return false;
  const now = Date.now();
  // Medianoche del día objetivo en zona del servidor (consistente con toServerDateStr)
  const target = new Date(dateStr + "T00:00:00");
  const hoursUntil = (target.getTime() - now) / (1000 * 60 * 60);
  return hoursUntil < minAdvanceHours;
}

// ─── Estado de cesión por día ─────────────────────────────────

interface CessionDayParams {
  dateStr: string;
  allowedDays: number[];
  /** Horas mínimas de antelación para ceder (de config.cession_min_advance_hours) */
  minAdvanceHours?: number;
  cession?: { status: string } | undefined;
}

/**
 * Determina el estado de un día en la vista de cesión (usuario con plaza asignada).
 * Lógica pura, sin side-effects, fácil de testear.
 */
export function computeCessionDayStatus(
  params: CessionDayParams
): ResourceCessionDayStatus {
  const { dateStr, allowedDays, minAdvanceHours = 0, cession } = params;

  if (!allowedDays.includes(getDayOfWeek(dateStr))) return "unavailable";
  if (isPast(dateStr)) return "past";
  if (isTooSoonForCession(dateStr, minAdvanceHours)) return "in-use";
  if (!cession) return "can-cede";
  if (cession.status === "available") return "ceded-free";
  if (cession.status === "reserved") return "ceded-taken";
  return "in-use";
}

// ─── Iteración de días del mes ────────────────────────────────

/**
 * Genera la secuencia de fechas "yyyy-MM-dd" para todos los días de un mes.
 * @param year - El año
 * @param month - El mes (0-based, como Date.getMonth())
 */
export function* iterMonthDays(year: number, month: number): Generator<string> {
  const current = new Date(year, month, 1);
  while (current.getMonth() === month) {
    yield toServerDateStr(current);
    current.setDate(current.getDate() + 1);
  }
}
