"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { updateOutlookPreferences, forceCalendarSync } from "../actions";
import type { ValidatedUserPreferences } from "@/lib/supabase/helpers";
import {
  updateOutlookPreferencesSchema,
  type UpdateOutlookPreferencesInput,
} from "@/lib/validations";

interface OutlookSyncFormProps {
  preferences: Pick<
    ValidatedUserPreferences,
    | "outlook_create_events"
    | "outlook_calendar_name"
    | "outlook_sync_enabled"
    | "outlook_sync_interval"
  >;
  microsoftConnected: boolean;
  lastSync: string | null;
}

export function OutlookSyncForm({
  preferences,
  microsoftConnected,
  lastSync,
}: OutlookSyncFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<UpdateOutlookPreferencesInput>({
    resolver: zodResolver(updateOutlookPreferencesSchema),
    defaultValues: {
      outlook_create_events: preferences.outlook_create_events,
      outlook_calendar_name: preferences.outlook_calendar_name || "Parking",
      outlook_sync_enabled: preferences.outlook_sync_enabled,
      outlook_sync_interval: preferences.outlook_sync_interval || 15,
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form watch() no es compatible con React Compiler (pre-existing)
  const outlookCreateEvents = watch("outlook_create_events");
  const outlookSyncEnabled = watch("outlook_sync_enabled");

  const onSubmit = async (data: UpdateOutlookPreferencesInput) => {
    setIsLoading(true);
    const result = await updateOutlookPreferences(data);
    setIsLoading(false);
    if (!result.success) {
      toast.error(result.error ?? "Error al actualizar las preferencias");
    } else {
      toast.success("Preferencias de Outlook actualizadas correctamente");
    }
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    const result = await forceCalendarSync({});
    setIsSyncing(false);
    if (result.success) {
      toast.success("Sincronización completada");
    } else {
      toast.info(result.error);
    }
  };

  if (!microsoftConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Sincronización con Outlook</h3>
          <p className="text-muted-foreground text-sm">
            Conecta tu cuenta de Microsoft 365 primero
          </p>
        </div>
        <div className="border-t" />
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            ⚠️ Conecta tu cuenta de Microsoft 365 en la sección de Microsoft 365
            para habilitar la sincronización con Outlook Calendar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">
          Sincronización con Outlook Calendar
        </h3>
        <p className="text-muted-foreground text-sm">
          Configura la sincronización automática con tu calendario
        </p>
      </div>
      <div className="border-t" />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Create Calendar Events */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="outlook_create_events" className="font-normal">
              Crear evento cuando hago una reserva
            </Label>
            <p className="text-muted-foreground text-sm">
              Se añadirá automáticamente a tu calendario de Outlook
            </p>
          </div>
          <Switch
            id="outlook_create_events"
            checked={outlookCreateEvents}
            onCheckedChange={(checked) =>
              setValue("outlook_create_events", checked, { shouldDirty: true })
            }
          />
        </div>

        {outlookCreateEvents && (
          <div className="ml-6 space-y-2">
            <Label htmlFor="outlook_calendar_name">Nombre del calendario</Label>
            <Input
              id="outlook_calendar_name"
              type="text"
              placeholder="Parking"
              className="w-60"
              {...register("outlook_calendar_name")}
            />
            {errors.outlook_calendar_name && (
              <p className="text-destructive text-sm">
                {errors.outlook_calendar_name.message}
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              Los eventos se crearán en este calendario (se creará si no existe)
            </p>
          </div>
        )}

        <div className="border-t" />

        {/* Enable Sync */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="outlook_sync_enabled" className="font-normal">
              Sincronizar mis reservas con Outlook
            </Label>
            <p className="text-muted-foreground text-sm">
              Mantiene tu calendario actualizado automáticamente
            </p>
          </div>
          <Switch
            id="outlook_sync_enabled"
            checked={outlookSyncEnabled}
            onCheckedChange={(checked) =>
              setValue("outlook_sync_enabled", checked, { shouldDirty: true })
            }
          />
        </div>

        {outlookSyncEnabled && (
          <div className="ml-6 space-y-2">
            <Label htmlFor="outlook_sync_interval">
              Intervalo de sincronización
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="outlook_sync_interval"
                type="number"
                min="5"
                max="120"
                className="w-24"
                {...register("outlook_sync_interval", { valueAsNumber: true })}
              />
              <span className="text-muted-foreground text-sm">minutos</span>
            </div>
            {errors.outlook_sync_interval && (
              <p className="text-destructive text-sm">
                {errors.outlook_sync_interval.message}
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              Mínimo 5 minutos, máximo 120 minutos (2 horas)
            </p>
          </div>
        )}

        <div className="border-t" />

        {/* Last Sync */}
        {lastSync && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Última sincronización</p>
            <p className="text-muted-foreground text-sm">
              {new Date(lastSync).toLocaleString("es-ES", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button type="submit" disabled={!isDirty || isLoading}>
            {isLoading ? "Guardando..." : "Guardar Cambios"}
          </Button>

          {outlookSyncEnabled && (
            <Button
              type="button"
              variant="outline"
              onClick={handleForceSync}
              disabled={isSyncing}
            >
              {isSyncing ? "Sincronizando..." : "Sincronizar Ahora"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
