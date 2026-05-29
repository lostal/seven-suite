/**
 * Parking List View
 *
 * Shows a date picker sidebar + grid of available spots.
 * Users can select a date, see free spots, and book one.
 */

"use client";

import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Car,
  Loader2,
  ParkingCircle,
  CalendarX,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { SpotWithStatus } from "@/types";
import type { ReservationRow } from "@/lib/queries/reservations";
import {
  getAvailableSpotsForDate,
  getMyParkingReservations,
  createReservation,
  cancelReservation,
} from "../actions";

// ─── Spot Card ───────────────────────────────────────────────

function SpotCard({
  spot,
  onBook,
  isBooking,
}: {
  spot: SpotWithStatus;
  onBook: (spotId: string) => void;
  isBooking: boolean;
}) {
  const isCeded = spot.status === "ceded";

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ParkingCircle className="text-primary size-5" />
            {spot.label}
          </CardTitle>
          <Badge variant={isCeded ? "secondary" : "outline"}>
            {isCeded ? "Cedida" : "Libre"}
          </Badge>
        </div>
        <CardDescription>
          {spot.type === "visitor"
            ? "Plaza de visitas"
            : spot.assigned_to
              ? "Plaza fija (cedida)"
              : "Plaza fija"}
        </CardDescription>
      </CardHeader>
      <CardFooter className="pt-2">
        <Button
          size="sm"
          className="w-full"
          onClick={() => onBook(spot.id)}
          disabled={isBooking}
        >
          {isBooking ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Reservando…
            </>
          ) : (
            <>
              <Car className="size-4" />
              Reservar
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

// ─── My Reservations Section ─────────────────────────────────

function MyReservationsSection({
  reservations,
  onCancel,
  cancellingId,
}: {
  reservations: ReservationRow[];
  onCancel: (id: string) => void;
  cancellingId: string | null;
}) {
  if (reservations.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Mis reservas próximas</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reservations.map((r) => (
          <Card key={r.id} className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="text-primary size-4" />
                  {r.spot_label}
                </CardTitle>
                <Badge variant="default">Confirmada</Badge>
              </div>
              <CardDescription>
                {format(new Date(r.date + "T00:00:00"), "EEEE d 'de' MMMM", {
                  locale: es,
                })}
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="w-full"
                      onClick={() => onCancel(r.id)}
                      disabled={cancellingId === r.id}
                    >
                      {cancellingId === r.id ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Cancelando…
                        </>
                      ) : (
                        <>
                          <Trash2 className="size-4" />
                          Cancelar
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Cancelar esta reserva</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────

function SpotsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardFooter className="pt-2">
            <Skeleton className="h-8 w-full" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────

function EmptyState({ date }: { date: Date }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <CalendarX className="text-muted-foreground mb-4 size-12" />
      <h3 className="text-lg font-semibold">No hay plazas disponibles</h3>
      <p className="text-muted-foreground mt-1 text-sm">
        No se encontraron plazas libres para el{" "}
        {format(date, "d 'de' MMMM", { locale: es })}.
      </p>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export function ListView() {
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
  const [spots, setSpots] = React.useState<SpotWithStatus[]>([]);
  const [myReservations, setMyReservations] = React.useState<ReservationRow[]>(
    []
  );
  const [loading, setLoading] = React.useState(true);
  const [bookingSpotId, setBookingSpotId] = React.useState<string | null>(null);
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);

  // Format date for the server action (YYYY-MM-DD)
  const dateStr = format(selectedDate, "yyyy-MM-dd");

  React.useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    Promise.all([getAvailableSpotsForDate(dateStr), getMyParkingReservations()])
      .then(([spotsResult, reservationsResult]) => {
        if (cancelled) return;
        if (spotsResult.success) {
          setSpots(spotsResult.data);
        } else {
          toast.error(spotsResult.error);
        }
        if (reservationsResult.success) {
          setMyReservations(reservationsResult.data);
        } else {
          toast.error(reservationsResult.error);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Error loading data:", error);
        toast.error("Error al cargar los datos");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateStr]);

  // Fetch available spots and user reservations (for manual refresh)
  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [spotsResult, reservationsResult] = await Promise.all([
        getAvailableSpotsForDate(dateStr),
        getMyParkingReservations(),
      ]);

      if (spotsResult.success) {
        setSpots(spotsResult.data);
      } else {
        toast.error(spotsResult.error);
      }

      if (reservationsResult.success) {
        setMyReservations(reservationsResult.data);
      } else {
        toast.error(reservationsResult.error);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error al cargar los datos");
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  // Book a spot
  const handleBook = async (spotId: string) => {
    setBookingSpotId(spotId);
    try {
      const result = await createReservation({
        spot_id: spotId,
        date: dateStr,
      });

      if (result.success) {
        toast.success("Plaza reservada correctamente");
        await fetchData();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      console.error("Error booking spot:", error);
      toast.error("Error al reservar la plaza");
    } finally {
      setBookingSpotId(null);
    }
  };

  // Cancel a reservation
  const handleCancel = async (reservationId: string) => {
    setCancellingId(reservationId);
    try {
      const result = await cancelReservation({ id: reservationId });

      if (result.success) {
        toast.success("Reserva cancelada");
        await fetchData();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      console.error("Error cancelling reservation:", error);
      toast.error("Error al cancelar la reserva");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Sidebar: Calendar */}
      <div className="shrink-0">
        <Card>
          <CardContent className="p-3">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              locale={es}
              disabled={{ before: new Date() }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Main content */}
      <div className="flex-1 space-y-6">
        {/* My reservations */}
        <MyReservationsSection
          reservations={myReservations}
          onCancel={handleCancel}
          cancellingId={cancellingId}
        />

        {/* Available spots header */}
        <div>
          <h3 className="text-lg font-semibold">
            Plazas disponibles —{" "}
            <span className="text-primary">
              {format(selectedDate, "d 'de' MMMM, yyyy", { locale: es })}
            </span>
          </h3>
          <p className="text-muted-foreground text-sm">
            Selecciona una plaza para reservarla
          </p>
        </div>

        {/* Spots grid */}
        {loading ? (
          <SpotsSkeleton />
        ) : spots.length === 0 ? (
          <EmptyState date={selectedDate} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {spots.map((spot) => (
              <SpotCard
                key={spot.id}
                spot={spot}
                onBook={handleBook}
                isBooking={bookingSpotId === spot.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
