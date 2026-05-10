"use client";

/**
 * Formulario de configuración por tipo de recurso
 *
 * Usado tanto para la página de parking como para la de oficinas.
 * Los campos de franjas horarias solo se muestran si time_slots_enabled
 * está activado (relevante para oficinas).
 */

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  updateResourceConfigSchema,
  type UpdateResourceConfigInput,
} from "@/lib/validations";
import type { ResourceConfigValues } from "@/lib/config-types";

const DAYS_OF_WEEK = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
] as const;

interface ResourceConfigFormProps {
  config: ResourceConfigValues;
  /** Server action that handles the form submission */
  onSave: (
    data: UpdateResourceConfigInput
  ) => Promise<{ success: boolean; error?: string }>;
  /** Whether time slot fields should be shown (only for offices) */
  showTimeSlots?: boolean;
  /** Whether the visitor booking toggle should be shown (false for offices) */
  showVisitorBooking?: boolean;
  /** Whether this is a per-entity override (shows restore defaults button) */
  isEntityOverride?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onRestoreDefaults?: any;
}

// ─── Nullable number input (vacío = sin límite) ───────────────

function NullableNumberInput({
  id,
  label,
  description,
  value,
  min,
  max,
  onChange,
  error,
}: {
  id: string;
  label: string;
  description?: string;
  value: number | null;
  min?: number;
  max?: number;
  onChange: (v: number | null) => void;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value ?? ""}
        placeholder="Sin límite"
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(null);
          } else {
            const n = parseInt(raw, 10);
            if (!isNaN(n)) onChange(n);
          }
        }}
      />
      {description && (
        <p className="text-muted-foreground text-xs">{description}</p>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}

type FormValues = UpdateResourceConfigInput;
type FormMethods = UseFormReturn<FormValues>;

interface SectionProps {
  values: FormValues;
  errors: FormMethods["formState"]["errors"];
  register: FormMethods["register"];
  setValue: FormMethods["setValue"];
}

function VisitorSection({
  values,
  setValue,
}: Pick<SectionProps, "values" | "setValue">) {
  return (
    <div className="flex flex-row items-center justify-between rounded-lg border p-4">
      <div className="space-y-0.5">
        <Label className="text-base">Reservas para visitantes</Label>
        <p className="text-muted-foreground text-sm">
          Permite reservar en nombre de visitantes externos
        </p>
      </div>
      <Switch
        checked={values.visitor_booking_enabled}
        onCheckedChange={(checked) =>
          setValue("visitor_booking_enabled", checked, { shouldDirty: true })
        }
      />
    </div>
  );
}

function TimeSlotsSection({
  values,
  errors,
  register,
  setValue,
}: SectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm leading-none font-medium">Franjas horarias</h4>
        <p className="text-muted-foreground mt-1 text-sm">
          Configura si las reservas son por día completo o por tramos de tiempo
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-row items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base">Reserva por franjas</Label>
            <p className="text-muted-foreground text-sm">
              Activa para permitir reservas por hora. Desactiva para reservas de
              día completo
            </p>
          </div>
          <Switch
            checked={values.time_slots_enabled}
            onCheckedChange={(checked) =>
              setValue("time_slots_enabled", checked, { shouldDirty: true })
            }
          />
        </div>

        {values.time_slots_enabled && (
          <div className="rounded-lg border p-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="slot_duration_minutes">
                  Duración del tramo (min)
                </Label>
                <Input
                  id="slot_duration_minutes"
                  type="number"
                  min={15}
                  max={480}
                  step={15}
                  {...register("slot_duration_minutes", {
                    valueAsNumber: true,
                  })}
                />
                {errors.slot_duration_minutes && (
                  <p className="text-destructive text-sm">
                    {errors.slot_duration_minutes.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="day_start_hour">Hora de inicio (0-23)</Label>
                <Input
                  id="day_start_hour"
                  type="number"
                  min={0}
                  max={23}
                  {...register("day_start_hour", { valueAsNumber: true })}
                />
                {errors.day_start_hour && (
                  <p className="text-destructive text-sm">
                    {errors.day_start_hour.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="day_end_hour">Hora de fin (1-24)</Label>
                <Input
                  id="day_end_hour"
                  type="number"
                  min={1}
                  max={24}
                  {...register("day_end_hour", { valueAsNumber: true })}
                />
                {errors.day_end_hour && (
                  <p className="text-destructive text-sm">
                    {errors.day_end_hour.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReservationLimitsSection({ values, errors, setValue }: SectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm leading-none font-medium">Límites de reserva</h4>
        <p className="text-muted-foreground mt-1 text-sm">
          Define cuántas reservas puede hacer un usuario y con cuánta
          antelación. Deja un campo vacío para no aplicar ese límite.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <NullableNumberInput
          id="max_advance_days"
          label="Días máximos de antelación"
          description="El usuario no puede reservar más allá de estos días en el futuro"
          value={values.max_advance_days}
          min={1}
          max={365}
          onChange={(v) =>
            setValue("max_advance_days", v, { shouldDirty: true })
          }
          error={errors.max_advance_days?.message as string | undefined}
        />

        <NullableNumberInput
          id="max_consecutive_days"
          label="Días consecutivos máximos"
          description="Límite de días seguidos que puede reservar un usuario"
          value={values.max_consecutive_days}
          min={1}
          max={30}
          onChange={(v) =>
            setValue("max_consecutive_days", v, { shouldDirty: true })
          }
          error={errors.max_consecutive_days?.message as string | undefined}
        />

        <NullableNumberInput
          id="max_weekly_reservations"
          label="Reservas máximas por semana"
          value={values.max_weekly_reservations}
          min={1}
          max={50}
          onChange={(v) =>
            setValue("max_weekly_reservations", v, { shouldDirty: true })
          }
          error={errors.max_weekly_reservations?.message as string | undefined}
        />

        <NullableNumberInput
          id="max_monthly_reservations"
          label="Reservas máximas por mes"
          value={values.max_monthly_reservations}
          min={1}
          max={200}
          onChange={(v) =>
            setValue("max_monthly_reservations", v, { shouldDirty: true })
          }
          error={errors.max_monthly_reservations?.message as string | undefined}
        />

        <NullableNumberInput
          id="max_daily_reservations"
          label="Reservas máximas por día"
          description="Límite de reservas diarias por usuario (null = sin límite)"
          value={values.max_daily_reservations}
          min={1}
          max={50}
          onChange={(v) =>
            setValue("max_daily_reservations", v, { shouldDirty: true })
          }
          error={errors.max_daily_reservations?.message as string | undefined}
        />
      </div>
    </div>
  );
}

function CessionRulesSection({
  values,
  errors,
  register,
  setValue,
}: SectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm leading-none font-medium">Cesiones de plaza</h4>
        <p className="text-muted-foreground mt-1 text-sm">
          Controla cómo los usuarios con plaza asignada pueden cederla a otros
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-row items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base">Cesiones habilitadas</Label>
            <p className="text-muted-foreground text-sm">
              Permite que los usuarios con plaza asignada la cedan al pool
              general
            </p>
          </div>
          <Switch
            checked={values.cession_enabled}
            onCheckedChange={(checked) =>
              setValue("cession_enabled", checked, { shouldDirty: true })
            }
          />
        </div>

        <div className="flex flex-row items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base">Cesión automática</Label>
            <p className="text-muted-foreground text-sm">
              Cede automáticamente la plaza cuando se detecta ausencia
              (integración Microsoft)
            </p>
          </div>
          <Switch
            checked={values.auto_cession_enabled}
            disabled={!values.cession_enabled}
            onCheckedChange={(checked) =>
              setValue("auto_cession_enabled", checked, { shouldDirty: true })
            }
          />
        </div>

        {values.cession_enabled && (
          <div className="rounded-lg border p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cession_min_advance_hours">
                  Antelación mínima (horas)
                </Label>
                <Input
                  id="cession_min_advance_hours"
                  type="number"
                  min={0}
                  max={168}
                  {...register("cession_min_advance_hours", {
                    valueAsNumber: true,
                  })}
                />
                <p className="text-muted-foreground text-xs">
                  Horas mínimas de antelación para realizar una cesión
                </p>
                {errors.cession_min_advance_hours && (
                  <p className="text-destructive text-sm">
                    {errors.cession_min_advance_hours.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cession_max_per_week">
                  Cesiones máximas por semana
                </Label>
                <Input
                  id="cession_max_per_week"
                  type="number"
                  min={1}
                  max={7}
                  {...register("cession_max_per_week", {
                    valueAsNumber: true,
                  })}
                />
                {errors.cession_max_per_week && (
                  <p className="text-destructive text-sm">
                    {errors.cession_max_per_week.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main form component ────────────────────────────────────────

export function ResourceConfigForm({
  config,
  onSave,
  showTimeSlots = true,
  showVisitorBooking = true,
  isEntityOverride = false,
  onRestoreDefaults,
}: ResourceConfigFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isDirty, errors },
  } = useForm<UpdateResourceConfigInput>({
    resolver: zodResolver(updateResourceConfigSchema),
    defaultValues: {
      booking_enabled: config.booking_enabled,
      visitor_booking_enabled: config.visitor_booking_enabled,
      allowed_days: config.allowed_days,
      max_advance_days: config.max_advance_days,
      max_consecutive_days: config.max_consecutive_days,
      max_weekly_reservations: config.max_weekly_reservations,
      max_monthly_reservations: config.max_monthly_reservations,
      max_daily_reservations: config.max_daily_reservations,
      time_slots_enabled: config.time_slots_enabled,
      slot_duration_minutes: config.slot_duration_minutes,
      day_start_hour: config.day_start_hour,
      day_end_hour: config.day_end_hour,
      cession_enabled: config.cession_enabled,
      cession_min_advance_hours: config.cession_min_advance_hours,
      cession_max_per_week: config.cession_max_per_week,
      auto_cession_enabled: config.auto_cession_enabled,
    },
  });

  const values = watch();

  const onSubmit = async (data: UpdateResourceConfigInput) => {
    try {
      setIsLoading(true);
      const result = await onSave(data);
      if (!result.success) {
        toast.error(result.error ?? "Error al guardar la configuración");
        return;
      }
      toast.success("Configuración guardada correctamente");
    } catch {
      toast.error("Error inesperado al guardar la configuración");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreDefaults = async () => {
    if (!onRestoreDefaults) return;
    setIsRestoring(true);
    try {
      const result = await onRestoreDefaults({});
      if (result && !result.success) {
        toast.error(result.error ?? "Error al restaurar valores");
        return;
      }
      toast.success("Valores restaurados a los defaults globales");
    } catch {
      toast.error("Error inesperado al restaurar");
    } finally {
      setIsRestoring(false);
    }
  };

  const toggleDay = (day: number) => {
    const current = values.allowed_days ?? [];
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day];
    setValue("allowed_days", next, { shouldDirty: true });
  };

  const sectionProps: SectionProps = { values, errors, register, setValue };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* ─── Disponibilidad ─────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h4 className="text-sm leading-none font-medium">Disponibilidad</h4>
          <p className="text-muted-foreground mt-1 text-sm">
            Controla si se pueden realizar reservas y en qué días
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Reservas habilitadas</Label>
              <p className="text-muted-foreground text-sm">
                Permite a los usuarios realizar nuevas reservas
              </p>
            </div>
            <Switch
              checked={values.booking_enabled}
              onCheckedChange={(checked) =>
                setValue("booking_enabled", checked, { shouldDirty: true })
              }
            />
          </div>

          {showVisitorBooking && (
            <VisitorSection values={values} setValue={setValue} />
          )}

          <div className="rounded-lg border p-4">
            <div className="mb-3 space-y-0.5">
              <Label className="text-base">Días permitidos</Label>
              <p className="text-muted-foreground text-sm">
                Días de la semana en los que se pueden hacer reservas
              </p>
              {errors.allowed_days && (
                <p className="text-destructive text-sm">
                  {errors.allowed_days.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DAYS_OF_WEEK.map((day) => (
                <div key={day.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`day-${day.value}`}
                    checked={(values.allowed_days ?? []).includes(day.value)}
                    onCheckedChange={() => toggleDay(day.value)}
                  />
                  <Label
                    htmlFor={`day-${day.value}`}
                    className="cursor-pointer font-normal"
                  >
                    {day.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* ─── Franjas horarias (solo oficinas) ───────────── */}
      {showTimeSlots && (
        <>
          <TimeSlotsSection {...sectionProps} />
          <Separator />
        </>
      )}

      {/* ─── Límites de reserva ──────────────────────────── */}
      <ReservationLimitsSection {...sectionProps} />

      <Separator />

      {/* ─── Cesiones ───────────────────────────────────── */}
      <CessionRulesSection {...sectionProps} />

      <div className="flex items-center justify-between">
        {isEntityOverride && onRestoreDefaults ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleRestoreDefaults}
            disabled={isRestoring}
          >
            {isRestoring ? "Restaurando..." : "Restaurar defaults globales"}
          </Button>
        ) : (
          <div />
        )}
        <Button type="submit" disabled={!isDirty || isLoading}>
          {isLoading ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
