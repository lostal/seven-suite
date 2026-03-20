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
} from "@/lib/validations";

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
          shortCode: parsedInput.short_code.toUpperCase(),
          isActive: parsedInput.is_active ?? true,
        })
        .returning({ id: entities.id });

      if (!entity) throw new Error("Error al crear la sede");

      revalidatePath("/administracion/entidades");
      return { id: entity.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (
        msg.includes("unique") ||
        msg.includes("duplicate") ||
        msg.includes("23505")
      ) {
        throw new Error("Ya existe una sede con ese nombre o código");
      }
      console.error("[entities] createEntity DB error:", msg);
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
    const { id, ...updates } = parsedInput;

    const updateValues: Partial<typeof entities.$inferInsert> = {};
    if (updates.name !== undefined) updateValues.name = updates.name;
    if (updates.short_code !== undefined)
      updateValues.shortCode = updates.short_code.toUpperCase();
    if (updates.is_active !== undefined)
      updateValues.isActive = updates.is_active;

    try {
      await db.update(entities).set(updateValues).where(eq(entities.id, id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (
        msg.includes("unique") ||
        msg.includes("duplicate") ||
        msg.includes("23505")
      ) {
        throw new Error("Ya existe una sede con ese nombre o código");
      }
      console.error("[entities] updateEntity DB error:", msg);
      throw new Error("Error al actualizar la sede");
    }

    revalidatePath("/administracion/entidades");
    return { updated: true };
  });

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
