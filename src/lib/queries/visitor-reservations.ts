/**
 * Queries de Reservas de Visitantes
 *
 * Funciones de servidor para leer datos de reservas de visitantes externos.
 */

import { createClient } from "@/lib/supabase/server";
import type { VisitorReservation } from "@/lib/supabase/types";

/** Tipo interno para la query con joins de plaza y perfil */
type VisitorReservationJoin = VisitorReservation & {
  spots: { label: string } | null;
  profiles: { full_name: string } | null;
};

/** Fila de reserva de visitante con detalles de plaza y creador */
export interface VisitorReservationWithDetails extends VisitorReservation {
  spot_label: string;
  reserved_by_name: string;
}

/**
 * Obtiene las reservas de visitantes confirmadas desde hoy en adelante,
 * con detalles de plaza y empleado que la creó.
 * @param userId - Si se proporciona, filtra solo las reservas del usuario; omitir para obtener todas (solo admins)
 */
export async function getUpcomingVisitorReservations(
  userId?: string
): Promise<VisitorReservationWithDetails[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0]!;

  let query = supabase
    .from("visitor_reservations")
    .select(
      "*, spots!visitor_reservations_spot_id_fkey(label), profiles!visitor_reservations_reserved_by_fkey(full_name)"
    )
    .eq("status", "confirmed")
    .gte("date", today)
    .order("date");

  if (userId) {
    query = query.eq("reserved_by", userId);
  }

  const { data, error } = await query.returns<VisitorReservationJoin[]>();

  if (error)
    throw new Error(
      `Error al obtener reservas de visitantes: ${error.message}`
    );

  return data.map((r) => ({
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
 * @param excludeReservationId - ID de reserva a ignorar (útil al editar)
 */
export async function getAvailableVisitorSpotsForDate(
  date: string,
  excludeReservationId?: string
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

  const [spotsResult, reservedResult] = await Promise.all([
    supabase
      .from("spots")
      .select("id, label")
      .eq("type", "visitor")
      .eq("is_active", true)
      .order("label"),
    reservedQuery,
  ]);

  if (spotsResult.error)
    throw new Error(`Error al obtener plazas: ${spotsResult.error.message}`);

  const reservedIds = new Set(
    (reservedResult.data ?? []).map((r) => r.spot_id)
  );

  return (spotsResult.data ?? []).filter((s) => !reservedIds.has(s.id));
}
