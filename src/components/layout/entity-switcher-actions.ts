"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { invalidateConfigCache } from "@/lib/config";
import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { entities } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function setActiveEntityAction(entityId: string): Promise<void> {
  await requireAdmin();

  const [entity] = await db
    .select({ id: entities.id })
    .from(entities)
    .where(and(eq(entities.id, entityId), eq(entities.isActive, true)))
    .limit(1);

  if (!entity) {
    throw new Error("Entidad no encontrada o inactiva");
  }

  const cookieStore = await cookies();
  cookieStore.set("active-entity-id", entityId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  // Invalidar cache de config para que la nueva sede aplique sus overrides
  await invalidateConfigCache();
  // Forzar re-render completo del layout para que todos los datos reflejen la nueva sede
  revalidatePath("/", "layout");
}

/**
 * Inicializa la cookie de sede activa si todavía no existe.
 * No dispara revalidatePath — se llama en silencio desde EntitySwitcher
 * en el primer render cuando el layout usó el fallback entities[0].
 */
export async function initActiveEntityCookie(entityId: string): Promise<void> {
  const cookieStore = await cookies();
  if (!cookieStore.get("active-entity-id")?.value) {
    cookieStore.set("active-entity-id", entityId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
}

/**
 * Elimina la cookie de sede activa.
 * Llamar al cerrar sesión para evitar que un usuario nuevo herede
 * el contexto de sede del usuario anterior en el mismo navegador.
 */
export async function clearActiveEntityCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("active-entity-id");
}
