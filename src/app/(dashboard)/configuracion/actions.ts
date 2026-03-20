"use server";

/**
 * Acciones de configuración del sistema (solo admin)
 *
 * Permite al administrador leer y modificar los valores de system_config.
 * Cada mutación invalida el cache de configuración para que los cambios
 * se reflejen inmediatamente en toda la aplicación.
 */

import { actionClient } from "@/lib/actions";
import { db } from "@/lib/db";
import { systemConfig, entityConfig } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/helpers";
import { revalidatePath } from "next/cache";
import { invalidateConfigCache } from "@/lib/config";
import { getActiveEntityId } from "@/lib/queries/active-entity";
import {
  updateGlobalConfigSchema,
  updateResourceConfigSchema,
  type UpdateResourceConfigInput,
} from "@/lib/validations";

// ─── Helper interno ───────────────────────────────────────────

/**
 * Actualiza (o inserta) múltiples claves en system_config.
 */
async function upsertConfigs(
  entries: Array<{ key: string; value: unknown }>,
  adminUserId: string
): Promise<void> {
  for (const { key, value } of entries) {
    await db
      .insert(systemConfig)
      .values({
        key,
        value: value as never,
        updatedBy: adminUserId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: {
          value: value as never,
          updatedBy: adminUserId,
          updatedAt: new Date(),
        },
      });
  }
}

/**
 * Actualiza (o inserta) múltiples claves en entity_config para la sede indicada.
 */
async function upsertEntityConfigs(
  entityId: string,
  entries: Array<{ key: string; value: unknown }>,
  adminUserId: string
): Promise<void> {
  for (const { key, value } of entries) {
    await db
      .insert(entityConfig)
      .values({
        entityId,
        key,
        value: value as never,
        updatedBy: adminUserId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [entityConfig.entityId, entityConfig.key],
        set: {
          value: value as never,
          updatedBy: adminUserId,
          updatedAt: new Date(),
        },
      });
  }
}

/**
 * Convierte un objeto de configuración de recurso al formato de filas
 * de system_config con prefijo.
 */
function resourceConfigToEntries(
  resourceType: "parking" | "office",
  config: UpdateResourceConfigInput
): Array<{ key: string; value: unknown }> {
  const prefix = `${resourceType}.`;
  return Object.entries(config).map(([key, value]) => ({
    key: `${prefix}${key}`,
    value,
  }));
}

// ─── Actualizar configuración global ─────────────────────────

export const updateGlobalConfig = actionClient
  .schema(updateGlobalConfigSchema)
  .action(async ({ parsedInput }) => {
    const adminUser = await requireAdmin();

    const entries = Object.entries(parsedInput).map(([key, value]) => ({
      key,
      value,
    }));

    await upsertConfigs(entries, adminUser.id);
    await invalidateConfigCache();
    revalidatePath("/configuracion/general");

    return { updated: true };
  });

// ─── Actualizar configuración de parking ─────────────────────

export const updateParkingConfig = actionClient
  .schema(updateResourceConfigSchema)
  .action(async ({ parsedInput }) => {
    const adminUser = await requireAdmin();
    const entityId = await getActiveEntityId();

    const entries = resourceConfigToEntries("parking", parsedInput);

    if (entityId) {
      await upsertEntityConfigs(entityId, entries, adminUser.id);
    } else {
      await upsertConfigs(entries, adminUser.id);
    }

    await invalidateConfigCache();
    revalidatePath("/configuracion/parking");
    revalidatePath("/parking");

    return { updated: true };
  });

// ─── Actualizar configuración de oficinas ────────────────────

export const updateOfficeConfig = actionClient
  .schema(updateResourceConfigSchema)
  .action(async ({ parsedInput }) => {
    const adminUser = await requireAdmin();
    const entityId = await getActiveEntityId();

    const entries = resourceConfigToEntries("office", parsedInput);

    if (entityId) {
      await upsertEntityConfigs(entityId, entries, adminUser.id);
    } else {
      await upsertConfigs(entries, adminUser.id);
    }

    await invalidateConfigCache();
    revalidatePath("/configuracion/oficinas");
    revalidatePath("/oficinas");

    return { updated: true };
  });
