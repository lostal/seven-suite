"use client";

import * as React from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  LeaveRequestWithDetails,
  LeaveStatus,
} from "@/lib/queries/leave-requests";
import { LEAVE_TYPE_LABELS } from "@/lib/validations";
import { LeaveStatusBadge } from "../../mis-solicitudes/_components/leave-status-badge";
import {
  approveLeaveRequest,
  rejectLeaveRequest,
  getEntityLeaveRequests,
} from "../../actions";

interface ManageLeaveClientProps {
  initialData: LeaveRequestWithDetails[];
  currentUserId: string;
  currentUserRole: string;
}

type FilterStatus = LeaveStatus | "all";

const STATUS_FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "manager_approved", label: "Aprobadas (manager)" },
  { value: "hr_approved", label: "Aprobadas" },
  { value: "rejected", label: "Rechazadas" },
  { value: "cancelled", label: "Canceladas" },
];

function formatDateRange(start: string, end: string): string {
  const s = format(new Date(start + "T00:00:00"), "d MMM yyyy", { locale: es });
  const e = format(new Date(end + "T00:00:00"), "d MMM yyyy", { locale: es });
  return s === e ? s : `${s} – ${e}`;
}

export function ManageLeaveClient({
  initialData,
  currentUserId: _currentUserId,
  currentUserRole,
}: ManageLeaveClientProps) {
  const [data, setData] =
    React.useState<LeaveRequestWithDetails[]>(initialData);
  const [isLoading, setIsLoading] = React.useState(false);
  const [filterStatus, setFilterStatus] = React.useState<FilterStatus>("all");

  // Approve dialog
  const [approvingId, setApprovingId] = React.useState<string | null>(null);
  const [approveNotes, setApproveNotes] = React.useState("");
  const [approvePending, startApproveTransition] = React.useTransition();

  // Reject dialog
  const [rejectingId, setRejectingId] = React.useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = React.useState("");
  const [rejectPending, startRejectTransition] = React.useTransition();

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getEntityLeaveRequests();
      if (result.success) setData(result.data);
      else toast.error(result.error);
    } catch (error) {
      console.error("Error loading leave requests:", error);
      toast.error("Error al cargar las solicitudes");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const filtered =
    filterStatus === "all"
      ? data
      : data.filter((r) => r.status === filterStatus);

  const canApprove = (row: LeaveRequestWithDetails) => {
    if (currentUserRole === "manager") return row.status === "pending";
    if (currentUserRole === "hr") return row.status === "manager_approved";
    if (currentUserRole === "admin")
      return row.status === "pending" || row.status === "manager_approved";
    return false;
  };

  const canReject = (row: LeaveRequestWithDetails) => {
    if (currentUserRole === "manager") return row.status === "pending";
    if (currentUserRole === "hr") return row.status === "manager_approved";
    if (currentUserRole === "admin")
      return row.status === "pending" || row.status === "manager_approved";
    return false;
  };

  const handleApprove = () => {
    if (!approvingId) return;
    startApproveTransition(async () => {
      const result = await approveLeaveRequest({
        id: approvingId,
        notes: approveNotes || null,
      });
      if (!result.success) {
        toast.error(result.error ?? "Error al aprobar");
        return;
      }
      toast.success("Solicitud aprobada");
      setApprovingId(null);
      setApproveNotes("");
      fetchData();
    });
  };

  const handleReject = () => {
    if (!rejectingId || !rejectNotes.trim()) return;
    startRejectTransition(async () => {
      const result = await rejectLeaveRequest({
        id: rejectingId,
        notes: rejectNotes,
      });
      if (!result.success) {
        toast.error(result.error ?? "Error al rechazar");
        return;
      }
      toast.success("Solicitud rechazada");
      setRejectingId(null);
      setRejectNotes("");
      fetchData();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filter */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {filtered.length} solicitud{filtered.length !== 1 ? "es" : ""}
        </p>
        <Select
          value={filterStatus}
          onValueChange={(v) => setFilterStatus(v as FilterStatus)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empleado</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Fechas</TableHead>
              <TableHead>Días</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No hay solicitudes con este filtro.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {row.employeeName}
                  </TableCell>
                  <TableCell>
                    {LEAVE_TYPE_LABELS[
                      row.leaveType as keyof typeof LEAVE_TYPE_LABELS
                    ] ?? row.leaveType}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDateRange(row.startDate, row.endDate)}
                  </TableCell>
                  <TableCell>
                    {row.workingDays !== null
                      ? `${row.workingDays} día${row.workingDays !== 1 ? "s" : ""}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <LeaveStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {canApprove(row) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-emerald-600 hover:text-emerald-700"
                          onClick={() => setApprovingId(row.id)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Aprobar
                        </Button>
                      )}
                      {canReject(row) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive h-7 gap-1"
                          onClick={() => setRejectingId(row.id)}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Rechazar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Approve dialog */}
      <Dialog
        open={!!approvingId}
        onOpenChange={(o) => !o && setApprovingId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aprobar solicitud</DialogTitle>
            <DialogDescription>
              Puedes añadir una nota opcional para el empleado.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Nota para el empleado (opcional)..."
            value={approveNotes}
            onChange={(e) => setApproveNotes(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApprovingId(null)}
              disabled={approvePending}
            >
              Cancelar
            </Button>
            <Button onClick={handleApprove} disabled={approvePending}>
              {approvePending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Aprobar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog
        open={!!rejectingId}
        onOpenChange={(o) => {
          if (!o) {
            setRejectingId(null);
            setRejectNotes("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar solicitud</DialogTitle>
            <DialogDescription>
              Indica el motivo del rechazo. Es obligatorio para informar al
              empleado.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Motivo del rechazo..."
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectingId(null);
                setRejectNotes("");
              }}
              disabled={rejectPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectPending || !rejectNotes.trim()}
            >
              {rejectPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
