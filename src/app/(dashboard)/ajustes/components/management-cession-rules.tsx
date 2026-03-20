"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { updateCessionRules } from "../actions";
import type { ValidatedUserPreferences } from "@/lib/db/helpers";
import {
  updateCessionRulesSchema,
  type UpdateCessionRulesInput,
} from "@/lib/validations";

interface ManagementCessionRulesProps {
  preferences: Pick<
    ValidatedUserPreferences,
    "autoCedeOnOoo" | "autoCedeNotify" | "autoCedeDays"
  >;
  spotInfo: {
    spot: {
      id: string;
      label: string;
      type: string;
    } | null;
    statusToday: "occupied" | "ceded" | "reserved" | "unknown";
    nextCession: {
      id: string;
      date: string;
      status: string;
    } | null;
  } | null;
  microsoftConnected: boolean;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
];

export function ManagementCessionRules({
  preferences,
  spotInfo,
  microsoftConnected,
}: ManagementCessionRulesProps) {
  const [isLoading, setIsLoading] = useState(false);

  const {
    handleSubmit,
    watch,
    setValue,
    formState: { isDirty },
  } = useForm<UpdateCessionRulesInput>({
    resolver: zodResolver(updateCessionRulesSchema),
    defaultValues: {
      auto_cede_on_ooo: preferences.autoCedeOnOoo,
      auto_cede_notify: preferences.autoCedeNotify,
      auto_cede_days: preferences.autoCedeDays,
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form watch() no es compatible con React Compiler (pre-existing)
  const autoCedeOnOOO = watch("auto_cede_on_ooo");
  const autoCedeNotify = watch("auto_cede_notify");
  const autoCedeDays = watch("auto_cede_days");

  const onSubmit = async (data: UpdateCessionRulesInput) => {
    setIsLoading(true);
    const result = await updateCessionRules(data);
    setIsLoading(false);
    if (!result.success) {
      toast.error(result.error ?? "Error al actualizar las reglas");
    } else {
      toast.success("Reglas actualizadas correctamente");
    }
  };

  const toggleDay = (dayValue: number): void => {
    const newDays = autoCedeDays.includes(dayValue)
      ? autoCedeDays.filter((d) => d !== dayValue)
      : [...autoCedeDays, dayValue].sort();

    setValue("auto_cede_days", newDays, { shouldDirty: true });
  };

  if (!spotInfo?.spot) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Cesión Automática</h3>
          <p className="text-muted-foreground text-sm">
            No tienes una plaza asignada
          </p>
        </div>
        <div className="border-t" />
        <p className="text-muted-foreground text-sm">
          Solo los directivos con plazas asignadas pueden configurar reglas de
          cesión automática. Contacta con un administrador para que te asigne
          una plaza.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Cesión Automática</h3>
        <p className="text-muted-foreground text-sm">
          Configura cuando ceder automáticamente tu plaza asignada
        </p>
      </div>
      <div className="border-t" />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Spot Info */}
        <div className="space-y-2 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Mi Plaza Asignada</p>
              <p className="text-2xl font-bold">{spotInfo.spot.label}</p>
            </div>
            <Badge
              variant={
                spotInfo.statusToday === "occupied"
                  ? "default"
                  : spotInfo.statusToday === "ceded"
                    ? "secondary"
                    : "outline"
              }
            >
              {spotInfo.statusToday === "occupied"
                ? "Ocupada"
                : spotInfo.statusToday === "ceded"
                  ? "Cedida"
                  : spotInfo.statusToday === "reserved"
                    ? "Reservada"
                    : "Desconocido"}
            </Badge>
          </div>

          {spotInfo.nextCession && (
            <p className="text-muted-foreground text-xs">
              Próxima cesión:{" "}
              {new Date(spotInfo.nextCession.date).toLocaleDateString("es-ES", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          )}
        </div>

        <div className="border-t" />

        {/* Auto-cede on Out of Office */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto_cede_on_ooo" className="font-normal">
                Ceder cuando esté &quot;Fuera de Oficina&quot;
              </Label>
              <p className="text-muted-foreground text-sm">
                Detecta automáticamente tu estado de Outlook Calendar
              </p>
            </div>
            <Switch
              id="auto_cede_on_ooo"
              checked={autoCedeOnOOO}
              onCheckedChange={(checked) =>
                setValue("auto_cede_on_ooo", checked, { shouldDirty: true })
              }
              disabled={!microsoftConnected}
            />
          </div>

          {!microsoftConnected && (
            <div className="ml-6 text-sm text-amber-600 dark:text-amber-400">
              ⚠️ Requiere conectar con Microsoft 365
            </div>
          )}
        </div>

        {/* Auto-cede specific days */}
        <div className="space-y-3">
          <div>
            <Label>Ceder automáticamente estos días</Label>
            <p className="text-muted-foreground mt-1 text-sm">
              Tu plaza se cederá automáticamente cada semana en estos días
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((day) => (
              <Button
                key={day.value}
                type="button"
                variant={
                  autoCedeDays.includes(day.value) ? "default" : "outline"
                }
                size="sm"
                onClick={() => toggleDay(day.value)}
              >
                {day.label}
              </Button>
            ))}
          </div>

          {autoCedeDays.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No has seleccionado ningún día
            </p>
          )}
        </div>

        <div className="border-t" />

        {/* Notification preference */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto_cede_notify" className="font-normal">
              Notificarme cuando se ceda automáticamente
            </Label>
            <p className="text-muted-foreground text-sm">
              Recibirás una confirmación cada vez que se ejecute una cesión
              automática
            </p>
          </div>
          <Switch
            id="auto_cede_notify"
            checked={autoCedeNotify}
            onCheckedChange={(checked) =>
              setValue("auto_cede_notify", checked, { shouldDirty: true })
            }
          />
        </div>

        {/* Submit */}
        <Button type="submit" disabled={!isDirty || isLoading}>
          {isLoading ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </form>
    </div>
  );
}
