"use server";

/**
 * Server Actions de Ajustes
 *
 * Acciones para actualizar el perfil, preferencias e integración con Microsoft.
 * Todas usan el patrón actionClient → devuelven ActionResult<T>, nunca lanzan.
 */

import { z } from "zod/v4";

const DEFAULT_OUTLOOK_CALENDAR_NAME = "Reservas";
import { actionClient } from "@/lib/actions";
import { db } from "@/lib/db";
import {
  profiles,
  userPreferences,
  userMicrosoftTokens,
  users,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/helpers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
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

    const updates: Partial<typeof profiles.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (parsedInput.full_name !== undefined)
      updates.fullName = parsedInput.full_name;
    if (parsedInput.avatar_url !== undefined)
      updates.avatarUrl = parsedInput.avatar_url;

    await db.update(profiles).set(updates).where(eq(profiles.id, user.id));

    revalidatePath("/ajustes");
    return { updated: true };
  });

// ─── Update Notification Preferences ─────────────────────────

export const updateNotificationPreferences = actionClient
  .schema(updateNotificationPreferencesSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireAuth();

    await db
      .update(userPreferences)
      .set({
        notificationChannel: parsedInput.notification_channel,
        notifyReservationConfirmed: parsedInput.notify_reservation_confirmed,
        notifyReservationReminder: parsedInput.notify_reservation_reminder,
        notifyCessionReserved: parsedInput.notify_cession_reserved,
        notifyAlertTriggered: parsedInput.notify_alert_triggered,
        notifyVisitorConfirmed: parsedInput.notify_visitor_confirmed,
        notifyDailyDigest: parsedInput.notify_daily_digest,
        dailyDigestTime: parsedInput.daily_digest_time || null,
        updatedAt: new Date(),
      })
      .where(eq(userPreferences.userId, user.id));

    revalidatePath("/ajustes");
    return { updated: true };
  });

// ─── Update Outlook Preferences ──────────────────────────────

export const updateOutlookPreferences = actionClient
  .schema(updateOutlookPreferencesSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireAuth();

    await db
      .update(userPreferences)
      .set({
        outlookCreateEvents: parsedInput.outlook_create_events,
        outlookCalendarName:
          parsedInput.outlook_calendar_name || DEFAULT_OUTLOOK_CALENDAR_NAME,
        outlookSyncEnabled: parsedInput.outlook_sync_enabled,
        outlookSyncInterval: parsedInput.outlook_sync_interval ?? 15,
        updatedAt: new Date(),
      })
      .where(eq(userPreferences.userId, user.id));

    revalidatePath("/ajustes");
    return { updated: true };
  });

// ─── Update Auto-Cession Rules ───────────────────────────────

export const updateCessionRules = actionClient
  .schema(updateCessionRulesSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireAuth();

    await db
      .update(userPreferences)
      .set({
        autoCedeOnOoo: parsedInput.auto_cede_on_ooo,
        autoCedeNotify: parsedInput.auto_cede_notify,
        autoCedeDays: parsedInput.auto_cede_days,
        updatedAt: new Date(),
      })
      .where(eq(userPreferences.userId, user.id));

    revalidatePath("/ajustes");
    return { updated: true };
  });

// ─── Disconnect Microsoft Account ────────────────────────────

export const disconnectMicrosoftAccount = actionClient
  .schema(z.object({}))
  .action(async () => {
    const user = await requireAuth();

    await db
      .delete(userMicrosoftTokens)
      .where(eq(userMicrosoftTokens.userId, user.id));

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

    await db
      .update(userPreferences)
      .set({
        theme: parsedInput.theme,
        updatedAt: new Date(),
      })
      .where(eq(userPreferences.userId, user.id));

    revalidatePath("/ajustes");
    return { updated: true };
  });

// ─── Delete Own Account ───────────────────────────────────────

export const deleteSelfAccount = actionClient
  .schema(z.object({}))
  .action(async () => {
    const user = await requireAuth();

    // Delete the user record — cascade will remove profile and all related data
    const deleted = await db
      .delete(users)
      .where(eq(users.id, user.id))
      .returning({ id: users.id });

    if (!deleted || deleted.length === 0) {
      throw new Error("Error al eliminar la cuenta: usuario no encontrado");
    }

    return { deleted: true };
  });
