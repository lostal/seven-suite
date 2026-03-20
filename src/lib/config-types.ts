/**
 * Tipos públicos de la capa de configuración.
 *
 * Este fichero se importa tanto en Server Components como en Client Components.
 * No contiene ningún import de APIs server-only (`next/cache`, `createAdminClient`, etc.)
 * para evitar que Turbopack los incluya en el bundle del cliente.
 */

import type { ResourceType } from "@/lib/db/types";

// ─── Claves de configuración ──────────────────────────────────

/** Claves globales (sin prefijo de recurso) */
export type GlobalConfigKey =
  | "notifications_enabled"
  | "email_notifications_enabled"
  | "teams_notifications_enabled";

/** Claves por tipo de recurso (sin prefijo) */
export type ResourceConfigKey =
  | "booking_enabled"
  | "visitor_booking_enabled"
  | "allowed_days"
  | "max_advance_days"
  | "max_consecutive_days"
  | "max_weekly_reservations"
  | "max_monthly_reservations"
  | "time_slots_enabled"
  | "slot_duration_minutes"
  | "day_start_hour"
  | "day_end_hour"
  | "cession_enabled"
  | "cession_min_advance_hours"
  | "cession_max_per_week"
  | "auto_cession_enabled"
  | "max_daily_reservations";

/** Claves de módulos ERP (sin prefijo) */
export type ModuleConfigKey =
  | "enabled"
  | "max_leave_days_year"
  | "require_hr_approval"
  | "allowed_leave_types"
  | "payslip_storage_bucket"
  | "tablon_allow_entity_scope";

/** Clave completa en la BD (con prefijo de recurso o módulo) */
export type FullConfigKey =
  | GlobalConfigKey
  | `parking.${ResourceConfigKey}`
  | `office.${ResourceConfigKey}`
  | `nominas.${ModuleConfigKey}`
  | `vacaciones.${ModuleConfigKey}`
  | `tablon.${ModuleConfigKey}`;

// ─── Tipos de valor ───────────────────────────────────────────

export interface ResourceConfigValues {
  booking_enabled: boolean;
  visitor_booking_enabled: boolean;
  allowed_days: number[]; // 0=Dom, 1=Lun, ..., 6=Sáb
  /** null = sin límite de antelación */
  max_advance_days: number | null;
  /** null = sin límite de días consecutivos */
  max_consecutive_days: number | null;
  /** null = sin límite semanal */
  max_weekly_reservations: number | null;
  /** null = sin límite mensual */
  max_monthly_reservations: number | null;
  time_slots_enabled: boolean;
  slot_duration_minutes: number | null;
  day_start_hour: number | null;
  day_end_hour: number | null;
  cession_enabled: boolean;
  cession_min_advance_hours: number;
  cession_max_per_week: number;
  auto_cession_enabled: boolean;
  /** null = sin límite diario */
  max_daily_reservations: number | null;
}

export interface GlobalConfigValues {
  notifications_enabled: boolean;
  email_notifications_enabled: boolean;
  teams_notifications_enabled: boolean;
}

// Re-export ResourceType para que los consumers no necesiten importarlo por separado
export type { ResourceType };
