/**
 * Helpers de autenticación
 *
 * Utilidades de servidor para verificación y autorización de usuarios.
 * Estas funciones se ejecutan en el servidor y gestionan redirecciones automáticamente.
 */

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants";
import { db } from "@/lib/db";
import { profiles, spots } from "@/lib/db/schema";
import type { Profile } from "@/lib/db/types";

import { auth } from "./config";

export interface AuthUser {
  id: string;
  email: string;
  profile: Profile | null;
}

/**
 * Obtiene el usuario autenticado actual con su perfil.
 * @returns Objeto de usuario con perfil o null si no está autenticado
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, session.user.id))
    .limit(1);

  return {
    id: session.user.id,
    email: session.user.email ?? "",
    profile: profile ?? null,
  };
}

/**
 * Requiere autenticación — redirige a /login si no está autenticado.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect(ROUTES.LOGIN);
  }

  return user;
}

/**
 * Requiere rol de administrador — redirige al dashboard si no es admin.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();

  if (user.profile?.role !== "admin") {
    redirect(ROUTES.PARKING);
  }

  return user;
}

/**
 * Requiere rol HR o superior (hr | admin).
 */
export async function requireHR(): Promise<AuthUser> {
  const user = await requireAuth();

  if (user.profile?.role !== "hr" && user.profile?.role !== "admin") {
    redirect(ROUTES.PARKING);
  }

  return user;
}

/**
 * Requiere rol manager o superior (manager | hr | admin).
 */
export async function requireManagerOrAbove(): Promise<AuthUser> {
  const user = await requireAuth();

  const role = user.profile?.role;
  if (role !== "manager" && role !== "hr" && role !== "admin") {
    redirect(ROUTES.PARKING);
  }

  return user;
}

/**
 * Requiere tener una plaza asignada del tipo indicado.
 */
export async function requireSpotOwner(
  resourceType: "parking" | "office"
): Promise<AuthUser> {
  const user = await requireAuth();

  // Los admins siempre tienen acceso
  if (user.profile?.role === "admin") return user;

  const [spot] = await db
    .select({ id: spots.id })
    .from(spots)
    .where(
      and(eq(spots.assignedTo, user.id), eq(spots.resourceType, resourceType))
    )
    .limit(1);

  if (!spot) {
    redirect(resourceType === "parking" ? ROUTES.PARKING : ROUTES.OFFICES);
  }

  return user;
}
