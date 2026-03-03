"use client";

/**
 * MisReservasClient
 *
 * Muestra reservas y cesiones del usuario con tabs:
 * - "Reservas": parking + oficina unificadas
 * - "Cesiones": plazas cedidas al pool (visible siempre, puede estar vacío)
 *
 * Patrones reutilizados del proyecto:
 * - Filas de lista de MyReservationsSection (reservations-view.tsx)
 * - Badges de estado de CessionsView (cessations-view.tsx)
 * - Separadores con etiqueta de grupo (patrón shadcn-admin)
 */

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Building2,
  CalendarDays,
  Car,
  Clock,
  Loader2,
  Repeat2,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { cancelReservation } from "@/app/(dashboard)/parking/actions";
import { cancelCession } from "@/app/(dashboard)/parking/cession-actions";
import { cancelOfficeReservation } from "@/app/(dashboard)/oficinas/actions";
import { cancelOfficeCession } from "@/app/(dashboard)/oficinas/cession-actions";
import type { ReservationRow } from "@/lib/queries/reservations";
import type { ReservationWithDetails as OfficeReservationWithDetails } from "@/types";
import type { CessionWithDetails } from "@/lib/queries/cessions";
import { ROUTES } from "@/lib/constants";

// ─── Types ───────────────────────────────────────────────────

/** Reserva con indicador de recurso para mostrar en la lista unificada */
type MergedReservation = (
  | (ReservationRow & { resourceType: "parking" })
  | (OfficeReservationWithDetails & { resourceType: "office" })
) & { spot_label: string; date: string };

interface MisReservasClientProps {
  reservations?: ReservationRow[];
  officeReservations?: OfficeReservationWithDetails[];
  cessions?: CessionWithDetails[];
  /** true si el usuario tiene una plaza de parking asignada (modo cesión) */
  hasParkingSpot?: boolean;
  /** true si el usuario tiene un puesto de oficina asignado (modo cesión) */
  hasOfficeSpot?: boolean;
}

type GroupKey = "esta-semana" | "este-mes" | "mas-adelante";

// ─── Helpers ─────────────────────────────────────────────────

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function getGroupKey(dateStr: string): GroupKey {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = parseLocalDate(dateStr);
  const diffDays = Math.floor(
    (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays <= 6) return "esta-semana";
  if (
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  )
    return "este-mes";
  return "mas-adelante";
}

const GROUP_LABELS: Record<GroupKey, string> = {
  "esta-semana": "Esta semana",
  "este-mes": "Este mes",
  "mas-adelante": "Más adelante",
};
const GROUP_ORDER: GroupKey[] = ["esta-semana", "este-mes", "mas-adelante"];

// ─── Cession Status Badge ────────────────────────────────────

function CessionStatusBadge({ status }: { status: string }) {
  if (status === "available") {
    return (
      <Badge
        variant="secondary"
        className="shrink-0 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
      >
        Disponible
      </Badge>
    );
  }
  if (status === "reserved") {
    return (
      <Badge variant="default" className="shrink-0">
        Reservada
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="shrink-0">
      {status}
    </Badge>
  );
}

// ─── Reservation Item ─────────────────────────────────────────

function ReservationItem({
  reservation,
  cancellingId,
  onCancel,
}: {
  reservation: MergedReservation;
  cancellingId: string | null;
  onCancel: (id: string, resourceType: "parking" | "office") => void;
}) {
  const date = parseLocalDate(reservation.date);
  const isToday = reservation.date === new Date().toISOString().split("T")[0]!;
  const isOffice = reservation.resourceType === "office";
  const officeRes = isOffice
    ? (reservation as OfficeReservationWithDetails & { resourceType: "office" })
    : null;
  const hasTimeSlot = isOffice && officeRes?.start_time;

  return (
    <div className="flex items-center gap-4 py-3 pl-1">
      {/* Date column */}
      <div className="flex w-9 shrink-0 flex-col items-center gap-0.5">
        <span
          className={cn(
            "text-[10px] leading-none font-medium tracking-widest uppercase",
            isToday ? "text-primary" : "text-muted-foreground"
          )}
        >
          {format(date, "EEE", { locale: es })}
        </span>
        <div
          className={cn(
            "flex size-8 items-center justify-center rounded-full",
            isToday ? "bg-primary" : ""
          )}
        >
          <span
            className={cn(
              "text-lg leading-none font-bold tabular-nums",
              isToday ? "text-primary-foreground" : "text-foreground"
            )}
          >
            {format(date, "d")}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {isOffice ? (
            <Building2 className="text-muted-foreground size-3.5 shrink-0" />
          ) : (
            <Car className="text-muted-foreground size-3.5 shrink-0" />
          )}
          <p className="text-sm font-medium">
            {isOffice ? "Puesto" : "Plaza"} {reservation.spot_label}
          </p>
        </div>
        <div className="text-muted-foreground flex items-center gap-1 text-xs capitalize">
          {hasTimeSlot && officeRes && (
            <>
              <Clock className="size-3" />
              <span>
                {officeRes.start_time?.slice(0, 5)}–
                {officeRes.end_time?.slice(0, 5)}
              </span>
              ·
            </>
          )}
          <span>{format(date, "EEEE d 'de' MMMM", { locale: es })}</span>
        </div>
      </div>

      {/* Cancel */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="hover:bg-destructive/10 hover:text-destructive shrink-0"
            onClick={() => onCancel(reservation.id, reservation.resourceType)}
            disabled={cancellingId === reservation.id}
          >
            {cancellingId === reservation.id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Cancelar reserva</TooltipContent>
      </Tooltip>
    </div>
  );
}

// ─── Cession Row ─────────────────────────────────────────────

function CessionRow({
  cession,
  cancellingId,
  onCancel,
}: {
  cession: CessionWithDetails;
  cancellingId: string | null;
  onCancel: (id: string, resourceType: "parking" | "office") => void;
}) {
  const date = parseLocalDate(cession.date);
  const isToday = cession.date === new Date().toISOString().split("T")[0]!;

  return (
    <div className="flex items-center gap-4 py-3 pl-1">
      {/* Date column — círculo de "hoy" al estilo Google Calendar */}
      <div className="flex w-9 shrink-0 flex-col items-center gap-0.5">
        <span
          className={cn(
            "text-[10px] leading-none font-medium tracking-widest uppercase",
            isToday ? "text-primary" : "text-muted-foreground"
          )}
        >
          {format(date, "EEE", { locale: es })}
        </span>
        <div
          className={cn(
            "flex size-8 items-center justify-center rounded-full",
            isToday ? "bg-primary" : ""
          )}
        >
          <span
            className={cn(
              "text-lg leading-none font-bold tabular-nums",
              isToday ? "text-primary-foreground" : "text-foreground"
            )}
          >
            {format(date, "d")}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {cession.resource_type === "office" ? (
            <Building2 className="text-muted-foreground size-3.5 shrink-0" />
          ) : (
            <Car className="text-muted-foreground size-3.5 shrink-0" />
          )}
          <p className="text-sm font-medium">
            {cession.resource_type === "office" ? "Puesto" : "Plaza"}{" "}
            {cession.spot_label}
          </p>
        </div>
        <p className="text-muted-foreground truncate text-xs capitalize">
          {format(date, "EEEE d 'de' MMMM", { locale: es })}
        </p>
      </div>

      {/* Status + cancel */}
      <div className="flex shrink-0 items-center gap-2">
        <CessionStatusBadge status={cession.status} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onCancel(cession.id, cession.resource_type)}
              disabled={cancellingId === cession.id}
            >
              {cancellingId === cession.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Cancelar cesión</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────

function EmptyState({
  isCessions,
  hasParkingSpot,
  hasOfficeSpot,
}: {
  isCessions?: boolean;
  hasParkingSpot?: boolean;
  hasOfficeSpot?: boolean;
}) {
  return (
    <div className="flex h-52 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center">
      <div className="bg-muted rounded-full p-3">
        {isCessions ? (
          <Repeat2 className="text-muted-foreground size-6" />
        ) : (
          <CalendarDays className="text-muted-foreground size-6" />
        )}
      </div>
      <div>
        <p className="text-sm font-medium">
          {isCessions
            ? "No tienes cesiones programadas"
            : "No tienes reservas próximas"}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {isCessions
            ? "Ve a la sección correspondiente para ceder tu espacio"
            : "Reserva una plaza de parking o un puesto de oficina"}
        </p>
      </div>
      <div className="flex gap-2">
        {/* En modo reservas: CTAs a los recursos que puede reservar */}
        {/* En modo cesiones: CTAs a los recursos que puede ceder */}
        {(isCessions ? hasParkingSpot : !hasParkingSpot) && (
          <Button asChild variant="outline" size="sm">
            <Link href={ROUTES.PARKING}>
              <Car className="mr-1.5 size-3.5" />
              Parking
            </Link>
          </Button>
        )}
        {(isCessions ? hasOfficeSpot : !hasOfficeSpot) && (
          <Button asChild variant="outline" size="sm">
            <Link href={ROUTES.OFFICES}>
              <Building2 className="mr-1.5 size-3.5" />
              Oficinas
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Grouped List ─────────────────────────────────────────────

function GroupedList<T extends { date: string; id: string }>({
  items,
  renderItem,
}: {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}) {
  const grouped = React.useMemo(() => {
    const result: Record<GroupKey, T[]> = {
      "esta-semana": [],
      "este-mes": [],
      "mas-adelante": [],
    };
    for (const item of items) {
      result[getGroupKey(item.date)].push(item);
    }
    return result;
  }, [items]);

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.06 } },
      }}
    >
      {GROUP_ORDER.map((groupKey) => {
        const groupItems = grouped[groupKey];
        if (!groupItems || groupItems.length === 0) return null;

        return (
          <motion.div
            key={groupKey}
            className="space-y-2"
            variants={{
              hidden: { opacity: 0, y: 10 },
              show: {
                opacity: 1,
                y: 0,
                transition: { type: "spring", stiffness: 380, damping: 28 },
              },
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {GROUP_LABELS[groupKey]}
              </span>
              <Separator className="flex-1" />
              <span className="text-muted-foreground text-xs tabular-nums">
                {groupItems.length}
              </span>
            </div>
            <div className="divide-border/50 divide-y">
              {groupItems.map((item) => renderItem(item))}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────

export function MisReservasClient({
  reservations: initialReservations = [],
  officeReservations: initialOfficeReservations = [],
  cessions: initialCessions = [],
  hasParkingSpot = false,
  hasOfficeSpot = false,
}: MisReservasClientProps) {
  // canReserve: hay al menos un recurso sin plaza asignada
  const canReserve = !hasParkingSpot || !hasOfficeSpot;
  // canCede: hay al menos una plaza asignada que ceder
  const canCede = hasParkingSpot || hasOfficeSpot;
  const [reservations, setReservations] =
    React.useState<ReservationRow[]>(initialReservations);
  const [officeReservations, setOfficeReservations] = React.useState<
    OfficeReservationWithDetails[]
  >(initialOfficeReservations);
  const [cessions, setCessions] =
    React.useState<CessionWithDetails[]>(initialCessions);
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);

  // Fusionar reservas de parking y oficina en una sola lista ordenada por fecha
  const mergedReservations = React.useMemo((): MergedReservation[] => {
    const parking: MergedReservation[] = reservations.map((r) => ({
      ...r,
      resourceType: "parking" as const,
    }));
    const offices: MergedReservation[] = officeReservations.map((r) => ({
      ...r,
      resourceType: "office" as const,
    }));
    return [...parking, ...offices].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [reservations, officeReservations]);

  const handleCancelReservation = async (
    id: string,
    resourceType: "parking" | "office" = "parking"
  ) => {
    setCancellingId(id);
    try {
      const result =
        resourceType === "office"
          ? await cancelOfficeReservation({ id })
          : await cancelReservation({ id });
      if (result?.success) {
        toast.success("Reserva cancelada");
        if (resourceType === "office") {
          setOfficeReservations((prev) => prev.filter((r) => r.id !== id));
        } else {
          setReservations((prev) => prev.filter((r) => r.id !== id));
        }
      } else {
        toast.error(result?.error ?? "Error al cancelar");
      }
    } catch {
      toast.error("Error al cancelar la reserva");
    } finally {
      setCancellingId(null);
    }
  };

  const handleCancelCession = async (
    id: string,
    resourceType: "parking" | "office"
  ) => {
    setCancellingId(id);
    try {
      const result =
        resourceType === "office"
          ? await cancelOfficeCession({ id })
          : await cancelCession({ id });
      if (result.success) {
        const msg = result.data.reservationAlsoCancelled
          ? "Cesión cancelada y reserva del empleado anulada"
          : "Cesión cancelada";
        toast.success(msg);
        setCessions((prev) => prev.filter((c) => c.id !== id));
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Error al cancelar la cesión");
    } finally {
      setCancellingId(null);
    }
  };

  const hasCessions = cessions.length > 0;
  const hasReservations = mergedReservations.length > 0;

  // ── Secciones reutilizables ───────────────────────────────

  const reservationsSection = hasReservations ? (
    <GroupedList
      items={mergedReservations}
      renderItem={(item) => (
        <ReservationItem
          key={item.id}
          reservation={item}
          cancellingId={cancellingId}
          onCancel={handleCancelReservation}
        />
      )}
    />
  ) : (
    <EmptyState hasParkingSpot={hasParkingSpot} hasOfficeSpot={hasOfficeSpot} />
  );

  const cessionsSection = hasCessions ? (
    <GroupedList
      items={cessions}
      renderItem={(item) => (
        <CessionRow
          key={item.id}
          cession={item}
          cancellingId={cancellingId}
          onCancel={handleCancelCession}
        />
      )}
    />
  ) : (
    <EmptyState
      isCessions
      hasParkingSpot={hasParkingSpot}
      hasOfficeSpot={hasOfficeSpot}
    />
  );

  // ── Renderizado adaptativo según el rol ──────────────────

  // Solo puede reservar (sin ninguna plaza asignada): sin tabs
  if (canReserve && !canCede) {
    return <TooltipProvider>{reservationsSection}</TooltipProvider>;
  }

  // Solo puede ceder (tiene ambas plazas asignadas): sin tabs
  if (!canReserve && canCede) {
    return <TooltipProvider>{cessionsSection}</TooltipProvider>;
  }

  // Puede tanto reservar como ceder: mostrar ambas pestañas
  return (
    <TooltipProvider>
      <Tabs
        defaultValue={
          hasCessions && !hasReservations ? "cessions" : "reservations"
        }
      >
        <TabsList className="mb-4">
          <TabsTrigger value="reservations">
            Reservas
            {hasReservations && (
              <span className="bg-primary/10 text-primary ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold">
                {mergedReservations.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="cessions">
            Cesiones
            {hasCessions && (
              <span className="bg-primary/10 text-primary ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold">
                {cessions.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="reservations">{reservationsSection}</TabsContent>
        <TabsContent value="cessions">{cessionsSection}</TabsContent>
      </Tabs>
    </TooltipProvider>
  );
}
