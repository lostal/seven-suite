/**
 * Queries de Cesiones
 *
 * Funciones de servidor para leer datos de cesiones.
 */

import { db } from "@/lib/db";
import {
  cessions as cessionsTable,
  spots as spotsTable,
  profiles as profilesTable,
} from "@/lib/db/schema";
import type { ResourceType } from "@/lib/db/types";
import { toServerDateStr } from "@/lib/utils";
import { eq, and, gte, ne, asc, desc, or, isNull } from "drizzle-orm";

/**
 * Fila de cesión — tipo compatible con los callers existentes (snake_case).
 */
export interface CessionWithDetails {
  id: string;
  spot_id: string;
  user_id: string;
  date: string;
  status: string;
  created_at: Date;
  spot_label: string;
  user_name: string;
  resource_type: ResourceType;
}

/**
 * Obtiene todas las cesiones no canceladas para una fecha específica,
 * con detalles de plaza y usuario.
 *
 * @param resourceType - Si se proporciona, filtra por tipo de recurso ('parking' | 'office').
 */
export async function getCessionsByDate(
  date: string,
  resourceType?: "parking" | "office",
  entityId?: string | null
): Promise<CessionWithDetails[]> {
  const conditions = [
    eq(cessionsTable.date, date),
    ne(cessionsTable.status, "cancelled"),
  ];

  if (resourceType) {
    conditions.push(eq(spotsTable.resourceType, resourceType));
  }

  if (entityId) {
    conditions.push(
      or(eq(spotsTable.entityId, entityId), isNull(spotsTable.entityId))!
    );
  }

  const rows = await db
    .select({
      id: cessionsTable.id,
      spot_id: cessionsTable.spotId,
      user_id: cessionsTable.userId,
      date: cessionsTable.date,
      status: cessionsTable.status,
      created_at: cessionsTable.createdAt,
      spot_label: spotsTable.label,
      spot_resource_type: spotsTable.resourceType,
      user_name: profilesTable.fullName,
    })
    .from(cessionsTable)
    .innerJoin(spotsTable, eq(cessionsTable.spotId, spotsTable.id))
    .innerJoin(profilesTable, eq(cessionsTable.userId, profilesTable.id))
    .where(and(...conditions))
    .orderBy(desc(cessionsTable.createdAt));

  return rows
    .filter((c) => {
      if (resourceType && c.spot_resource_type !== resourceType) {
        console.warn(
          "[cessions] getCessionsByDate: fila descartada por resource_type incorrecto",
          { id: c.id, expected: resourceType, got: c.spot_resource_type }
        );
        return false;
      }
      return true;
    })
    .map(
      (c): CessionWithDetails => ({
        id: c.id,
        spot_id: c.spot_id,
        user_id: c.user_id,
        date: c.date,
        status: c.status,
        created_at: c.created_at,
        spot_label: c.spot_label,
        user_name: c.user_name ?? "",
        resource_type: c.spot_resource_type as ResourceType,
      })
    );
}

/**
 * Obtiene las cesiones no canceladas futuras de un usuario.
 * Devuelve cesiones desde hoy en adelante, ordenadas por fecha.
 * Si se proporciona resourceType, filtra en SQL las cesiones de ese módulo.
 */
export async function getUserCessions(
  userId: string,
  resourceType?: "parking" | "office",
  entityId?: string | null
): Promise<CessionWithDetails[]> {
  const today = toServerDateStr(new Date());

  const conditions = [
    eq(cessionsTable.userId, userId),
    ne(cessionsTable.status, "cancelled"),
    gte(cessionsTable.date, today),
  ];

  if (resourceType) {
    conditions.push(eq(spotsTable.resourceType, resourceType));
  }

  if (entityId) {
    conditions.push(
      or(eq(spotsTable.entityId, entityId), isNull(spotsTable.entityId))!
    );
  }

  const rows = await db
    .select({
      id: cessionsTable.id,
      spot_id: cessionsTable.spotId,
      user_id: cessionsTable.userId,
      date: cessionsTable.date,
      status: cessionsTable.status,
      created_at: cessionsTable.createdAt,
      spot_label: spotsTable.label,
      spot_resource_type: spotsTable.resourceType,
      user_name: profilesTable.fullName,
    })
    .from(cessionsTable)
    .innerJoin(spotsTable, eq(cessionsTable.spotId, spotsTable.id))
    .innerJoin(profilesTable, eq(cessionsTable.userId, profilesTable.id))
    .where(and(...conditions))
    .orderBy(asc(cessionsTable.date));

  return rows
    .filter((c) => {
      if (resourceType && c.spot_resource_type !== resourceType) {
        console.warn(
          "[cessions] getUserCessions: fila descartada por resource_type incorrecto",
          { id: c.id, expected: resourceType, got: c.spot_resource_type }
        );
        return false;
      }
      return true;
    })
    .map(
      (c): CessionWithDetails => ({
        id: c.id,
        spot_id: c.spot_id,
        user_id: c.user_id,
        date: c.date,
        status: c.status,
        created_at: c.created_at,
        spot_label: c.spot_label,
        user_name: c.user_name ?? "",
        resource_type: c.spot_resource_type as ResourceType,
      })
    );
}
