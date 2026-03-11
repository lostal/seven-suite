/**
 * Queries de Reservas de Visitantes
 *
 * Funciones de servidor para leer datos de reservas de visitantes externos.
 */

import { createClient } from "@/lib/supabase/server";
import type { VisitorReservation } from "@/lib/supabase/types";

/** Fila de reserva de visitante con detalles de plaza y creador */
export interface VisitorReservationWithDetails extends VisitorReservation {
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
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0]!;

  let query = supabase
    .from("visitor_reservations")
    .select(
      "*, spots!visitor_reservations_spot_id_fkey(label, entity_id), profiles!visitor_reservations_reserved_by_fkey(full_name)"
    )
    .eq("status", "confirmed")
    .gte("date", today)
    .order("date");

  if (userId) {
    query = query.eq("reserved_by", userId);
  }

  // Nota: el filtro de entidad se aplica en JS tras recibir los datos con el join,
  // ya que .eq("spots.entity_id", entityId) en PostgREST elimina también las plazas
  // globales (entity_id = null) del join, impidiendo incluirlas correctamente.

  const { data, error } = await query.returns<
    (VisitorReservation & {
      spots: { label: string; entity_id: string | null } | null;
      profiles: { full_name: string } | null;
    })[]
  >();

  if (error)
    throw new Error(
      `Error al obtener reservas de visitantes: ${error.message}`
    );

  // Si se filtró por entityId, incluir también plazas sin sede asignada (entity_id = null)
  const filtered = entityId
    ? data.filter(
        (r) => r.spots?.entity_id === entityId || r.spots?.entity_id === null
      )
    : data;

  return filtered.map((r) => ({
    ...r,
    spots: undefined,
    profiles: undefined,
    spot_label: r.spots?.label ?? "",
    reserved_by_name: r.profiles?.full_name ?? "",
  })) as VisitorReservationWithDetails[];
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
  const supabase = await createClient();

  let reservedQuery = supabase
    .from("visitor_reservations")
    .select("spot_id")
    .eq("date", date)
    .eq("status", "confirmed");

  if (excludeReservationId) {
    reservedQuery = reservedQuery.neq("id", excludeReservationId);
  }

  let spotsQuery = supabase
    .from("spots")
    .select("id, label")
    .eq("type", "visitor")
    .eq("is_active", true)
    .order("label");

  if (entityId) {
    spotsQuery = spotsQuery.or(`entity_id.eq.${entityId},entity_id.is.null`);
  }

  const [spotsResult, reservedResult] = await Promise.all([
    spotsQuery,
    reservedQuery,
  ]);

  if (spotsResult.error)
    throw new Error(`Error al obtener plazas: ${spotsResult.error.message}`);

  const reservedIds = new Set(
    (reservedResult.data ?? []).map((r) => r.spot_id)
  );

  return (spotsResult.data ?? []).filter((s) => !reservedIds.has(s.id));
}
