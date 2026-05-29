/**
 * Time Slot Picker
 *
 * Rejilla de franjas horarias para seleccionar una franja en un puesto de trabajo.
 * Muestra los slots disponibles/ocupados y permite seleccionar uno.
 */

"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimeSlot } from "@/types";
import { getOfficeTimeSlotsForSpot } from "../actions";

interface TimeSlotPickerProps {
  spotId: string;
  date: string;
  selectedSlot: TimeSlot | null;
  onSelectSlot: (slot: TimeSlot | null) => void;
}

export function TimeSlotPicker({
  spotId,
  date,
  selectedSlot,
  onSelectSlot,
}: TimeSlotPickerProps) {
  const [slots, setSlots] = React.useState<TimeSlot[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!spotId || !date) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setSlots([]);
        onSelectSlot(null);
        setLoading(true);
      }
    });
    getOfficeTimeSlotsForSpot(spotId, date)
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setSlots(result.data);
        } else {
          toast.error(result.error ?? "Error al cargar franjas horarias");
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Error loading time slots:", error);
        toast.error("Error al cargar franjas horarias");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [spotId, date, onSelectSlot]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6">
        <Loader2 className="text-muted-foreground size-4 animate-spin" />
        <span className="text-muted-foreground text-sm">Cargando franjas…</span>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <p className="text-muted-foreground py-4 text-center text-sm">
        No hay franjas disponibles para este puesto.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <Clock className="text-muted-foreground size-3.5" />
        <span className="text-muted-foreground text-xs font-medium">
          Selecciona una franja horaria
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {slots.map((slot) => {
          const isSelected =
            selectedSlot?.start_time === slot.start_time &&
            selectedSlot?.end_time === slot.end_time;

          return (
            <button
              key={`${slot.start_time}-${slot.end_time}`}
              disabled={!slot.available}
              onClick={() => onSelectSlot(isSelected ? null : slot)}
              className={cn(
                "rounded-lg border px-2 py-1.5 text-xs font-medium transition-all",
                slot.available
                  ? isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:border-primary/50 hover:bg-primary/5 border-border cursor-pointer"
                  : "bg-muted text-muted-foreground cursor-not-allowed line-through opacity-50"
              )}
            >
              {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
