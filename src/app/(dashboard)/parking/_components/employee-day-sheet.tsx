/**
 * Employee Day Sheet
 *
 * Sheet lateral que aparece al hacer clic en un día del calendario (rol empleado).
 * Muestra las plazas disponibles para ese día y permite reservar o cancelar.
 */

"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Car,
  CheckCircle2,
  Loader2,
  ParkingCircle,
  Trash2,
  X,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { SpotWithStatus } from "@/types";
import {
  getAvailableSpotsForDate,
  createReservation,
  cancelReservation,
} from "../actions";

interface EmployeeDaySheetProps {
  /** "yyyy-MM-dd" o null cuando está cerrado */
  date: string | null;
  /** ID de reserva existente del usuario para este día (si la hay) */
  myReservationId?: string;
  /** Label de la plaza reservada (ej. "A-12") */
  myReservationSpotLabel?: string;
  /** Plazas disponibles conocidas desde el calendario (evita pop de altura en skeleton) */
  availableCount?: number;
  onClose: () => void;
  /** Callback tras una acción exitosa para refrescar el calendario */
  onActionSuccess: () => void;
}

export function EmployeeDaySheet({
  date,
  myReservationId,
  myReservationSpotLabel,
  availableCount,
  onClose,
  onActionSuccess,
}: EmployeeDaySheetProps) {
  const [spots, setSpots] = React.useState<SpotWithStatus[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [bookingId, setBookingId] = React.useState<string | null>(null);
  const [cancelling, setCancelling] = React.useState(false);

  const isOpen = date !== null;

  // Congela los valores visibles mientras el sheet se cierra para evitar pop visual.
  // Solo se actualizan cuando el sheet está abierto (isOpen=true).
  const stableReservationId = React.useRef(myReservationId);
  const stableSpotLabel = React.useRef(myReservationSpotLabel);
  const stableSkeletonCount = React.useRef(availableCount ?? 3);
  if (isOpen) {
    stableReservationId.current = myReservationId;
    stableSpotLabel.current = myReservationSpotLabel;
    if (availableCount !== undefined)
      stableSkeletonCount.current = availableCount;
  }

  // Cargar plazas al abrir; al cerrar no borrar el contenido (animación suave)
  React.useEffect(() => {
    if (!date) return;
    loadSpots(date);
  }, [date]);

  const loadSpots = async (d: string) => {
    setLoading(true);
    try {
      const result = await getAvailableSpotsForDate(d);
      if (result.success) {
        setSpots(result.data);
      } else {
        toast.error(result.error);
        setSpots([]);
      }
    } catch {
      toast.error("Error al cargar las plazas");
      setSpots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBook = async (spotId: string) => {
    if (!date) return;
    setBookingId(spotId);
    try {
      const result = await createReservation({ spot_id: spotId, date });
      if (result.success) {
        toast.success("¡Plaza reservada!");
        onActionSuccess();
        onClose();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Error al reservar");
    } finally {
      setBookingId(null);
    }
  };

  const handleCancel = async () => {
    if (!myReservationId) return;
    setCancelling(true);
    try {
      const result = await cancelReservation({ id: myReservationId });
      if (result.success) {
        toast.success("Reserva cancelada");
        onActionSuccess();
        onClose();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Error al cancelar");
    } finally {
      setCancelling(false);
    }
  };

  const dateLabel = date
    ? format(parseISO(date), "EEEE d 'de' MMMM", { locale: es })
    : "";

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] rounded-t-2xl px-0 sm:mx-auto sm:max-w-lg"
      >
        <SheetHeader className="px-6 pb-4">
          <SheetTitle className="capitalize">{dateLabel}</SheetTitle>
          <SheetDescription>
            {stableReservationId.current
              ? "Ya tienes una plaza reservada para este día"
              : loading
                ? "Cargando plazas disponibles…"
                : spots.length === 0
                  ? "No hay plazas disponibles"
                  : `${spots.length} ${spots.length === 1 ? "plaza disponible" : "plazas disponibles"}`}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-3 px-6 pb-6">
            {/* Reserva existente del usuario */}
            {stableReservationId.current && (
              <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 p-2.5 dark:bg-blue-900/50">
                    <CheckCircle2 className="size-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {stableSpotLabel.current
                        ? `Plaza ${stableSpotLabel.current}`
                        : "Plaza reservada"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Tu reserva para este día está confirmada
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleCancel}
                  disabled={cancelling}
                >
                  {cancelling ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="mr-1.5 size-4" />
                      Cancelar
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Lista de plazas disponibles */}
            {!stableReservationId.current && (
              <div className="space-y-3">
                {loading ? (
                  Array.from({ length: stableSkeletonCount.current }).map(
                    (_, i) => (
                      <Skeleton key={i} className="h-18 w-full rounded-xl" />
                    )
                  )
                ) : spots.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="bg-muted mb-3 rounded-full p-4">
                      <X className="text-muted-foreground size-8" />
                    </div>
                    <p className="font-semibold">Sin plazas disponibles</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Prueba con otro día
                    </p>
                  </div>
                ) : (
                  spots.map((spot) => (
                    <SpotRow
                      key={spot.id}
                      spot={spot}
                      onBook={handleBook}
                      isBooking={bookingId === spot.id}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ─── SpotRow ─────────────────────────────────────────────────

function SpotRow({
  spot,
  onBook,
  isBooking,
}: {
  spot: SpotWithStatus;
  onBook: (id: string) => void;
  isBooking: boolean;
}) {
  const isCeded = spot.status === "ceded";

  return (
    <div className="bg-card hover:border-primary/30 flex items-center justify-between rounded-xl border p-4 shadow-sm transition-colors">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 rounded-lg p-2.5">
          <ParkingCircle className="text-primary size-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">{spot.label}</p>
          <p className="text-muted-foreground text-xs">
            {isCeded ? "Plaza cedida por un directivo" : "Plaza estándar"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isCeded && (
          <Badge variant="secondary" className="text-xs">
            Cedida
          </Badge>
        )}
        <Button
          size="sm"
          onClick={() => onBook(spot.id)}
          disabled={isBooking}
          className="min-w-20"
        >
          {isBooking ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Car className="mr-1.5 size-4" />
              Reservar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
