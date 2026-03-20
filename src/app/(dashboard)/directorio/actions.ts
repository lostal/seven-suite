"use server";

/**
 * Directorio Server Actions
 *
 * Admin-only actions for managing users from the directory view.
 */

import { actionClient } from "@/lib/actions";
import { db } from "@/lib/db";
import { profiles, users, userPreferences } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/helpers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  updateDirectorioUserSchema,
  createDirectorioUserSchema,
} from "@/lib/validations";

/**
 * Actualiza nombre, puesto, teléfono y sede de un usuario en profiles.
 */
export const updateDirectorioUser = actionClient
  .schema(updateDirectorioUserSchema)
  .action(async ({ parsedInput }) => {
    await requireAdmin();

    await db
      .update(profiles)
      .set({
        fullName: parsedInput.nombre,
        jobTitle: parsedInput.puesto || null,
        phone: parsedInput.telefono || null,
        entityId: parsedInput.entity_id || null,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, parsedInput.user_id));

    revalidatePath("/directorio");
    return { updated: true };
  });

/**
 * Crea un nuevo usuario con perfil y preferencias por defecto.
 */
export const createDirectorioUser = actionClient
  .schema(createDirectorioUserSchema)
  .action(async ({ parsedInput }) => {
    await requireAdmin();

    // Check if user already exists
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, parsedInput.correo))
      .limit(1);

    if (existing) {
      throw new Error("Ya existe un usuario con ese correo electrónico.");
    }

    // Create a temporary hashed password (user should reset it)
    const tempPassword = Math.random().toString(36).slice(-12);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Create user
    const [user] = await db
      .insert(users)
      .values({
        email: parsedInput.correo,
        name: parsedInput.nombre,
        password: hashedPassword,
      })
      .returning({ id: users.id });

    if (!user) throw new Error("Error al crear el usuario");

    // Create profile
    await db
      .insert(profiles)
      .values({
        id: user.id,
        email: parsedInput.correo,
        fullName: parsedInput.nombre,
        jobTitle: parsedInput.puesto || null,
        phone: parsedInput.telefono || null,
        entityId: parsedInput.entity_id || null,
        role: "employee",
      })
      .onConflictDoNothing();

    // Create default preferences
    await db
      .insert(userPreferences)
      .values({ userId: user.id })
      .onConflictDoNothing();

    revalidatePath("/directorio");
    return { created: true };
  });
