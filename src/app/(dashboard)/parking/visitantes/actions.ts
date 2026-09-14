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
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/helpers";
import { spots, reservations, visitorReservations } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/helpers";
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
import { getAllResourceConfigs, getResourceConfig } from "@/lib/config";
import { getEffectiveEntityId } from "@/lib/queries/active-entity";
import { assertVisitorsEnabled } from "@/lib/module-guard";
import { eq, and, ne } from "drizzle-orm";
import { validateBookingDate } from "@/lib/booking-validation";

function requireEntityContext(entityId: string | null): string {
  if (!entityId) {
    throw new Error("No tienes una sede activa seleccionada");
  }
  return entityId;
}

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

    const isAdmin = user.profile?.role === "admin";
    const entityId = requireEntityContext(await getEffectiveEntityId());
    await assertVisitorsEnabled(entityId);
    const reservations = await getUpcomingVisitorReservations(
      isAdmin ? undefined : user.id,
      entityId
    );
    return success(reservations);
  } catch (err) {
    console.error("[visitantes] getVisitorReservations error:", err);
    return error("Error al obtener las reservas");
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

    const entityId = requireEntityContext(await getEffectiveEntityId());
    await assertVisitorsEnabled(entityId);
    const availableSpots = await getAvailableVisitorSpotsForDate(
      date,
      excludeReservationId,
      entityId
    );
    return success(availableSpots);
  } catch (err) {
    console.error("[visitantes] getAvailableVisitorSpots error:", err);
    return error("Error al obtener plazas disponibles");
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

    const entityId = requireEntityContext(await getEffectiveEntityId());
    await assertVisitorsEnabled(entityId);
    const parkingConfig = await getAllResourceConfigs("parking", entityId);
    const [bookingEnabled, visitorEnabled] = await Promise.all([
      getResourceConfig("parking", "booking_enabled", entityId),
      getResourceConfig("parking", "visitor_booking_enabled", entityId),
    ]);
    if (!bookingEnabled) {
      throw new Error(
        "Las reservas de parking están deshabilitadas actualmente"
      );
    }
    if (!visitorEnabled) {
      throw new Error(
        "Las reservas para visitantes están deshabilitadas actualmente"
      );
    }

    validateBookingDate(parsedInput.date, parkingConfig);

    const result = await db.transaction(async (tx) => {
      const [spotData] = await tx
        .select({
          label: spots.label,
          entityId: spots.entityId,
          type: spots.type,
          resourceType: spots.resourceType,
          isActive: spots.isActive,
        })
        .from(spots)
        .where(eq(spots.id, parsedInput.spot_id))
        .for("update")
        .limit(1);

      if (!spotData || spotData.isActive === false) {
        throw new Error("La plaza seleccionada no existe");
      }
      if (spotData.type !== "visitor" || spotData.resourceType !== "parking") {
        throw new Error("La plaza seleccionada no es una plaza de visitantes");
      }

      if (spotData.entityId !== entityId) {
        throw new Error("La plaza seleccionada no pertenece a la sede activa");
      }

      const [employeeReservation, visitorReservation] = await Promise.all([
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
          .select({ id: visitorReservations.id })
          .from(visitorReservations)
          .where(
            and(
              eq(visitorReservations.spotId, parsedInput.spot_id),
              eq(visitorReservations.date, parsedInput.date),
              eq(visitorReservations.status, "confirmed")
            )
          )
          .limit(1),
      ]);
      if (employeeReservation[0] || visitorReservation[0]) {
        throw new Error(
          "Esta plaza ya tiene una reserva de visitante para este día"
        );
      }

      const [inserted] = await tx
        .insert(visitorReservations)
        .values({
          spotId: parsedInput.spot_id,
          reservedBy: user.id,
          date: parsedInput.date,
          visitorName: parsedInput.visitor_name,
          visitorCompany: parsedInput.visitor_company,
          visitorEmail: parsedInput.visitor_email,
          notes: parsedInput.notes ?? null,
        })
        .returning({ id: visitorReservations.id });
      if (!inserted)
        throw new Error("No se pudo crear la reserva de visitante");
      return { id: inserted.id, spotLabel: spotData.label };
    });

    const reservationId = result.id;
    const spotLabel = result.spotLabel;
    const reservedByName = user.profile?.fullName ?? user.email;

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

      await db
        .update(visitorReservations)
        .set({ notificationSent: true })
        .where(eq(visitorReservations.id, reservationId));
    } catch (emailErr) {
      console.error(
        "[visitantes] sendConfirmationEmail failed (reserva creada correctamente):",
        {
          reservationId,
          userId: user.id,
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

    const isAdmin = user.profile?.role === "admin";

    const entityId = requireEntityContext(await getEffectiveEntityId());
    await assertVisitorsEnabled(entityId);
    const [bookingEnabled, visitorEnabled] = await Promise.all([
      getResourceConfig("parking", "booking_enabled", entityId),
      getResourceConfig("parking", "visitor_booking_enabled", entityId),
    ]);
    if (!bookingEnabled) {
      throw new Error(
        "Las reservas de parking están deshabilitadas actualmente"
      );
    }
    if (!visitorEnabled) {
      throw new Error(
        "Las reservas para visitantes están deshabilitadas actualmente"
      );
    }

    // Obtener spot label y entityId de la nueva plaza
    const [spotData] = await db
      .select({
        label: spots.label,
        entityId: spots.entityId,
        type: spots.type,
        resourceType: spots.resourceType,
        isActive: spots.isActive,
      })
      .from(spots)
      .where(eq(spots.id, parsedInput.spot_id))
      .limit(1);

    validateBookingDate(
      parsedInput.date,
      await getAllResourceConfigs("parking", entityId)
    );

    if (!spotData || spotData.isActive === false) {
      throw new Error("La plaza seleccionada no existe");
    }
    if (spotData.type !== "visitor" || spotData.resourceType !== "parking") {
      throw new Error("La plaza seleccionada no es una plaza de visitantes");
    }

    if (spotData.entityId !== entityId) {
      throw new Error("La plaza seleccionada no pertenece a la sede activa");
    }

    const spotLabel = spotData.label;
    const reservedByName = user.profile?.fullName ?? user.email;

    // Actualizar la reserva (solo el creador o admin pueden hacerlo)
    const whereConditions = isAdmin
      ? and(
          eq(visitorReservations.id, parsedInput.id),
          eq(visitorReservations.status, "confirmed")
        )
      : and(
          eq(visitorReservations.id, parsedInput.id),
          eq(visitorReservations.status, "confirmed"),
          eq(visitorReservations.reservedBy, user.id)
        );

    let updatedRows: { id: string }[];
    try {
      updatedRows = await db.transaction(async (tx) => {
        const [lockedSpot] = await tx
          .select({
            id: spots.id,
            isActive: spots.isActive,
            type: spots.type,
            resourceType: spots.resourceType,
            entityId: spots.entityId,
          })
          .from(spots)
          .where(eq(spots.id, parsedInput.spot_id))
          .for("update")
          .limit(1);

        if (
          !lockedSpot ||
          lockedSpot.isActive === false ||
          lockedSpot.type !== "visitor" ||
          lockedSpot.resourceType !== "parking" ||
          lockedSpot.entityId !== entityId
        ) {
          throw new Error("La plaza seleccionada no está disponible");
        }

        const [employeeReservation, visitorReservation] = await Promise.all([
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
            .select({ id: visitorReservations.id })
            .from(visitorReservations)
            .where(
              and(
                eq(visitorReservations.spotId, parsedInput.spot_id),
                eq(visitorReservations.date, parsedInput.date),
                eq(visitorReservations.status, "confirmed"),
                ne(visitorReservations.id, parsedInput.id)
              )
            )
            .limit(1),
        ]);
        if (employeeReservation[0] || visitorReservation[0]) {
          throw new Error("La plaza ya está reservada para ese día");
        }

        return tx
          .update(visitorReservations)
          .set({
            spotId: parsedInput.spot_id,
            date: parsedInput.date,
            visitorName: parsedInput.visitor_name,
            visitorCompany: parsedInput.visitor_company,
            visitorEmail: parsedInput.visitor_email,
            notes: parsedInput.notes ?? null,
            notificationSent: false,
          })
          .where(whereConditions)
          .returning({ id: visitorReservations.id });
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new Error(
          "Esta plaza ya tiene una reserva de visitante para ese día"
        );
      }
      if (
        err instanceof Error &&
        [
          "La plaza seleccionada no está disponible",
          "La plaza ya está reservada para ese día",
        ].includes(err.message)
      ) {
        throw err;
      }
      console.error("[visitantes] updateVisitorReservation update error", err);
      throw new Error("Error al actualizar reserva de visitante");
    }

    if (!updatedRows || updatedRows.length === 0) {
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

      await db
        .update(visitorReservations)
        .set({ notificationSent: true })
        .where(eq(visitorReservations.id, parsedInput.id));
    } catch (emailErr) {
      console.error(
        "[visitantes] sendConfirmationEmail (update) failed (reserva actualizada correctamente):",
        {
          reservationId: parsedInput.id,
          userId: user.id,
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
export const cancelVisitorReservation = actionClient
  .schema(cancelVisitorReservationSchema)
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");

    const isAdmin = user.profile?.role === "admin";

    const entityId = requireEntityContext(await getEffectiveEntityId());
    await assertVisitorsEnabled(entityId);
    const [bookingEnabled, visitorEnabled] = await Promise.all([
      getResourceConfig("parking", "booking_enabled", entityId),
      getResourceConfig("parking", "visitor_booking_enabled", entityId),
    ]);
    if (!bookingEnabled) {
      throw new Error(
        "Las reservas de parking están deshabilitadas actualmente"
      );
    }
    if (!visitorEnabled) {
      throw new Error(
        "Las reservas para visitantes están deshabilitadas actualmente"
      );
    }

    // Obtener los detalles antes de cancelar (para el email)
    const fetchConditions = isAdmin
      ? and(
          eq(visitorReservations.id, parsedInput.id),
          eq(visitorReservations.status, "confirmed")
        )
      : and(
          eq(visitorReservations.id, parsedInput.id),
          eq(visitorReservations.status, "confirmed"),
          eq(visitorReservations.reservedBy, user.id)
        );

    const [reservation] = await db
      .select({
        visitorEmail: visitorReservations.visitorEmail,
        visitorName: visitorReservations.visitorName,
        visitorCompany: visitorReservations.visitorCompany,
        date: visitorReservations.date,
        spotId: visitorReservations.spotId,
      })
      .from(visitorReservations)
      .where(fetchConditions)
      .limit(1);

    if (!reservation) {
      throw new Error("Reserva no encontrada o sin permisos para cancelarla");
    }

    // Obtener el label de la plaza
    const [spotData] = await db
      .select({ label: spots.label })
      .from(spots)
      .where(eq(spots.id, reservation.spotId))
      .limit(1);

    // Cancelar la reserva
    const cancelConditions = isAdmin
      ? and(
          eq(visitorReservations.id, parsedInput.id),
          eq(visitorReservations.status, "confirmed")
        )
      : and(
          eq(visitorReservations.id, parsedInput.id),
          eq(visitorReservations.status, "confirmed"),
          eq(visitorReservations.reservedBy, user.id)
        );

    let updatedRows: { id: string }[];
    try {
      updatedRows = await db
        .update(visitorReservations)
        .set({ status: "cancelled" })
        .where(cancelConditions)
        .returning({ id: visitorReservations.id });
    } catch (err) {
      console.error("[visitantes] cancelVisitorReservation update error", err);
      throw new Error("Error al cancelar reserva de visitante");
    }

    if (!updatedRows || updatedRows.length === 0) {
      throw new Error(
        "Reserva no encontrada, ya cancelada o sin permisos para cancelarla"
      );
    }

    // Enviar email de cancelación con ICS METHOD:CANCEL (no bloqueante)
    try {
      const spotLabel = spotData?.label ?? "";
      const formattedDate = format(
        new Date(reservation.date + "T00:00:00"),
        "EEEE, d 'de' MMMM 'de' yyyy",
        { locale: es }
      );
      const cancelledByName = user.profile?.fullName ?? user.email;

      const cancellationICS = generateCancellationICSBuffer({
        reservationId: parsedInput.id,
        spotLabel,
        date: reservation.date,
      });

      await sendVisitorCancellationEmail({
        to: reservation.visitorEmail,
        visitorName: reservation.visitorName,
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
