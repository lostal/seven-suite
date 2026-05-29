"use server";

/**
 * Server Actions de Vacaciones
 *
 * Workflow de aprobación en dos pasos:
 *   empleado → pending → manager_approved → hr_approved
 * Las bajas médicas (sick) van directamente a hr_approved.
 */

import { revalidatePath } from "next/cache";
import { actionClient, type ActionResult, success, error } from "@/lib/actions";
import { db } from "@/lib/db";
import { leaveRequests, profiles } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/helpers";
import {
  createLeaveRequestSchema,
  updateLeaveRequestSchema,
  approveLeaveRequestSchema,
  rejectLeaveRequestSchema,
  cancelLeaveRequestSchema,
} from "@/lib/validations";
import {
  getUserLeaveRequests,
  getLeaveRequestsByEntity,
  type LeaveRequestWithDetails,
} from "@/lib/queries/leave-requests";
import { getHolidayDatesSetForYears } from "@/lib/queries/holidays";
import { getEffectiveEntityId } from "@/lib/queries/active-entity";
import { eq, and } from "drizzle-orm";
import { toServerDateStr } from "@/lib/utils";

// ─── Working days calculation ─────────────────────────────────

/**
 * Cuenta los días laborables entre startDate y endDate (ambos incluidos),
 * excluyendo sábados, domingos y festivos de la sede del empleado.
 */
async function calcWorkingDays(
  startDate: string,
  endDate: string,
  entityId: string | null
): Promise<number> {
  const years = new Set<number>();
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    years.add(d.getFullYear());
  }

  // Build a combined set of holiday dates for all years in the range (single query)
  const holidayDates = new Set<string>();
  if (entityId) {
    const allYears = Array.from(years);
    const dates = await getHolidayDatesSetForYears(entityId, allYears);
    dates.forEach((d) => holidayDates.add(d));
  }

  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // weekend
    const dateStr = toServerDateStr(d);
    if (holidayDates.has(dateStr)) continue;
    count++;
  }
  return count;
}

async function getManageableLeaveRequest(
  requestId: string,
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
) {
  const [request] = await db
    .select({
      status: leaveRequests.status,
      employeeEntityId: profiles.entityId,
    })
    .from(leaveRequests)
    .innerJoin(profiles, eq(leaveRequests.employeeId, profiles.id))
    .where(eq(leaveRequests.id, requestId))
    .limit(1);

  if (!request) throw new Error("Solicitud no encontrada");

  const activeEntityId = await getEffectiveEntityId();
  const isAdmin = user.profile?.role === "admin";
  const expectedEntityId = isAdmin ? activeEntityId : user.profile?.entityId;

  if (expectedEntityId && request.employeeEntityId !== expectedEntityId) {
    throw new Error("Sin permisos para gestionar esta solicitud");
  }

  return request;
}

// ─── Queries ──────────────────────────────────────────────────

export async function getMyLeaveRequests(): Promise<
  ActionResult<LeaveRequestWithDetails[]>
> {
  try {
    const user = await getCurrentUser();
    if (!user) return error("No autenticado");
    const requests = await getUserLeaveRequests(user.id);
    return success(requests);
  } catch (err) {
    console.error("[vacaciones] getMyLeaveRequests error:", err);
    return error(
      err instanceof Error ? err.message : "Error al obtener solicitudes"
    );
  }
}

export async function getEntityLeaveRequests(): Promise<
  ActionResult<LeaveRequestWithDetails[]>
> {
  try {
    const user = await getCurrentUser();
    if (!user) return error("No autenticado");
    if (
      user.profile?.role !== "manager" &&
      user.profile?.role !== "hr" &&
      user.profile?.role !== "admin"
    ) {
      return error("Sin permisos");
    }
    const entityId = await getEffectiveEntityId();
    if (!entityId) return error("No hay sede activa");
    const requests = await getLeaveRequestsByEntity(entityId);
    return success(requests);
  } catch (err) {
    console.error("[vacaciones] getEntityLeaveRequests error:", err);
    return error(
      err instanceof Error ? err.message : "Error al obtener solicitudes"
    );
  }
}

// ─── Mutations ────────────────────────────────────────────────

/**
 * Crea una solicitud de vacaciones/ausencia.
 * Bajas médicas (sick) se aprueban automáticamente.
 */
export const createLeaveRequest = actionClient
  .schema(createLeaveRequestSchema)
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");

    const today = toServerDateStr(new Date());
    if (parsedInput.leave_type !== "sick" && parsedInput.start_date < today) {
      throw new Error("No se pueden solicitar días pasados");
    }

    const entityId = await getEffectiveEntityId();
    const workingDays = await calcWorkingDays(
      parsedInput.start_date,
      parsedInput.end_date,
      entityId
    );

    if (workingDays === 0) {
      throw new Error("El rango seleccionado no contiene días laborables");
    }

    const isSick = parsedInput.leave_type === "sick";

    const [inserted] = await db
      .insert(leaveRequests)
      .values({
        employeeId: user.id,
        leaveType: parsedInput.leave_type,
        startDate: parsedInput.start_date,
        endDate: parsedInput.end_date,
        reason: parsedInput.reason ?? null,
        workingDays,
        // Sick leave auto-approved
        status: isSick ? "hr_approved" : "pending",
      })
      .returning({ id: leaveRequests.id });

    if (!inserted) throw new Error("No se pudo crear la solicitud");

    revalidatePath("/vacaciones");
    revalidatePath("/vacaciones/mis-solicitudes");
    return { id: inserted.id };
  });

/**
 * Edita una solicitud rechazada (vuelve a pending).
 */
export const updateLeaveRequest = actionClient
  .schema(updateLeaveRequestSchema)
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");

    const entityId = await getEffectiveEntityId();
    const workingDays = await calcWorkingDays(
      parsedInput.start_date,
      parsedInput.end_date,
      entityId
    );

    if (workingDays === 0) {
      throw new Error("El rango seleccionado no contiene días laborables");
    }

    const updated = await db
      .update(leaveRequests)
      .set({
        leaveType: parsedInput.leave_type,
        startDate: parsedInput.start_date,
        endDate: parsedInput.end_date,
        reason: parsedInput.reason ?? null,
        workingDays,
        status: "pending",
        managerId: null,
        managerActionAt: null,
        managerNotes: null,
        hrId: null,
        hrActionAt: null,
        hrNotes: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(leaveRequests.id, parsedInput.id),
          eq(leaveRequests.employeeId, user.id),
          eq(leaveRequests.status, "rejected")
        )
      )
      .returning({ id: leaveRequests.id });

    if (!updated || updated.length === 0) {
      throw new Error(
        "Solicitud no encontrada, sin permisos, o no está en estado rechazado"
      );
    }

    revalidatePath("/vacaciones/mis-solicitudes");
    return { updated: true };
  });

/**
 * Cancela una solicitud propia (solo si pending o manager_approved).
 */
export const cancelLeaveRequest = actionClient
  .schema(cancelLeaveRequestSchema)
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");

    // Verify it's in a cancellable state first
    const [current] = await db
      .select({
        status: leaveRequests.status,
        employeeId: leaveRequests.employeeId,
      })
      .from(leaveRequests)
      .where(eq(leaveRequests.id, parsedInput.id))
      .limit(1);

    if (!current) throw new Error("Solicitud no encontrada");
    if (current.employeeId !== user.id) throw new Error("Sin permisos");
    if (current.status !== "pending" && current.status !== "manager_approved") {
      throw new Error(
        `No se puede cancelar una solicitud en estado "${current.status}"`
      );
    }

    await db
      .update(leaveRequests)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(leaveRequests.id, parsedInput.id));

    revalidatePath("/vacaciones/mis-solicitudes");
    return { cancelled: true };
  });

/**
 * Aprueba una solicitud.
 * Manager: pending → manager_approved
 * HR/admin: manager_approved → hr_approved (o pending si es admin)
 */
export const approveLeaveRequest = actionClient
  .schema(approveLeaveRequestSchema)
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");

    const role = user.profile?.role;
    if (role !== "manager" && role !== "hr" && role !== "admin") {
      throw new Error("Sin permisos para aprobar solicitudes");
    }

    const now = new Date();

    const current = await getManageableLeaveRequest(parsedInput.id, user);

    let newStatus: "manager_approved" | "hr_approved";
    let updateData: Partial<typeof leaveRequests.$inferInsert>;

    if (role === "manager" && current.status === "pending") {
      newStatus = "manager_approved";
      updateData = {
        status: newStatus,
        managerId: user.id,
        managerActionAt: now,
        managerNotes: parsedInput.notes ?? null,
        updatedAt: now,
      };
    } else if (
      (role === "hr" || role === "admin") &&
      (current.status === "manager_approved" || role === "admin")
    ) {
      newStatus = "hr_approved";
      updateData = {
        status: newStatus,
        hrId: user.id,
        hrActionAt: now,
        hrNotes: parsedInput.notes ?? null,
        updatedAt: now,
      };
    } else {
      throw new Error(
        `No puedes aprobar una solicitud en estado "${current.status}" con tu rol`
      );
    }

    await db
      .update(leaveRequests)
      .set(updateData)
      .where(
        and(
          eq(leaveRequests.id, parsedInput.id),
          eq(leaveRequests.status, current.status)
        )
      );

    revalidatePath("/vacaciones/gestionar");
    return { approved: true, newStatus };
  });

/**
 * Rechaza una solicitud (manager o HR/admin). Requiere notas.
 */
export const rejectLeaveRequest = actionClient
  .schema(rejectLeaveRequestSchema)
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");

    const role = user.profile?.role;
    if (role !== "manager" && role !== "hr" && role !== "admin") {
      throw new Error("Sin permisos para rechazar solicitudes");
    }

    const current = await getManageableLeaveRequest(parsedInput.id, user);
    if (
      (role === "manager" && current.status !== "pending") ||
      (role === "hr" && current.status !== "manager_approved") ||
      (role === "admin" &&
        current.status !== "pending" &&
        current.status !== "manager_approved")
    ) {
      throw new Error(
        `No puedes rechazar una solicitud en estado "${current.status}" con tu rol`
      );
    }

    const now = new Date();
    const isHR = role === "hr" || role === "admin";

    const updateData: Partial<typeof leaveRequests.$inferInsert> = {
      status: "rejected",
      updatedAt: now,
    };

    if (isHR) {
      updateData.hrId = user.id;
      updateData.hrActionAt = now;
      updateData.hrNotes = parsedInput.notes;
    } else {
      updateData.managerId = user.id;
      updateData.managerActionAt = now;
      updateData.managerNotes = parsedInput.notes;
    }

    const updated = await db
      .update(leaveRequests)
      .set(updateData)
      .where(
        and(
          eq(leaveRequests.id, parsedInput.id),
          eq(leaveRequests.status, current.status)
        )
      )
      .returning({ id: leaveRequests.id });

    if (!updated || updated.length === 0) {
      throw new Error("Solicitud no encontrada");
    }

    revalidatePath("/vacaciones/gestionar");
    return { rejected: true };
  });
