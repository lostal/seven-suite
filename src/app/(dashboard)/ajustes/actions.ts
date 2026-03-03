"use server";

/**
 * Server Actions de Ajustes
 *
 * Acciones para actualizar el perfil, preferencias e integración con Microsoft.
 * Todas usan el patrón actionClient → devuelven ActionResult<T>, nunca lanzan.
 */

import { z } from "zod/v4";
import { actionClient } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/supabase/auth";
import { revalidatePath } from "next/cache";
import {
  updateProfileSchema,
  updateNotificationPreferencesSchema,
  updateOutlookPreferencesSchema,
  updateCessionRulesSchema,
  updateThemeSchema,
} from "@/lib/validations";

// ─── Update Profile ──────────────────────────────────────────

export const updateProfile = actionClient
  .schema(updateProfileSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireAuth();
    const supabase = await createClient();

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsedInput.full_name,
        avatar_url: parsedInput.avatar_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) throw new Error("No se pudo actualizar el perfil");

    revalidatePath("/ajustes");
    return { updated: true };
  });

// ─── Update Notification Preferences ─────────────────────────

export const updateNotificationPreferences = actionClient
  .schema(updateNotificationPreferencesSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireAuth();
    const supabase = await createClient();

    const { error } = await supabase
      .from("user_preferences")
      .update({
        notification_channel: parsedInput.notification_channel,
        notify_reservation_confirmed: parsedInput.notify_reservation_confirmed,
        notify_reservation_reminder: parsedInput.notify_reservation_reminder,
        notify_cession_reserved: parsedInput.notify_cession_reserved,
        notify_alert_triggered: parsedInput.notify_alert_triggered,
        notify_visitor_confirmed: parsedInput.notify_visitor_confirmed,
        notify_daily_digest: parsedInput.notify_daily_digest,
        daily_digest_time: parsedInput.daily_digest_time || null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (error) throw new Error("No se pudieron actualizar las preferencias");

    revalidatePath("/ajustes");
    return { updated: true };
  });

// ─── Update Outlook Preferences ──────────────────────────────

export const updateOutlookPreferences = actionClient
  .schema(updateOutlookPreferencesSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireAuth();
    const supabase = await createClient();

    const { error } = await supabase
      .from("user_preferences")
      .update({
        outlook_create_events: parsedInput.outlook_create_events,
        outlook_calendar_name: parsedInput.outlook_calendar_name || "Reservas",
        outlook_sync_enabled: parsedInput.outlook_sync_enabled,
        outlook_sync_interval: parsedInput.outlook_sync_interval || 15,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (error)
      throw new Error("No se pudieron actualizar las preferencias de Outlook");

    revalidatePath("/ajustes");
    return { updated: true };
  });

// ─── Update Auto-Cession Rules ───────────────────────────────

export const updateCessionRules = actionClient
  .schema(updateCessionRulesSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireAuth();
    const supabase = await createClient();

    const { error } = await supabase
      .from("user_preferences")
      .update({
        auto_cede_on_ooo: parsedInput.auto_cede_on_ooo,
        auto_cede_notify: parsedInput.auto_cede_notify,
        auto_cede_days: parsedInput.auto_cede_days,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (error)
      throw new Error("No se pudieron actualizar las reglas de cesión");

    revalidatePath("/ajustes");
    return { updated: true };
  });

// ─── Disconnect Microsoft Account ────────────────────────────

export const disconnectMicrosoftAccount = actionClient
  .schema(z.object({}))
  .action(async () => {
    const user = await requireAuth();
    const supabase = await createClient();

    const { error } = await supabase
      .from("user_microsoft_tokens")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      throw new Error("No se pudo desvincular la cuenta de Microsoft");
    }

    revalidatePath("/ajustes");
    return { disconnected: true };
  });

// ─── Test Teams Notification (Stub for Future) ───────────────

// TODO: Implementar cuando el bot de Teams esté listo
export const testTeamsNotification = actionClient
  .schema(z.object({}))
  .action(async () => {
    throw new Error("Función no implementada todavía (bot de Teams pendiente)");
  });

// ─── Force Calendar Sync (Stub for Future) ───────────────────

// TODO: Implementar cuando la sincronización con Outlook esté lista
export const forceCalendarSync = actionClient
  .schema(z.object({}))
  .action(async () => {
    throw new Error("Función no implementada todavía (Outlook API pendiente)");
  });

// ─── Update Theme ─────────────────────────────────────────────

export const updateTheme = actionClient
  .schema(updateThemeSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireAuth();
    const supabase = await createClient();

    const { error } = await supabase
      .from("user_preferences")
      .update({
        theme: parsedInput.theme,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (error) throw new Error("No se pudo actualizar el tema");

    revalidatePath("/ajustes");
    return { updated: true };
  });

// ─── Delete Own Account ───────────────────────────────────────

export const deleteSelfAccount = actionClient
  .schema(z.object({}))
  .action(async () => {
    const user = await requireAuth();
    const adminClient = createAdminClient();

    const { error } = await adminClient.auth.admin.deleteUser(user.id);

    if (error) {
      throw new Error(`Error al eliminar la cuenta: ${error.message}`);
    }

    return { deleted: true };
  });
