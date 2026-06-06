"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTableColumnHeader } from "@/components/data-table";
import type { LeaveRequestWithDetails } from "@/lib/queries/leave-requests";
import { LEAVE_TYPE_LABELS } from "@/lib/validations";
import { LeaveStatusBadge } from "./leave-status-badge";
import { useLeaveRequests } from "./leave-requests-provider";

function LeaveRowActions({ row }: { row: LeaveRequestWithDetails }) {
  const { setOpen, setCurrentRow, currentUserId } = useLeaveRequests();
  const isOwn = row.employeeId === currentUserId;
  const canCancel = isOwn && row.status === "pending";
  const canEdit = isOwn && row.status === "rejected";

  if (!canCancel && !canEdit) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEdit && (
          <DropdownMenuItem
            onClick={() => {
              setCurrentRow(row);
              setOpen("edit");
            }}
          >
            Editar
          </DropdownMenuItem>
        )}
        {canCancel && (
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => {
              setCurrentRow(row);
              setOpen("cancel");
            }}
          >
            Cancelar solicitud
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatDateRange(start: string, end: string): string {
  const s = format(new Date(start + "T00:00:00"), "d MMM yyyy", { locale: es });
  const e = format(new Date(end + "T00:00:00"), "d MMM yyyy", { locale: es });
  return s === e ? s : `${s} – ${e}`;
}

export const leaveRequestsColumns: ColumnDef<LeaveRequestWithDetails>[] = [
  {
    accessorKey: "startDate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Fechas" />
    ),
    cell: ({ row }) =>
      formatDateRange(row.original.startDate, row.original.endDate),
    sortingFn: "alphanumeric",
  },
  {
    accessorKey: "leaveType",
    header: "Tipo",
    cell: ({ row }) =>
      LEAVE_TYPE_LABELS[
        row.original.leaveType as keyof typeof LEAVE_TYPE_LABELS
      ] ?? row.original.leaveType,
  },
  {
    accessorKey: "workingDays",
    header: "Días",
    cell: ({ row }) => {
      const d = row.original.workingDays;
      return d !== null ? `${d} día${d !== 1 ? "s" : ""}` : "—";
    },
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => <LeaveStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "reason",
    header: "Motivo",
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {row.original.reason ?? "—"}
      </span>
    ),
    meta: { className: "hidden @xl/content:table-cell" },
  },
  {
    id: "actions",
    cell: ({ row }) => <LeaveRowActions row={row.original} />,
    enableHiding: false,
  },
];
