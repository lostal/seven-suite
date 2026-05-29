/**
 * Office Management Cession Sheet
 *
 * Sheet de confirmación para directivos al seleccionar días en el calendario de oficinas.
 * Permite confirmar la cesión del puesto para los días seleccionados,
 * o cancelar cesiones existentes.
 */

"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Building2, CalendarDays, Loader2, Trash2 } from "lucide-react";

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
import { createOfficeCession, cancelOfficeCession } from "../cession-actions";

interface OfficeCessionSheetProps {
  open: boolean;
  selectedDates: Set<string>;
  dayData: Map<string, ResourceDayData>;
  spotId: string;
  spotLabel: string;
  onClose: () => void;
  onActionSuccess: () => void;
}

export function OfficeCessionSheet({
  open,
  selectedDates,
  dayData,
  spotId,
  spotLabel,
  onClose,
  onActionSuccess,
}: OfficeCessionSheetProps) {
  const [isCreating, setIsCreating] = React.useState(false);
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);

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
      const result = await createOfficeCession({
        spot_id: spotId,
        dates: toCreate,
      });
      if (result?.success) {
        toast.success(
          `${result.data.count} ${result.data.count === 1 ? "cesión creada" : "cesiones creadas"}`
        );
        onActionSuccess();
        onClose();
      } else {
        toast.error(result?.error ?? "Error al crear cesiones");
      }
    } catch (error) {
      console.error("Error creating office cessions:", error);
      toast.error("Error al crear cesiones");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelOne = async (cessionId: string) => {
    setCancellingId(cessionId);
    try {
      const result = await cancelOfficeCession({ id: cessionId });
      if (result?.success) {
        toast.success("Cesión cancelada");
        onActionSuccess();
        if (toCancel.length === 1) onClose();
      } else {
        toast.error(result?.error ?? "Error al cancelar cesión");
      }
    } catch (error) {
      console.error("Error cancelling office cession:", error);
      toast.error("Error al cancelar cesión");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] rounded-t-2xl px-0 sm:mx-auto sm:max-w-lg"
      >
        <SheetHeader className="px-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-lg p-2.5">
              <Building2 className="text-primary size-5" />
            </div>
            <div>
              <SheetTitle>Puesto {spotLabel}</SheetTitle>
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
            {toCreate.length > 0 && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Ceder puesto estos días
                </p>
                <div className="space-y-1.5">
                  {toCreate.map((d) => (
                    <DateBadgeRow key={d} date={d} variant="create" />
                  ))}
                </div>
              </div>
            )}

            {toCreate.length > 0 && toCancel.length > 0 && <Separator />}

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

            {toCreate.length === 0 && toCancel.length === 0 && (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No hay acciones disponibles para los días seleccionados.
              </p>
            )}
          </div>
        </ScrollArea>

        {toCreate.length > 0 && (
          <SheetFooter className="px-6 pt-2 pb-4">
            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={isCreating}
            >
              {isCreating ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <CalendarDays className="mr-2 size-4" />
              )}
              Ceder{" "}
              {toCreate.length === 1 ? "1 día" : `${toCreate.length} días`}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── DateBadgeRow ─────────────────────────────────────────────

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
  const label = format(parseISO(date), "EEEE, d 'de' MMMM", { locale: es });

  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
      <div className="flex items-center gap-2">
        <Badge
          variant={variant === "create" ? "default" : "secondary"}
          className="text-xs"
        >
          {variant === "create" ? "Ceder" : "Cancelar"}
        </Badge>
        <span className="text-sm capitalize">{label}</span>
      </div>
      {variant === "cancel" && onCancel && (
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:bg-destructive/10 size-7"
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
