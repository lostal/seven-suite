/**
 * Entity Queries
 *
 * Server-side queries for entities (sedes) and their modules.
 */

import { db } from "@/lib/db";
import {
  entities as entitiesTable,
  entityModules as entityModulesTable,
} from "@/lib/db/schema";
import type { Entity, EntityModule } from "@/lib/db/types";
import { eq, asc } from "drizzle-orm";
import { ENTITY_MODULES } from "@/lib/validations";

export type { Entity, EntityModule };
export type EntityWithModules = Entity & { modules: EntityModule[] };

export async function getAllEntities(): Promise<Entity[]> {
  const rows = await db
    .select()
    .from(entitiesTable)
    .orderBy(asc(entitiesTable.name));
  return rows;
}

export async function getEntityWithModules(
  entityId: string
): Promise<EntityWithModules | null> {
  const [entityRows, moduleRows] = await Promise.all([
    db
      .select()
      .from(entitiesTable)
      .where(eq(entitiesTable.id, entityId))
      .limit(1),
    db
      .select()
      .from(entityModulesTable)
      .where(eq(entityModulesTable.entityId, entityId)),
  ]);

  const [entity] = entityRows;
  if (!entity) return null;

  return {
    ...entity,
    modules: moduleRows,
  };
}

/**
 * Returns the list of module keys that are ENABLED for an entity.
 * Opt-out model: if no row in entity_modules for a module, it's considered enabled.
 */
export async function getEntityEnabledModules(
  entityId: string
): Promise<string[]> {
  const ALL_MODULES = [...ENTITY_MODULES];
  try {
    const rows = await db
      .select({
        module: entityModulesTable.module,
        enabled: entityModulesTable.enabled,
      })
      .from(entityModulesTable)
      .where(eq(entityModulesTable.entityId, entityId));

    const disabledSet = new Set(
      rows.filter((m) => !m.enabled).map((m) => m.module)
    );
    return ALL_MODULES.filter((m) => !disabledSet.has(m));
  } catch (err) {
    console.warn(
      "[entities] getEntityEnabledModules error (¿migración pendiente?):",
      err
    );
    return [];
  }
}
