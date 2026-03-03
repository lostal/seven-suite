/**
 * Cessations View Component
 *
 * Interfaz para que los usuarios con plaza asignada cedan sus
 * plazas de parking y gestionen cesiones activas.
 */

"use client";

import * as React from "react";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  Loader2,
  ParkingCircle,
  Trash2,
  X,
  CalendarDays,
  Plus,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";

import type { Spot } from "@/lib/supabase/types";
import type { CessionWithDetails } from "@/lib/queries/cessions";
import {
  createCession,
  cancelCession,
  getMyParkingCessions,
} from "../../cession-actions";

interface CessionsViewProps {
  spot: Spot;
  initialCessions: CessionWithDetails[];
}

export function CessionsView({ spot, initialCessions }: CessionsViewProps) {
  const [cessions, setCessions] = React.useState(initialCessions);
  const [selectedDates, setSelectedDates] = React.useState<Date[]>([]);
  const [isCreating, setIsCreating] = React.useState(false);
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const refreshCessions = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const result = await getMyParkingCessions();
      if (result.success) {
        setCessions(result.data);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Error al actualizar cesiones");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;

    const dateStr = format(date, "yyyy-MM-dd");
    const existing = selectedDates.find(
      (d) => format(d, "yyyy-MM-dd") === dateStr
    );

    if (existing) {
      setSelectedDates(selectedDates.filter((d) => d !== existing));
    } else {
      setSelectedDates(
        [...selectedDates, date].sort((a, b) => a.getTime() - b.getTime())
      );
    }
  };

  const handleCreateCessions = async () => {
    if (selectedDates.length === 0) {
      toast.error("Selecciona al menos una fecha");
      return;
    }

    setIsCreating(true);
    try {
      const dateStrings = selectedDates.map((d) => format(d, "yyyy-MM-dd"));
      const result = await createCession({
        spot_id: spot.id,
        dates: dateStrings,
      });

      if (result.success) {
        toast.success(`${result.data.count} cesiones creadas correctamente`);
        setSelectedDates([]);
        setCalendarOpen(false);
        await refreshCessions();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Error al crear cesiones");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelCession = async (cessionId: string) => {
    setCancellingId(cessionId);
    try {
      const result = await cancelCession({ id: cessionId });

      if (result.success) {
        if (result.data.reservationAlsoCancelled) {
          toast.success("Cesión cancelada y reserva del empleado anulada");
        } else {
          toast.success("Cesión cancelada");
        }
        await refreshCessions();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Error al cancelar cesión");
    } finally {
      setCancellingId(null);
    }
  };

  const handleQuickSelectRange = (days: number) => {
    const today = new Date();
    const dates: Date[] = [];
    for (let i = 0; i < days; i++) {
      dates.push(addDays(today, i));
    }
    setSelectedDates(dates);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "available":
        return (
          <Badge
            variant="secondary"
            className="bg-green-500/10 text-green-700 hover:bg-green-500/20 dark:bg-green-500/20 dark:text-green-400"
          >
            Disponible
          </Badge>
        );
      case "reserved":
        return <Badge variant="default">Reservada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get stats
  const availableCessions = cessions.filter(
    (c) => c.status === "available"
  ).length;
  const reservedCessions = cessions.filter(
    (c) => c.status === "reserved"
  ).length;

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tu Plaza</CardTitle>
            <div className="bg-primary/10 rounded-lg p-2">
              <ParkingCircle className="text-primary size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{spot.label}</div>
            <p className="text-muted-foreground text-xs">Plaza de dirección</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Cesiones
            </CardTitle>
            <CalendarDays className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cessions.length}</div>
            <p className="text-muted-foreground text-xs">Cesiones activas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponibles</CardTitle>
            <div className="size-4 rounded-full bg-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{availableCessions}</div>
            <p className="text-muted-foreground text-xs">Sin reservar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reservadas</CardTitle>
            <div className="bg-primary size-4 rounded-full" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reservedCessions}</div>
            <p className="text-muted-foreground text-xs">Ya asignadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Cede Spot Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <CalendarDays className="size-5" />
            Ceder plaza
          </CardTitle>
          <CardDescription className="mt-1.5">
            Selecciona las fechas en las que quieres ceder tu plaza a otros
            empleados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickSelectRange(5)}
            >
              Próximos 5 días
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickSelectRange(7)}
            >
              Próxima semana
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDates([])}
              disabled={selectedDates.length === 0}
            >
              Limpiar selección
            </Button>
          </div>

          {/* Date picker */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDates.length === 0
                      ? "Selecciona fechas"
                      : selectedDates.length === 1 && selectedDates[0]
                        ? format(selectedDates[0], "d 'de' MMMM, yyyy", {
                            locale: es,
                          })
                        : `${selectedDates.length} fechas seleccionadas`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-3">
                    <Calendar
                      mode="single"
                      onSelect={handleDateSelect}
                      locale={es}
                      disabled={{ before: new Date() }}
                      modifiers={{
                        selected: selectedDates,
                      }}
                      modifiersClassNames={{
                        selected:
                          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                      }}
                      className="p-0"
                    />
                  </div>
                  <div className="border-t px-3 py-2">
                    <p className="text-muted-foreground text-xs">
                      Haz clic en las fechas para seleccionar/deseleccionar
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <Button
              onClick={handleCreateCessions}
              disabled={selectedDates.length === 0 || isCreating}
              className="w-full sm:w-auto"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creando…
                </>
              ) : (
                <>
                  <Plus className="mr-2 size-4" />
                  Ceder{" "}
                  {selectedDates.length > 0 && `(${selectedDates.length})`}
                </>
              )}
            </Button>
          </div>

          {/* Selected dates preview */}
          {selectedDates.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <span className="font-medium">
                  {selectedDates.length}{" "}
                  {selectedDates.length === 1
                    ? "fecha seleccionada"
                    : "fechas seleccionadas"}
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedDates.map((date) => (
                    <Badge key={date.toISOString()} variant="secondary">
                      {format(date, "d MMM", { locale: es })}
                    </Badge>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Active Cessions Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Cesiones activas
          </CardTitle>
          <CardDescription className="mt-1.5">
            {cessions.length === 0
              ? "No tienes cesiones activas"
              : `Tienes ${cessions.length} ${cessions.length === 1 ? "cesión activa" : "cesiones activas"}`}
          </CardDescription>
        </CardHeader>
        {cessions.length > 0 && (
          <CardContent className="pt-0">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Reservada por</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cessions.map((cession) => (
                    <TableRow key={cession.id}>
                      <TableCell className="font-medium">
                        {format(
                          new Date(cession.date + "T00:00:00"),
                          "EEEE d 'de' MMMM, yyyy",
                          { locale: es }
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(cession.status)}</TableCell>
                      <TableCell>
                        {cession.status === "reserved" ? (
                          <span className="text-sm">
                            {cession.user_name || "Empleado"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {cession.status === "available" ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() =>
                                    handleCancelCession(cession.id)
                                  }
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
                          </TooltipProvider>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  disabled
                                  className="cursor-not-allowed"
                                >
                                  <X className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                No se puede cancelar: ya ha sido reservada
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
