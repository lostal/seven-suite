/**
 * Entity Queries
 *
 * Server-side queries for entities (sedes) and their modules.
 */

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type Entity = Database["public"]["Tables"]["entities"]["Row"];
export type EntityModule =
  Database["public"]["Tables"]["entity_modules"]["Row"];
export type EntityWithModules = Entity & { modules: EntityModule[] };

export async function getAllEntities(): Promise<Entity[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entities")
    .select("id, name, short_code, is_active, created_at")
    .order("name");
  return data ?? [];
}

export async function getEntityWithModules(
  entityId: string
): Promise<EntityWithModules | null> {
  const supabase = await createClient();
  const [entityRes, modulesRes] = await Promise.all([
    supabase
      .from("entities")
      .select("id, name, short_code, is_active, created_at")
      .eq("id", entityId)
      .maybeSingle(),
    supabase
      .from("entity_modules")
      .select("entity_id, module, enabled")
      .eq("entity_id", entityId),
  ]);
  if (!entityRes.data) return null;
  return {
    ...entityRes.data,
    modules: modulesRes.data ?? [],
  };
}

/**
 * Returns the list of module keys that are ENABLED for an entity.
 * Opt-out model: if no row in entity_modules for a module, it's considered enabled.
 */
export async function getEntityEnabledModules(
  entityId: string
): Promise<string[]> {
  const supabase = await createClient();
  const ALL_MODULES = [
    "parking",
    "office",
    "visitors",
    "nominas",
    "vacaciones",
    "tablon",
  ];
  try {
    const { data } = await supabase
      .from("entity_modules")
      .select("module, enabled")
      .eq("entity_id", entityId);
    const disabledSet = new Set(
      (data ?? []).filter((m) => !m.enabled).map((m) => m.module)
    );
    return ALL_MODULES.filter((m) => !disabledSet.has(m));
  } catch {
    return ALL_MODULES; // migration not applied yet
  }
}
