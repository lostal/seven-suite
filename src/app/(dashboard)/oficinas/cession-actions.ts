"use server";

/**
 * Acciones de cesión de puestos de oficina
 *
 * Server Actions para que los usuarios con puesto preferente asignado
 * (management) puedan cederlo al pool general en fechas específicas.
 */

import { actionClient, success, error, type ActionResult } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createCessionSchema, cancelCessionSchema } from "@/lib/validations";
import { getAllResourceConfigs } from "@/lib/config";
import { isTooSoonForCession } from "@/lib/calendar/calendar-utils";
import {
  getUserCessions,
  type CessionWithDetails,
} from "@/lib/queries/cessions";

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

    // Comprobar si las cesiones de oficina están habilitadas
    const config = await getAllResourceConfigs("office");
    if (!config.cession_enabled) {
      throw new Error("Las cesiones de oficina están deshabilitadas");
    }

    const supabase = await createClient();

    // Verificar que el usuario es dueño del puesto y que es de oficina
    const { data: spot, error: spotError } = await supabase
      .from("spots")
      .select("id, assigned_to, resource_type")
      .eq("id", parsedInput.spot_id)
      .maybeSingle();

    if (spotError)
      throw new Error(`Error al verificar puesto: ${spotError.message}`);
    if (!spot) throw new Error("Puesto no encontrado");
    if (spot.resource_type !== "office") {
      throw new Error("Este puesto no es un espacio de oficina");
    }
    if (spot.assigned_to !== user.id) {
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
      spot_id: parsedInput.spot_id,
      user_id: user.id,
      date,
    }));

    const { data, error } = await supabase
      .from("cessions")
      .insert(rows)
      .select("id");

    if (error) {
      if (error.code === "23505") {
        throw new Error(
          "Ya existe una cesión para este puesto en uno de los días seleccionados"
        );
      }
      throw new Error(`Error al crear cesión: ${error.message}`);
    }

    return { count: data.length };
  });

/**
 * Cancela una cesión de puesto de oficina.
 */
export const cancelOfficeCession = actionClient
  .schema(cancelCessionSchema)
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");

    const supabase = await createClient();

    const { data: cession, error: fetchError } = await supabase
      .from("cessions")
      .select("id, status, user_id, spot_id, date")
      .eq("id", parsedInput.id)
      .single();

    if (fetchError || !cession) throw new Error("Cesión no encontrada");

    if (cession.user_id !== user.id && user.profile?.role !== "admin") {
      throw new Error("No puedes cancelar esta cesión");
    }

    // Buscar si hay una reserva activa sobre este puesto+fecha.
    // IMPORTANTE: comprobamos la reserva real en BD, NO nos fiamos del campo
    // cession.status para evitar estados inconsistentes.
    const { data: activeReservation } = await supabase
      .from("reservations")
      .select("id")
      .eq("spot_id", cession.spot_id)
      .eq("date", cession.date)
      .eq("status", "confirmed")
      .maybeSingle();

    if (activeReservation && user.profile?.role !== "admin") {
      throw new Error(
        "No se puede cancelar: alguien ya ha reservado este puesto"
      );
    }

    // Cancelar la reserva activa del empleado PRIMERO: si falla, la cesión
    // permanece intacta y no hay estado inconsistente.
    if (activeReservation) {
      const { error: reservationError } = await supabase
        .from("reservations")
        .update({ status: "cancelled" })
        .eq("id", activeReservation.id);

      if (reservationError) {
        throw new Error(
          `No se pudo anular la reserva del empleado: ${reservationError.message}. La cesión no ha sido modificada.`
        );
      }
    }

    const { error: updateError } = await supabase
      .from("cessions")
      .update({ status: "cancelled" })
      .eq("id", parsedInput.id);

    if (updateError) {
      throw new Error(`Error al cancelar cesión: ${updateError.message}`);
    }

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

    const cessions = await getUserCessions(user.id, "office");
    return success(cessions);
  } catch (err) {
    console.error("[oficinas] getMyOfficeCessions error:", err);
    return error(
      err instanceof Error ? err.message : "Error al obtener cesiones"
    );
  }
}
