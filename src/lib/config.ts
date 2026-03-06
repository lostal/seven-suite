/**
 * System Configuration Layer
 *
 * Capa tipada de acceso a la configuración del sistema almacenada en `system_config`.
 * Todas las claves conocidas están definidas con sus tipos y valores por defecto,
 * garantizando que la aplicación siempre tenga un valor válido incluso si la BD
 * no contiene la clave (fallback a CONFIG_DEFAULTS).
 *
 * Uso típico en Server Components / Actions:
 *   const maxDays = await getResourceConfig('parking', 'max_advance_days');
 *   const config  = await getAllResourceConfigs('office');
 */

import { unstable_cache, revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ResourceType } from "@/lib/supabase/types";

// ─── Definición de claves de configuración ────────────────────

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

/** Clave completa en la BD (con prefijo de recurso) */
export type FullConfigKey =
  | GlobalConfigKey
  | `parking.${ResourceConfigKey}`
  | `office.${ResourceConfigKey}`;

// ─── Tipos de valor por clave ─────────────────────────────────

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

// ─── Valores por defecto ──────────────────────────────────────

const PARKING_DEFAULTS: ResourceConfigValues = {
  booking_enabled: true,
  visitor_booking_enabled: true,
  allowed_days: [1, 2, 3, 4, 5],
  max_advance_days: 14,
  max_consecutive_days: 5,
  max_weekly_reservations: 5,
  max_monthly_reservations: 20,
  max_daily_reservations: 1,
  time_slots_enabled: false,
  slot_duration_minutes: null,
  day_start_hour: null,
  day_end_hour: null,
  cession_enabled: true,
  cession_min_advance_hours: 24,
  cession_max_per_week: 5,
  auto_cession_enabled: false,
};

const OFFICE_DEFAULTS: ResourceConfigValues = {
  booking_enabled: true,
  visitor_booking_enabled: false,
  allowed_days: [1, 2, 3, 4, 5],
  max_advance_days: 7,
  max_consecutive_days: 3,
  max_weekly_reservations: 10,
  max_monthly_reservations: 40,
  max_daily_reservations: 2,
  time_slots_enabled: true,
  slot_duration_minutes: 60,
  day_start_hour: 8,
  day_end_hour: 20,
  cession_enabled: true,
  cession_min_advance_hours: 24,
  cession_max_per_week: 5,
  auto_cession_enabled: false,
};

const GLOBAL_DEFAULTS: GlobalConfigValues = {
  notifications_enabled: true,
  email_notifications_enabled: true,
  teams_notifications_enabled: true,
};

const RESOURCE_DEFAULTS: Record<ResourceType, ResourceConfigValues> = {
  parking: PARKING_DEFAULTS,
  office: OFFICE_DEFAULTS,
};

// ─── Cache tag ────────────────────────────────────────────────

export const CONFIG_CACHE_TAG = "system-config";

// ─── Funciones de acceso ──────────────────────────────────────

/**
 * Carga todas las filas de system_config desde la BD.
 * El resultado se cachea con el tag `system-config`.
 * Se invalida llamando a `revalidateTag(CONFIG_CACHE_TAG)`.
 */
const fetchRawConfigs = unstable_cache(
  async (): Promise<Record<string, unknown>> => {
    // createAdminClient no usa cookies() y el service role bypassa RLS → compatible con unstable_cache
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("system_config")
      .select("key, value");

    if (error) {
      console.error("[config] Error fetching system_config:", error.message);
      return {};
    }

    return Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
  },
  ["system-config-all"],
  {
    tags: [CONFIG_CACHE_TAG],
    revalidate: 60, // 1 minuto como máximo aunque no se invalide explícitamente
  }
);

/**
 * Devuelve todas las configuraciones de un tipo de recurso como un objeto tipado.
 * Si una clave no existe en la BD, usa el valor por defecto de RESOURCE_DEFAULTS.
 */
export async function getAllResourceConfigs(
  resourceType: ResourceType
): Promise<ResourceConfigValues> {
  const raw = await fetchRawConfigs();
  const defaults = RESOURCE_DEFAULTS[resourceType];
  const prefix = `${resourceType}.` as const;

  const result = {} as ResourceConfigValues;

  for (const _key of Object.keys(defaults) as Array<
    keyof ResourceConfigValues
  >) {
    const fullKey = `${prefix}${_key}`;
    const rawVal = raw[fullKey];
    const defVal = defaults[_key];

    if (rawVal === undefined) {
      // @ts-expect-error – iterando claves genéricas; el tipo es correcto en runtime
      result[_key] = defVal;
    } else if (Array.isArray(defVal)) {
      // @ts-expect-error – idem
      result[_key] = Array.isArray(rawVal) ? rawVal : defVal;
    } else if (typeof defVal === "boolean") {
      // @ts-expect-error – idem
      result[_key] = rawVal === true || rawVal === 1;
    } else if (typeof defVal === "number" || defVal === null) {
      // null explícito en BD = "sin límite"; undefined ya fue gestionado arriba
      // @ts-expect-error – idem
      result[_key] =
        rawVal === null ? null : typeof rawVal === "number" ? rawVal : defVal;
    } else {
      // null | number | string — conservar el valor raw o el default
      // @ts-expect-error – idem
      result[_key] = rawVal ?? defVal;
    }
  }

  return result;
}

/**
 * Devuelve la configuración global del sistema.
 */
export async function getGlobalConfigs(): Promise<GlobalConfigValues> {
  const raw = await fetchRawConfigs();

  return {
    notifications_enabled:
      raw["notifications_enabled"] !== undefined
        ? raw["notifications_enabled"] === true ||
          raw["notifications_enabled"] === 1
        : GLOBAL_DEFAULTS.notifications_enabled,

    email_notifications_enabled:
      raw["email_notifications_enabled"] !== undefined
        ? raw["email_notifications_enabled"] === true ||
          raw["email_notifications_enabled"] === 1
        : GLOBAL_DEFAULTS.email_notifications_enabled,

    teams_notifications_enabled:
      raw["teams_notifications_enabled"] !== undefined
        ? raw["teams_notifications_enabled"] === true ||
          raw["teams_notifications_enabled"] === 1
        : GLOBAL_DEFAULTS.teams_notifications_enabled,
  };
}

/**
 * Devuelve una sola clave de configuración de recurso con tipo inferido.
 */
export async function getResourceConfig<K extends ResourceConfigKey>(
  resourceType: ResourceType,
  key: K
): Promise<ResourceConfigValues[K]> {
  const config = await getAllResourceConfigs(resourceType);
  return config[key];
}

/**
 * Invalida el cache de configuración.
 * Debe llamarse después de cada mutación en system_config.
 */
export async function invalidateConfigCache(): Promise<void> {
  // Second arg 'default' required by Next.js 16 internal cache layer — do not remove
  revalidateTag(CONFIG_CACHE_TAG, "default");
}
