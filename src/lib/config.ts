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
import { db } from "@/lib/db";
import {
  systemConfig as systemConfigTable,
  entityConfig as entityConfigTable,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Los tipos públicos están en config-types.ts para que los componentes cliente
// puedan importarlos sin arrastrar las dependencias server-only de este fichero.
export type {
  GlobalConfigKey,
  ResourceConfigKey,
  ModuleConfigKey,
  FullConfigKey,
  ResourceConfigValues,
  GlobalConfigValues,
} from "./config-types";
import type {
  ResourceConfigKey,
  ResourceConfigValues,
  GlobalConfigValues,
} from "./config-types";
import type { ResourceType } from "@/lib/db/types";

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
const ENTITY_CONFIG_CACHE_TAG = "entity-config";

// ─── Funciones de acceso ──────────────────────────────────────

/**
 * Carga todas las filas de system_config desde la BD.
 * El resultado se cachea con el tag `system-config`.
 * Se invalida llamando a `revalidateTag(CONFIG_CACHE_TAG)`.
 */
const fetchRawConfigs = unstable_cache(
  async (): Promise<Record<string, unknown>> => {
    try {
      const rows = await db
        .select({ key: systemConfigTable.key, value: systemConfigTable.value })
        .from(systemConfigTable);

      return Object.fromEntries(rows.map((row) => [row.key, row.value]));
    } catch (error) {
      console.error("[config] Error fetching system_config:", error);
      return {};
    }
  },
  ["system-config-all"],
  {
    tags: [CONFIG_CACHE_TAG],
    revalidate: 60, // 1 minuto como máximo aunque no se invalide explícitamente
  }
);

const toBooleanConfig = (rawVal: unknown): boolean =>
  rawVal === true || rawVal === 1;

/**
 * Devuelve todas las configuraciones de un tipo de recurso como un objeto tipado.
 * Si se proporciona `entityId`, aplica el overlay de `entity_config` sobre `system_config`.
 * Prioridad: entity_config > system_config > defaults.
 */
export async function getAllResourceConfigs(
  resourceType: ResourceType,
  entityId?: string | null
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
      result[_key] = toBooleanConfig(rawVal);
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

  // Aplicar overlay de entity_config si se especificó una sede
  if (entityId) {
    const entityRaw = await fetchEntityConfigs(entityId);
    for (const _key of Object.keys(result) as Array<
      keyof ResourceConfigValues
    >) {
      const fullKey = `${prefix}${_key}`;
      if (entityRaw[fullKey] !== undefined) {
        // @ts-expect-error – JSONB values are already the correct runtime type
        result[_key] = entityRaw[fullKey];
      }
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
        ? toBooleanConfig(raw["notifications_enabled"])
        : GLOBAL_DEFAULTS.notifications_enabled,

    email_notifications_enabled:
      raw["email_notifications_enabled"] !== undefined
        ? toBooleanConfig(raw["email_notifications_enabled"])
        : GLOBAL_DEFAULTS.email_notifications_enabled,

    teams_notifications_enabled:
      raw["teams_notifications_enabled"] !== undefined
        ? toBooleanConfig(raw["teams_notifications_enabled"])
        : GLOBAL_DEFAULTS.teams_notifications_enabled,
  };
}

/**
 * Devuelve una sola clave de configuración de recurso con tipo inferido.
 * Si se proporciona `entityId`, aplica el overlay de `entity_config`.
 */
export async function getResourceConfig<K extends ResourceConfigKey>(
  resourceType: ResourceType,
  key: K,
  entityId?: string | null
): Promise<ResourceConfigValues[K]> {
  const config = await getAllResourceConfigs(resourceType, entityId);
  return config[key];
}

/**
 * Invalida el cache de configuración.
 * Debe llamarse después de cada mutación en system_config.
 */
export async function invalidateConfigCache(): Promise<void> {
  revalidateTag(CONFIG_CACHE_TAG, "default");
}

export async function invalidateEntityConfigCache(): Promise<void> {
  revalidateTag(ENTITY_CONFIG_CACHE_TAG, "default");
}

// ─── Configuración por entidad (entity_config) ───────────────

/**
 * Carga todas las filas de entity_config para una entidad concreta.
 * Cacheada por entityId con el tag `entity-config`. Se invalida al
 * escribir en entity_config desde las acciones de configuración.
 */
const fetchEntityConfigs = unstable_cache(
  async (entityId: string): Promise<Record<string, unknown>> => {
    try {
      const rows = await db
        .select({ key: entityConfigTable.key, value: entityConfigTable.value })
        .from(entityConfigTable)
        .where(eq(entityConfigTable.entityId, entityId));

      return Object.fromEntries(rows.map((row) => [row.key, row.value]));
    } catch (error) {
      console.error("[config] Error fetching entity_config:", error);
      return {};
    }
  },
  ["entity-config"],
  {
    tags: [ENTITY_CONFIG_CACHE_TAG],
    revalidate: 60,
  }
);
