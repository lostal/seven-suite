"use server";

/**
 * Server Actions de Reservas de Visitantes
 *
 * Server Actions para crear, editar y cancelar reservas realizadas
 * por empleados para visitantes externos, con envío de emails
 * de confirmación y cancelación con archivo .ics adjunto.
 */

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { actionClient, type ActionResult, success, error } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import {
  createVisitorReservationSchema,
  updateVisitorReservationSchema,
  cancelVisitorReservationSchema,
} from "@/lib/validations";
import {
  sendVisitorReservationEmail,
  sendVisitorCancellationEmail,
} from "@/lib/email";
import {
  generateICSBuffer,
  generateCancellationICSBuffer,
  generateGoogleCalendarUrl,
  generateOutlookUrl,
} from "@/lib/calendar";
import {
  getUpcomingVisitorReservations,
  getAvailableVisitorSpotsForDate,
  type VisitorReservationWithDetails,
} from "@/lib/queries/visitor-reservations";
import { getResourceConfig } from "@/lib/config";

// ─── Funciones de consulta ────────────────────────────────────

/**
 * Obtiene las reservas de visitantes próximas confirmadas.
 */
export async function getVisitorReservationsAction(): Promise<
  ActionResult<VisitorReservationWithDetails[]>
> {
  try {
    const user = await getCurrentUser();
    if (!user) return error("No autenticado");

    const reservations = await getUpcomingVisitorReservations();
    return success(reservations);
  } catch (err) {
    console.error("[visitantes] getVisitorReservations error:", err);
    return error(
      err instanceof Error ? err.message : "Error al obtener las reservas"
    );
  }
}

/**
 * Obtiene las plazas de visitantes disponibles para una fecha dada.
 * @param excludeReservationId - Excluye esta reserva del cálculo (para edición)
 */
export async function getAvailableVisitorSpotsAction(
  date: string,
  excludeReservationId?: string
): Promise<ActionResult<{ id: string; label: string }[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) return error("No autenticado");

    const spots = await getAvailableVisitorSpotsForDate(
      date,
      excludeReservationId
    );
    return success(spots);
  } catch (err) {
    console.error("[visitantes] getAvailableVisitorSpots error:", err);
    return error(
      err instanceof Error ? err.message : "Error al obtener plazas disponibles"
    );
  }
}

// ─── Helpers internos ─────────────────────────────────────────

/** Construye y envía el email de confirmación (usado en crear y editar) */
async function sendConfirmationEmail(params: {
  reservationId: string;
  visitorEmail: string;
  visitorName: string;
  visitorCompany: string;
  spotLabel: string;
  date: string; // YYYY-MM-DD
  reservedByName: string;
  notes?: string | null;
}) {
  const formattedDate = format(
    new Date(params.date + "T00:00:00"),
    "EEEE, d 'de' MMMM 'de' yyyy",
    { locale: es }
  );

  const calendarData = {
    reservationId: params.reservationId,
    spotLabel: params.spotLabel,
    date: params.date,
    visitorName: params.visitorName,
    visitorCompany: params.visitorCompany,
    reservedByName: params.reservedByName,
    notes: params.notes,
  };

  const icsBuffer = generateICSBuffer(calendarData);
  const googleCalendarUrl = generateGoogleCalendarUrl(calendarData);
  const outlookUrl = generateOutlookUrl(calendarData);

  await sendVisitorReservationEmail({
    to: params.visitorEmail,
    visitorName: params.visitorName,
    visitorCompany: params.visitorCompany,
    spotLabel: params.spotLabel,
    date: formattedDate,
    reservedByName: params.reservedByName,
    notes: params.notes,
    googleCalendarUrl,
    outlookUrl,
    icsBuffer,
  });

  return { formattedDate };
}

// ─── Mutations ────────────────────────────────────────────────

/**
 * Crea una reserva de visitante y envía el email de confirmación.
 */
export const createVisitorReservation = actionClient
  .schema(createVisitorReservationSchema)
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");

    // Comprobar si las reservas de visitantes están habilitadas
    const visitorEnabled = await getResourceConfig(
      "parking",
      "visitor_booking_enabled"
    );
    if (!visitorEnabled) {
      throw new Error(
        "Las reservas para visitantes están deshabilitadas actualmente"
      );
    }

    const supabase = await createClient();

    const { data: spotData } = await supabase
      .from("spots")
      .select("label")
      .eq("id", parsedInput.spot_id)
      .maybeSingle();

    const spotLabel = spotData?.label ?? parsedInput.spot_id;
    const reservedByName = user.profile?.full_name ?? user.email;

    const { data, error: insertError } = await supabase
      .from("visitor_reservations")
      .insert({
        spot_id: parsedInput.spot_id,
        reserved_by: user.id,
        date: parsedInput.date,
        visitor_name: parsedInput.visitor_name,
        visitor_company: parsedInput.visitor_company,
        visitor_email: parsedInput.visitor_email,
        notes: parsedInput.notes ?? null,
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        throw new Error(
          "Esta plaza ya tiene una reserva de visitante para este día"
        );
      }
      throw new Error(
        `Error al crear reserva de visitante: ${insertError.message}`
      );
    }

    const reservationId = data.id;

    try {
      await sendConfirmationEmail({
        reservationId,
        visitorEmail: parsedInput.visitor_email,
        visitorName: parsedInput.visitor_name,
        visitorCompany: parsedInput.visitor_company,
        spotLabel,
        date: parsedInput.date,
        reservedByName,
        notes: parsedInput.notes,
      });

      await supabase
        .from("visitor_reservations")
        .update({ notification_sent: true })
        .eq("id", reservationId);
    } catch (emailErr) {
      console.error(
        "[visitantes] sendConfirmationEmail failed (reserva creada correctamente):",
        {
          reservationId,
          userId: user.id,
          visitorEmail: parsedInput.visitor_email,
          error: emailErr instanceof Error ? emailErr.message : emailErr,
        }
      );
    }

    revalidatePath("/parking/visitantes");
    return { id: reservationId };
  });

/**
 * Edita una reserva de visitante existente y reenvía el email de confirmación.
 * Solo puede editar el empleado que la creó o un administrador.
 */
export const updateVisitorReservation = actionClient
  .schema(updateVisitorReservationSchema)
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");

    const supabase = await createClient();
    const isAdmin = user.profile?.role === "admin";

    // Obtener spot label de la nueva plaza
    const { data: spotData } = await supabase
      .from("spots")
      .select("label")
      .eq("id", parsedInput.spot_id)
      .maybeSingle();

    const spotLabel = spotData?.label ?? parsedInput.spot_id;
    const reservedByName = user.profile?.full_name ?? user.email;

    // Actualizar la reserva (solo el creador o admin pueden hacerlo)
    const baseQuery = supabase
      .from("visitor_reservations")
      .update({
        spot_id: parsedInput.spot_id,
        date: parsedInput.date,
        visitor_name: parsedInput.visitor_name,
        visitor_company: parsedInput.visitor_company,
        visitor_email: parsedInput.visitor_email,
        notes: parsedInput.notes ?? null,
        notification_sent: false,
      })
      .eq("id", parsedInput.id)
      .eq("status", "confirmed");

    const { error: updateError, count } = await (isAdmin
      ? baseQuery
      : baseQuery.eq("reserved_by", user.id));

    if (updateError) {
      if (updateError.code === "23505") {
        throw new Error(
          "Esta plaza ya tiene una reserva de visitante para ese día"
        );
      }
      throw new Error(
        `Error al actualizar reserva de visitante: ${updateError.message}`
      );
    }
    if (count === 0) {
      throw new Error(
        "Reserva no encontrada, ya cancelada o sin permisos para editarla"
      );
    }

    // Reenviar email de confirmación con los datos actualizados
    try {
      await sendConfirmationEmail({
        reservationId: parsedInput.id,
        visitorEmail: parsedInput.visitor_email,
        visitorName: parsedInput.visitor_name,
        visitorCompany: parsedInput.visitor_company,
        spotLabel,
        date: parsedInput.date,
        reservedByName,
        notes: parsedInput.notes,
      });

      await supabase
        .from("visitor_reservations")
        .update({ notification_sent: true })
        .eq("id", parsedInput.id);
    } catch (emailErr) {
      console.error(
        "[visitantes] sendConfirmationEmail (update) failed (reserva actualizada correctamente):",
        {
          reservationId: parsedInput.id,
          userId: user.id,
          visitorEmail: parsedInput.visitor_email,
          error: emailErr instanceof Error ? emailErr.message : emailErr,
        }
      );
    }

    revalidatePath("/parking/visitantes");
    return { id: parsedInput.id };
  });

/**
 * Cancela una reserva de visitante y envía email de cancelación.
 * Solo puede cancelar el empleado que la creó o un administrador.
 */
/** Tipo interno para la query pre-cancelación de visitante */
type VisitorReservationForCancel = {
  visitor_email: string;
  visitor_name: string;
  visitor_company: string;
  date: string;
  spots: { label: string } | null;
};

export const cancelVisitorReservation = actionClient
  .schema(cancelVisitorReservationSchema)
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");

    const supabase = await createClient();
    const isAdmin = user.profile?.role === "admin";

    // Obtener los detalles antes de cancelar (para el email)
    const fetchBase = supabase
      .from("visitor_reservations")
      .select(
        "visitor_email, visitor_name, visitor_company, date, spots!visitor_reservations_spot_id_fkey(label)"
      )
      .eq("id", parsedInput.id)
      .eq("status", "confirmed");

    const { data: rawReservation } = await (
      isAdmin ? fetchBase : fetchBase.eq("reserved_by", user.id)
    ).maybeSingle();
    const reservation = rawReservation as VisitorReservationForCancel | null;

    if (!reservation) {
      throw new Error("Reserva no encontrada o sin permisos para cancelarla");
    }

    // Cancelar la reserva
    const { error: updateError } = await supabase
      .from("visitor_reservations")
      .update({ status: "cancelled" })
      .eq("id", parsedInput.id);

    if (updateError) {
      throw new Error(
        `Error al cancelar reserva de visitante: ${updateError.message}`
      );
    }

    // Enviar email de cancelación con ICS METHOD:CANCEL (no bloqueante)
    try {
      const spotLabel = reservation.spots?.label ?? "";
      const formattedDate = format(
        new Date(reservation.date + "T00:00:00"),
        "EEEE, d 'de' MMMM 'de' yyyy",
        { locale: es }
      );
      const cancelledByName = user.profile?.full_name ?? user.email;

      const cancellationICS = generateCancellationICSBuffer({
        reservationId: parsedInput.id,
        spotLabel,
        date: reservation.date,
      });

      await sendVisitorCancellationEmail({
        to: reservation.visitor_email,
        visitorName: reservation.visitor_name,
        spotLabel,
        date: formattedDate,
        cancelledByName,
        icsBuffer: cancellationICS,
      });
    } catch (emailErr) {
      console.error(
        "[visitantes] sendCancellationEmail failed (reserva cancelada correctamente):",
        {
          reservationId: parsedInput.id,
          userId: user.id,
          error: emailErr instanceof Error ? emailErr.message : emailErr,
        }
      );
    }

    revalidatePath("/parking/visitantes");
    return { cancelled: true };
  });
