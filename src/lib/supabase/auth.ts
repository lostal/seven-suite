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
 *   - requireManagement() - Devuelve usuario directivo/admin o redirige
 */

import { redirect } from "next/navigation";
import { createClient } from "./server";
import { ROUTES } from "@/lib/constants";
import type { Profile, UserRole } from "./types";

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
 * Requiere rol de directivo o administrador.
 * Usar para funcionalidades como la gestión de cesiones.
 * @returns Usuario directivo/admin con perfil
 */
export async function requireManagement(): Promise<AuthUser> {
  const user = await requireAuth();

  const allowedRoles: UserRole[] = ["admin", "management"];

  if (!user.profile?.role || !allowedRoles.includes(user.profile.role)) {
    redirect(ROUTES.PARKING);
  }

  return user;
}
