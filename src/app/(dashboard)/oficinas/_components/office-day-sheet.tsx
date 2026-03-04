/**
 * Office Employee Day Sheet
 *
 * Sheet lateral para que el empleado reserve un puesto de trabajo.
 * Flujo de dos pasos cuando time_slots_enabled=true:
 *   1. Selecciona un puesto disponible
 *   2. Selecciona una franja horaria (o reserva todo el día)
 */

"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
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

import type { SpotWithStatus, TimeSlot } from "@/types";
import {
  getOfficeSpotsForDate,
  createOfficeReservation,
  cancelOfficeReservation,
} from "../actions";
import { TimeSlotPicker } from "./time-slot-picker";

interface OfficeDaySheetProps {
  date: string | null;
  myReservationId?: string;
  myReservationSpotLabel?: string;
  myReservationStartTime?: string | null;
  myReservationEndTime?: string | null;
  availableCount?: number;
  timeSlotsEnabled?: boolean;
  onClose: () => void;
  onActionSuccess: () => void;
}

export function OfficeDaySheet({
  date,
  myReservationId,
  myReservationSpotLabel,
  myReservationStartTime,
  myReservationEndTime,
  availableCount,
  timeSlotsEnabled = false,
  onClose,
  onActionSuccess,
}: OfficeDaySheetProps) {
  const [spots, setSpots] = React.useState<SpotWithStatus[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedSpot, setSelectedSpot] = React.useState<SpotWithStatus | null>(
    null
  );
  const [selectedSlot, setSelectedSlot] = React.useState<TimeSlot | null>(null);
  const [bookingSpotId, setBookingSpotId] = React.useState<string | null>(null);
  const [cancelling, setCancelling] = React.useState(false);

  const isOpen = date !== null;

  const stableReservationId = React.useRef(myReservationId);
  const stableSpotLabel = React.useRef(myReservationSpotLabel);
  const stableStartTime = React.useRef(myReservationStartTime);
  const stableEndTime = React.useRef(myReservationEndTime);
  const stableSkeletonCount = React.useRef(availableCount ?? 3);

  if (isOpen) {
    stableReservationId.current = myReservationId;
    stableSpotLabel.current = myReservationSpotLabel;
    stableStartTime.current = myReservationStartTime;
    stableEndTime.current = myReservationEndTime;
    if (availableCount !== undefined)
      stableSkeletonCount.current = availableCount;
  }

  // Limpiar selección de franja al cambiar puesto o día
  const handleSelectSpot = React.useCallback((spot: SpotWithStatus | null) => {
    setSelectedSpot(spot);
    setSelectedSlot(null);
  }, []);

  React.useEffect(() => {
    if (!date) return;
    setSelectedSpot(null);
    setSelectedSlot(null);
    loadSpots(date);
  }, [date]);

  const loadSpots = async (d: string) => {
    setLoading(true);
    try {
      const result = await getOfficeSpotsForDate(d);
      if (result.success) {
        setSpots(result.data);
      } else {
        toast.error(result.error ?? "Error al cargar los puestos");
        setSpots([]);
      }
    } catch {
      toast.error("Error al cargar los puestos");
      setSpots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBook = async (spot: SpotWithStatus) => {
    if (!date) return;

    // Si hay franjas habilitadas y no ha seleccionad… → entrar en modo selección de franja
    if (timeSlotsEnabled && selectedSpot?.id !== spot.id) {
      handleSelectSpot(spot);
      return;
    }

    // Confirmar reserva (con o sin franja)
    setBookingSpotId(spot.id);
    try {
      const result = await createOfficeReservation({
        spot_id: spot.id,
        date,
        start_time: selectedSlot?.start_time ?? undefined,
        end_time: selectedSlot?.end_time ?? undefined,
      });
      if (result?.success) {
        toast.success("¡Puesto reservado!");
        onActionSuccess();
        onClose();
      } else if (result && !result.success) {
        toast.error(result.error ?? "Error al reservar");
      }
    } catch {
      toast.error("Error al reservar");
    } finally {
      setBookingSpotId(null);
    }
  };

  const handleCancel = async () => {
    if (!myReservationId) return;
    setCancelling(true);
    try {
      const result = await cancelOfficeReservation({ id: myReservationId });
      if (result?.success) {
        toast.success("Reserva cancelada");
        onActionSuccess();
        onClose();
      } else if (result && !result.success) {
        toast.error(result.error ?? "Error al cancelar");
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

  const isInSlotSelectionMode = timeSlotsEnabled && selectedSpot !== null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] overflow-hidden rounded-t-2xl px-0 sm:mx-auto sm:max-w-lg"
      >
        <SheetHeader className="px-6 pb-4">
          {isInSlotSelectionMode ? (
            <>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => handleSelectSpot(null)}
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <SheetTitle className="capitalize">{dateLabel}</SheetTitle>
              </div>
              <SheetDescription>
                Puesto {selectedSpot.label} — Selecciona una franja horaria
              </SheetDescription>
            </>
          ) : (
            <>
              <SheetTitle className="capitalize">{dateLabel}</SheetTitle>
              <SheetDescription>
                {stableReservationId.current
                  ? "Ya tienes un puesto reservado para este día"
                  : loading
                    ? "Cargando puestos disponibles…"
                    : spots.length === 0
                      ? "No hay puestos disponibles"
                      : `${spots.filter((s) => s.status === "free" || s.status === "ceded").length} ${
                          spots.filter(
                            (s) => s.status === "free" || s.status === "ceded"
                          ).length === 1
                            ? "puesto disponible"
                            : "puestos disponibles"
                        }`}
              </SheetDescription>
            </>
          )}
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-3 px-6 pb-6">
            {/* ── Modo selección de franja horaria ── */}
            {isInSlotSelectionMode && (
              <div className="space-y-4">
                <TimeSlotPicker
                  spotId={selectedSpot.id}
                  date={date!}
                  selectedSlot={selectedSlot}
                  onSelectSlot={setSelectedSlot}
                />
                {/* Botón confirmar con franja o día completo */}
                <div className="space-y-2 pt-2">
                  {selectedSlot ? (
                    <Button
                      className="w-full"
                      onClick={() => handleBook(selectedSpot)}
                      disabled={bookingSpotId !== null}
                    >
                      {bookingSpotId ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Clock className="mr-2 size-4" />
                      )}
                      Reservar {selectedSlot.start_time.slice(0, 5)}–
                      {selectedSlot.end_time.slice(0, 5)}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => handleBook(selectedSpot)}
                      disabled={bookingSpotId !== null}
                    >
                      {bookingSpotId ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Building2 className="mr-2 size-4" />
                      )}
                      Reservar día completo
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* ── Modo lista de puestos ── */}
            {!isInSlotSelectionMode && (
              <>
                {/* Reserva existente */}
                {stableReservationId.current && (
                  <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-blue-100 p-2.5 dark:bg-blue-900/50">
                        <CheckCircle2 className="size-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          {stableSpotLabel.current
                            ? `Puesto ${stableSpotLabel.current}`
                            : "Puesto reservado"}
                        </p>
                        {stableStartTime.current ? (
                          <p className="text-muted-foreground text-xs">
                            {stableStartTime.current.slice(0, 5)}–
                            {stableEndTime.current?.slice(0, 5) ?? ""}
                          </p>
                        ) : (
                          <p className="text-muted-foreground text-xs">
                            Reserva confirmada para este día
                          </p>
                        )}
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

                {/* Lista de puestos */}
                {!stableReservationId.current && (
                  <div className="space-y-3">
                    {loading ? (
                      Array.from({ length: stableSkeletonCount.current }).map(
                        (_, i) => (
                          <Skeleton
                            key={i}
                            className="h-18 w-full rounded-xl"
                          />
                        )
                      )
                    ) : spots.filter(
                        (s) => s.status === "free" || s.status === "ceded"
                      ).length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="bg-muted mb-3 rounded-full p-4">
                          <X className="text-muted-foreground size-8" />
                        </div>
                        <p className="font-semibold">Sin puestos disponibles</p>
                        <p className="text-muted-foreground mt-1 text-sm">
                          Prueba con otro día
                        </p>
                      </div>
                    ) : (
                      spots
                        .filter(
                          (s) => s.status === "free" || s.status === "ceded"
                        )
                        .map((spot) => (
                          <OfficeSpotRow
                            key={spot.id}
                            spot={spot}
                            onBook={handleBook}
                            isBooking={bookingSpotId === spot.id}
                            timeSlotsEnabled={timeSlotsEnabled}
                          />
                        ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ─── OfficeSpotRow ────────────────────────────────────────────

function OfficeSpotRow({
  spot,
  onBook,
  isBooking,
  timeSlotsEnabled,
}: {
  spot: SpotWithStatus;
  onBook: (spot: SpotWithStatus) => void;
  isBooking: boolean;
  timeSlotsEnabled: boolean;
}) {
  const isCeded = spot.status === "ceded";

  return (
    <div className="bg-card hover:border-primary/30 flex items-center justify-between rounded-xl border p-4 shadow-sm transition-colors">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 rounded-lg p-2.5">
          <Building2 className="text-primary size-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">{spot.label}</p>
          <p className="text-muted-foreground text-xs">
            {isCeded ? "Cedido por directivo" : "Puesto disponible"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isCeded && (
          <Badge variant="secondary" className="text-xs">
            Cedido
          </Badge>
        )}
        <Button
          size="sm"
          onClick={() => onBook(spot)}
          disabled={isBooking}
          className="min-w-22"
        >
          {isBooking ? (
            <Loader2 className="size-4 animate-spin" />
          ) : timeSlotsEnabled ? (
            <>
              <Clock className="mr-1.5 size-3.5" />
              Elegir hora
            </>
          ) : (
            <>
              <Building2 className="mr-1.5 size-3.5" />
              Reservar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
