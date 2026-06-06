"use client";

import { Badge } from "@/components/ui/badge";
import type { LeaveStatus } from "@/lib/queries/leave-requests";
import { LEAVE_TYPE_LABELS, type LeaveTypeValue } from "@/lib/validations";

const STATUS_LABEL: Record<LeaveStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
};

const STATUS_VARIANT: Record<
  LeaveStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  cancelled: "outline",
};

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function LeaveTypeLabel({ leaveType }: { leaveType: LeaveTypeValue }) {
  return <span>{LEAVE_TYPE_LABELS[leaveType]}</span>;
}

export { STATUS_LABEL };
