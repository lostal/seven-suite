/**
 * Queries de Oficinas
 *
 * Funciones de acceso a datos para puestos de oficina y sus reservas.
 * Las reservas de oficina pueden ser de día completo o por franja horaria.
 */

import { createClient } from "@/lib/supabase/server";
import type { SpotWithStatus, TimeSlot, ReservationWithDetails } from "@/types";
import type { Reservation, Spot } from "@/lib/supabase/types";

// ─── Tipos internos ───────────────────────────────────────────────

type ReservationRow = Reservation & {
  spots: { label: string; resource_type: string } | null;
  profiles: { full_name: string } | null;
};

// ─── Queries de disponibilidad ────────────────────────────────

/**
 * Obtiene todos los puestos de oficina activos.
 */
export async function getOfficeSpots(): Promise<Spot[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("spots")
    .select("*")
    .eq("is_active", true)
    .eq("resource_type", "office")
    .order("label");

  if (error) throw new Error(`Error al obtener puestos: ${error.message}`);
  return data ?? [];
}

/**
 * Obtiene los puestos de oficina con su estado para una fecha dada.
 * Tiene en cuenta reservas confirmadas, cesiones y estado de cada puesto.
 *
 * @param date - Fecha ISO YYYY-MM-DD
 * @param startTime - Hora de inicio para filtrar solapamientos (opcional)
 * @param endTime - Hora de fin para filtrar solapamientos (opcional)
 */
export async function getOfficeAvailabilityForDate(
  date: string,
  startTime?: string,
  endTime?: string
): Promise<SpotWithStatus[]> {
  const supabase = await createClient();

  const spotsResult = await supabase
    .from("spots")
    .select("*")
    .eq("is_active", true)
    .eq("resource_type", "office")
    .order("label");

  if (spotsResult.error)
    throw new Error(`Error al obtener puestos: ${spotsResult.error.message}`);

  const spots = spotsResult.data ?? [];

  if (spots.length === 0) return [];

  const spotIds = spots.map((s) => s.id);

  const [reservationsResult, cessionsResult] = await Promise.all([
    supabase
      .from("reservations")
      .select("id, spot_id, start_time, end_time")
      .eq("date", date)
      .eq("status", "confirmed")
      .in("spot_id", spotIds)
      .returns<
        {
          id: string;
          spot_id: string;
          start_time: string | null;
          end_time: string | null;
        }[]
      >(),
    supabase
      .from("cessions")
      .select("id, spot_id, status")
      .eq("date", date)
      .neq("status", "cancelled")
      .in("spot_id", spotIds),
  ]);
  const reservations = reservationsResult.data ?? [];
  const cessionBySpot = new Map(
    (cessionsResult.data ?? []).map((c) => [c.spot_id, c])
  );

  const result: SpotWithStatus[] = [];

  for (const spot of spots) {
    // Reservas activas en este puesto para la fecha
    const spotReservations = reservations.filter((r) => r.spot_id === spot.id);

    let isOccupied = false;

    if (startTime && endTime) {
      // Reserva por franja: comprobar solapamiento
      isOccupied = spotReservations.some((r) => {
        if (!r.start_time || !r.end_time) return true; // Día completo bloquea toda franja
        // Solapamiento: no (r.end_time <= startTime || r.start_time >= endTime)
        return !(r.end_time <= startTime || r.start_time >= endTime);
      });
    } else {
      // Sin franja: está ocupado si tiene cualquier reserva confirmada
      isOccupied = spotReservations.length > 0;
    }

    if (isOccupied) {
      result.push({
        id: spot.id,
        label: spot.label,
        type: spot.type as SpotWithStatus["type"],
        resource_type: "office",
        assigned_to: spot.assigned_to,
        position_x: spot.position_x,
        position_y: spot.position_y,
        status: "occupied",
        reservation_id: spotReservations[0]?.id,
      });
      continue;
    }

    if (spot.assigned_to !== null) {
      // Puesto con propietario: solo disponible si el dueño lo ha cedido activamente
      const cession = cessionBySpot.get(spot.id);
      if (!cession || cession.status !== "available") {
        // Sin cesión activa: bloqueado por su dueño
        result.push({
          id: spot.id,
          label: spot.label,
          type: spot.type as SpotWithStatus["type"],
          resource_type: "office",
          assigned_to: spot.assigned_to,
          position_x: spot.position_x,
          position_y: spot.position_y,
          status: "occupied",
        });
        continue;
      }

      result.push({
        id: spot.id,
        label: spot.label,
        type: spot.type as SpotWithStatus["type"],
        resource_type: "office",
        assigned_to: spot.assigned_to,
        position_x: spot.position_x,
        position_y: spot.position_y,
        status: "ceded",
      });
    } else {
      // Sin propietario → no reservable directamente; se muestra como ocupado
      result.push({
        id: spot.id,
        label: spot.label,
        type: spot.type as SpotWithStatus["type"],
        resource_type: "office",
        assigned_to: spot.assigned_to,
        position_x: spot.position_x,
        position_y: spot.position_y,
        status: "occupied",
      });
    }
  }

  return result;
}

/**
 * Genera las franjas horarias disponibles para un puesto en una fecha.
 * Calcula qué slots ya están ocupados y cuáles quedan libres.
 *
 * @param spotId - ID del puesto
 * @param date - Fecha ISO YYYY-MM-DD
 * @param startHour - Hora de inicio del día (e.g. 8)
 * @param endHour - Hora de fin del día (e.g. 20)
 * @param slotDurationMinutes - Duración de cada franja en minutos (e.g. 60)
 */
export async function getAvailableTimeSlots(
  spotId: string,
  date: string,
  startHour: number,
  endHour: number,
  slotDurationMinutes: number
): Promise<TimeSlot[]> {
  const supabase = await createClient();

  const { data: reservations, error } = await supabase
    .from("reservations")
    .select("start_time, end_time")
    .eq("spot_id", spotId)
    .eq("date", date)
    .eq("status", "confirmed")
    .returns<{ start_time: string | null; end_time: string | null }[]>();

  if (error) throw new Error(`Error al obtener franjas: ${error.message}`);

  const bookedSlots = (reservations ?? []).filter(
    (r) => r.start_time && r.end_time
  ) as { start_time: string; end_time: string }[];

  const slots: TimeSlot[] = [];
  const totalMinutes = (endHour - startHour) * 60;
  const numSlots = Math.floor(totalMinutes / slotDurationMinutes);

  for (let i = 0; i < numSlots; i++) {
    const startMinutes = startHour * 60 + i * slotDurationMinutes;
    const endMinutes = startMinutes + slotDurationMinutes;

    const toHHMM = (mins: number) => {
      const h = Math.floor(mins / 60)
        .toString()
        .padStart(2, "0");
      const m = (mins % 60).toString().padStart(2, "0");
      return `${h}:${m}`;
    };

    const slotStart = toHHMM(startMinutes);
    const slotEnd = toHHMM(endMinutes);

    const isBooked = bookedSlots.some(
      (r) => !(r.end_time <= slotStart || r.start_time >= slotEnd)
    );

    slots.push({
      start_time: slotStart,
      end_time: slotEnd,
      available: !isBooked,
    });
  }

  return slots;
}

// ─── Queries de reservas ──────────────────────────────────────

/**
 * Obtiene las reservas de oficina futuras del usuario.
 */
export async function getUserOfficeReservations(
  userId: string
): Promise<ReservationWithDetails[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0]!;

  const { data, error } = await supabase
    .from("reservations")
    .select(
      "*, spots!reservations_spot_id_fkey(label, resource_type), profiles!reservations_user_id_fkey(full_name)"
    )
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .eq("spots.resource_type", "office")
    .gte("date", today)
    .order("date")
    .returns<ReservationRow[]>();

  if (error)
    throw new Error(`Error al obtener reservas de oficina: ${error.message}`);

  return (data ?? []).map(
    (r): ReservationWithDetails => ({
      id: r.id,
      spot_id: r.spot_id,
      spot_label: r.spots?.label ?? "",
      resource_type: "office",
      user_id: r.user_id,
      user_name: r.profiles?.full_name ?? "",
      date: r.date,
      status: r.status,
      notes: r.notes,
      start_time: r.start_time,
      end_time: r.end_time,
      created_at: r.created_at,
    })
  );
}
