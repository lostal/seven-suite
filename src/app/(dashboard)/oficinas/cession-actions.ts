"use server";

/**
 * Acciones de cesión de puestos de oficina
 *
 * Server Actions para que los usuarios con puesto preferente asignado
 * puedan cederlo al pool general en fechas específicas.
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
  getUserCessions,
  type CessionWithDetails,
} from "@/lib/queries/cessions";
import { eq, and } from "drizzle-orm";

/**
 * Crea cesiones de puesto de oficina para múltiples fechas.
 *
 * El usuario debe tener un puesto de tipo 'assigned' con resource_type='office'
 * asignado para poder ceder.
 */
export const createOfficeCession = actionClient
  .schema(createCessionSchema)
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");

    const entityId = await getEffectiveEntityId();
    // Comprobar si las cesiones de oficina están habilitadas
    const config = await getAllResourceConfigs("office", entityId);
    if (!config.cession_enabled) {
      throw new Error("Las cesiones de oficina están deshabilitadas");
    }

    // Verificar que el usuario es dueño del puesto y que es de oficina
    const [spot] = await db
      .select({
        id: spots.id,
        assignedTo: spots.assignedTo,
        resourceType: spots.resourceType,
      })
      .from(spots)
      .where(eq(spots.id, parsedInput.spot_id))
      .limit(1);

    if (!spot) throw new Error("Puesto no encontrado");
    if (spot.resourceType !== "office") {
      throw new Error("Este puesto no es un espacio de oficina");
    }
    if (spot.assignedTo !== user.id) {
      throw new Error("Solo puedes ceder tu propio puesto");
    }

    // Check advance hours if configured
    if (config.cession_min_advance_hours > 0) {
      for (const dateStr of parsedInput.dates) {
        if (isTooSoonForCession(dateStr, config.cession_min_advance_hours)) {
          throw new Error(
            `La fecha ${dateStr} no cumple la antelación mínima de ${config.cession_min_advance_hours} horas`
          );
        }
      }
    }

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

      revalidatePath("/oficinas");
      revalidatePath("/oficinas/cesiones");
      return { count: inserted.length };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (
        msg.includes("23505") ||
        msg.includes("unique") ||
        msg.includes("duplicate")
      ) {
        throw new Error(
          "Ya existe una cesión para este puesto en uno de los días seleccionados"
        );
      }
      throw new Error(`Error al crear cesión: ${msg}`);
    }
  });

/**
 * Cancela una cesión de puesto de oficina.
 */
export const cancelOfficeCession = actionClient
  .schema(cancelCessionSchema)
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");

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

    if (!cession) throw new Error("Cesión no encontrada");

    if (cession.userId !== user.id && user.profile?.role !== "admin") {
      throw new Error("No puedes cancelar esta cesión");
    }

    // Buscar si hay una reserva activa sobre este puesto+fecha.
    // IMPORTANTE: comprobamos la reserva real en BD, NO nos fiamos del campo
    // cession.status para evitar estados inconsistentes.
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
        "No se puede cancelar: alguien ya ha reservado este puesto"
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
        throw new Error(
          `No se pudo anular la reserva del empleado: ${msg}. La cesión no ha sido modificada.`
        );
      }
    }

    try {
      await db
        .update(cessions)
        .set({ status: "cancelled" })
        .where(eq(cessions.id, parsedInput.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      throw new Error(`Error al cancelar cesión: ${msg}`);
    }

    revalidatePath("/oficinas");
    revalidatePath("/oficinas/cesiones");
    return { cancelled: true, reservationAlsoCancelled: !!activeReservation };
  });

/**
 * Obtiene las cesiones de oficina activas del usuario actual.
 * Wrapper de acción para que los componentes cliente puedan llamarla.
 */
export async function getMyOfficeCessions(): Promise<
  ActionResult<CessionWithDetails[]>
> {
  try {
    const user = await getCurrentUser();
    if (!user) return error("No autenticado");

    const officeCessions = await getUserCessions(user.id, "office");
    return success(officeCessions);
  } catch (err) {
    console.error("[oficinas] getMyOfficeCessions error:", err);
    return error(
      err instanceof Error ? err.message : "Error al obtener cesiones"
    );
  }
}
