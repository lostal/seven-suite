/**
 * Resource Calendar View – Contenedor unificado
 *
 * Orquesta carga de datos, caché, prefetch y navegación de mes.
 * Delega los sheets concretos mediante render props, por lo que
 * sirve tanto para parking como para oficinas sin duplicar lógica.
 *
 * Uso (parking):
 *   <ResourceCalendarView
 *     hasAssignedSpot={!!spot}
 *     assignedSpot={spot}
 *     loadMonthData={getCalendarMonthData}
 *     showAvailableCount
 *     resourceLabel="plaza de parking"
 *     renderBookingSheet={...}
 *     renderCessionSheet={...}
 *   />
 */

"use client";

import * as React from "react";
import { startOfMonth, format, addMonths, subMonths } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { X, CalendarCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ResourceCalendar } from "./resource-calendar";
import type { ResourceDayData } from "@/lib/calendar/resource-types";
import type { ActionResult } from "@/lib/actions";

// ─── Props ─────────────────────────────────────────────────────

export interface BookingSheetProps {
  /** Fecha seleccionada (null = cerrado) */
  date: string | null;
  /** Datos del día seleccionado */
  data: ResourceDayData | undefined;
  onClose: () => void;
  onSuccess: () => void;
}

export interface CessionSheetProps {
  open: boolean;
  selectedDates: Set<string>;
  spotId: string;
  spotLabel: string;
  dayData: Map<string, ResourceDayData>;
  onClose: () => void;
  onSuccess: () => void;
}

export interface ResourceCalendarViewProps {
  hasAssignedSpot: boolean;
  /** Puesto/plaza asignada; solo presente cuando hasAssignedSpot=true */
  assignedSpot?: { id: string; label: string } | null;
  /**
   * Server action que devuelve los datos del mes.
   * Tipado con ActionResult para detectar errores en compilación.
   */
  loadMonthData: (input: {
    monthStart: string;
  }) => Promise<ActionResult<ResourceDayData[]>>;
  /** Mostrar contador de disponibilidad en celdas. True para parking. */
  showAvailableCount?: boolean;
  /**
   * Etiqueta del recurso para el aviso de "sin asignación".
   * Ej: "plaza de parking" | "puesto de oficina"
   */
  resourceLabel?: string;
  /** Sheet que se muestra al hacer click en un día (modo reserva / sin plaza asignada) */
  renderBookingSheet: (props: BookingSheetProps) => React.ReactNode;
  /** Sheet que se muestra al confirmar la selección de días (modo cesión / con plaza asignada) */
  renderCessionSheet: (props: CessionSheetProps) => React.ReactNode;
}

// ─── Constantes de caché ─────────────────────────────────────

/** TTL del caché de meses en el cliente. Expirar tras 5 min evita datos obsoletos en sesiones largas. */
const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = { data: Map<string, ResourceDayData>; loadedAt: number };

// ─── Componente ──────────────────────────────────────────────

export function ResourceCalendarView({
  hasAssignedSpot,
  assignedSpot,
  loadMonthData: loadMonthDataAction,
  showAvailableCount = false,
  resourceLabel = "recurso",
  renderBookingSheet,
  renderCessionSheet,
}: ResourceCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = React.useState(() =>
    startOfMonth(new Date())
  );
  const [dayData, setDayData] = React.useState<Map<string, ResourceDayData>>(
    new Map()
  );
  const [monthSlideDir, setMonthSlideDir] = React.useState(0);

  // Sheet booking (sin plaza): fecha del día clickado
  const [bookingSheetDate, setBookingSheetDate] = React.useState<string | null>(
    null
  );

  // Sheet cesión (con plaza asignada): días seleccionados + open
  const [cessionSelected, setCessionSelected] = React.useState<Set<string>>(
    new Set()
  );
  const [cessionSheetOpen, setCessionSheetOpen] = React.useState(false);

  // ── Caché con TTL ─────────────────────────────────────────
  // Cada entrada guarda los datos y el timestamp de carga.
  // Entradas con más de CACHE_TTL_MS se invalidan automáticamente.
  const monthCache = React.useRef(new Map<string, CacheEntry>());
  const inFlight = React.useRef(new Set<string>());
  const currentMonthRef = React.useRef(currentMonth);

  // ── Carga de datos ────────────────────────────────────────

  const loadMonth = React.useCallback(
    async (month: Date, { silent = false }: { silent?: boolean } = {}) => {
      const monthKey = format(month, "yyyy-MM");
      const monthStart = format(month, "yyyy-MM-dd");

      const cached = monthCache.current.get(monthKey);
      const isFresh = cached && Date.now() - cached.loadedAt < CACHE_TTL_MS;
      if (isFresh) {
        if (format(currentMonthRef.current, "yyyy-MM") === monthKey) {
          setDayData(cached.data);
        }
        return;
      }

      if (inFlight.current.has(monthKey)) return;
      inFlight.current.add(monthKey);

      try {
        const result = await loadMonthDataAction({ monthStart });
        if (result.success) {
          const map = new Map<string, ResourceDayData>(
            result.data.map((d) => [d.date, d])
          );
          // LRU eviction: keep at most 24 months to prevent unbounded memory growth
          const cache = monthCache.current;
          if (cache.size >= 24) {
            const oldestKey = cache.keys().next().value;
            if (oldestKey !== undefined) cache.delete(oldestKey);
          }
          cache.set(monthKey, { data: map, loadedAt: Date.now() });
          if (format(currentMonthRef.current, "yyyy-MM") === monthKey) {
            setDayData(map);
          }
        } else if (!silent) {
          toast.error(result.error ?? "Error al cargar el calendario");
        }
      } catch {
        if (!silent) toast.error("Error al cargar el calendario");
      } finally {
        inFlight.current.delete(monthKey);
      }
    },
    [loadMonthDataAction]
  );

  // Carga inicial + pre-carga de meses adyacentes
  React.useEffect(() => {
    const initial = startOfMonth(new Date());
    void loadMonth(initial);
    void loadMonth(addMonths(initial, 1), { silent: true });
    void loadMonth(subMonths(initial, 1), { silent: true });
  }, [loadMonth]);

  // ── Navegación de mes ─────────────────────────────────────

  const handleMonthChange = (newMonth: Date) => {
    const dir = newMonth > currentMonth ? 1 : -1;
    currentMonthRef.current = newMonth;
    setMonthSlideDir(dir);
    setCurrentMonth(newMonth);
    setCessionSelected(new Set());
    setCessionSheetOpen(false);

    const cached = monthCache.current.get(format(newMonth, "yyyy-MM"));
    if (cached) setDayData(cached.data);

    void loadMonth(newMonth);
    void loadMonth(addMonths(newMonth, 1), { silent: true });
    void loadMonth(subMonths(newMonth, 1), { silent: true });
  };

  // ── Click en día ──────────────────────────────────────────

  const handleDayClick = (dateStr: string) => {
    const data = dayData.get(dateStr);
    if (!data) return;

    if (!hasAssignedSpot) {
      const status = data.bookingStatus;
      if (status === "past" || status === "unavailable") return;
      setBookingSheetDate(dateStr);
    } else {
      const status = data.cessionDayStatus;
      if (status !== "can-cede" && status !== "ceded-free") return;
      setCessionSelected((prev) => {
        const next = new Set(prev);
        if (next.has(dateStr)) {
          next.delete(dateStr);
        } else {
          next.add(dateStr);
        }
        return next;
      });
    }
  };

  // ── Refresco tras acción ──────────────────────────────────

  const handleActionSuccess = React.useCallback(() => {
    monthCache.current.delete(format(currentMonthRef.current, "yyyy-MM"));
    setCessionSelected(new Set());
    setCessionSheetOpen(false);
    setBookingSheetDate(null);
    void loadMonth(currentMonthRef.current);
  }, [loadMonth]);

  const bookingSheet = React.useMemo(
    () =>
      !hasAssignedSpot
        ? // eslint-disable-next-line react-hooks/refs
          renderBookingSheet({
            date: bookingSheetDate,
            data: bookingSheetDate ? dayData.get(bookingSheetDate) : undefined,
            onClose: () => setBookingSheetDate(null),
            onSuccess: handleActionSuccess,
          })
        : null,
    [
      hasAssignedSpot,
      bookingSheetDate,
      dayData,
      renderBookingSheet,
      handleActionSuccess,
    ]
  );

  const cessionSheet = React.useMemo(
    () =>
      hasAssignedSpot && assignedSpot
        ? // eslint-disable-next-line react-hooks/refs
          renderCessionSheet({
            open: cessionSheetOpen,
            selectedDates: cessionSelected,
            spotId: assignedSpot.id,
            spotLabel: assignedSpot.label,
            dayData,
            onClose: () => setCessionSheetOpen(false),
            onSuccess: handleActionSuccess,
          })
        : null,
    [
      hasAssignedSpot,
      assignedSpot,
      cessionSheetOpen,
      cessionSelected,
      dayData,
      renderCessionSheet,
      handleActionSuccess,
    ]
  );

  return (
    <div className="relative">
      <ResourceCalendar
        mode={hasAssignedSpot ? "cession" : "booking"}
        dayData={dayData}
        currentMonth={currentMonth}
        slideDirection={monthSlideDir}
        onMonthChange={handleMonthChange}
        selectedDates={cessionSelected}
        onDayClick={handleDayClick}
        showAvailableCount={showAvailableCount}
      />

      {/* Sheet modo reserva (sin plaza/puesto asignado) */}
      {bookingSheet}

      {/* Barra de confirmación del modo cesión */}
      {hasAssignedSpot && assignedSpot && (
        <AnimatePresence>
          {cessionSelected.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="bg-card mt-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-sm"
            >
              <span className="text-sm font-medium">
                {cessionSelected.size}{" "}
                {cessionSelected.size === 1
                  ? "día seleccionado"
                  : "días seleccionados"}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => setCessionSelected(new Set())}
                >
                  <X className="size-3.5" />
                  Limpiar
                </Button>
                <Button
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => setCessionSheetOpen(true)}
                >
                  <CalendarCheck className="size-3.5" />
                  Confirmar
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Sheet modo cesión */}
      {cessionSheet}

      {/* Aviso si el usuario no tiene plaza/puesto asignado */}
      {hasAssignedSpot && !assignedSpot && (
        <p className="mt-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-400">
          No tienes asignado una {resourceLabel}. Contacta con el administrador.
        </p>
      )}
    </div>
  );
}
