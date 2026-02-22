"use server";

/**
 * Acciones de administración
 *
 * Server Actions exclusivas para administradores:
 * CRUD de plazas, gestión de roles de usuario y asignación de plazas.
 */

import { actionClient } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { revalidatePath } from "next/cache";
import {
  createSpotSchema,
  updateSpotSchema,
  deleteSpotSchema,
  updateUserRoleSchema,
  assignSpotToUserSchema,
  deleteUserSchema,
} from "@/lib/validations";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── Spot CRUD ───────────────────────────────────────────────

/**
 * Crea una nueva plaza de aparcamiento.
 */
export const createSpot = actionClient
  .schema(createSpotSchema)
  .action(async ({ parsedInput }) => {
    await requireAdmin();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("spots")
      .insert({
        label: parsedInput.label,
        type: parsedInput.type,
        assigned_to: parsedInput.assigned_to ?? null,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error(
          `Ya existe una plaza con la etiqueta "${parsedInput.label}"`
        );
      }
      throw new Error(`Error al crear plaza: ${error.message}`);
    }

    revalidatePath("/administracion");
    return { id: data.id };
  });

/**
 * Actualiza una plaza de aparcamiento existente.
 */
export const updateSpot = actionClient
  .schema(updateSpotSchema)
  .action(async ({ parsedInput }) => {
    await requireAdmin();
    const supabase = await createClient();

    const { id, ...updates } = parsedInput;

    const { error } = await supabase.from("spots").update(updates).eq("id", id);

    if (error) {
      if (error.code === "23505") {
        throw new Error("Ya existe una plaza con esa etiqueta");
      }
      throw new Error(`Error al actualizar plaza: ${error.message}`);
    }

    revalidatePath("/administracion");
    return { updated: true };
  });

/**
 * Elimina una plaza de aparcamiento.
 * Elimina en cascada reservas y cesiones relacionadas (restricción de BD).
 */
export const deleteSpot = actionClient
  .schema(deleteSpotSchema)
  .action(async ({ parsedInput }) => {
    await requireAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("spots")
      .delete()
      .eq("id", parsedInput.id);

    if (error) {
      throw new Error(`Error al eliminar plaza: ${error.message}`);
    }

    revalidatePath("/administracion");
    return { deleted: true };
  });

// ─── User Role Management ───────────────────────────────────

/**
 * Actualiza el rol de un usuario (solo administradores).
 */
export const updateUserRole = actionClient
  .schema(updateUserRoleSchema)
  .action(async ({ parsedInput }) => {
    await requireAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("profiles")
      .update({ role: parsedInput.role })
      .eq("id", parsedInput.user_id);

    if (error) {
      throw new Error(`Error al actualizar rol: ${error.message}`);
    }

    revalidatePath("/administracion/usuarios");
    return { updated: true };
  });

// ─── Assign Spot to Management User ─────────────────────────

/**
 * Asigna (o desasigna) una plaza de dirección a un usuario.
 *
 * Reglas:
 *   - Solo se pueden asignar plazas de tipo dirección.
 *   - Una plaza solo puede estar asignada a un usuario a la vez.
 *   - Pasar spot_id = null elimina la asignación.
 */
export const assignSpotToUser = actionClient
  .schema(assignSpotToUserSchema)
  .action(async ({ parsedInput }) => {
    await requireAdmin();
    const supabase = await createClient();

    const { user_id, spot_id } = parsedInput;

    // 1. If unassigning: clear the spot currently assigned to this user
    if (!spot_id) {
      const { error } = await supabase
        .from("spots")
        .update({ assigned_to: null })
        .eq("assigned_to", user_id);

      if (error) throw new Error(`Error al desasignar plaza: ${error.message}`);
      return { assigned: false };
    }

    // 2. Validate spot is management type
    const { data: spot, error: spotErr } = await supabase
      .from("spots")
      .select("id, type, assigned_to")
      .eq("id", spot_id)
      .single();

    if (spotErr || !spot) throw new Error("Plaza no encontrada");
    if (spot.type !== "management") {
      throw new Error("Solo se pueden asignar plazas de tipo 'dirección'");
    }
    if (spot.assigned_to && spot.assigned_to !== user_id) {
      throw new Error("Esa plaza ya está asignada a otro usuario");
    }

    // 3. First, clear any previous spot assigned to this user
    await supabase
      .from("spots")
      .update({ assigned_to: null })
      .eq("assigned_to", user_id);

    // 4. Assign the new spot
    const { error } = await supabase
      .from("spots")
      .update({ assigned_to: user_id })
      .eq("id", spot_id);

    if (error) throw new Error(`Error al asignar plaza: ${error.message}`);

    revalidatePath("/administracion/usuarios");
    revalidatePath("/administracion");
    return { assigned: true };
  });

// ─── Delete User Account ─────────────────────────────────────

/**
 * Elimina permanentemente una cuenta de usuario (auth + cascade perfil).
 */
export const deleteUser = actionClient
  .schema(deleteUserSchema)
  .action(async ({ parsedInput }) => {
    await requireAdmin();
    const supabase = createAdminClient();

    const { error } = await supabase.auth.admin.deleteUser(parsedInput.user_id);

    if (error) {
      throw new Error(`Error al eliminar cuenta: ${error.message}`);
    }

    revalidatePath("/administracion/usuarios");
    return { deleted: true };
  });
