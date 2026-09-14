"use server";

/**
 * Directorio Server Actions
 *
 * Admin-only actions for managing users from the directory view.
 */

import { actionClient } from "@/lib/actions";
import { db } from "@/lib/db";
import { profiles, users, userPreferences } from "@/lib/db/schema";
import { requireManagerOrAbove } from "@/lib/auth/helpers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getActiveEntityId } from "@/lib/queries/active-entity";
import { isUniqueViolation } from "@/lib/db/helpers";
import {
  updateDirectorioUserSchema,
  createDirectorioUserSchema,
} from "@/lib/validations";

async function assertEntityInAdminScope(
  user: Awaited<ReturnType<typeof requireManagerOrAbove>>,
  entityId?: string | null
) {
  if (user.profile?.role !== "admin") {
    const ownEntityId = user.profile?.entityId;
    if (!ownEntityId) throw new Error("Tu usuario no tiene una sede asignada");
    if (entityId !== ownEntityId) {
      throw new Error("No tienes permisos para gestionar otra sede");
    }
    return ownEntityId;
  }

  let activeEntityId: string | null = null;
  try {
    activeEntityId = await getActiveEntityId();
  } catch (err) {
    if (
      !(err instanceof Error) ||
      !err.message.includes("outside a request scope")
    ) {
      console.error("[directorio] getActiveEntityId error:", err);
      throw new Error("No se pudo determinar la sede activa");
    }
  }

  if (activeEntityId && entityId && entityId !== activeEntityId) {
    throw new Error("No tienes permisos para gestionar usuarios de otra sede");
  }
  return activeEntityId;
}

/**
 * Actualiza nombre, puesto, teléfono y sede de un usuario en profiles.
 */
export const updateDirectorioUser = actionClient
  .schema(updateDirectorioUserSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireManagerOrAbove();
    const activeEntityId = await assertEntityInAdminScope(
      user,
      parsedInput.entity_id
    );

    if (activeEntityId) {
      const [targetProfile] = await db
        .select({ entityId: profiles.entityId })
        .from(profiles)
        .where(eq(profiles.id, parsedInput.user_id))
        .limit(1);

      if (targetProfile?.entityId !== activeEntityId) {
        throw new Error("No tienes permisos para modificar este usuario");
      }
    }

    const updated = await db
      .update(profiles)
      .set({
        fullName: parsedInput.nombre,
        jobTitle: parsedInput.puesto || null,
        phone: parsedInput.telefono || null,
        entityId: parsedInput.entity_id || null,
        updatedAt: new Date(),
      })
      .returning({ id: profiles.id });

    if (updated.length === 0) throw new Error("Usuario no encontrado");

    revalidatePath("/directorio");
    return { updated: true };
  });

/**
 * Crea un nuevo usuario con perfil y preferencias por defecto.
 * El usuario podrá iniciar sesión con Microsoft Entra ID usando el mismo email.
 */
export const createDirectorioUser = actionClient
  .schema(createDirectorioUserSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireManagerOrAbove();
    const entityId = await assertEntityInAdminScope(
      user,
      parsedInput.entity_id
    );

    // Check if user already exists
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, parsedInput.correo))
      .limit(1);

    if (existing) {
      throw new Error("Ya existe un usuario con ese correo electrónico.");
    }

    try {
      await db.transaction(async (tx) => {
        const [createdUser] = await tx
          .insert(users)
          .values({ email: parsedInput.correo, name: parsedInput.nombre })
          .returning({ id: users.id });

        if (!createdUser) throw new Error("Error al crear el usuario");

        await tx.insert(profiles).values({
          id: createdUser.id,
          email: parsedInput.correo,
          fullName: parsedInput.nombre,
          jobTitle: parsedInput.puesto || null,
          phone: parsedInput.telefono || null,
          entityId,
          role: "employee",
        });

        await tx.insert(userPreferences).values({ userId: createdUser.id });
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new Error("Ya existe un usuario con ese correo electrónico.");
      }
      throw err;
    }

    revalidatePath("/directorio");
    return { created: true };
  });
