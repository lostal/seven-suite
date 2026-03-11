/**
 * Helpers de autenticación
 *
 * Utilidades de servidor para verificación y autorización de usuarios.
 * Estas funciones se ejecutan en el servidor y gestionan redirecciones automáticamente.
 *
 * Uso:
 *   - getCurrentUser() - Devuelve usuario + perfil o null si no está autenticado
 *   - requireAuth() - Devuelve usuario + perfil o redirige a /login
 *   - requireAdmin() - Devuelve usuario admin o redirige al dashboard
 *   - requireSpotOwner(resourceType) - Requiere tener plaza asignada del tipo indicado
 */

import { redirect } from "next/navigation";
import { createClient } from "./server";
import { ROUTES } from "@/lib/constants";
import type { Profile } from "./types";

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
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  // Fetch user profile with role
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? "",
    profile: profile ?? null,
  };
}

/**
 * Requiere autenticación — redirige a /login si no está autenticado.
 * Usar en layouts/páginas protegidas.
 * @returns Usuario autenticado con perfil
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
 * Usar en páginas/layouts exclusivos de administración.
 * @returns Usuario admin con perfil
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();

  if (user.profile?.role !== "admin") {
    redirect(ROUTES.PARKING);
  }

  return user;
}

/**
 * Requiere rol HR o superior (hr | admin) — redirige al dashboard en caso contrario.
 * Usar en páginas de nóminas, documentos y gestión de personal.
 * @returns Usuario HR o admin con perfil
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
 * Usar en páginas de aprobación de vacaciones y reportes de equipo.
 * @returns Usuario manager, HR o admin con perfil
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
 * Cualquier empleado (o admin) con plaza asignada puede gestionar cesiones.
 * @param resourceType "parking" | "office"
 * @returns Usuario autenticado con perfil
 */
export async function requireSpotOwner(
  resourceType: "parking" | "office"
): Promise<AuthUser> {
  const user = await requireAuth();

  // Los admins siempre tienen acceso
  if (user.profile?.role === "admin") return user;

  const supabase = await createClient();
  const { data: spot } = await supabase
    .from("spots")
    .select("id")
    .eq("assigned_to", user.id)
    .eq("resource_type", resourceType)
    .maybeSingle();

  if (!spot) {
    redirect(resourceType === "parking" ? ROUTES.PARKING : ROUTES.OFFICES);
  }

  return user;
}
