/**
 * Management Cession Sheet
 *
 * Sheet de confirmación para directivos al seleccionar días en el calendario.
 * Permite confirmar la cesión de la plaza para los días seleccionados,
 * o cancelar cesiones existentes.
 */

"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  CalendarDays,
  Loader2,
  ParkingCircle,
  Trash2,
  ArrowRight,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import type { ResourceDayData } from "@/lib/calendar/resource-types";
import { createCession, cancelCession } from "../cession-actions";

interface ManagementCessionSheetProps {
  /** Controla si el sheet está abierto */
  open: boolean;
  /** Días seleccionados (Set<"yyyy-MM-dd">) */
  selectedDates: Set<string>;
  /** Datos del mes – para saber el estado de cada fecha seleccionada */
  dayData: Map<string, ResourceDayData>;
  /** Spot ID del directivo */
  spotId: string;
  spotLabel: string;
  onClose: () => void;
  /** Callback tras acción exitosa para refrescar el calendario */
  onActionSuccess: () => void;
}

export function ManagementCessionSheet({
  open,
  selectedDates,
  dayData,
  spotId,
  spotLabel,
  onClose,
  onActionSuccess,
}: ManagementCessionSheetProps) {
  const [isCreating, setIsCreating] = React.useState(false);
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);

  const isOpen = open;

  // Separar los días seleccionados en: nuevos (can-cede) vs cancelables (ceded-free)
  const toCreate: string[] = [];
  const toCancel: Array<{ date: string; cessionId: string }> = [];

  for (const dateStr of selectedDates) {
    const data = dayData.get(dateStr);
    if (data?.cessionDayStatus === "can-cede") {
      toCreate.push(dateStr);
    } else if (data?.cessionDayStatus === "ceded-free" && data.myCessionId) {
      toCancel.push({ date: dateStr, cessionId: data.myCessionId });
    }
  }

  const handleCreate = async () => {
    if (toCreate.length === 0) return;
    setIsCreating(true);
    try {
      const result = await createCession({
        spot_id: spotId,
        dates: toCreate,
      });
      if (result.success) {
        toast.success(
          `${result.data.count} ${result.data.count === 1 ? "cesión creada" : "cesiones creadas"}`
        );
        onActionSuccess();
        onClose();
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      console.error("[management-cession-sheet] Error al crear cesiones:", err);
      toast.error("Error al crear cesiones");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelOne = async (cessionId: string) => {
    setCancellingId(cessionId);
    try {
      const result = await cancelCession({ id: cessionId });
      if (result.success) {
        toast.success("Cesión cancelada");
        onActionSuccess();
        // No cerramos el sheet si quedan más cesiones
        if (toCancel.length === 1) onClose();
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      console.error(
        "[management-cession-sheet] Error al cancelar cesión:",
        err
      );
      toast.error("Error al cancelar cesión");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] rounded-t-2xl px-0 sm:mx-auto sm:max-w-lg"
      >
        <SheetHeader className="px-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-lg p-2.5">
              <ParkingCircle className="text-primary size-5" />
            </div>
            <div>
              <SheetTitle>Plaza {spotLabel}</SheetTitle>
              <SheetDescription>
                {selectedDates.size === 1
                  ? "1 día seleccionado"
                  : `${selectedDates.size} días seleccionados`}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-4 px-6 pb-4">
            {/* Días a CEDER */}
            {toCreate.length > 0 && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Ceder plaza estos días
                </p>
                <div className="space-y-1.5">
                  {toCreate.map((d) => (
                    <DateBadgeRow key={d} date={d} variant="create" />
                  ))}
                </div>
              </div>
            )}

            {toCreate.length > 0 && toCancel.length > 0 && <Separator />}

            {/* Días a CANCELAR */}
            {toCancel.length > 0 && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Cancelar cesión
                </p>
                <div className="space-y-1.5">
                  {toCancel.map(({ date, cessionId }) => (
                    <DateBadgeRow
                      key={date}
                      date={date}
                      variant="cancel"
                      isCancelling={cancellingId === cessionId}
                      onCancel={() => handleCancelOne(cessionId)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer con acción principal */}
        {toCreate.length > 0 && (
          <SheetFooter className="px-6 pt-2">
            <Button
              className="h-12 w-full text-base"
              onClick={handleCreate}
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Cediendo…
                </>
              ) : (
                <>
                  <CalendarDays className="mr-2 size-5" />
                  Ceder {toCreate.length}{" "}
                  {toCreate.length === 1 ? "día" : "días"}
                  <ArrowRight className="ml-2 size-4" />
                </>
              )}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Fila de fecha ────────────────────────────────────────────

function DateBadgeRow({
  date,
  variant,
  isCancelling,
  onCancel,
}: {
  date: string;
  variant: "create" | "cancel";
  isCancelling?: boolean;
  onCancel?: () => void;
}) {
  const label = format(parseISO(date), "EEEE d 'de' MMMM", { locale: es });

  return (
    <div className="bg-card flex items-center justify-between rounded-lg border px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Badge
          variant={variant === "create" ? "secondary" : "outline"}
          className={
            variant === "create"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
          }
        >
          {variant === "create" ? "Nueva" : "Ceder"}
        </Badge>
        <span className="text-sm capitalize">{label}</span>
      </div>

      {variant === "cancel" && onCancel && (
        <Button
          size="icon"
          variant="ghost"
          className="hover:bg-destructive/10 hover:text-destructive size-7"
          onClick={onCancel}
          disabled={isCancelling}
        >
          {isCancelling ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </Button>
      )}
    </div>
  );
}
