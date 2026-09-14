"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Building2, CheckCircle2, Loader2, Trash2, X } from "lucide-react";
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
import { ResourceMapDialog } from "@/components/booking/resource-map-dialog";
import type { SpotWithStatus } from "@/types";
import {
  getOfficeSpotsForDate,
  createOfficeReservation,
  cancelOfficeReservation,
} from "../actions";

interface OfficeDaySheetProps {
  date: string | null;
  myReservationId?: string;
  myReservationSpotLabel?: string;
  availableCount?: number;
  onClose: () => void;
  onActionSuccess: () => void;
  mapMimeType: string | null;
  mapUrl: string | null;
}

export function OfficeDaySheet({
  date,
  myReservationId,
  myReservationSpotLabel,
  availableCount,
  onClose,
  onActionSuccess,
  mapMimeType,
  mapUrl,
}: OfficeDaySheetProps) {
  const [spots, setSpots] = React.useState<SpotWithStatus[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [bookingId, setBookingId] = React.useState<string | null>(null);
  const [cancelling, setCancelling] = React.useState(false);
  const isOpen = date !== null;
  const [stableReservationId, setStableReservationId] =
    React.useState(myReservationId);
  const [stableSpotLabel, setStableSpotLabel] = React.useState(
    myReservationSpotLabel
  );
  const [stableSkeletonCount, setStableSkeletonCount] = React.useState(
    availableCount ?? 3
  );

  /* eslint-disable react-hooks/set-state-in-effect -- freeze while closing */
  React.useEffect(() => {
    if (isOpen) {
      setStableReservationId(myReservationId);
      setStableSpotLabel(myReservationSpotLabel);
      if (availableCount !== undefined) setStableSkeletonCount(availableCount);
    }
  }, [isOpen, myReservationId, myReservationSpotLabel, availableCount]);
  /* eslint-enable react-hooks/set-state-in-effect */

  React.useEffect(() => {
    if (!date) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    getOfficeSpotsForDate(date)
      .then((result) => {
        if (cancelled) return;
        if (result.success) setSpots(result.data);
        else {
          toast.error(result.error ?? "Error al cargar los puestos");
          setSpots([]);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Error loading office spots:", error);
          toast.error("Error al cargar los puestos");
          setSpots([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const handleBook = async (spotId: string) => {
    if (!date) return;
    setBookingId(spotId);
    try {
      const result = await createOfficeReservation({ spot_id: spotId, date });
      if (result.success) {
        toast.success("¡Puesto reservado!");
        onActionSuccess();
        onClose();
      } else toast.error(result.error ?? "Error al reservar");
    } catch (error) {
      console.error("Error booking office spot:", error);
      toast.error("Error al reservar");
    } finally {
      setBookingId(null);
    }
  };

  const handleCancel = async () => {
    if (!myReservationId) return;
    setCancelling(true);
    try {
      const result = await cancelOfficeReservation({ id: myReservationId });
      if (result.success) {
        toast.success("Reserva cancelada");
        onActionSuccess();
        onClose();
      } else toast.error(result.error ?? "Error al cancelar");
    } catch (error) {
      console.error("Error cancelling office reservation:", error);
      toast.error("Error al cancelar");
    } finally {
      setCancelling(false);
    }
  };

  const dateLabel = date
    ? format(parseISO(date), "EEEE d 'de' MMMM", { locale: es })
    : "";
  const availableSpots = spots.filter(
    (spot) => spot.status === "free" || spot.status === "ceded"
  );

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] overflow-hidden rounded-t-2xl px-0 sm:mx-auto sm:max-w-lg"
      >
        <SheetHeader className="px-6 pb-4">
          <SheetTitle className="capitalize">{dateLabel}</SheetTitle>
          <SheetDescription>
            {stableReservationId
              ? "Ya tienes un puesto reservado para este día"
              : loading
                ? "Cargando puestos disponibles…"
                : availableSpots.length === 0
                  ? "No hay puestos disponibles"
                  : `${availableSpots.length} ${availableSpots.length === 1 ? "puesto disponible" : "puestos disponibles"}`}
          </SheetDescription>
          {mapMimeType && mapUrl && (
            <ResourceMapDialog
              mapUrl={mapUrl}
              mimeType={mapMimeType}
              resourceLabel="oficinas"
            />
          )}
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-3 px-6 pb-6">
            {stableReservationId && (
              <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="text-sm font-semibold">
                      {stableSpotLabel
                        ? `Puesto ${stableSpotLabel}`
                        : "Puesto reservado"}
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

            {!stableReservationId && (
              <div className="space-y-3">
                {loading ? (
                  Array.from({ length: stableSkeletonCount }).map((_, i) => (
                    <Skeleton key={i} className="h-18 w-full rounded-xl" />
                  ))
                ) : availableSpots.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <X className="text-muted-foreground mb-3 size-8" />
                    <p className="font-semibold">Sin puestos disponibles</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Prueba con otro día
                    </p>
                  </div>
                ) : (
                  availableSpots.map((spot) => (
                    <div
                      key={spot.id}
                      className="bg-card flex items-center justify-between rounded-xl border p-4 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className="text-primary size-5" />
                        <div>
                          <p className="text-sm font-semibold">{spot.label}</p>
                          <p className="text-muted-foreground text-xs">
                            {spot.status === "ceded"
                              ? "Cedido por directivo"
                              : "Puesto disponible"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {spot.status === "ceded" && (
                          <Badge variant="secondary" className="text-xs">
                            Cedido
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          onClick={() => handleBook(spot.id)}
                          disabled={bookingId !== null}
                        >
                          {bookingId === spot.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            "Reservar"
                          )}
                        </Button>
                      </div>
                    </div>
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
