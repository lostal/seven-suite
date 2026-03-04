/**
 * Visitors Mutate Drawer
 *
 * Sheet lateral para crear o editar una reserva de visitante.
 * En modo edición se pre-rellena el formulario con los datos actuales
 * y las plazas disponibles excluyen la plaza ya ocupada por esta reserva.
 */

"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createVisitorReservationSchema,
  type CreateVisitorReservationInput,
} from "@/lib/validations";
import type { VisitorReservationWithDetails } from "@/lib/queries/visitor-reservations";

import {
  createVisitorReservation,
  updateVisitorReservation,
  getAvailableVisitorSpotsAction,
} from "../actions";
import { useVisitantes } from "./visitors-provider";

interface VisitorsMutateDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRow?: VisitorReservationWithDetails;
}

export function VisitorsMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: VisitorsMutateDrawerProps) {
  const { onRefresh } = useVisitantes();
  const isEdit = !!currentRow;

  const [availableSpots, setAvailableSpots] = React.useState<
    { id: string; label: string }[]
  >([]);
  const [loadingSpots, setLoadingSpots] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<CreateVisitorReservationInput>({
    resolver: zodResolver(createVisitorReservationSchema),
    defaultValues: isEdit
      ? {
          spot_id: currentRow.spot_id,
          date: currentRow.date,
          visitor_name: currentRow.visitor_name,
          visitor_company: currentRow.visitor_company,
          visitor_email: currentRow.visitor_email,
          notes: currentRow.notes ?? "",
        }
      : {
          spot_id: "",
          date: "",
          visitor_name: "",
          visitor_company: "",
          visitor_email: "",
          notes: "",
        },
  });

  const selectedDate = form.watch("date");

  // Cargar plazas disponibles cuando cambia la fecha.
  // En modo edición excluye la reserva actual del cálculo de ocupación.
  React.useEffect(() => {
    if (!selectedDate) {
      setAvailableSpots([]);
      return;
    }

    let cancelled = false;

    const fetchSpots = async () => {
      setLoadingSpots(true);
      form.setValue("spot_id", isEdit ? currentRow.spot_id : "");
      try {
        const result = await getAvailableVisitorSpotsAction(
          selectedDate,
          isEdit ? currentRow.id : undefined
        );
        if (!cancelled) {
          if (result.success) {
            setAvailableSpots(result.data);
          } else {
            toast.error("Error al cargar plazas disponibles");
          }
        }
      } catch {
        if (!cancelled) toast.error("Error al cargar plazas disponibles");
      } finally {
        if (!cancelled) setLoadingSpots(false);
      }
    };

    fetchSpots();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const onSubmit = async (data: CreateVisitorReservationInput) => {
    setIsSubmitting(true);
    try {
      const result = isEdit
        ? await updateVisitorReservation({ ...data, id: currentRow.id })
        : await createVisitorReservation(data);

      if (result.success) {
        toast.success(
          isEdit
            ? "Reserva actualizada y email reenviado al visitante"
            : "Reserva creada y email enviado al visitante"
        );
        onOpenChange(false);
        form.reset();
        onRefresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error(
        isEdit ? "Error al actualizar la reserva" : "Error al crear la reserva"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    onOpenChange(v);
    if (!v) form.reset();
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex flex-col sm:max-w-md">
        <SheetHeader className="text-start">
          <SheetTitle>
            {isEdit
              ? "Editar reserva de visitante"
              : "Nueva reserva de visitante"}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Modifica los datos de la reserva. Se reenviará el email de confirmación al visitante."
              : "Reserva una plaza para un visitante externo. Se le enviará un email de confirmación."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            id="visitor-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex-1 space-y-4 overflow-y-auto px-4 py-2"
          >
            {/* Fecha */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha de visita</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value
                            ? format(
                                new Date(field.value + "T00:00:00"),
                                "PPP",
                                { locale: es }
                              )
                            : "Selecciona una fecha"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={
                          field.value
                            ? new Date(field.value + "T00:00:00")
                            : undefined
                        }
                        onSelect={(date) => {
                          if (date) {
                            field.onChange(format(date, "yyyy-MM-dd"));
                          }
                        }}
                        disabled={{ before: new Date() }}
                        locale={es}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Plaza */}
            <FormField
              control={form.control}
              name="spot_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plaza</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={!selectedDate || loadingSpots}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            !selectedDate
                              ? "Selecciona una fecha primero"
                              : loadingSpots
                                ? "Cargando plazas..."
                                : availableSpots.length === 0
                                  ? "Sin plazas disponibles"
                                  : "Selecciona una plaza"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableSpots.map((spot) => (
                        <SelectItem key={spot.id} value={spot.id}>
                          {spot.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Nombre del visitante */}
            <FormField
              control={form.control}
              name="visitor_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del visitante</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre completo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Empresa */}
            <FormField
              control={form.control}
              name="visitor_company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre de la empresa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email */}
            <FormField
              control={form.control}
              name="visitor_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email del visitante</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="visitante@empresa.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notas */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Notas{" "}
                    <span className="text-muted-foreground font-normal">
                      (opcional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Instrucciones especiales, motivo de la visita..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <SheetFooter className="gap-2">
          <SheetClose asChild>
            <Button variant="outline" disabled={isSubmitting}>
              Cancelar
            </Button>
          </SheetClose>
          <Button form="visitor-form" type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEdit ? "Guardando…" : "Creando…"}
              </>
            ) : isEdit ? (
              "Guardar cambios"
            ) : (
              "Crear reserva"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
