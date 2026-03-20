"use server";

/**
 * Acciones de cesión
 *
 * Server Actions para que los directivos cedan sus plazas asignadas
 * en fechas específicas.
 */

import { revalidatePath } from "next/cache";
import { actionClient, success, error, type ActionResult } from "@/lib/actions";
import { db } from "@/lib/db";
import { spots, reservations, cessions } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/helpers";
import { createCessionSchema, cancelCessionSchema } from "@/lib/validations";
import { getAllResourceConfigs } from "@/lib/config";
import { getEffectiveEntityId } from "@/lib/queries/active-entity";
import { isTooSoonForCession } from "@/lib/calendar/calendar-utils";
import {
  getUserCessions as queryUserCessions,
  type CessionWithDetails,
} from "@/lib/queries/cessions";
import { eq, and } from "drizzle-orm";

/**
 * Crea cesiones para múltiples fechas.
 *
 * Reglas de negocio:
 * - El usuario debe tener una plaza de parking asignada (assigned_to = user.id, resource_type = 'parking')
 * - El usuario debe ser propietario de la plaza (assigned_to = user.id)
 * - Una cesión por plaza por fecha
 */
export const createCession = actionClient
  .schema(createCessionSchema)
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");

    const entityId = await getEffectiveEntityId();
    // Comprobar si las cesiones de parking están habilitadas
    const config = await getAllResourceConfigs("parking", entityId);
    if (!config.cession_enabled) {
      throw new Error("Las cesiones de parking están deshabilitadas");
    }

    // Verificar que el usuario es dueño de la plaza y que es de parking
    // (verificar ANTES del check de antelación para dar el error correcto)
    const [spot] = await db
      .select({
        id: spots.id,
        assignedTo: spots.assignedTo,
        resourceType: spots.resourceType,
      })
      .from(spots)
      .where(eq(spots.id, parsedInput.spot_id))
      .limit(1);

    if (!spot) throw new Error("Plaza no encontrada");
    if (spot.resourceType !== "parking") {
      throw new Error("Esta plaza no es un espacio de parking");
    }
    if (spot.assignedTo !== user.id) {
      throw new Error("Solo puedes ceder tu propia plaza");
    }

    // Comprobar antelación mínima en TODAS las fechas seleccionadas
    if (config.cession_min_advance_hours > 0) {
      for (const dateStr of parsedInput.dates) {
        if (isTooSoonForCession(dateStr, config.cession_min_advance_hours)) {
          throw new Error(
            `La fecha ${dateStr} no cumple la antelación mínima de ${config.cession_min_advance_hours} horas`
          );
        }
      }
    }

    // Insert one cession per date
    const rows = parsedInput.dates.map((date) => ({
      spotId: parsedInput.spot_id,
      userId: user.id,
      date,
    }));

    try {
      const inserted = await db
        .insert(cessions)
        .values(rows)
        .returning({ id: cessions.id });

      revalidatePath("/parking");
      revalidatePath("/parking/cesiones");
      return { count: inserted.length };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (
        msg.includes("23505") ||
        msg.includes("unique") ||
        msg.includes("duplicate")
      ) {
        throw new Error(
          "Ya existe una cesión para esta plaza en uno de los días seleccionados"
        );
      }
      console.error("[parking] createCession DB error:", {
        userId: user.id,
        spotId: parsedInput.spot_id,
        dates: parsedInput.dates,
        error: msg,
      });
      throw new Error(`Error al crear cesión: ${msg}`);
    }
  });

/**
 * Cancela una cesión.
 *
 * Reglas de negocio:
 * - El usuario debe ser el propietario de la cesión
 * - No se puede cancelar si la cesión ya ha sido reservada
 */
export const cancelCession = actionClient
  .schema(cancelCessionSchema)
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");

    // Fetch the cession to check status
    const [cession] = await db
      .select({
        id: cessions.id,
        status: cessions.status,
        userId: cessions.userId,
        spotId: cessions.spotId,
        date: cessions.date,
      })
      .from(cessions)
      .where(eq(cessions.id, parsedInput.id))
      .limit(1);

    if (!cession) {
      throw new Error("Cesión no encontrada");
    }

    if (cession.userId !== user.id && user.profile?.role !== "admin") {
      throw new Error("No puedes cancelar esta cesión");
    }

    // Buscar si hay una reserva activa sobre esta plaza+fecha.
    // IMPORTANTE: comprobamos la reserva real en BD, NO nos fiamos del campo
    // cession.status, que puede quedar dessincronizado si la actualización a
    // "reserved" falló silenciosamente en createReservation. Usar solo
    // activeReservation como fuente de verdad evita que un directivo pueda
    // cancelar una cesión que ya tiene un empleado reservado.
    const [activeReservation] = await db
      .select({ id: reservations.id })
      .from(reservations)
      .where(
        and(
          eq(reservations.spotId, cession.spotId),
          eq(reservations.date, cession.date),
          eq(reservations.status, "confirmed")
        )
      )
      .limit(1);

    if (activeReservation && user.profile?.role !== "admin") {
      throw new Error(
        "No se puede cancelar: alguien ya ha reservado esta plaza"
      );
    }

    // Cancelar la reserva activa del empleado PRIMERO: si falla, la cesión
    // permanece intacta y no hay estado inconsistente.
    if (activeReservation) {
      try {
        await db
          .update(reservations)
          .set({ status: "cancelled" })
          .where(eq(reservations.id, activeReservation.id));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        // La cesión NO se ha modificado → no hay estado inconsistente.
        throw new Error(
          `No se pudo anular la reserva del empleado: ${msg}. La cesión no ha sido modificada.`
        );
      }
    }

    // Cancelar la cesión
    try {
      await db
        .update(cessions)
        .set({ status: "cancelled" })
        .where(eq(cessions.id, parsedInput.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      console.error("[parking] cancelCession DB error:", {
        userId: user.id,
        cessionId: parsedInput.id,
        error: msg,
      });
      throw new Error(`Error al cancelar cesión: ${msg}`);
    }

    revalidatePath("/parking");
    revalidatePath("/parking/cesiones");
    return { cancelled: true, reservationAlsoCancelled: !!activeReservation };
  });

/**
 * Obtiene las cesiones activas del usuario actual.
 * Wrapper de acción para que los componentes cliente puedan llamarla.
 */
export async function getMyParkingCessions(): Promise<
  ActionResult<CessionWithDetails[]>
> {
  try {
    const user = await getCurrentUser();
    if (!user) return error("No autenticado");

    const userCessions = await queryUserCessions(user.id, "parking");
    return success(userCessions);
  } catch (err) {
    console.error("[parking] getMyParkingCessions error:", err);
    return error(
      err instanceof Error ? err.message : "Error al obtener cesiones"
    );
  }
}
