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
import { isUniqueViolation, isExclusionViolation } from "@/lib/db/helpers";
import { spots, reservations, cessions } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/helpers";
import {
  createOfficeReservationSchema,
  cancelReservationSchema,
} from "@/lib/validations";
import type { SpotWithStatus, TimeSlot, ReservationWithDetails } from "@/types";
import { getAllResourceConfigs } from "@/lib/config";
import { assertModuleEnabled } from "@/lib/module-guard";
import { getEffectiveEntityId } from "@/lib/queries/active-entity";
import {
  getOfficeAvailabilityForDate,
  getAvailableTimeSlots,
  getUserOfficeReservations,
} from "@/lib/queries/offices";
import { getDayOfWeek } from "@/lib/utils";
import { validateBookingDate } from "@/lib/booking-validation";
import { eq, and, ne } from "drizzle-orm";

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
    await assertModuleEnabled("office", entityId);
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
    return error("Error al obtener disponibilidad");
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
    await assertModuleEnabled("office", entityId);
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
    return error("Error al obtener franjas");
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
    return error("Error al obtener tus reservas");
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
    await assertModuleEnabled("office", entityId);
    const isAdmin = user.profile?.role === "admin";

    if (!isAdmin && !entityId) {
      throw new Error(
        "No tienes una sede asignada. Contacta con un administrador."
      );
    }

    const config = await getAllResourceConfigs("office", entityId);

    // Comprobar si las reservas están habilitadas
    if (!config.booking_enabled) {
      throw new Error(
        "Las reservas de oficina están deshabilitadas actualmente"
      );
    }

    // Comprobar día permitido, fechas pasadas y antelación máxima
    validateBookingDate(parsedInput.date, config);

    try {
      const inserted = await db.transaction(async (tx) => {
        const [spot] = await tx
          .select({
            id: spots.id,
            resourceType: spots.resourceType,
            entityId: spots.entityId,
            isActive: spots.isActive,
            assignedTo: spots.assignedTo,
          })
          .from(spots)
          .where(eq(spots.id, parsedInput.spot_id))
          .for("update")
          .limit(1);

        if (!spot || spot.isActive === false)
          throw new Error("Puesto no encontrado");
        if (spot.resourceType !== "office") {
          throw new Error("Este puesto no es un espacio de oficina");
        }
        if (entityId && spot.entityId !== null && spot.entityId !== entityId) {
          throw new Error(
            "El puesto seleccionado no pertenece a la sede activa"
          );
        }

        const [occupiedRows, cessionRows] = await Promise.all([
          tx
            .select({ id: reservations.id })
            .from(reservations)
            .where(
              and(
                eq(reservations.spotId, parsedInput.spot_id),
                eq(reservations.date, parsedInput.date),
                eq(reservations.status, "confirmed")
              )
            )
            .limit(1),
          tx
            .select({ status: cessions.status })
            .from(cessions)
            .where(
              and(
                eq(cessions.spotId, parsedInput.spot_id),
                eq(cessions.date, parsedInput.date),
                ne(cessions.status, "cancelled")
              )
            )
            .limit(1),
        ]);

        if (occupiedRows[0]) {
          throw new Error("Este puesto ya está reservado para este día");
        }
        if (spot.assignedTo && cessionRows[0]?.status !== "available") {
          throw new Error("Este puesto no está cedido para este día");
        }

        const [row] = await tx
          .insert(reservations)
          .values({
            spotId: parsedInput.spot_id,
            userId: user.id,
            date: parsedInput.date,
            notes: parsedInput.notes ?? null,
          })
          .returning({ id: reservations.id });
        return row;
      });

      if (!inserted) throw new Error("No se pudo crear la reserva");

      revalidatePath("/oficinas");
      revalidatePath("/oficinas/reservas");
      return { id: inserted.id };
    } catch (err) {
      if (isUniqueViolation(err) || isExclusionViolation(err)) {
        throw new Error("Este puesto ya está reservado para este día");
      }
      if (
        err instanceof Error &&
        [
          "Puesto no encontrado",
          "Este puesto no es un espacio de oficina",
          "El puesto seleccionado no pertenece a la sede activa",
          "Este puesto ya está reservado para este día",
          "Este puesto no está cedido para este día",
          "No se pudo crear la reserva",
        ].includes(err.message)
      ) {
        throw err;
      }
      console.error("[oficinas] createOfficeReservation insert error", err);
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

    const entityId = await getEffectiveEntityId();
    await assertModuleEnabled("office", entityId);

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
  });
