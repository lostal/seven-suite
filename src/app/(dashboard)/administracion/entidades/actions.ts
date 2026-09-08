"use server";

/**
 * Acciones de gestión de sedes/entidades
 *
 * Server Actions exclusivas para administradores:
 * CRUD de entidades y gestión de módulos por sede.
 */

import { actionClient } from "@/lib/actions";
import { db } from "@/lib/db";
import { entities, entityModules } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/helpers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import {
  createEntitySchema,
  updateEntitySchema,
  deleteEntitySchema,
  toggleEntityModuleSchema,
  ENTITY_MODULES,
} from "@/lib/validations";
import { isUniqueViolation } from "@/lib/db/helpers";
import { AUTONOMOUS_COMMUNITIES } from "@/lib/constants";
import { getEntityEnabledModules } from "@/lib/queries/entities";

function buildShortCode(name: string, ccaaCode?: string | null): string {
  const normalized = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();

  if (ccaaCode) {
    const cc = AUTONOMOUS_COMMUNITIES.find((c) => c.code === ccaaCode);
    if (cc) {
      const words = cc.name.trim().split(/\s+/);
      const lastWord = words[words.length - 1] ?? cc.name;
      const ccaaPart = normalized(lastWord).slice(0, 3);
      const entityFirst = normalized(name.trim()[0] ?? "X");
      return `${ccaaPart}-${entityFirst}`;
    }
  }
  // Fallback: first 5 chars of name
  return normalized(name.replace(/\s+/g, "")).slice(0, 5);
}

// ─── Entity CRUD ──────────────────────────────────────────────

/**
 * Crea una nueva sede.
 */
export const createEntity = actionClient
  .schema(createEntitySchema)
  .action(async ({ parsedInput }) => {
    await requireAdmin();
    try {
      const [entity] = await db
        .insert(entities)
        .values({
          name: parsedInput.name,
          shortCode: buildShortCode(
            parsedInput.name,
            parsedInput.autonomous_community
          ),
          isActive: parsedInput.is_active ?? true,
          autonomousCommunity: parsedInput.autonomous_community ?? null,
        })
        .returning({ id: entities.id });

      if (!entity) throw new Error("Error al crear la sede");

      revalidatePath("/administracion/entidades");
      return { id: entity.id };
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new Error("Ya existe una sede con ese nombre o código");
      }
      console.error("[entities] createEntity DB error:", err);
      throw new Error("Error al crear la sede");
    }
  });

/**
 * Actualiza una sede existente.
 */
export const updateEntity = actionClient
  .schema(updateEntitySchema)
  .action(async ({ parsedInput }) => {
    await requireAdmin();
    const { id, name, is_active, autonomous_community } = parsedInput;

    const updateValues: Partial<typeof entities.$inferInsert> = {};
    if (name !== undefined) updateValues.name = name;
    if (is_active !== undefined) updateValues.isActive = is_active;
    if (autonomous_community !== undefined)
      updateValues.autonomousCommunity = autonomous_community ?? null;

    try {
      await db.update(entities).set(updateValues).where(eq(entities.id, id));
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new Error("Ya existe una sede con ese nombre o código");
      }
      console.error("[entities] updateEntity DB error:", err);
      throw new Error("Error al actualizar la sede");
    }

    revalidatePath("/administracion/entidades");
    return { updated: true };
  });

/**
 * Devuelve el estado actual de módulos para una sede (Record<module, enabled>).
 */
export async function getEntityModuleStates(
  entityId: string
): Promise<Record<string, boolean>> {
  await requireAdmin();
  const enabled = await getEntityEnabledModules(entityId);
  return Object.fromEntries(
    ENTITY_MODULES.map((m) => [m, enabled.includes(m)])
  );
}

/**
 * Elimina una sede.
 */
export const deleteEntity = actionClient
  .schema(deleteEntitySchema)
  .action(async ({ parsedInput }) => {
    await requireAdmin();
    try {
      await db.delete(entities).where(eq(entities.id, parsedInput.id));
    } catch (err) {
      console.error("[entities] deleteEntity DB error:", err);
      throw new Error("Error al eliminar la sede");
    }
    revalidatePath("/administracion/entidades");
    return { deleted: true };
  });

/**
 * Activa o desactiva un módulo para una sede.
 */
export const toggleEntityModule = actionClient
  .schema(toggleEntityModuleSchema)
  .action(async ({ parsedInput }) => {
    await requireAdmin();
    const { entity_id, module, enabled } = parsedInput;
    try {
      await db
        .insert(entityModules)
        .values({ entityId: entity_id, module, enabled })
        .onConflictDoUpdate({
          target: [entityModules.entityId, entityModules.module],
          set: { enabled },
        });
    } catch (err) {
      console.error("[entities] toggleEntityModule DB error:", err);
      throw new Error("Error al actualizar el módulo");
    }
    revalidatePath("/administracion/entidades");
    return { updated: true };
  });
