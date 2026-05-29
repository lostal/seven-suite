/**
 * Queries de Reservas
 *
 * Funciones de servidor para leer datos de reservas.
 */

import { db } from "@/lib/db";
import {
  reservations as reservationsTable,
  spots as spotsTable,
  profiles as profilesTable,
} from "@/lib/db/schema";
import type { ResourceType } from "@/lib/db/types";
import { toServerDateStr } from "@/lib/utils";
import { eq, and, gte, inArray, desc, asc, or, isNull } from "drizzle-orm";

/**
 * Fila de reserva — tipo compatible con los callers existentes (snake_case).
 * @internal Tipo local a la capa de queries — no usar como tipo público.
 * Para el tipo público compartido ver `ReservationWithDetails` en `@/types`.
 */
export interface ReservationRow {
  id: string;
  spot_id: string;
  user_id: string;
  date: string;
  status: string;
  notes: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at: Date;
  updated_at: Date;
  spot_label: string;
  user_name: string;
  resource_type: ResourceType;
}

/**
 * Obtiene todas las reservas confirmadas para una fecha específica,
 * con detalles de plaza y usuario.
 *
 * @param resourceType - Si se proporciona, filtra por tipo de recurso ('parking' | 'office').
 */
export async function getReservationsByDate(
  date: string,
  resourceType?: "parking" | "office",
  entityId?: string | null
): Promise<ReservationRow[]> {
  const conditions = [
    eq(reservationsTable.date, date),
    eq(reservationsTable.status, "confirmed"),
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
      id: reservationsTable.id,
      spot_id: reservationsTable.spotId,
      user_id: reservationsTable.userId,
      date: reservationsTable.date,
      status: reservationsTable.status,
      notes: reservationsTable.notes,
      start_time: reservationsTable.startTime,
      end_time: reservationsTable.endTime,
      created_at: reservationsTable.createdAt,
      updated_at: reservationsTable.updatedAt,
      spot_label: spotsTable.label,
      spot_resource_type: spotsTable.resourceType,
      user_name: profilesTable.fullName,
    })
    .from(reservationsTable)
    .innerJoin(spotsTable, eq(reservationsTable.spotId, spotsTable.id))
    .innerJoin(profilesTable, eq(reservationsTable.userId, profilesTable.id))
    .where(and(...conditions))
    .orderBy(desc(reservationsTable.createdAt));

  return rows.map(
    (r): ReservationRow => ({
      id: r.id,
      spot_id: r.spot_id,
      user_id: r.user_id,
      date: r.date,
      status: r.status,
      notes: r.notes,
      start_time: r.start_time,
      end_time: r.end_time,
      created_at: r.created_at,
      updated_at: r.updated_at,
      spot_label: r.spot_label,
      user_name: r.user_name ?? "",
      resource_type: r.spot_resource_type as ResourceType,
    })
  );
}

/**
 * Obtiene las reservas confirmadas futuras de un usuario.
 * Devuelve reservas desde hoy en adelante, ordenadas por fecha.
 *
 * @param resourceType - Si se proporciona, filtra por tipo de recurso ('parking' | 'office').
 */
export async function getUserReservations(
  userId: string,
  resourceType?: "parking" | "office",
  entityId?: string | null
): Promise<ReservationRow[]> {
  const today = toServerDateStr(new Date());

  const conditions = [
    eq(reservationsTable.userId, userId),
    eq(reservationsTable.status, "confirmed"),
    gte(reservationsTable.date, today),
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
      id: reservationsTable.id,
      spot_id: reservationsTable.spotId,
      user_id: reservationsTable.userId,
      date: reservationsTable.date,
      status: reservationsTable.status,
      notes: reservationsTable.notes,
      start_time: reservationsTable.startTime,
      end_time: reservationsTable.endTime,
      created_at: reservationsTable.createdAt,
      updated_at: reservationsTable.updatedAt,
      spot_label: spotsTable.label,
      spot_resource_type: spotsTable.resourceType,
      user_name: profilesTable.fullName,
    })
    .from(reservationsTable)
    .innerJoin(spotsTable, eq(reservationsTable.spotId, spotsTable.id))
    .innerJoin(profilesTable, eq(reservationsTable.userId, profilesTable.id))
    .where(and(...conditions))
    .orderBy(asc(reservationsTable.date));

  return rows.map(
    (r): ReservationRow => ({
      id: r.id,
      spot_id: r.spot_id,
      user_id: r.user_id,
      date: r.date,
      status: r.status,
      notes: r.notes,
      start_time: r.start_time,
      end_time: r.end_time,
      created_at: r.created_at,
      updated_at: r.updated_at,
      spot_label: r.spot_label,
      user_name: r.user_name ?? "",
      resource_type: r.spot_resource_type as ResourceType,
    })
  );
}

/**
 * Comprueba si un usuario ya tiene una reserva confirmada en una fecha dada
 * para un tipo de recurso concreto (o cualquiera si no se especifica).
 * Devuelve la reserva si existe, null en caso contrario.
 *
 * @param resourceType - Si se proporciona, sólo busca reservas de ese recurso.
 *   Imprescindible en un sistema multi-recurso donde el mismo usuario puede
 *   tener una reserva de parking y otra de oficina en la misma fecha.
 */
export async function getUserReservationForDate(
  userId: string,
  date: string,
  resourceType?: ResourceType
): Promise<ReservationRow | null> {
  if (!resourceType) {
    // Sin filtro de recurso: consulta simple (compatibilidad hacia atrás)
    const rows = await db
      .select({
        id: reservationsTable.id,
        spot_id: reservationsTable.spotId,
        user_id: reservationsTable.userId,
        date: reservationsTable.date,
        status: reservationsTable.status,
        notes: reservationsTable.notes,
        start_time: reservationsTable.startTime,
        end_time: reservationsTable.endTime,
        created_at: reservationsTable.createdAt,
        updated_at: reservationsTable.updatedAt,
        spot_label: spotsTable.label,
        spot_resource_type: spotsTable.resourceType,
        user_name: profilesTable.fullName,
      })
      .from(reservationsTable)
      .innerJoin(spotsTable, eq(reservationsTable.spotId, spotsTable.id))
      .innerJoin(profilesTable, eq(reservationsTable.userId, profilesTable.id))
      .where(
        and(
          eq(reservationsTable.userId, userId),
          eq(reservationsTable.date, date),
          eq(reservationsTable.status, "confirmed")
        )
      )
      .limit(1);

    const [first] = rows;
    if (!first) return null;
    return {
      id: first.id,
      spot_id: first.spot_id,
      user_id: first.user_id,
      date: first.date,
      status: first.status,
      notes: first.notes,
      start_time: first.start_time,
      end_time: first.end_time,
      created_at: first.created_at,
      updated_at: first.updated_at,
      spot_label: first.spot_label,
      user_name: first.user_name ?? "",
      resource_type: first.spot_resource_type as ResourceType,
    };
  }

  // Con filtro de recurso: obtener IDs de plazas del tipo correcto primero
  const spotRows = await db
    .select({ id: spotsTable.id })
    .from(spotsTable)
    .where(
      and(
        eq(spotsTable.resourceType, resourceType),
        eq(spotsTable.isActive, true)
      )
    );

  const ids = spotRows.map((s) => s.id);
  if (ids.length === 0) return null;

  const rows = await db
    .select({
      id: reservationsTable.id,
      spot_id: reservationsTable.spotId,
      user_id: reservationsTable.userId,
      date: reservationsTable.date,
      status: reservationsTable.status,
      notes: reservationsTable.notes,
      start_time: reservationsTable.startTime,
      end_time: reservationsTable.endTime,
      created_at: reservationsTable.createdAt,
      updated_at: reservationsTable.updatedAt,
      spot_label: spotsTable.label,
      spot_resource_type: spotsTable.resourceType,
      user_name: profilesTable.fullName,
    })
    .from(reservationsTable)
    .innerJoin(spotsTable, eq(reservationsTable.spotId, spotsTable.id))
    .innerJoin(profilesTable, eq(reservationsTable.userId, profilesTable.id))
    .where(
      and(
        eq(reservationsTable.userId, userId),
        eq(reservationsTable.date, date),
        eq(reservationsTable.status, "confirmed"),
        inArray(reservationsTable.spotId, ids)
      )
    )
    .limit(1);

  const [last] = rows;
  if (!last) return null;
  return {
    id: last.id,
    spot_id: last.spot_id,
    user_id: last.user_id,
    date: last.date,
    status: last.status,
    notes: last.notes,
    start_time: last.start_time,
    end_time: last.end_time,
    created_at: last.created_at,
    updated_at: last.updated_at,
    spot_label: last.spot_label,
    user_name: last.user_name ?? "",
    resource_type: last.spot_resource_type as ResourceType,
  };
}
