import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { entities } from "@/lib/db/schema";

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
 * - Admin → cookie validada contra una entidad activa existente
 * - Employee/manager/HR → `profile.entityId`, nunca la cookie
 * - Sin autenticar → null
 */
export async function getEffectiveEntityId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.profile?.role === "admin") {
    const entityId = await getActiveEntityId();
    if (!entityId) return null;

    const [entity] = await db
      .select({ id: entities.id })
      .from(entities)
      .where(and(eq(entities.id, entityId), eq(entities.isActive, true)))
      .limit(1);

    return entity?.id ?? null;
  }
  const entityId = user.profile?.entityId ?? null;
  if (!entityId) return null;

  const [entity] = await db
    .select({ id: entities.id })
    .from(entities)
    .where(and(eq(entities.id, entityId), eq(entities.isActive, true)))
    .limit(1);

  return entity?.id ?? null;
}
