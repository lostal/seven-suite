"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, differenceInCalendarDays } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Loader2, Info } from "lucide-react";
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
  createLeaveRequestSchema,
  LEAVE_TYPES,
  LEAVE_TYPE_LABELS,
  type CreateLeaveRequestInput,
} from "@/lib/validations";
import type { LeaveRequestWithDetails } from "@/lib/queries/leave-requests";
import { createLeaveRequest, updateLeaveRequest } from "../../actions";
import { useLeaveRequests } from "./leave-requests-provider";

interface LeaveRequestFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRow?: LeaveRequestWithDetails;
}

export function LeaveRequestForm({
  open,
  onOpenChange,
  currentRow,
}: LeaveRequestFormProps) {
  const { onRefresh } = useLeaveRequests();
  const isEdit = !!currentRow;
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<CreateLeaveRequestInput>({
    resolver: zodResolver(createLeaveRequestSchema),
    defaultValues: isEdit
      ? {
          leave_type: currentRow.leaveType,
          start_date: currentRow.startDate,
          end_date: currentRow.endDate,
          reason: currentRow.reason ?? "",
        }
      : {
          leave_type: "vacation",
          start_date: "",
          end_date: "",
          reason: "",
        },
  });

  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form watch() es el patrón estándar de RHF
  const leaveType = form.watch("leave_type");
  const startDate = form.watch("start_date");
  const endDate = form.watch("end_date");

  const approxDays =
    startDate && endDate && endDate >= startDate
      ? differenceInCalendarDays(
          new Date(endDate + "T00:00:00"),
          new Date(startDate + "T00:00:00")
        ) + 1
      : null;

  const onSubmit = async (data: CreateLeaveRequestInput) => {
    setIsSubmitting(true);
    try {
      const result = isEdit
        ? await updateLeaveRequest({ ...data, id: currentRow.id })
        : await createLeaveRequest(data);

      if (result.success) {
        toast.success(
          isEdit ? "Solicitud actualizada" : "Solicitud enviada correctamente"
        );
        onOpenChange(false);
        form.reset();
        onRefresh();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      console.error("Error submitting leave request:", error);
      toast.error("Error al enviar la solicitud");
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
            {isEdit ? "Editar solicitud" : "Nueva solicitud"}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Modifica los datos y vuelve a enviar para revisión."
              : "Solicita días de ausencia. Tu manager recibirá la solicitud para aprobarla."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            id="leave-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex-1 space-y-4 overflow-y-auto px-4 py-2"
          >
            {/* Tipo */}
            <FormField
              control={form.control}
              name="leave_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de ausencia</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LEAVE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {LEAVE_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                  {leaveType === "sick" && (
                    <p className="text-muted-foreground flex items-center gap-1 text-xs">
                      <Info className="h-3 w-3" />
                      La baja médica se registra automáticamente sin necesitar
                      aprobación.
                    </p>
                  )}
                </FormItem>
              )}
            />

            {/* Fecha inicio */}
            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha de inicio</FormLabel>
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
                        onSelect={(d) => {
                          if (d) field.onChange(format(d, "yyyy-MM-dd"));
                        }}
                        disabled={
                          leaveType !== "sick"
                            ? { before: new Date() }
                            : undefined
                        }
                        locale={es}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Fecha fin */}
            <FormField
              control={form.control}
              name="end_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha de fin</FormLabel>
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
                        onSelect={(d) => {
                          if (d) field.onChange(format(d, "yyyy-MM-dd"));
                        }}
                        disabled={
                          startDate
                            ? { before: new Date(startDate + "T00:00:00") }
                            : { before: new Date() }
                        }
                        locale={es}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                  {approxDays !== null && (
                    <p className="text-muted-foreground text-xs">
                      Aproximadamente {approxDays} día
                      {approxDays !== 1 ? "s" : ""} naturales (los días
                      laborables se calculan al enviar).
                    </p>
                  )}
                </FormItem>
              )}
            />

            {/* Motivo */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Motivo{" "}
                    <span className="text-muted-foreground font-normal">
                      (opcional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe brevemente el motivo de la ausencia..."
                      className="resize-none"
                      rows={3}
                      {...field}
                      value={field.value ?? ""}
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
          <Button form="leave-form" type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEdit ? "Guardando…" : "Enviando…"}
              </>
            ) : isEdit ? (
              "Guardar cambios"
            ) : (
              "Enviar solicitud"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
