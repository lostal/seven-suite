/**
 * Reservations View (Employee)
 *
 * Mobile-first optimized view for quick parking reservations.
 * Flow: Select date (Today/Tomorrow/Pick) → See available spots → Book
 * Maximum 3 taps to complete a reservation.
 */

"use client";

import * as React from "react";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Car,
  Loader2,
  ParkingCircle,
  CalendarX,
  CheckCircle2,
  Trash2,
  Calendar as CalendarIcon,
  MapPin,
  Clock,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

// ─── Quick Date Actions ──────────────────────────────────────

function QuickDateActions({
  onSelectDate,
  selectedDate,
}: {
  onSelectDate: (date: Date) => void;
  selectedDate: Date | null;
}) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const today = new Date();
  const tomorrow = addDays(today, 1);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      onSelectDate(date);
      setDialogOpen(false);
    }
  };

  const isToday =
    selectedDate &&
    format(selectedDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
  const isTomorrow =
    selectedDate &&
    format(selectedDate, "yyyy-MM-dd") === format(tomorrow, "yyyy-MM-dd");

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Button
        size="lg"
        variant={isToday ? "default" : "outline"}
        className="flex h-auto flex-col items-center justify-center gap-1.5 py-4"
        onClick={() => onSelectDate(today)}
      >
        <CalendarIcon className="size-5" />
        <span className="text-sm font-semibold">Hoy</span>
        <span className="text-xs opacity-90">
          {format(today, "d MMM", { locale: es })}
        </span>
      </Button>
      <Button
        size="lg"
        variant={isTomorrow ? "default" : "outline"}
        className="flex h-auto flex-col items-center justify-center gap-1.5 py-4"
        onClick={() => onSelectDate(tomorrow)}
      >
        <Clock className="size-5" />
        <span className="text-sm font-semibold">Mañana</span>
        <span className="text-xs opacity-90">
          {format(tomorrow, "d MMM", { locale: es })}
        </span>
      </Button>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button
            size="lg"
            variant={
              selectedDate && !isToday && !isTomorrow ? "default" : "outline"
            }
            className="flex h-auto flex-col items-center justify-center gap-1.5 py-4"
          >
            <CalendarIcon className="size-5" />
            <span className="text-sm font-semibold">Elegir día</span>
            {selectedDate && !isToday && !isTomorrow ? (
              <span className="text-xs opacity-90">
                {format(selectedDate, "d MMM", { locale: es })}
              </span>
            ) : (
              <span className="text-xs opacity-90">Otro día</span>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Selecciona una fecha</DialogTitle>
            <DialogDescription>
              Elige el día para el que necesitas reservar plaza
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate || undefined}
              onSelect={handleDateSelect}
              locale={es}
              disabled={{ before: new Date() }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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

  const getSpotTypeInfo = () => {
    if (spot.type === "visitor") {
      return {
        label: "Plaza de visitas",
        description: "Uso temporal",
        variant: "outline" as const,
      };
    }
    if (spot.assigned_to) {
      return {
        label: "Plaza fija",
        description: "Cedida temporalmente",
        variant: "secondary" as const,
      };
    }
    return {
      label: "Plaza fija",
      description: "Disponible para reservar",
      variant: "outline" as const,
    };
  };

  const typeInfo = getSpotTypeInfo();

  return (
    <Card className="group hover:border-primary/50 transition-all hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 group-hover:bg-primary/20 rounded-lg p-2 transition-colors">
            <ParkingCircle className="text-primary size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              {spot.label}
            </CardTitle>
            <p className="text-muted-foreground text-xs">{typeInfo.label}</p>
          </div>
        </div>
        {isCeded && (
          <Badge variant={typeInfo.variant} className="shrink-0">
            Cedida
          </Badge>
        )}
      </CardHeader>
      <CardFooter className="pt-2">
        <Button
          size="default"
          className="w-full"
          onClick={() => onBook(spot.id)}
          disabled={isBooking}
        >
          {isBooking ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Reservando…
            </>
          ) : (
            <>
              <Car className="mr-2 size-4" />
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
    <Card className="border-primary/30 from-primary/5 to-primary/10 bg-linear-to-br">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <CheckCircle2 className="text-primary size-5" />
            Mis reservas
          </CardTitle>
          <CardDescription className="mt-1.5">
            Tienes {reservations.length}{" "}
            {reservations.length === 1
              ? "reserva confirmada"
              : "reservas confirmadas"}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {reservations.map((r) => (
          <div
            key={r.id}
            className="bg-background flex items-center justify-between rounded-lg border p-3 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-md p-2">
                <MapPin className="text-primary size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">{r.spot_label}</p>
                <p className="text-muted-foreground text-xs">
                  {format(new Date(r.date + "T00:00:00"), "EEEE d 'de' MMMM", {
                    locale: es,
                  })}
                </p>
              </div>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => onCancel(r.id)}
                    disabled={cancellingId === r.id}
                  >
                    {cancellingId === r.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cancelar reserva</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────

function SpotsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <Skeleton className="size-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </CardHeader>
          <CardFooter className="pt-2">
            <Skeleton className="h-9 w-full" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────

function EmptyState({ date }: { date: Date }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="bg-muted mb-4 rounded-full p-4">
          <CalendarX className="text-muted-foreground size-10" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">
          No hay plazas disponibles
        </h3>
        <p className="text-muted-foreground mb-1 max-w-sm text-sm">
          No se encontraron plazas libres para el{" "}
          <span className="text-foreground font-medium">
            {format(date, "EEEE d 'de' MMMM", { locale: es })}
          </span>
        </p>
        <p className="text-muted-foreground text-xs">
          Prueba eligiendo otro día o vuelve más tarde
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────────

export function ReservationsView() {
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [spots, setSpots] = React.useState<SpotWithStatus[]>([]);
  const [myReservations, setMyReservations] = React.useState<ReservationRow[]>(
    []
  );
  const [loading, setLoading] = React.useState(false);
  const [bookingSpotId, setBookingSpotId] = React.useState<string | null>(null);
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);

  const loadMyReservations = async () => {
    try {
      const result = await getMyParkingReservations();
      if (result.success) {
        setMyReservations(result.data);
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      console.error("Error loading reservations:", error);
      toast.error("Error al cargar tus reservas");
    }
  };

  const loadSpotsForDate = async (date: Date) => {
    setLoading(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const result = await getAvailableSpotsForDate(dateStr);

      if (result.success) {
        setSpots(result.data);
      } else {
        toast.error(result.error);
        setSpots([]);
      }
    } catch (error) {
      console.error("Error loading spots:", error);
      toast.error("Error al cargar las plazas");
      setSpots([]);
    } finally {
      setLoading(false);
    }
  };

  // Load user reservations on mount
  React.useEffect(() => {
    let cancelled = false;
    getMyParkingReservations()
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setMyReservations(result.data);
        } else {
          toast.error(result.error);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Error loading reservations:", error);
        toast.error("Error al cargar tus reservas");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load spots when date changes
  React.useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    getAvailableSpotsForDate(dateStr)
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setSpots(result.data);
        } else {
          toast.error(result.error);
          setSpots([]);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Error loading spots:", error);
        toast.error("Error al cargar las plazas");
        setSpots([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
  };

  const handleBook = async (spotId: string) => {
    if (!selectedDate) return;

    setBookingSpotId(spotId);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const result = await createReservation({
        spot_id: spotId,
        date: dateStr,
      });

      if (result.success) {
        toast.success("¡Plaza reservada correctamente!");
        await Promise.all([
          loadSpotsForDate(selectedDate),
          loadMyReservations(),
        ]);
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

  const handleCancel = async (reservationId: string) => {
    setCancellingId(reservationId);
    try {
      const result = await cancelReservation({ id: reservationId });

      if (result.success) {
        toast.success("Reserva cancelada");
        await loadMyReservations();
        if (selectedDate) {
          await loadSpotsForDate(selectedDate);
        }
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
    <div className="space-y-4">
      {/* My Reservations */}
      <MyReservationsSection
        reservations={myReservations}
        onCancel={handleCancel}
        cancellingId={cancellingId}
      />

      {/* Quick Date Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            ¿Cuándo necesitas plaza?
          </CardTitle>
          <CardDescription>
            Selecciona el día para ver las plazas disponibles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QuickDateActions
            onSelectDate={handleSelectDate}
            selectedDate={selectedDate}
          />
        </CardContent>
      </Card>

      {/* Available Spots */}
      {selectedDate && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Plazas disponibles</h3>
              <p className="text-muted-foreground text-sm">
                {format(selectedDate, "EEEE d 'de' MMMM, yyyy", { locale: es })}
              </p>
            </div>
            {!loading && spots.length > 0 && (
              <Badge variant="secondary" className="text-sm">
                {spots.length} {spots.length === 1 ? "plaza" : "plazas"}
              </Badge>
            )}
          </div>

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
      )}
    </div>
  );
}
