"use server";

/**
 * Server Actions de Reservas de Aparcamiento
 *
 * Server Actions para crear y cancelar reservas de aparcamiento de empleados,
 * y funciones de consulta para la vista de lista del parking.
 */

import { revalidatePath } from "next/cache";
import { actionClient, type ActionResult, success, error } from "@/lib/actions";
import { db } from "@/lib/db";
import {
  spots,
  reservations,
  cessions,
  visitorReservations,
} from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/helpers";
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
import { eq, and, or, isNull, ne } from "drizzle-orm";

// ─── Available spots ─────────────────────────────────────────

/**
 * Obtiene las plazas disponibles de parking para una fecha dada.
 */
export async function getAvailableSpotsForDate(
  date: string
): Promise<ActionResult<SpotWithStatus[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) return error("No autenticado");

    const entityId = await getEffectiveEntityId();
    const config = await getAllResourceConfigs("parking", entityId);

    if (!config.booking_enabled) return success([]);

    const dayOfWeek = getDayOfWeek(date);
    if (!config.allowed_days.includes(dayOfWeek)) return success([]);

    // Obtain all data in parallel
    const spotsConditions = [
      eq(spots.isActive, true),
      eq(spots.resourceType, "parking"),
    ];
    if (entityId) {
      spotsConditions.push(
        or(eq(spots.entityId, entityId), isNull(spots.entityId))!
      );
    }

    const [allSpots, reservedRows, cessionRows, visitorRows] =
      await Promise.all([
        db
          .select()
          .from(spots)
          .where(and(...spotsConditions))
          .orderBy(spots.label),
        db
          .select({ id: reservations.id, spotId: reservations.spotId })
          .from(reservations)
          .where(
            and(
              eq(reservations.date, date),
              eq(reservations.status, "confirmed")
            )
          ),
        db
          .select({
            id: cessions.id,
            spotId: cessions.spotId,
            status: cessions.status,
          })
          .from(cessions)
          .where(
            and(eq(cessions.date, date), ne(cessions.status, "cancelled"))
          ),
        db
          .select({
            id: visitorReservations.id,
            spotId: visitorReservations.spotId,
          })
          .from(visitorReservations)
          .where(
            and(
              eq(visitorReservations.date, date),
              eq(visitorReservations.status, "confirmed")
            )
          ),
      ]);

    const reservedSpotIds = new Set(reservedRows.map((r) => r.spotId));
    const cessionBySpot = new Map(cessionRows.map((c) => [c.spotId, c]));
    const visitorSpotIds = new Set(visitorRows.map((v) => v.spotId));

    const available: SpotWithStatus[] = [];

    for (const spot of allSpots) {
      if (reservedSpotIds.has(spot.id)) continue;
      if (visitorSpotIds.has(spot.id)) continue;

      if (spot.type === "visitor") {
        available.push({
          id: spot.id,
          label: spot.label,
          type: spot.type,
          resource_type: "parking",
          assigned_to: spot.assignedTo,
          position_x: spot.positionX,
          position_y: spot.positionY,
          status: "free",
        });
        continue;
      }

      if (spot.assignedTo !== null) {
        const cession = cessionBySpot.get(spot.id);
        if (!cession || cession.status !== "available") continue;

        available.push({
          id: spot.id,
          label: spot.label,
          type: spot.type,
          resource_type: "parking",
          assigned_to: spot.assignedTo,
          position_x: spot.positionX,
          position_y: spot.positionY,
          status: "ceded",
        });
      }
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
 */
export async function getMyParkingReservations(): Promise<
  ActionResult<ReservationRow[]>
> {
  try {
    const user = await getCurrentUser();
    if (!user) return error("No autenticado");

    const reservationList = await getUserReservations(user.id, "parking");
    return success(reservationList);
  } catch (err) {
    console.error("[parking] getMyParkingReservations error:", err);
    return error(
      err instanceof Error ? err.message : "Error al obtener tus reservas"
    );
  }
}

/**
 * Crea una nueva reserva de aparcamiento.
 */
export const createReservation = actionClient
  .schema(createReservationSchema)
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");

    const entityId = await getEffectiveEntityId();
    const config = await getAllResourceConfigs("parking", entityId);

    if (!config.booking_enabled) {
      throw new Error(
        "Las reservas de parking están deshabilitadas actualmente"
      );
    }

    validateBookingDate(parsedInput.date, config);

    // Verificar que el spot es de tipo parking
    const [spot] = await db
      .select({
        id: spots.id,
        resourceType: spots.resourceType,
        entityId: spots.entityId,
      })
      .from(spots)
      .where(eq(spots.id, parsedInput.spot_id))
      .limit(1);

    if (!spot) throw new Error("Plaza no encontrada");
    if (spot.resourceType !== "parking") {
      throw new Error("Esta plaza no es un espacio de parking");
    }
    if (entityId && spot.entityId !== null && spot.entityId !== entityId) {
      throw new Error("La plaza seleccionada no pertenece a la sede activa");
    }

    // Check if user already has a reservation for this date
    const [existing] = await db
      .select({ id: reservations.id })
      .from(reservations)
      .where(
        and(
          eq(reservations.userId, user.id),
          eq(reservations.date, parsedInput.date),
          eq(reservations.status, "confirmed")
        )
      )
      .limit(1);

    if (existing) {
      throw new Error("Ya tienes una reserva para este día");
    }

    try {
      const [inserted] = await db
        .insert(reservations)
        .values({
          spotId: parsedInput.spot_id,
          userId: user.id,
          date: parsedInput.date,
          notes: parsedInput.notes ?? null,
        })
        .returning({ id: reservations.id });

      if (!inserted) throw new Error("No se pudo crear la reserva");

      revalidatePath("/parking");
      revalidatePath("/parking/reservas");
      return { id: inserted.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (
        msg.includes("23505") ||
        msg.includes("unique") ||
        msg.includes("duplicate")
      ) {
        // Check if it's a user duplicate
        const [userDuplicate] = await db
          .select({ id: reservations.id })
          .from(reservations)
          .where(
            and(
              eq(reservations.userId, user.id),
              eq(reservations.date, parsedInput.date),
              eq(reservations.status, "confirmed")
            )
          )
          .limit(1);

        if (userDuplicate) {
          throw new Error("Ya tienes una reserva para este día");
        }
        throw new Error("Esta plaza ya está reservada para este día");
      }
      console.error("[parking] createReservation insert error", msg);
      throw new Error("No se pudo crear la reserva");
    }
  });

/**
 * Cancela una reserva existente.
 */
export const cancelReservation = actionClient
  .schema(cancelReservationSchema)
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");

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

    revalidatePath("/parking");
    revalidatePath("/parking/reservas");
    return { cancelled: true };
  });
