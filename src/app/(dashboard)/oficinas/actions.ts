"use server";

/**
 * Server Actions de Reservas de Oficina
 *
 * Server Actions para reservar puestos de trabajo en la oficina.
 * Soporta reservas de día completo y por franjas horarias (según config).
 */

import { revalidatePath } from "next/cache";
import { actionClient, type ActionResult, success, error } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import {
  createOfficeReservationSchema,
  cancelReservationSchema,
} from "@/lib/validations";
import type { SpotWithStatus, TimeSlot, ReservationWithDetails } from "@/types";
import { getAllResourceConfigs } from "@/lib/config";
import {
  getOfficeAvailabilityForDate,
  getAvailableTimeSlots,
  getUserOfficeReservations,
} from "@/lib/queries/offices";
import { getDayOfWeek } from "@/lib/utils";
import { validateBookingDate } from "@/lib/booking-validation";

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

    const config = await getAllResourceConfigs("office");

    if (!config.booking_enabled) return success([]);

    const dayOfWeek = getDayOfWeek(date);
    if (!config.allowed_days.includes(dayOfWeek)) return success([]);

    const spots = await getOfficeAvailabilityForDate(date, startTime, endTime);
    return success(spots);
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

    const config = await getAllResourceConfigs("office");

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

    const reservations = await getUserOfficeReservations(user.id);
    return success(reservations);
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

    const config = await getAllResourceConfigs("office");

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
      const toMinutes = (t: string) => {
        const [h, m] = t.split(":").map(Number);
        return (h ?? 0) * 60 + (m ?? 0);
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

    const supabase = await createClient();

    // Verificar que el spot es de tipo oficina
    const { data: spot } = await supabase
      .from("spots")
      .select("id, resource_type")
      .eq("id", parsedInput.spot_id)
      .maybeSingle();

    if (!spot) throw new Error("Puesto no encontrado");
    if (spot.resource_type !== "office") {
      throw new Error("Este puesto no es un espacio de oficina");
    }

    // Insertar reserva
    const { data, error: insertError } = await supabase
      .from("reservations")
      .insert({
        spot_id: parsedInput.spot_id,
        user_id: user.id,
        date: parsedInput.date,
        start_time: parsedInput.start_time ?? null,
        end_time: parsedInput.end_time ?? null,
        notes: parsedInput.notes ?? null,
      })
      .select("id")
      .single();

    if (insertError) {
      // Handle exclusion constraint violation (solapamiento de franjas)
      if (
        insertError.code === "23P01" ||
        insertError.code === "23505" ||
        insertError.message.includes("reservations_no_overlap")
      ) {
        throw new Error(
          "Esta franja horaria ya está reservada para este puesto"
        );
      }
      console.error("[oficinas] createOfficeReservation DB error:", {
        userId: user.id,
        spotId: parsedInput.spot_id,
        date: parsedInput.date,
        error: insertError.message,
      });
      throw new Error(`Error al crear reserva: ${insertError.message}`);
    }

    revalidatePath("/oficinas");
    revalidatePath("/mis-reservas");
    return { id: data.id };
  });

/**
 * Cancela una reserva de oficina existente.
 */
export const cancelOfficeReservation = actionClient
  .schema(cancelReservationSchema)
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("id", parsedInput.id)
      .eq("user_id", user.id)
      .select("id");

    if (error) {
      console.error("[oficinas] cancelOfficeReservation DB error:", {
        userId: user.id,
        reservationId: parsedInput.id,
        error: error.message,
      });
      throw new Error(`Error al cancelar reserva: ${error.message}`);
    }
    if (!data || data.length === 0) {
      throw new Error("Reserva no encontrada o no pertenece a tu cuenta");
    }

    revalidatePath("/oficinas");
    revalidatePath("/mis-reservas");
    return { cancelled: true };
  });
