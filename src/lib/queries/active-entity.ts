import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/supabase/auth";

/**
 * Returns the active entity ID from the admin cookie.
 * Call from Server Components/Actions only.
 */
export async function getActiveEntityId(): Promise<string | null> {
  const store = await cookies();
  return store.get("active-entity-id")?.value ?? null;
}

/**
 * Devuelve la sede efectiva según el rol del usuario:
 * - Admin → lee la cookie `active-entity-id` (sede seleccionada en el switcher)
 * - Employee → devuelve `profile.entity_id` (sede asignada en el perfil)
 * - Sin autenticar → null
 */
export async function getEffectiveEntityId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.profile?.role === "admin") {
    return getActiveEntityId();
  }
  return user.profile?.entity_id ?? null;
}
