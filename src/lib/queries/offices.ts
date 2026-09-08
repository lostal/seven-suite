/**
 * Queries de Oficinas
 *
 * Funciones de acceso a datos para puestos de oficina y sus reservas.
 * Las reservas de oficina pueden ser de día completo o por franja horaria.
 */

import { db } from "@/lib/db";
import {
  spots as spotsTable,
  reservations as reservationsTable,
  cessions as cessionsTable,
  profiles as profilesTable,
} from "@/lib/db/schema";
import type { Spot } from "@/lib/db/types";
import type { SpotWithStatus, TimeSlot, ReservationWithDetails } from "@/types";
import { toServerDateStr } from "@/lib/utils";
import { eq, and, gte, or, isNull, ne, inArray } from "drizzle-orm";

// ─── Queries de disponibilidad ────────────────────────────────

/**
 * Obtiene todos los puestos de oficina activos.
 * @param entityId - Si se provee, filtra por esa entidad (incluye puestos sin entidad asignada).
 */
export async function getOfficeSpots(
  entityId?: string | null
): Promise<Spot[]> {
  const conditions = [
    eq(spotsTable.isActive, true),
    eq(spotsTable.resourceType, "office"),
  ];

  if (entityId) {
    conditions.push(
      or(eq(spotsTable.entityId, entityId), isNull(spotsTable.entityId))!
    );
  }

  try {
    const rows = await db
      .select()
      .from(spotsTable)
      .where(and(...conditions))
      .orderBy(spotsTable.label);
    return rows;
  } catch (err) {
    console.error("[offices] getOfficeSpots query error", err);
    throw new Error("No se pudieron obtener los puestos");
  }
}

/**
 * Obtiene los puestos de oficina con su estado para una fecha dada.
 * Tiene en cuenta reservas confirmadas, cesiones y estado de cada puesto.
 *
 * @param date - Fecha ISO YYYY-MM-DD
 * @param startTime - Hora de inicio para filtrar solapamientos (opcional)
 * @param endTime - Hora de fin para filtrar solapamientos (opcional)
 * @param entityId - Si se provee, filtra por esa entidad (incluye puestos sin entidad asignada).
 */
export async function getOfficeAvailabilityForDate(
  date: string,
  startTime?: string,
  endTime?: string,
  entityId?: string | null
): Promise<SpotWithStatus[]> {
  const spotConditions = [
    eq(spotsTable.isActive, true),
    eq(spotsTable.resourceType, "office"),
  ];

  if (entityId) {
    spotConditions.push(
      or(eq(spotsTable.entityId, entityId), isNull(spotsTable.entityId))!
    );
  }

  const spots = await db
    .select()
    .from(spotsTable)
    .where(and(...spotConditions))
    .orderBy(spotsTable.label);

  if (spots.length === 0) return [];

  const spotIds = spots.map((s) => s.id);

  const [reservations, cessions] = await Promise.all([
    db
      .select({
        id: reservationsTable.id,
        spotId: reservationsTable.spotId,
        startTime: reservationsTable.startTime,
        endTime: reservationsTable.endTime,
      })
      .from(reservationsTable)
      .where(
        and(
          eq(reservationsTable.date, date),
          eq(reservationsTable.status, "confirmed"),
          inArray(reservationsTable.spotId, spotIds)
        )
      ),
    db
      .select({
        id: cessionsTable.id,
        spotId: cessionsTable.spotId,
        status: cessionsTable.status,
      })
      .from(cessionsTable)
      .where(
        and(
          eq(cessionsTable.date, date),
          ne(cessionsTable.status, "cancelled"),
          inArray(cessionsTable.spotId, spotIds)
        )
      ),
  ]);

  const cessionBySpot = new Map(cessions.map((c) => [c.spotId, c]));

  const result: SpotWithStatus[] = [];

  for (const spot of spots) {
    // Reservas activas en este puesto para la fecha
    const spotReservations = reservations.filter((r) => r.spotId === spot.id);

    let isOccupied = false;

    if (startTime && endTime) {
      // Reserva por franja: comprobar solapamiento
      isOccupied = spotReservations.some((r) => {
        if (!r.startTime || !r.endTime) return true; // Día completo bloquea toda franja
        // Solapamiento: no (r.endTime <= startTime || r.startTime >= endTime)
        return !(r.endTime <= startTime || r.startTime >= endTime);
      });
    } else {
      // Sin franja: está ocupado si tiene cualquier reserva confirmada
      isOccupied = spotReservations.length > 0;
    }

    if (isOccupied) {
      result.push({
        id: spot.id,
        label: spot.label,
        type: spot.type,
        resource_type: "office",
        assigned_to: spot.assignedTo,
        position_x: spot.positionX,
        position_y: spot.positionY,
        status: "occupied",
        reservation_id: spotReservations[0]?.id,
      });
      continue;
    }

    if (spot.type === "visitor") {
      // Plazas flexibles: siempre disponibles salvo reserva activa — no requieren cesión.
      result.push({
        id: spot.id,
        label: spot.label,
        type: spot.type,
        resource_type: "office",
        assigned_to: spot.assignedTo,
        position_x: spot.positionX,
        position_y: spot.positionY,
        status: "free",
      });
      continue;
    }

    if (spot.assignedTo !== null) {
      // Puesto con propietario: solo disponible si el dueño lo ha cedido activamente
      const cession = cessionBySpot.get(spot.id);
      if (!cession || cession.status !== "available") {
        // Sin cesión activa: bloqueado por su dueño
        result.push({
          id: spot.id,
          label: spot.label,
          type: spot.type,
          resource_type: "office",
          assigned_to: spot.assignedTo,
          position_x: spot.positionX,
          position_y: spot.positionY,
          status: "occupied",
        });
        continue;
      }

      result.push({
        id: spot.id,
        label: spot.label,
        type: spot.type,
        resource_type: "office",
        assigned_to: spot.assignedTo,
        position_x: spot.positionX,
        position_y: spot.positionY,
        status: "ceded",
      });
    } else {
      // Sin propietario → no reservable directamente; se muestra como ocupado
      result.push({
        id: spot.id,
        label: spot.label,
        type: spot.type,
        resource_type: "office",
        assigned_to: spot.assignedTo,
        position_x: spot.positionX,
        position_y: spot.positionY,
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
  const rows = await db
    .select({
      startTime: reservationsTable.startTime,
      endTime: reservationsTable.endTime,
    })
    .from(reservationsTable)
    .where(
      and(
        eq(reservationsTable.spotId, spotId),
        eq(reservationsTable.date, date),
        eq(reservationsTable.status, "confirmed")
      )
    );

  const allReservations = rows ?? [];
  // All-day reservations (null start/end) block the entire day: every slot is taken.
  const hasAllDayBooking = allReservations.some(
    (r) => !r.startTime || !r.endTime
  );
  const bookedSlots = allReservations.filter(
    (r) => r.startTime && r.endTime
  ) as { startTime: string; endTime: string }[];

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

    const isBooked =
      hasAllDayBooking ||
      bookedSlots.some(
        (r) => !(r.endTime <= slotStart || r.startTime >= slotEnd)
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
  const today = toServerDateStr(new Date());

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
        eq(reservationsTable.status, "confirmed"),
        eq(spotsTable.resourceType, "office"),
        gte(reservationsTable.date, today)
      )
    )
    .orderBy(reservationsTable.date);

  return rows
    .filter((r) => r.spot_resource_type === "office")
    .map((r): ReservationWithDetails => ({
      id: r.id,
      spot_id: r.spot_id,
      spot_label: r.spot_label,
      resource_type: "office",
      user_id: r.user_id,
      user_name: r.user_name ?? "",
      date: r.date,
      status: r.status,
      notes: r.notes,
      start_time: r.start_time,
      end_time: r.end_time,
      created_at: r.created_at.toISOString(),
    }));
}
