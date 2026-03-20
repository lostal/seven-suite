"use server";

/**
 * Acciones de administración
 *
 * Server Actions exclusivas para administradores:
 * CRUD de plazas, gestión de roles de usuario y asignación de plazas.
 */

import { actionClient } from "@/lib/actions";
import { db } from "@/lib/db";
import { profiles, spots, users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { logAuditEvent } from "@/lib/audit";
import {
  createSpotSchema,
  updateSpotSchema,
  deleteSpotSchema,
  updateUserRoleSchema,
  assignSpotToUserSchema,
  deleteUserSchema,
} from "@/lib/validations";
import { getActiveEntityId } from "@/lib/queries/active-entity";
import { eq, and, ne } from "drizzle-orm";

// ─── Spot CRUD ───────────────────────────────────────────────

/**
 * Crea una nueva plaza.
 */
export const createSpot = actionClient
  .schema(createSpotSchema)
  .action(async ({ parsedInput }) => {
    await requireAdmin();
    const entityId = await getActiveEntityId();

    try {
      const [spot] = await db
        .insert(spots)
        .values({
          label: parsedInput.label,
          type: parsedInput.type,
          resourceType: parsedInput.resource_type,
          assignedTo: parsedInput.assigned_to ?? null,
          entityId: entityId ?? null,
        })
        .returning({ id: spots.id });

      if (!spot) throw new Error("Error al crear la plaza");

      revalidatePath("/administracion");
      revalidatePath("/parking/asignaciones");
      revalidatePath("/oficinas/asignaciones");
      revalidatePath("/parking");
      revalidatePath("/oficinas");
      return { id: spot.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (
        msg.includes("unique") ||
        msg.includes("duplicate") ||
        msg.includes("23505")
      ) {
        throw new Error(
          `Ya existe una plaza con la etiqueta "${parsedInput.label}"`
        );
      }
      console.error("[admin] createSpot DB error:", msg);
      throw new Error("Error al crear la plaza");
    }
  });

/**
 * Actualiza una plaza existente.
 */
export const updateSpot = actionClient
  .schema(updateSpotSchema)
  .action(async ({ parsedInput }) => {
    await requireAdmin();
    const activeEntityId = await getActiveEntityId();

    const { id, ...updates } = parsedInput;

    const [currentSpot] = await db
      .select({ id: spots.id, entityId: spots.entityId })
      .from(spots)
      .where(eq(spots.id, id))
      .limit(1);

    if (!currentSpot) throw new Error("Plaza no encontrada");

    // Verificar que el spot pertenece a la sede activa (o es global)
    if (activeEntityId) {
      if (
        currentSpot.entityId !== null &&
        currentSpot.entityId !== activeEntityId
      ) {
        throw new Error("No tienes permisos para modificar esta plaza");
      }
    }

    // Map snake_case input keys to camelCase schema columns
    const updateValues: Partial<typeof spots.$inferInsert> = {};
    if (updates.label !== undefined) updateValues.label = updates.label;
    if (updates.type !== undefined) updateValues.type = updates.type;
    if (updates.resource_type !== undefined)
      updateValues.resourceType = updates.resource_type;
    if (updates.is_active !== undefined)
      updateValues.isActive = updates.is_active;

    try {
      const updatedRows = await db
        .update(spots)
        .set(updateValues)
        .where(eq(spots.id, id))
        .returning({ id: spots.id });

      if (!updatedRows || updatedRows.length === 0) {
        throw new Error("Plaza no encontrada");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (
        msg.includes("unique") ||
        msg.includes("duplicate") ||
        msg.includes("23505")
      ) {
        throw new Error("Ya existe una plaza con esa etiqueta");
      }
      console.error("[admin] updateSpot DB error:", msg);
      throw new Error("Error al actualizar la plaza");
    }

    revalidatePath("/administracion");
    revalidatePath("/parking/asignaciones");
    revalidatePath("/oficinas/asignaciones");
    revalidatePath("/parking");
    revalidatePath("/oficinas");
    return { updated: true };
  });

/**
 * Elimina una plaza.
 * Elimina en cascada reservas y cesiones relacionadas (restricción de BD).
 */
export const deleteSpot = actionClient
  .schema(deleteSpotSchema)
  .action(async ({ parsedInput }) => {
    await requireAdmin();
    const activeEntityId = await getActiveEntityId();

    const [currentSpot] = await db
      .select({ id: spots.id, entityId: spots.entityId })
      .from(spots)
      .where(eq(spots.id, parsedInput.id))
      .limit(1);

    if (!currentSpot) throw new Error("Plaza no encontrada");

    // Verificar que el spot pertenece a la sede activa (o es global)
    if (activeEntityId) {
      if (
        currentSpot.entityId !== null &&
        currentSpot.entityId !== activeEntityId
      ) {
        throw new Error("No tienes permisos para eliminar esta plaza");
      }
    }

    const deletedRows = await db
      .delete(spots)
      .where(eq(spots.id, parsedInput.id))
      .returning({ id: spots.id });

    if (!deletedRows || deletedRows.length === 0) {
      throw new Error("Plaza no encontrada");
    }

    revalidatePath("/administracion");
    revalidatePath("/parking/asignaciones");
    revalidatePath("/oficinas/asignaciones");
    revalidatePath("/parking");
    revalidatePath("/oficinas");
    return { deleted: true };
  });

// ─── User Role Management ───────────────────────────────────

/**
 * Actualiza el rol de un usuario (solo administradores).
 */
export const updateUserRole = actionClient
  .schema(updateUserRoleSchema)
  .action(async ({ parsedInput }) => {
    const adminUser = await requireAdmin();
    const activeEntityId = await getActiveEntityId();

    // Verificar que el usuario objetivo pertenece a la sede activa
    if (activeEntityId) {
      const [targetProfile] = await db
        .select({ entityId: profiles.entityId })
        .from(profiles)
        .where(eq(profiles.id, parsedInput.user_id))
        .limit(1);
      if (
        targetProfile &&
        targetProfile.entityId !== null &&
        targetProfile.entityId !== activeEntityId
      ) {
        throw new Error("No tienes permisos para modificar este usuario");
      }
    }

    await db
      .update(profiles)
      .set({ role: parsedInput.role })
      .where(eq(profiles.id, parsedInput.user_id));

    await logAuditEvent("role.changed", "profile", parsedInput.user_id, {
      new_role: parsedInput.role,
      changed_by: adminUser.id,
    });

    return { updated: true };
  });

// ─── Assign Spot to User ──────────────────────────────────────────

/**
 * Asigna (o desasigna) una plaza a un usuario.
 */
export const assignSpotToUser = actionClient
  .schema(assignSpotToUserSchema)
  .action(async ({ parsedInput }) => {
    await requireAdmin();

    const { user_id, spot_id, resource_type } = parsedInput;

    // 1. If unassigning: clear only the spot of the given resource_type for this user
    if (!spot_id) {
      // Find current spot before clearing, for audit log
      const [currentSpot] = await db
        .select({ id: spots.id })
        .from(spots)
        .where(
          and(
            eq(spots.assignedTo, user_id),
            eq(spots.resourceType, resource_type)
          )
        )
        .limit(1);

      await db
        .update(spots)
        .set({ assignedTo: null })
        .where(
          and(
            eq(spots.assignedTo, user_id),
            eq(spots.resourceType, resource_type)
          )
        );

      if (currentSpot?.id) {
        await logAuditEvent("spot.unassigned", "spot", currentSpot.id, {
          user_id,
        });
      }
      return { assigned: false };
    }

    // 2. Validate spot
    const [spot] = await db
      .select({
        id: spots.id,
        type: spots.type,
        resourceType: spots.resourceType,
        assignedTo: spots.assignedTo,
        entityId: spots.entityId,
      })
      .from(spots)
      .where(eq(spots.id, spot_id))
      .limit(1);

    if (!spot) throw new Error("Plaza no encontrada");
    if (spot.type === "visitor") {
      throw new Error("No se pueden asignar plazas de visitas a usuarios");
    }
    if (spot.assignedTo && spot.assignedTo !== user_id) {
      throw new Error("Esa plaza ya está asignada a otro usuario");
    }

    // Verificar que el spot pertenece a la sede activa
    const activeEntityId = await getActiveEntityId();
    if (
      activeEntityId &&
      spot.entityId !== null &&
      spot.entityId !== activeEntityId
    ) {
      throw new Error("Esta plaza no pertenece a la sede activa");
    }

    // Verificar que el usuario objetivo pertenece a la sede activa
    if (activeEntityId) {
      const [targetProfile] = await db
        .select({ entityId: profiles.entityId })
        .from(profiles)
        .where(eq(profiles.id, user_id))
        .limit(1);
      if (
        targetProfile &&
        targetProfile.entityId !== null &&
        targetProfile.entityId !== activeEntityId
      ) {
        throw new Error("Este usuario no pertenece a la sede activa");
      }
    }

    // 3 & 4. Asignar nueva plaza y limpiar la anterior atómicamente
    await db.transaction(async (tx) => {
      await tx
        .update(spots)
        .set({ assignedTo: user_id })
        .where(eq(spots.id, spot_id));

      await tx
        .update(spots)
        .set({ assignedTo: null })
        .where(
          and(
            eq(spots.assignedTo, user_id),
            eq(spots.resourceType, spot.resourceType),
            ne(spots.id, spot_id)
          )
        );
    });

    // Audit log después de que la transacción se haya confirmado
    await logAuditEvent("spot.assigned", "spot", spot_id, {
      user_id,
      resource_type: spot.resourceType,
    });

    revalidatePath("/parking/asignaciones");
    revalidatePath("/oficinas/asignaciones");
    return { assigned: true };
  });

// ─── Assign User to Spot ──────────────────────────────────────────

/**
 * Asigna (o desasigna) un usuario a una plaza — perspectiva desde la plaza.
 */
export const assignUserToSpot = actionClient
  .schema(
    z.object({
      spot_id: z.string().uuid(),
      user_id: z.string().uuid().nullable(),
      resource_type: z.enum(["parking", "office"]),
    })
  )
  .action(async ({ parsedInput }) => {
    const { spot_id, user_id, resource_type } = parsedInput;
    await requireAdmin();

    if (!user_id) {
      await db
        .update(spots)
        .set({ assignedTo: null })
        .where(eq(spots.id, spot_id));
      revalidatePath("/parking/asignaciones");
      revalidatePath("/oficinas/asignaciones");
      return { assigned: false };
    }

    // Verificar que el spot pertenece a la sede activa
    const activeEntityId = await getActiveEntityId();
    if (activeEntityId) {
      const [spotRow] = await db
        .select({ entityId: spots.entityId })
        .from(spots)
        .where(eq(spots.id, spot_id))
        .limit(1);
      if (
        spotRow &&
        spotRow.entityId !== null &&
        spotRow.entityId !== activeEntityId
      ) {
        throw new Error("Esta plaza no pertenece a la sede activa");
      }

      const [targetProfile] = await db
        .select({ entityId: profiles.entityId })
        .from(profiles)
        .where(eq(profiles.id, user_id))
        .limit(1);

      if (
        targetProfile &&
        targetProfile.entityId !== null &&
        targetProfile.entityId !== activeEntityId
      ) {
        throw new Error("Este usuario no pertenece a la sede activa");
      }
    }

    // 1 & 2. Asignar usuario a esta plaza y limpiar la anterior atómicamente
    await db.transaction(async (tx) => {
      await tx
        .update(spots)
        .set({ assignedTo: user_id })
        .where(eq(spots.id, spot_id));

      await tx
        .update(spots)
        .set({ assignedTo: null })
        .where(
          and(
            eq(spots.assignedTo, user_id),
            eq(spots.resourceType, resource_type),
            ne(spots.id, spot_id)
          )
        );
    });

    revalidatePath("/parking/asignaciones");
    revalidatePath("/oficinas/asignaciones");
    return { assigned: true };
  });

// ─── Delete User Account ─────────────────────────────────────

/**
 * Elimina permanentemente una cuenta de usuario (cascade profile).
 */
export const deleteUser = actionClient
  .schema(deleteUserSchema)
  .action(async ({ parsedInput }) => {
    const adminUser = await requireAdmin();
    const activeEntityId = await getActiveEntityId();

    // Verificar que el usuario objetivo pertenece a la sede activa
    if (activeEntityId) {
      const [targetProfile] = await db
        .select({ entityId: profiles.entityId })
        .from(profiles)
        .where(eq(profiles.id, parsedInput.user_id))
        .limit(1);
      if (
        targetProfile &&
        targetProfile.entityId !== null &&
        targetProfile.entityId !== activeEntityId
      ) {
        throw new Error("No tienes permisos para eliminar este usuario");
      }
    }

    // Delete the user — cascade will remove profile and all related data
    const deleted = await db
      .delete(users)
      .where(eq(users.id, parsedInput.user_id))
      .returning({ id: users.id });

    if (!deleted || deleted.length === 0) {
      throw new Error("Usuario no encontrado");
    }

    await logAuditEvent("user.deleted", "user", parsedInput.user_id, {
      deleted_by: adminUser.id,
    });

    return { deleted: true };
  });
