/**
 * Acciones de cesión compartidas
 *
 * Lógica única parametrizada por tipo de recurso.
 * Los módulos de ruta (parking, oficinas) importan buildCessionActions
 * y reexportan con la config correspondiente.
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

type ResourceType = "parking" | "office";

type CessionConfig = {
  resourceType: ResourceType;
  /** Nombre del recurso en singular ("plaza" | "puesto") */
  noun: string;
  /** Ruta base para revalidar ("/parking" | "/oficinas") */
  basePath: string;
  /** Prefijo para logs de error ("[parking]" | "[oficinas]") */
  logPrefix: string;
};

export function buildCessionActions(cfg: CessionConfig) {
  const createCession = actionClient
    .schema(createCessionSchema)
    .action(async ({ parsedInput }) => {
      const user = await getCurrentUser();
      if (!user) throw new Error("No autenticado");

      const entityId = await getEffectiveEntityId();
      const config = await getAllResourceConfigs(cfg.resourceType, entityId);
      if (!config.cession_enabled) {
        throw new Error(
          `Las cesiones de ${cfg.resourceType === "parking" ? "parking" : "oficina"} están deshabilitadas`
        );
      }

      const [spot] = await db
        .select({
          id: spots.id,
          assignedTo: spots.assignedTo,
          resourceType: spots.resourceType,
        })
        .from(spots)
        .where(eq(spots.id, parsedInput.spot_id))
        .limit(1);

      if (!spot)
        throw new Error(
          `${cfg.noun.charAt(0).toUpperCase() + cfg.noun.slice(1)} no encontrad${cfg.noun === "plaza" ? "a" : "o"}`
        );
      if (spot.resourceType !== cfg.resourceType) {
        throw new Error(
          `Este${cfg.noun === "plaza" ? "a" : ""} ${cfg.noun} no es un espacio de ${cfg.resourceType === "parking" ? "parking" : "oficina"}`
        );
      }
      if (spot.assignedTo !== user.id) {
        throw new Error(
          `Solo puedes ceder tu propi${cfg.noun === "plaza" ? "a" : "o"} ${cfg.noun}`
        );
      }

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

        revalidatePath(cfg.basePath);
        revalidatePath(`${cfg.basePath}/cesiones`);
        return { count: inserted.length };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (
          msg.includes("23505") ||
          msg.includes("unique") ||
          msg.includes("duplicate")
        ) {
          throw new Error(
            `Ya existe una cesión para est${cfg.noun === "plaza" ? "a" : "e"} ${cfg.noun} en uno de los días seleccionados`
          );
        }
        console.error(`${cfg.logPrefix} createCession DB error:`, {
          userId: user.id,
          spotId: parsedInput.spot_id,
          dates: parsedInput.dates,
          error: msg,
        });
        throw new Error(`Error al crear cesión: ${msg}`);
      }
    });

  const cancelCession = actionClient
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

      // Comprobamos la reserva real en BD, NO el campo cession.status,
      // para evitar estados inconsistentes si la sincronización falló.
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
          `No se puede cancelar: alguien ya ha reservado est${cfg.noun === "plaza" ? "a" : "e"} ${cfg.noun}`
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
        console.error(`${cfg.logPrefix} cancelCession DB error:`, {
          userId: user.id,
          cessionId: parsedInput.id,
          error: msg,
        });
        throw new Error(`Error al cancelar cesión: ${msg}`);
      }

      revalidatePath(cfg.basePath);
      revalidatePath(`${cfg.basePath}/cesiones`);
      return { cancelled: true, reservationAlsoCancelled: !!activeReservation };
    });

  async function getMyCessions(): Promise<ActionResult<CessionWithDetails[]>> {
    try {
      const user = await getCurrentUser();
      if (!user) return error("No autenticado");

      const userCessions = await getUserCessions(user.id, cfg.resourceType);
      return success(userCessions);
    } catch (err) {
      console.error(`${cfg.logPrefix} getMyCessions error:`, err);
      return error(
        err instanceof Error ? err.message : "Error al obtener cesiones"
      );
    }
  }

  return { createCession, cancelCession, getMyCessions };
}
