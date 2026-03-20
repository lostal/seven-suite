"use server";

/**
 * Server Actions de Reservas de Oficina
 *
 * Server Actions para reservar puestos de trabajo en la oficina.
 * Soporta reservas de día completo y por franjas horarias (según config).
 */

import { revalidatePath } from "next/cache";
import { actionClient, type ActionResult, success, error } from "@/lib/actions";
import { db } from "@/lib/db";
import { spots, reservations } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/helpers";
import {
  createOfficeReservationSchema,
  cancelReservationSchema,
} from "@/lib/validations";
import type { SpotWithStatus, TimeSlot, ReservationWithDetails } from "@/types";
import { getAllResourceConfigs } from "@/lib/config";
import { getEffectiveEntityId } from "@/lib/queries/active-entity";
import {
  getOfficeAvailabilityForDate,
  getAvailableTimeSlots,
  getUserOfficeReservations,
} from "@/lib/queries/offices";
import { getDayOfWeek } from "@/lib/utils";
import { validateBookingDate } from "@/lib/booking-validation";
import { eq, and } from "drizzle-orm";

// ─── Queries ──────────────────────────────────────────────────

/**
 * Obtiene la disponibilidad de puestos de oficina para una fecha.
 * Si se proporcionan start_time/end_time, filtra por solapamiento de franja.
 */
export async function getOfficeSpotsForDate(
  date: string,
  startTime?: string,
  endTime?: string
): Promise<ActionResult<SpotWithStatus[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) return error("No autenticado");

    const entityId = await getEffectiveEntityId();
    const config = await getAllResourceConfigs("office", entityId);

    if (!config.booking_enabled) return success([]);

    const dayOfWeek = getDayOfWeek(date);
    if (!config.allowed_days.includes(dayOfWeek)) return success([]);

    const officeSpots = await getOfficeAvailabilityForDate(
      date,
      startTime,
      endTime,
      entityId
    );
    return success(officeSpots);
  } catch (err) {
    console.error("[oficinas] getOfficeSpotsForDate error:", err);
    return error(
      err instanceof Error ? err.message : "Error al obtener disponibilidad"
    );
  }
}

/**
 * Devuelve las franjas horarias disponibles para un puesto en una fecha.
 * Lee la configuración de franjas (duración, hora de inicio/fin) desde system_config.
 */
export async function getOfficeTimeSlotsForSpot(
  spotId: string,
  date: string
): Promise<ActionResult<TimeSlot[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) return error("No autenticado");

    const entityId = await getEffectiveEntityId();
    const config = await getAllResourceConfigs("office", entityId);

    if (!config.time_slots_enabled) {
      return error("Las franjas horarias no están habilitadas");
    }

    if (
      config.slot_duration_minutes === null ||
      config.day_start_hour === null ||
      config.day_end_hour === null
    ) {
      return error("La configuración de franjas no está completa");
    }

    const slots = await getAvailableTimeSlots(
      spotId,
      date,
      config.day_start_hour,
      config.day_end_hour,
      config.slot_duration_minutes
    );

    return success(slots);
  } catch (err) {
    console.error("[oficinas] getOfficeTimeSlotsForSpot error:", err);
    return error(
      err instanceof Error ? err.message : "Error al obtener franjas"
    );
  }
}

/**
 * Obtiene las reservas de oficina futuras del usuario actual.
 */
export async function getMyOfficeReservations(): Promise<
  ActionResult<ReservationWithDetails[]>
> {
  try {
    const user = await getCurrentUser();
    if (!user) return error("No autenticado");

    const officeReservations = await getUserOfficeReservations(user.id);
    return success(officeReservations);
  } catch (err) {
    console.error("[oficinas] getMyOfficeReservations error:", err);
    return error(
      err instanceof Error ? err.message : "Error al obtener tus reservas"
    );
  }
}

// ─── Mutations ────────────────────────────────────────────────

/**
 * Crea una nueva reserva de puesto de oficina.
 *
 * Reglas de negocio (leídas desde system_config con prefijo office.*):
 * - Las reservas deben estar habilitadas (office.booking_enabled)
 * - La fecha debe ser un día permitido (office.allowed_days)
 * - La fecha no puede superar el límite de antelación (office.max_advance_days)
 * - Si time_slots_enabled, start_time y end_time son obligatorios
 * - No puede haber solapamiento de franjas para el mismo puesto/fecha
 */
export const createOfficeReservation = actionClient
  .schema(createOfficeReservationSchema)
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");

    const entityId = await getEffectiveEntityId();
    const config = await getAllResourceConfigs("office", entityId);

    // Comprobar si las reservas están habilitadas
    if (!config.booking_enabled) {
      throw new Error(
        "Las reservas de oficina están deshabilitadas actualmente"
      );
    }

    // Comprobar día permitido, fechas pasadas y antelación máxima
    validateBookingDate(parsedInput.date, config);

    // Si las franjas están habilitadas, las horas son obligatorias y deben estar dentro del horario del día
    if (config.time_slots_enabled) {
      if (!parsedInput.start_time || !parsedInput.end_time) {
        throw new Error(
          "Debes seleccionar una franja horaria para reservar este puesto"
        );
      }
      const toMinutes = (t: string): number => {
        const parts = t.split(":");
        const h = parseInt(parts[0] ?? "", 10);
        const m = parseInt(parts[1] ?? "0", 10);
        if (isNaN(h) || isNaN(m)) {
          throw new Error(`Formato de hora inválido: ${t}`);
        }
        return h * 60 + m;
      };
      const startMins = toMinutes(parsedInput.start_time);
      const endMins = toMinutes(parsedInput.end_time);
      const dayStart = config.day_start_hour ?? 0;
      const dayEnd = config.day_end_hour ?? 24;
      if (startMins < dayStart * 60 || endMins > dayEnd * 60) {
        throw new Error(
          `La franja horaria debe estar entre las ${dayStart}:00 y las ${dayEnd}:00`
        );
      }
    }

    // Verificar que el spot es de tipo oficina
    const [spot] = await db
      .select({
        id: spots.id,
        resourceType: spots.resourceType,
        entityId: spots.entityId,
      })
      .from(spots)
      .where(eq(spots.id, parsedInput.spot_id))
      .limit(1);

    if (!spot) throw new Error("Puesto no encontrado");
    if (spot.resourceType !== "office") {
      throw new Error("Este puesto no es un espacio de oficina");
    }
    if (entityId && spot.entityId !== null && spot.entityId !== entityId) {
      throw new Error("El puesto seleccionado no pertenece a la sede activa");
    }

    // Insertar reserva
    try {
      const [inserted] = await db
        .insert(reservations)
        .values({
          spotId: parsedInput.spot_id,
          userId: user.id,
          date: parsedInput.date,
          startTime: parsedInput.start_time ?? null,
          endTime: parsedInput.end_time ?? null,
          notes: parsedInput.notes ?? null,
        })
        .returning({ id: reservations.id });

      if (!inserted) throw new Error("No se pudo crear la reserva");

      revalidatePath("/oficinas");
      revalidatePath("/oficinas/reservas");
      return { id: inserted.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      // Handle exclusion constraint violation (solapamiento de franjas)
      if (
        msg.includes("23P01") ||
        msg.includes("23505") ||
        msg.includes("reservations_no_overlap") ||
        msg.includes("unique") ||
        msg.includes("duplicate")
      ) {
        throw new Error(
          "Esta franja horaria ya está reservada para este puesto"
        );
      }
      console.error("[oficinas] createOfficeReservation insert error", msg);
      throw new Error("No se pudo crear la reserva");
    }
  });

/**
 * Cancela una reserva de oficina existente.
 */
export const cancelOfficeReservation = actionClient
  .schema(cancelReservationSchema)
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");

    try {
      const updated = await db
        .update(reservations)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(reservations.id, parsedInput.id),
            eq(reservations.userId, user.id)
          )
        )
        .returning({ id: reservations.id });

      if (!updated || updated.length === 0) {
        throw new Error("Reserva no encontrada o no pertenece a tu cuenta");
      }

      revalidatePath("/oficinas");
      revalidatePath("/oficinas/reservas");
      return { cancelled: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "Reserva no encontrada o no pertenece a tu cuenta") throw err;
      console.error("[oficinas] cancelOfficeReservation update error", msg);
      throw new Error("No se pudo cancelar la reserva");
    }
  });
