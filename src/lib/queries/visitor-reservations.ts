/**
 * Queries de Reservas de Visitantes
 *
 * Funciones de servidor para leer datos de reservas de visitantes externos.
 */

import { db } from "@/lib/db";
import {
  visitorReservations as visitorReservationsTable,
  spots as spotsTable,
  profiles as profilesTable,
} from "@/lib/db/schema";
import { toServerDateStr } from "@/lib/utils";
import { eq, and, gte, ne, or, isNull, asc } from "drizzle-orm";

/** Fila de reserva de visitante con detalles de plaza y creador */
export interface VisitorReservationWithDetails {
  id: string;
  spot_id: string;
  reserved_by: string;
  date: string;
  visitor_name: string;
  visitor_company: string;
  visitor_email: string;
  status: string;
  notification_sent: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  spot_label: string;
  reserved_by_name: string;
}

/**
 * Obtiene las reservas de visitantes confirmadas desde hoy en adelante,
 * con detalles de plaza y empleado que la creó.
 * @param userId - Si se proporciona, filtra solo las reservas del usuario; omitir para obtener todas (solo admins)
 * @param entityId - Si se proporciona, filtra solo las reservas de plazas de la sede indicada
 */
export async function getUpcomingVisitorReservations(
  userId?: string,
  entityId?: string | null
): Promise<VisitorReservationWithDetails[]> {
  const today = toServerDateStr(new Date());

  const conditions = [
    eq(visitorReservationsTable.status, "confirmed"),
    gte(visitorReservationsTable.date, today),
  ];

  if (userId) {
    conditions.push(eq(visitorReservationsTable.reservedBy, userId));
  }

  const rows = await db
    .select({
      id: visitorReservationsTable.id,
      spotId: visitorReservationsTable.spotId,
      reservedBy: visitorReservationsTable.reservedBy,
      date: visitorReservationsTable.date,
      visitorName: visitorReservationsTable.visitorName,
      visitorCompany: visitorReservationsTable.visitorCompany,
      visitorEmail: visitorReservationsTable.visitorEmail,
      status: visitorReservationsTable.status,
      notificationSent: visitorReservationsTable.notificationSent,
      notes: visitorReservationsTable.notes,
      createdAt: visitorReservationsTable.createdAt,
      updatedAt: visitorReservationsTable.updatedAt,
      spot_label: spotsTable.label,
      spot_entity_id: spotsTable.entityId,
      reserved_by_name: profilesTable.fullName,
    })
    .from(visitorReservationsTable)
    .innerJoin(spotsTable, eq(visitorReservationsTable.spotId, spotsTable.id))
    .innerJoin(
      profilesTable,
      eq(visitorReservationsTable.reservedBy, profilesTable.id)
    )
    .where(and(...conditions))
    .orderBy(asc(visitorReservationsTable.date));

  // Si se filtró por entityId, incluir también plazas sin sede asignada (entity_id = null)
  const filtered = entityId
    ? rows.filter(
        (r) => r.spot_entity_id === entityId || r.spot_entity_id === null
      )
    : rows;

  return filtered.map(
    (r): VisitorReservationWithDetails => ({
      id: r.id,
      spot_id: r.spotId,
      reserved_by: r.reservedBy,
      date: r.date,
      visitor_name: r.visitorName,
      visitor_company: r.visitorCompany,
      visitor_email: r.visitorEmail,
      status: r.status,
      notification_sent: r.notificationSent,
      notes: r.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      spot_label: r.spot_label,
      reserved_by_name: r.reserved_by_name ?? "",
    })
  );
}

/**
 * Obtiene las plazas de tipo "visitor" activas disponibles para una fecha dada.
 * Excluye las que ya tienen una reserva confirmada ese día.
 * @param entityId - Si se proporciona, filtra solo las plazas de la sede indicada
 * @param excludeReservationId - ID de reserva a ignorar (útil al editar)
 */
export async function getAvailableVisitorSpotsForDate(
  date: string,
  excludeReservationId?: string,
  entityId?: string | null
): Promise<{ id: string; label: string }[]> {
  const spotConditions = [
    eq(spotsTable.type, "visitor"),
    eq(spotsTable.isActive, true),
  ];

  if (entityId) {
    spotConditions.push(
      or(eq(spotsTable.entityId, entityId), isNull(spotsTable.entityId))!
    );
  }

  const reservedConditions = [
    eq(visitorReservationsTable.date, date),
    eq(visitorReservationsTable.status, "confirmed"),
  ];

  if (excludeReservationId) {
    reservedConditions.push(
      ne(visitorReservationsTable.id, excludeReservationId)
    );
  }

  const [spotsResult, reservedResult] = await Promise.all([
    db
      .select({ id: spotsTable.id, label: spotsTable.label })
      .from(spotsTable)
      .where(and(...spotConditions))
      .orderBy(asc(spotsTable.label)),
    db
      .select({ spotId: visitorReservationsTable.spotId })
      .from(visitorReservationsTable)
      .where(and(...reservedConditions)),
  ]);

  const reservedIds = new Set(reservedResult.map((r) => r.spotId));

  return spotsResult.filter((s) => !reservedIds.has(s.id));
}
