"use server";

/**
 * Acciones de administración
 *
 * Server Actions exclusivas para administradores:
 * CRUD de plazas, gestión de roles de usuario y asignación de plazas.
 */

import { actionClient } from "@/lib/actions";
import { db } from "@/lib/db";
import { profiles, reservations, spots, users } from "@/lib/db/schema";
import { requireAdmin, requireManagerOrAbove } from "@/lib/auth/helpers";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import {
  createSpotSchema,
  updateSpotSchema,
  deleteSpotSchema,
  updateUserRoleSchema,
  assignSpotToUserSchema,
  assignUserToSpotSchema,
  deleteUserSchema,
} from "@/lib/validations";
import { getActiveEntityId } from "@/lib/queries/active-entity";
import { isUniqueViolation } from "@/lib/db/helpers";
import { eq, and, isNull, ne } from "drizzle-orm";

type ManagementScope = Awaited<ReturnType<typeof requireManagerOrAbove>> & {
  entityId: string | null;
};

async function getManagementScope(): Promise<ManagementScope> {
  const user = await requireManagerOrAbove();
  if (user.profile?.role === "admin") {
    return { ...user, entityId: await getActiveEntityId() };
  }
  if (!user.profile?.entityId) {
    throw new Error("Tu usuario no tiene una sede asignada");
  }
  return { ...user, entityId: user.profile.entityId };
}

function assertEntityAccess(
  entityId: string | null,
  scope: ManagementScope,
  message: string
) {
  if (scope.profile?.role !== "admin" && entityId !== scope.entityId) {
    throw new Error(message);
  }
}

// ─── Spot CRUD ───────────────────────────────────────────────

/**
 * Crea una nueva plaza.
 */
export const createSpot = actionClient
  .schema(createSpotSchema)
  .action(async ({ parsedInput }) => {
    const scope = await getManagementScope();
    const entityId = scope.entityId;

    if (parsedInput.assigned_to) {
      if (parsedInput.type === "visitor") {
        throw new Error("Las plazas de visitas no se pueden asignar");
      }
      const [target] = await db
        .select({ entityId: profiles.entityId })
        .from(profiles)
        .where(eq(profiles.id, parsedInput.assigned_to))
        .limit(1);
      if (!target) throw new Error("Usuario no encontrado");
      assertEntityAccess(
        target.entityId,
        scope,
        "Este usuario no pertenece a tu sede"
      );
    }

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
      if (isUniqueViolation(err)) {
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
    const scope = await getManagementScope();

    const { id, ...updates } = parsedInput;

    const [currentSpot] = await db
      .select({
        id: spots.id,
        entityId: spots.entityId,
        resourceType: spots.resourceType,
      })
      .from(spots)
      .where(eq(spots.id, id))
      .limit(1);

    if (!currentSpot) throw new Error("Plaza no encontrada");

    assertEntityAccess(
      currentSpot.entityId,
      scope,
      "No tienes permisos para modificar esta plaza"
    );

    // Map snake_case input keys to camelCase schema columns
    const updateValues: Partial<typeof spots.$inferInsert> = {};
    if (updates.label !== undefined) updateValues.label = updates.label;
    if (updates.type !== undefined) updateValues.type = updates.type;
    if (updates.resource_type !== undefined)
      if (updates.resource_type !== currentSpot.resourceType) {
        const [existingReservation] = await db
          .select({ id: reservations.id })
          .from(reservations)
          .where(eq(reservations.spotId, id))
          .limit(1);
        if (existingReservation) {
          throw new Error(
            "No se puede cambiar el tipo de recurso de una plaza con reservas"
          );
        }
      }
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
      if (isUniqueViolation(err)) {
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
 * Desactiva una plaza sin borrar su historial de reservas y cesiones.
 */
export const deleteSpot = actionClient
  .schema(deleteSpotSchema)
  .action(async ({ parsedInput }) => {
    const scope = await getManagementScope();

    const [currentSpot] = await db
      .select({ id: spots.id, entityId: spots.entityId })
      .from(spots)
      .where(eq(spots.id, parsedInput.id))
      .limit(1);

    if (!currentSpot) throw new Error("Plaza no encontrada");

    assertEntityAccess(
      currentSpot.entityId,
      scope,
      "No tienes permisos para eliminar esta plaza"
    );

    const deletedRows = await db
      .update(spots)
      .set({ isActive: false, assignedTo: null })
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
    const [targetProfile] = await db
      .select({ id: profiles.id, role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, parsedInput.user_id))
      .limit(1);
    if (!targetProfile) throw new Error("Usuario no encontrado");

    if (parsedInput.user_id === adminUser.id && parsedInput.role !== "admin") {
      throw new Error(
        "No puedes quitarte tus propios permisos de administrador"
      );
    }
    await db.transaction(async (tx) => {
      if (parsedInput.role !== "admin" && targetProfile.role === "admin") {
        const admins = await tx
          .select({ id: profiles.id })
          .from(profiles)
          .where(eq(profiles.role, "admin"))
          .for("update");
        if (admins.length <= 1) {
          throw new Error("Debe existir al menos un administrador");
        }
      }

      await tx
        .update(profiles)
        .set({ role: parsedInput.role })
        .where(eq(profiles.id, parsedInput.user_id));
    });

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
    const scope = await getManagementScope();

    const { user_id, spot_id, resource_type } = parsedInput;

    // 1. If unassigning: clear only the spot of the given resource_type for this user
    if (!spot_id) {
      // Find current spot before clearing, for audit log
      const [targetProfile] = await db
        .select({ id: profiles.id, entityId: profiles.entityId })
        .from(profiles)
        .where(eq(profiles.id, user_id))
        .limit(1);
      if (!targetProfile) throw new Error("Usuario no encontrado");
      assertEntityAccess(
        targetProfile.entityId,
        scope,
        "Este usuario no pertenece a tu sede"
      );
      const conditions = [
        eq(spots.assignedTo, user_id),
        eq(spots.resourceType, resource_type),
        ...(scope.profile?.role === "admin"
          ? []
          : [eq(spots.entityId, scope.entityId!)]),
      ];
      const [currentSpot] = await db
        .select({ id: spots.id })
        .from(spots)
        .where(and(...conditions))
        .limit(1);

      await db
        .update(spots)
        .set({ assignedTo: null })
        .where(and(...conditions));

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
    if (spot.resourceType !== resource_type) {
      throw new Error("El tipo de recurso no coincide con la plaza");
    }
    if (spot.assignedTo && spot.assignedTo !== user_id) {
      throw new Error("Esa plaza ya está asignada a otro usuario");
    }

    assertEntityAccess(
      spot.entityId,
      scope,
      "Esta plaza no pertenece a tu sede"
    );
    const [targetProfile] = await db
      .select({ entityId: profiles.entityId })
      .from(profiles)
      .where(eq(profiles.id, user_id))
      .limit(1);
    if (!targetProfile) throw new Error("Usuario no encontrado");
    assertEntityAccess(
      targetProfile.entityId,
      scope,
      "Este usuario no pertenece a tu sede"
    );

    // 3 & 4. Asignar nueva plaza y limpiar la anterior atómicamente
    await db.transaction(async (tx) => {
      const assigned = await tx
        .update(spots)
        .set({ assignedTo: user_id })
        .where(
          and(
            eq(spots.id, spot_id),
            ...(scope.profile?.role === "admin"
              ? []
              : [eq(spots.entityId, scope.entityId!)]),
            // Do not overwrite a concurrent assignment.
            spot.assignedTo
              ? eq(spots.assignedTo, user_id)
              : isNull(spots.assignedTo)
          )
        )
        .returning({ id: spots.id });
      if (assigned.length === 0) {
        throw new Error("La plaza ya no está disponible");
      }

      await tx
        .update(spots)
        .set({ assignedTo: null })
        .where(
          and(
            eq(spots.assignedTo, user_id),
            eq(spots.resourceType, spot.resourceType),
            ne(spots.id, spot_id),
            ...(scope.profile?.role === "admin"
              ? []
              : [eq(spots.entityId, scope.entityId!)])
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
  .schema(assignUserToSpotSchema)
  .action(async ({ parsedInput }) => {
    const { spot_id, user_id, resource_type } = parsedInput;
    const scope = await getManagementScope();

    if (!user_id) {
      const [spot] = await db
        .select({ entityId: spots.entityId, resourceType: spots.resourceType })
        .from(spots)
        .where(eq(spots.id, spot_id))
        .limit(1);
      if (!spot) throw new Error("Plaza no encontrada");
      if (spot.resourceType !== resource_type)
        throw new Error("El tipo de recurso no coincide con la plaza");
      assertEntityAccess(
        spot.entityId,
        scope,
        "Esta plaza no pertenece a tu sede"
      );
      const cleared = await db
        .update(spots)
        .set({ assignedTo: null })
        .where(
          and(
            eq(spots.id, spot_id),
            ...(scope.profile?.role === "admin"
              ? []
              : [eq(spots.entityId, scope.entityId!)]),
            eq(spots.resourceType, resource_type)
          )
        )
        .returning({ id: spots.id });
      if (cleared.length === 0)
        throw new Error("La plaza no se pudo desasignar");
      revalidatePath("/parking/asignaciones");
      revalidatePath("/oficinas/asignaciones");
      return { assigned: false };
    }

    const [spotRow] = await db
      .select({
        entityId: spots.entityId,
        resourceType: spots.resourceType,
        assignedTo: spots.assignedTo,
      })
      .from(spots)
      .where(eq(spots.id, spot_id))
      .limit(1);
    if (!spotRow) throw new Error("Plaza no encontrada");
    if (spotRow.resourceType !== resource_type)
      throw new Error("El tipo de recurso no coincide con la plaza");
    if (spotRow.assignedTo && spotRow.assignedTo !== user_id) {
      throw new Error("Esa plaza ya está asignada a otro usuario");
    }
    assertEntityAccess(
      spotRow.entityId,
      scope,
      "Esta plaza no pertenece a tu sede"
    );
    const [targetProfile] = await db
      .select({ entityId: profiles.entityId })
      .from(profiles)
      .where(eq(profiles.id, user_id))
      .limit(1);

    if (!targetProfile) throw new Error("Usuario no encontrado");
    assertEntityAccess(
      targetProfile.entityId,
      scope,
      "Este usuario no pertenece a tu sede"
    );

    // 1 & 2. Asignar usuario a esta plaza y limpiar la anterior atómicamente
    await db.transaction(async (tx) => {
      const assigned = await tx
        .update(spots)
        .set({ assignedTo: user_id })
        .where(
          and(
            eq(spots.id, spot_id),
            eq(spots.resourceType, resource_type),
            ...(scope.profile?.role === "admin"
              ? []
              : [eq(spots.entityId, scope.entityId!)]),
            spotRow.assignedTo
              ? eq(spots.assignedTo, user_id)
              : isNull(spots.assignedTo)
          )
        )
        .returning({ id: spots.id });
      if (assigned.length === 0)
        throw new Error("La plaza ya no está disponible");

      await tx
        .update(spots)
        .set({ assignedTo: null })
        .where(
          and(
            eq(spots.assignedTo, user_id),
            eq(spots.resourceType, resource_type),
            ne(spots.id, spot_id),
            ...(scope.profile?.role === "admin"
              ? []
              : [eq(spots.entityId, scope.entityId!)])
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

    if (parsedInput.user_id === adminUser.id) {
      throw new Error("No puedes eliminar tu propia cuenta");
    }
    const [targetProfile] = await db
      .select({ role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, parsedInput.user_id))
      .limit(1);
    if (!targetProfile) throw new Error("Usuario no encontrado");
    const deleted = await db.transaction(async (tx) => {
      if (targetProfile.role === "admin") {
        const admins = await tx
          .select({ id: profiles.id })
          .from(profiles)
          .where(eq(profiles.role, "admin"))
          .for("update");
        if (admins.length <= 1) {
          throw new Error("Debe existir al menos un administrador");
        }
      }

      return tx
        .delete(users)
        .where(eq(users.id, parsedInput.user_id))
        .returning({ id: users.id });
    });

    if (!deleted || deleted.length === 0) {
      throw new Error("Usuario no encontrado");
    }

    await logAuditEvent("user.deleted", "user", parsedInput.user_id, {
      deleted_by: adminUser.id,
    });

    return { deleted: true };
  });
