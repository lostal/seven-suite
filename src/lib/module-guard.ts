/**
 * Module Guard — enforces module activation at page and action boundaries.
 *
 * RNF-06: "La arquitectura modular permitirá añadir o desactivar módulos
 * sin modificar el código base existente."
 *
 * - `requireModuleEnabled` → for pages: redirects to /panel if module is off
 * - `assertModuleEnabled`   → for actions: throws Error if module is off
 * - `requireVisitorsEnabled` → convenience: checks both parking AND visitors
 */

import { redirect } from "next/navigation";
import type { EntityModuleKey } from "@/lib/validations";
import { getEntityEnabledModules } from "@/lib/queries/entities";
import { ROUTES } from "@/lib/constants";

/** Throws if the module is disabled for the given entity. Use in server actions. */
export async function assertModuleEnabled(
  module: EntityModuleKey,
  entityId: string | null
): Promise<void> {
  if (!entityId) return; // global context (no entity selected) — allow all
  const enabled = await getEntityEnabledModules(entityId);
  if (!enabled.includes(module)) {
    throw new Error(`El módulo "${module}" está desactivado para esta sede`);
  }
}

/** Redirects to /panel if the module is disabled. Use in page server components. */
export async function requireModuleEnabled(
  module: EntityModuleKey,
  entityId: string | null
): Promise<void> {
  if (!entityId) return;
  const enabled = await getEntityEnabledModules(entityId);
  if (!enabled.includes(module)) {
    redirect(ROUTES.DASHBOARD);
  }
}

/** Checks both parking and visitors. Visitors depends on parking being enabled. */
export async function requireVisitorsEnabled(
  entityId: string | null
): Promise<void> {
  await requireModuleEnabled("parking", entityId);
  await requireModuleEnabled("visitors", entityId);
}

/** Checks both parking and visitors. Use in server actions. */
export async function assertVisitorsEnabled(
  entityId: string | null
): Promise<void> {
  await assertModuleEnabled("parking", entityId);
  await assertModuleEnabled("visitors", entityId);
}
