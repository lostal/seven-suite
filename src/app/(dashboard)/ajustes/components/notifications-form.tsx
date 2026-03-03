"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import type { ValidatedUserPreferences } from "@/lib/supabase/helpers";
import {
  updateNotificationPreferences,
  testTeamsNotification,
} from "../actions";
import {
  updateNotificationPreferencesSchema,
  type UpdateNotificationPreferencesInput,
} from "@/lib/validations";

interface NotificationsFormProps {
  preferences: Pick<
    ValidatedUserPreferences,
    | "notification_channel"
    | "notify_reservation_confirmed"
    | "notify_reservation_reminder"
    | "notify_cession_reserved"
    | "notify_alert_triggered"
    | "notify_visitor_confirmed"
    | "notify_daily_digest"
    | "daily_digest_time"
  >;
  microsoftConnected: boolean;
}

export function NotificationsForm({
  preferences,
  microsoftConnected,
}: NotificationsFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<UpdateNotificationPreferencesInput>({
    resolver: zodResolver(updateNotificationPreferencesSchema),
    defaultValues: {
      notification_channel: preferences.notification_channel,
      notify_reservation_confirmed: preferences.notify_reservation_confirmed,
      notify_reservation_reminder: preferences.notify_reservation_reminder,
      notify_cession_reserved: preferences.notify_cession_reserved,
      notify_alert_triggered: preferences.notify_alert_triggered,
      notify_visitor_confirmed: preferences.notify_visitor_confirmed,
      notify_daily_digest: preferences.notify_daily_digest,
      daily_digest_time: preferences.daily_digest_time || "09:00",
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form watch() no es compatible con React Compiler (pre-existing)
  const notificationChannel = watch("notification_channel");
  const notifyDailyDigest = watch("notify_daily_digest");

  const onSubmit = async (data: UpdateNotificationPreferencesInput) => {
    setIsLoading(true);
    const result = await updateNotificationPreferences(data);
    setIsLoading(false);
    if (!result.success) {
      toast.error(result.error ?? "Error al actualizar las preferencias");
    } else {
      toast.success("Preferencias actualizadas correctamente");
    }
  };

  const handleTestNotification = async () => {
    setIsTesting(true);
    const result = await testTeamsNotification({});
    setIsTesting(false);
    if (result.success) {
      toast.success("Notificación de prueba enviada");
    } else {
      toast.info(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Channel Selection */}
      <div className="space-y-3">
        <Label>Canal Preferido</Label>
        <RadioGroup
          value={notificationChannel}
          onValueChange={(value) =>
            setValue(
              "notification_channel",
              value as "teams" | "email" | "both",
              {
                shouldDirty: true,
              }
            )
          }
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              value="teams"
              id="channel-teams"
              disabled={!microsoftConnected}
            />
            <Label htmlFor="channel-teams" className="font-normal">
              Microsoft Teams {!microsoftConnected && "(Requiere conexión)"}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="email" id="channel-email" />
            <Label htmlFor="channel-email" className="font-normal">
              Email (Outlook)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              value="both"
              id="channel-both"
              disabled={!microsoftConnected}
            />
            <Label htmlFor="channel-both" className="font-normal">
              Ambos {!microsoftConnected && "(Requiere conexión)"}
            </Label>
          </div>
        </RadioGroup>
        {notificationChannel === "teams" && microsoftConnected && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestNotification}
            disabled={isTesting}
          >
            {isTesting ? "Enviando..." : "Enviar Prueba"}
          </Button>
        )}
      </div>

      <div className="border-t" />

      {/* Notification Types */}
      <div className="space-y-4">
        <Label>Recibir notificaciones cuando:</Label>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label
              htmlFor="notify_reservation_confirmed"
              className="font-normal"
            >
              Confirmo o cancelo una reserva
            </Label>
          </div>
          <Switch
            id="notify_reservation_confirmed"
            checked={watch("notify_reservation_confirmed")}
            onCheckedChange={(checked) =>
              setValue("notify_reservation_confirmed", checked, {
                shouldDirty: true,
              })
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label
              htmlFor="notify_reservation_reminder"
              className="font-normal"
            >
              Recordatorio (1 día antes de mi reserva)
            </Label>
          </div>
          <Switch
            id="notify_reservation_reminder"
            checked={watch("notify_reservation_reminder")}
            onCheckedChange={(checked) =>
              setValue("notify_reservation_reminder", checked, {
                shouldDirty: true,
              })
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notify_cession_reserved" className="font-normal">
              Alguien reserva mi cesión
            </Label>
          </div>
          <Switch
            id="notify_cession_reserved"
            checked={watch("notify_cession_reserved")}
            onCheckedChange={(checked) =>
              setValue("notify_cession_reserved", checked, {
                shouldDirty: true,
              })
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notify_alert_triggered" className="font-normal">
              Se libera un spot favorito
            </Label>
          </div>
          <Switch
            id="notify_alert_triggered"
            checked={watch("notify_alert_triggered")}
            onCheckedChange={(checked) =>
              setValue("notify_alert_triggered", checked, {
                shouldDirty: true,
              })
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notify_visitor_confirmed" className="font-normal">
              Confirmación de visitante
            </Label>
          </div>
          <Switch
            id="notify_visitor_confirmed"
            checked={watch("notify_visitor_confirmed")}
            onCheckedChange={(checked) =>
              setValue("notify_visitor_confirmed", checked, {
                shouldDirty: true,
              })
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notify_daily_digest" className="font-normal">
              Resumen diario de actividad
            </Label>
          </div>
          <Switch
            id="notify_daily_digest"
            checked={watch("notify_daily_digest")}
            onCheckedChange={(checked) =>
              setValue("notify_daily_digest", checked, { shouldDirty: true })
            }
          />
        </div>

        {notifyDailyDigest && (
          <div className="ml-6 space-y-2">
            <Label htmlFor="daily_digest_time" className="text-sm">
              Hora del resumen
            </Label>
            <Input
              id="daily_digest_time"
              type="time"
              className="w-40"
              {...register("daily_digest_time")}
            />
            {errors.daily_digest_time && (
              <p className="text-destructive text-sm">
                {errors.daily_digest_time.message}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Submit */}
      <Button type="submit" disabled={!isDirty || isLoading}>
        {isLoading ? "Guardando..." : "Guardar Cambios"}
      </Button>
    </form>
  );
}
