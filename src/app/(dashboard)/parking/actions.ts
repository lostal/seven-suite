"use server";

/**
 * Server Actions de Reservas de Aparcamiento
 *
 * Server Actions para crear y cancelar reservas de aparcamiento de empleados,
 * y funciones de consulta para la vista de lista del parking.
 */

import { revalidatePath } from "next/cache";
import { actionClient, type ActionResult, success, error } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import {
  createReservationSchema,
  cancelReservationSchema,
} from "@/lib/validations";
import type { SpotWithStatus } from "@/types";
import {
  getUserReservations,
  type ReservationRow,
} from "@/lib/queries/reservations";
import { getAllResourceConfigs } from "@/lib/config";
import { getDayOfWeek } from "@/lib/utils";
import { getEffectiveEntityId } from "@/lib/queries/active-entity";
import { validateBookingDate } from "@/lib/booking-validation";

// ─── Available spots ─────────────────────────────────────────

/**
 * Obtiene las plazas disponibles de parking para una fecha dada.
 *
 * Lee la configuración del sistema para determinar:
 * - Si las reservas están habilitadas
 * - Si la fecha es un día permitido (según `parking.allowed_days`)
 *
 * Una plaza está "disponible" si:
 * - No tiene una reserva confirmada para esa fecha
 * - Si tiene dueño asignado (assigned_to ≠ null), debe existir una cesión activa
 * - Está activa y es de tipo 'parking'
 */
export async function getAvailableSpotsForDate(
  date: string
): Promise<ActionResult<SpotWithStatus[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) return error("No autenticado");

    const entityId = await getEffectiveEntityId();
    // Leer configuración del parking desde la BD
    const config = await getAllResourceConfigs("parking", entityId);

    // Comprobar si las reservas están habilitadas
    if (!config.booking_enabled) return success([]);

    // Comprobar si el día está permitido
    const dayOfWeek = getDayOfWeek(date);
    if (!config.allowed_days.includes(dayOfWeek)) return success([]);

    const supabase = await createClient();

    // Obtener todos los datos en paralelo
    const [spotsResult, reservationsResult, cessionsResult, visitorResult] =
      await Promise.all([
        entityId
          ? supabase
              .from("spots")
              .select("*")
              .eq("is_active", true)
              .eq("resource_type", "parking")
              .or(`entity_id.eq.${entityId},entity_id.is.null`)
              .order("label")
          : supabase
              .from("spots")
              .select("*")
              .eq("is_active", true)
              .eq("resource_type", "parking")
              .order("label"),
        supabase
          .from("reservations")
          .select("id, spot_id")
          .eq("date", date)
          .eq("status", "confirmed"),
        supabase
          .from("cessions")
          .select("id, spot_id, status")
          .eq("date", date)
          .neq("status", "cancelled"),
        supabase
          .from("visitor_reservations")
          .select("id, spot_id")
          .eq("date", date)
          .eq("status", "confirmed"),
      ]);

    if (spotsResult.error)
      return error(`Error al obtener plazas: ${spotsResult.error.message}`);

    const spots = spotsResult.data;
    const reservedSpotIds = new Set(
      (reservationsResult.data ?? []).map((r) => r.spot_id)
    );
    const cessionBySpot = new Map(
      (cessionsResult.data ?? []).map((c) => [c.spot_id, c])
    );
    const visitorSpotIds = new Set(
      (visitorResult.data ?? []).map((v) => v.spot_id)
    );

    const available: SpotWithStatus[] = [];

    for (const spot of spots) {
      // Omitir plazas con reservas confirmadas
      if (reservedSpotIds.has(spot.id)) continue;

      // Omitir plazas con reservas de visitantes
      if (visitorSpotIds.has(spot.id)) continue;

      if (spot.type === "visitor") {
        // Plazas de visitas: disponibles por defecto salvo reserva activa — no requieren cesión.
        available.push({
          id: spot.id,
          label: spot.label,
          type: spot.type,
          resource_type: "parking",
          assigned_to: spot.assigned_to,
          position_x: spot.position_x,
          position_y: spot.position_y,
          status: "free",
        });
        continue;
      }

      if (spot.assigned_to !== null) {
        // Plaza con propietario: solo disponible si tiene cesión activa
        const cession = cessionBySpot.get(spot.id);
        if (!cession || cession.status !== "available") continue;

        available.push({
          id: spot.id,
          label: spot.label,
          type: spot.type,
          resource_type: "parking",
          assigned_to: spot.assigned_to,
          position_x: spot.position_x,
          position_y: spot.position_y,
          status: "ceded",
        });
      }
      // Sin propietario → no reservable en el nuevo modelo:
      // solo las plazas cedidas activamente por su dueño son reservables.
    }

    return success(available);
  } catch (err) {
    console.error("[parking] getAvailableSpotsForDate error:", err);
    return error(
      err instanceof Error ? err.message : "Error al obtener plazas disponibles"
    );
  }
}

/**
 * Obtiene las reservas confirmadas futuras del usuario actual.
 * Devuelve reservas desde hoy en adelante, con detalles de plaza.
 */
export async function getMyParkingReservations(): Promise<
  ActionResult<ReservationRow[]>
> {
  try {
    const user = await getCurrentUser();
    if (!user) return error("No autenticado");

    const reservations = await getUserReservations(user.id, "parking");
    return success(reservations);
  } catch (err) {
    console.error("[parking] getMyParkingReservations error:", err);
    return error(
      err instanceof Error ? err.message : "Error al obtener tus reservas"
    );
  }
}

/**
 * Crea una nueva reserva de aparcamiento.
 *
 * Reglas de negocio (leídas desde system_config):
 * - El usuario debe estar autenticado
 * - Las reservas deben estar habilitadas (booking_enabled)
 * - La fecha debe ser un día permitido (allowed_days)
 * - La fecha no puede superar el límite de antelación (max_advance_days)
 * - Una reserva por usuario por día (garantizado por índice único de la BD)
 * - Una reserva por plaza por día (garantizado por índice único de la BD)
 */
export const createReservation = actionClient
  .schema(createReservationSchema)
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");

    const entityId = await getEffectiveEntityId();
    // Leer configuración del parking
    const config = await getAllResourceConfigs("parking", entityId);

    // Comprobar si las reservas están habilitadas
    if (!config.booking_enabled) {
      throw new Error(
        "Las reservas de parking están deshabilitadas actualmente"
      );
    }

    // Comprobar día permitido, fechas pasadas y antelación máxima
    validateBookingDate(parsedInput.date, config);

    const supabase = await createClient();

    // Verificar que el spot es de tipo parking
    const { data: spot } = await supabase
      .from("spots")
      .select("id, resource_type")
      .eq("id", parsedInput.spot_id)
      .maybeSingle();

    if (!spot) throw new Error("Plaza no encontrada");
    if (spot.resource_type !== "parking") {
      throw new Error("Esta plaza no es un espacio de parking");
    }

    // Check if user already has a reservation for this date
    const { data: existing } = await supabase
      .from("reservations")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", parsedInput.date)
      .eq("status", "confirmed")
      .maybeSingle();

    if (existing) {
      throw new Error("Ya tienes una reserva para este día");
    }

    // Insert reservation.
    // El trigger trg_sync_cession_status en la BD sincroniza automáticamente
    // cession.status → "reserved" dentro de la misma transacción.
    const { data, error } = await supabase
      .from("reservations")
      .insert({
        spot_id: parsedInput.spot_id,
        user_id: user.id,
        date: parsedInput.date,
        notes: parsedInput.notes ?? null,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("Esta plaza ya está reservada para este día");
      }
      throw new Error(`Error al crear reserva: ${error.message}`);
    }

    revalidatePath("/parking");
    revalidatePath("/parking/reservas");
    return { id: data.id };
  });

/**
 * Cancela una reserva existente.
 *
 * El trigger trg_sync_cession_status revierte cession.status → "available"
 * automáticamente si era una plaza de dirección cedida.
 */
export const cancelReservation = actionClient
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
      throw new Error(`Error al cancelar reserva: ${error.message}`);
    }
    if (!data || data.length === 0) {
      throw new Error("Reserva no encontrada o no pertenece a tu cuenta");
    }

    revalidatePath("/parking");
    revalidatePath("/parking/reservas");
    return { cancelled: true };
  });
