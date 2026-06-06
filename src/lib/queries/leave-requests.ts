import { db } from "@/lib/db";
import { leaveRequests, profiles } from "@/lib/db/schema";
import type { LeaveStatus, LeaveType } from "@/lib/db/types";
import { eq, and, desc, sql } from "drizzle-orm";

export type { LeaveStatus, LeaveType };

export type LeaveRequestWithDetails = {
  id: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  status: LeaveStatus;
  reason: string | null;
  workingDays: number | null;
  createdAt: Date;
  employeeId: string;
  employeeName: string;
  reviewerId: string | null;
  reviewerName: string | null;
  reviewerNotes: string | null;
};

const LEAVE_SELECT = {
  id: leaveRequests.id,
  leaveType: leaveRequests.leaveType,
  startDate: leaveRequests.startDate,
  endDate: leaveRequests.endDate,
  status: leaveRequests.status,
  reason: leaveRequests.reason,
  workingDays: leaveRequests.workingDays,
  createdAt: leaveRequests.createdAt,
  employeeId: leaveRequests.employeeId,
  employeeName: profiles.fullName,
  reviewerId: leaveRequests.reviewerId,
  reviewerNotes: leaveRequests.reviewerNotes,
} as const;

function toRow(r: {
  id: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  status: LeaveStatus;
  reason: string | null;
  workingDays: number | null;
  createdAt: Date;
  employeeId: string;
  employeeName: string | null;
  reviewerId: string | null;
  reviewerName: string | null;
  reviewerNotes: string | null;
}): LeaveRequestWithDetails {
  return {
    ...r,
    employeeName: r.employeeName ?? "",
    reviewerName: r.reviewerName ?? "",
  };
}

const LEAVE_FROM = sql`${leaveRequests}
  inner join ${profiles} on ${leaveRequests.employeeId} = ${profiles.id}
  left join ${profiles} reviewer_profiles on ${leaveRequests.reviewerId} = reviewer_profiles.id`;

/**
 * Obtiene todas las solicitudes de un empleado, ordenadas por fecha desc.
 */
export async function getUserLeaveRequests(
  userId: string
): Promise<LeaveRequestWithDetails[]> {
  const rows = await db
    .select({
      ...LEAVE_SELECT,
      reviewerName: sql<string | null>`reviewer_profiles.full_name`,
    })
    .from(LEAVE_FROM)
    .where(eq(leaveRequests.employeeId, userId))
    .orderBy(desc(leaveRequests.createdAt));

  return rows.map(toRow);
}

/**
 * Obtiene las solicitudes de todos los empleados de una sede,
 * opcionalmente filtrando por estado.
 */
export async function getLeaveRequestsByEntity(
  entityId: string,
  status?: LeaveStatus
): Promise<LeaveRequestWithDetails[]> {
  const conditions = [eq(profiles.entityId, entityId)];
  if (status) conditions.push(eq(leaveRequests.status, status));

  const rows = await db
    .select({
      ...LEAVE_SELECT,
      reviewerName: sql<string | null>`reviewer_profiles.full_name`,
    })
    .from(LEAVE_FROM)
    .where(and(...conditions))
    .orderBy(desc(leaveRequests.createdAt));

  return rows.map(toRow);
}

/**
 * Cuenta las solicitudes pendientes de una sede (para badges en sidebar).
 */
export async function countPendingByEntity(entityId: string): Promise<number> {
  const rows = await db
    .select({ id: leaveRequests.id })
    .from(leaveRequests)
    .innerJoin(profiles, eq(leaveRequests.employeeId, profiles.id))
    .where(
      and(eq(profiles.entityId, entityId), eq(leaveRequests.status, "pending"))
    );
  return rows.length;
}
