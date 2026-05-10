"use client";

/**
 * Formulario de configuración global del sistema
 * Controla los toggles de funcionalidades a nivel aplicación.
 */

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  updateGlobalConfigSchema,
  type UpdateGlobalConfigInput,
} from "@/lib/validations";
import { updateGlobalConfig } from "../actions";
import type { GlobalConfigValues } from "@/lib/config-types";

interface GlobalConfigFormProps {
  config: GlobalConfigValues;
}

export function GlobalConfigForm({ config }: GlobalConfigFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const {
    handleSubmit,
    watch,
    setValue,
    formState: { isDirty },
  } = useForm<UpdateGlobalConfigInput>({
    resolver: zodResolver(updateGlobalConfigSchema),
    defaultValues: {
      notifications_enabled: config.notifications_enabled,
      email_notifications_enabled: config.email_notifications_enabled,
      teams_notifications_enabled: config.teams_notifications_enabled,
    },
  });

  const values = watch();

  const onSubmit = async (data: UpdateGlobalConfigInput) => {
    try {
      setIsLoading(true);
      const result = await updateGlobalConfig(data);
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Notificaciones */}
      <div className="space-y-4">
        <div>
          <h4 className="text-sm leading-none font-medium">
            Sistema de notificaciones
          </h4>
          <p className="text-muted-foreground mt-1 text-sm">
            Activa o desactiva los canales de notificación de forma global.
            Desactivar un canal aquí anula las preferencias individuales de los
            usuarios.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Notificaciones globales</Label>
              <p className="text-muted-foreground text-sm">
                Si se desactiva, no se enviará ninguna notificación a ningún
                usuario
              </p>
            </div>
            <Switch
              checked={values.notifications_enabled}
              onCheckedChange={(checked) =>
                setValue("notifications_enabled", checked, {
                  shouldDirty: true,
                })
              }
            />
          </div>

          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Notificaciones por correo</Label>
              <p className="text-muted-foreground text-sm">
                Envío de correos electrónicos (confirmaciones, visitantes,
                alertas)
              </p>
            </div>
            <Switch
              checked={values.email_notifications_enabled}
              disabled={!values.notifications_enabled}
              onCheckedChange={(checked) =>
                setValue("email_notifications_enabled", checked, {
                  shouldDirty: true,
                })
              }
            />
          </div>

          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Notificaciones por Teams</Label>
              <p className="text-muted-foreground text-sm">
                Mensajes a través de Microsoft Teams para usuarios conectados
              </p>
            </div>
            <Switch
              checked={values.teams_notifications_enabled}
              disabled={!values.notifications_enabled}
              onCheckedChange={(checked) =>
                setValue("teams_notifications_enabled", checked, {
                  shouldDirty: true,
                })
              }
            />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={!isDirty || isLoading}>
        {isLoading ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
