/**
 * Parking Calendar View – Contenedor unificado
 *
 * Orquesta la carga de datos, el calendario y los sheets según el rol del usuario.
 * Empleado → sheet de plazas disponibles
 * Directivo → sheet de cesión con multi-selección
 */

"use client";

import * as React from "react";
import { startOfMonth, format, addMonths, subMonths } from "date-fns";
import { toast } from "sonner";
import { CalendarCheck, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";

import type { Spot } from "@/types";
import {
  type CalendarDayData,
  getCalendarMonthData,
} from "../calendar-actions";
import { ParkingCalendar, type CalendarRole } from "./parking-calendar";
import { EmployeeDaySheet } from "./employee-day-sheet";
import { ManagementCessionSheet } from "./management-cession-sheet";

interface ParkingCalendarViewProps {
  role: CalendarRole;
  /** Solo para directivo */
  assignedSpot?: Spot | null;
}

export function ParkingCalendarView({
  role,
  assignedSpot,
}: ParkingCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = React.useState<Date>(() =>
    startOfMonth(new Date())
  );
  const [dayData, setDayData] = React.useState<Map<string, CalendarDayData>>(
    new Map()
  );
  // Dirección de navegación de mes (-1 ← | 0 inicial | 1 →)
  const [monthSlideDir, setMonthSlideDir] = React.useState(0);

  // ── Estado para sheets ────────────────────────────────────

  // Empleado: fecha del día clicado
  const [employeeSheetDate, setEmployeeSheetDate] = React.useState<
    string | null
  >(null);

  // Directivo: días seleccionados (Set) y estado del sheet
  const [managementSelected, setManagementSelected] = React.useState<
    Set<string>
  >(new Set());
  const [sheetOpen, setSheetOpen] = React.useState(false);

  // ── Caché de datos por mes ─────────────────────────────────
  // Permite mostrar datos inmediatamente al navegar a un mes ya visitado
  // y pre-cargar los meses adyacentes en segundo plano.

  const monthCache = React.useRef(
    new Map<string, Map<string, CalendarDayData>>()
  );
  const inFlight = React.useRef(new Set<string>());
  // Ref síncrona del mes activo — evita que fetches lentos sobreescriban la vista
  const currentMonthRef = React.useRef(currentMonth);

  // ── Carga de datos ────────────────────────────────────────

  const loadMonthData = React.useCallback(
    async (month: Date, { silent = false }: { silent?: boolean } = {}) => {
      const monthKey = format(month, "yyyy-MM");
      const monthStart = format(month, "yyyy-MM-dd");

      // Golpe de caché: actualizar la vista si sigue siendo el mes activo
      const cached = monthCache.current.get(monthKey);
      if (cached) {
        if (format(currentMonthRef.current, "yyyy-MM") === monthKey) {
          setDayData(cached);
        }
        return;
      }

      // Evitar peticiones duplicadas en vuelo para el mismo mes
      if (inFlight.current.has(monthKey)) return;
      inFlight.current.add(monthKey);

      try {
        const result = await getCalendarMonthData({ monthStart });
        if (result.success) {
          const map = new Map<string, CalendarDayData>(
            result.data.map((d) => [d.date, d])
          );
          monthCache.current.set(monthKey, map);
          // Solo actualizar la vista si el mes sigue siendo el activo
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
    []
  );

  // Carga inicial + pre-carga de meses adyacentes (solo al montar)
  React.useEffect(() => {
    const initial = startOfMonth(new Date());
    void loadMonthData(initial);
    void loadMonthData(addMonths(initial, 1), { silent: true });
    void loadMonthData(subMonths(initial, 1), { silent: true });
  }, [loadMonthData]); // loadMonthData es estable (useCallback con deps vacías)

  const handleMonthChange = (newMonth: Date) => {
    const dir = newMonth > currentMonth ? 1 : -1;

    // Actualizar la ref antes del estado para que los fetches en vuelo sepan
    // cuál es el mes activo antes del siguiente render
    currentMonthRef.current = newMonth;

    setMonthSlideDir(dir);
    setCurrentMonth(newMonth);
    setManagementSelected(new Set());
    setSheetOpen(false);

    // Mostrar datos cacheados inmediatamente (mismo ciclo de render que setCurrentMonth)
    const cached = monthCache.current.get(format(newMonth, "yyyy-MM"));
    if (cached) setDayData(cached);

    // Cargar el mes nuevo si no está en caché y pre-cargar adyacentes
    void loadMonthData(newMonth);
    void loadMonthData(addMonths(newMonth, 1), { silent: true });
    void loadMonthData(subMonths(newMonth, 1), { silent: true });
  };

  // ── Click en día ──────────────────────────────────────────

  const handleDayClick = (dateStr: string) => {
    const data = dayData.get(dateStr);
    if (!data) return;

    if (role === "employee") {
      const status = data.employeeStatus;
      if (status === "past" || status === "weekend") return;
      setEmployeeSheetDate(dateStr);
    } else {
      // Directivo: tap-to-toggle
      const status = data.managementStatus;
      if (status !== "can-cede" && status !== "ceded-free") return;
      setManagementSelected((prev) => {
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

  const handleActionSuccess = () => {
    // Invalidar caché del mes actual para obtener datos frescos tras la acción
    monthCache.current.delete(format(currentMonthRef.current, "yyyy-MM"));
    setManagementSelected(new Set());
    setSheetOpen(false);
    void loadMonthData(currentMonthRef.current);
  };

  return (
    <div className="relative">
      <ParkingCalendar
        role={role}
        dayData={dayData}
        currentMonth={currentMonth}
        slideDirection={monthSlideDir}
        onMonthChange={handleMonthChange}
        selectedDates={managementSelected}
        onDayClick={handleDayClick}
      />

      {/* Sheet empleado */}
      {role === "employee" && (
        <EmployeeDaySheet
          date={employeeSheetDate}
          myReservationId={
            employeeSheetDate
              ? dayData.get(employeeSheetDate)?.myReservationId
              : undefined
          }
          myReservationSpotLabel={
            employeeSheetDate
              ? dayData.get(employeeSheetDate)?.myReservationSpotLabel
              : undefined
          }
          availableCount={
            employeeSheetDate
              ? dayData.get(employeeSheetDate)?.availableCount
              : undefined
          }
          onClose={() => setEmployeeSheetDate(null)}
          onActionSuccess={handleActionSuccess}
        />
      )}

      {/* Barra de confirmación directivo — entra/sale con spring */}
      {role === "management" && assignedSpot && (
        <AnimatePresence>
          {managementSelected.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="bg-card mt-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-sm"
            >
              <span className="text-sm font-medium">
                {managementSelected.size}{" "}
                {managementSelected.size === 1
                  ? "día seleccionado"
                  : "días seleccionados"}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => setManagementSelected(new Set())}
                >
                  <X className="size-3.5" />
                  Limpiar
                </Button>
                <Button
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => setSheetOpen(true)}
                >
                  <CalendarCheck className="size-3.5" />
                  Confirmar
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Sheet directivo */}
      {role === "management" && assignedSpot && (
        <ManagementCessionSheet
          open={sheetOpen}
          selectedDates={managementSelected}
          dayData={dayData}
          spotId={assignedSpot.id}
          spotLabel={assignedSpot.label}
          onClose={() => setSheetOpen(false)}
          onActionSuccess={handleActionSuccess}
        />
      )}

      {/* Aviso si directivo no tiene plaza */}
      {role === "management" && !assignedSpot && (
        <p className="mt-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-400">
          No tienes asignada una plaza de dirección. Contacta con el
          administrador.
        </p>
      )}
    </div>
  );
}
