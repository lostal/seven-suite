"use server";

/**
 * Acciones de Ajustes
 *
 * Incluye tanto acciones de configuración del sistema (admin)
 * como acciones de perfil y preferencias de usuario.
 */

import { actionClient, type ActionResult, success, error } from "@/lib/actions";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import {
  systemConfig,
  entityConfig,
  profiles,
  userPreferences,
  userMicrosoftTokens,
  users,
} from "@/lib/db/schema";
import {
  requireAuth,
  requireAdmin,
  requireManagerOrAbove,
} from "@/lib/auth/helpers";
import { revalidatePath } from "next/cache";
import {
  invalidateConfigCache,
  invalidateEntityConfigCache,
} from "@/lib/config";
import { getActiveEntityId } from "@/lib/queries/active-entity";
import { and, eq, inArray } from "drizzle-orm";
import {
  updateGlobalConfigSchema,
  updateResourceConfigSchema,
  updateProfileSchema,
  updateNotificationPreferencesSchema,
  updateOutlookPreferencesSchema,
  updateCessionRulesSchema,
  updateThemeSchema,
  type UpdateResourceConfigInput,
} from "@/lib/validations";
import { ALL_RESOURCE_CONFIG_KEYS } from "@/lib/config-types";
import { syncAllHolidays } from "@/lib/holidays-sync";

// ─── Helper interno ───────────────────────────────────────────

/**
 * Actualiza (o inserta) múltiples claves en system_config.
 */
async function upsertConfigs(
  entries: Array<{ key: string; value: unknown }>,
  adminUserId: string
): Promise<void> {
  for (const { key, value } of entries) {
    await db
      .insert(systemConfig)
      .values({
        key,
        value: value as never,
        updatedBy: adminUserId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: {
          value: value as never,
          updatedBy: adminUserId,
          updatedAt: new Date(),
        },
      });
  }
}

/**
 * Actualiza (o inserta) múltiples claves en entity_config para la sede indicada.
 */
async function upsertEntityConfigs(
  entityId: string,
  entries: Array<{ key: string; value: unknown }>,
  adminUserId: string
): Promise<void> {
  for (const { key, value } of entries) {
    await db
      .insert(entityConfig)
      .values({
        entityId,
        key,
        value: value as never,
        updatedBy: adminUserId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [entityConfig.entityId, entityConfig.key],
        set: {
          value: value as never,
          updatedBy: adminUserId,
          updatedAt: new Date(),
        },
      });
  }
}

/**
 * Convierte un objeto de configuración de recurso al formato de filas
 * de system_config con prefijo.
 */
function resourceConfigToEntries(
  resourceType: "parking" | "office",
  config: UpdateResourceConfigInput
): Array<{ key: string; value: unknown }> {
  const prefix = `${resourceType}.`;
  return Object.entries(config).map(([key, value]) => ({
    key: `${prefix}${key}`,
    value,
  }));
}

// ─── Actualizar configuración global ─────────────────────────

export const updateGlobalConfig = actionClient
  .schema(updateGlobalConfigSchema)
  .action(async ({ parsedInput }) => {
    const adminUser = await requireAdmin();

    const entries = Object.entries(parsedInput).map(([key, value]) => ({
      key,
      value,
    }));

    await upsertConfigs(entries, adminUser.id);
    await invalidateConfigCache();
    revalidatePath("/ajustes/general");

    return { updated: true };
  });

// ─── Actualizar configuración de parking ─────────────────────

export const updateParkingConfig = actionClient
  .schema(updateResourceConfigSchema)
  .action(async ({ parsedInput }) => {
    const currentUser = await requireManagerOrAbove();
    const entityId = await getActiveEntityId();

    const entries = resourceConfigToEntries("parking", parsedInput);

    if (entityId) {
      await upsertEntityConfigs(entityId, entries, currentUser.id);
      await invalidateEntityConfigCache();
    } else {
      await upsertConfigs(entries, currentUser.id);
    }

    await invalidateConfigCache();
    revalidatePath("/ajustes/parking");
    revalidatePath("/parking");

    return { updated: true };
  });

// ─── Sincronizar festivos ─────────────────────────────────────

/**
 * Sincroniza los festivos de todas las sedes activas con CCAA asignada
 * desde la API OpenHolidays. Solo admin.
 */
export async function syncHolidaysAction(): Promise<
  ActionResult<{ synced: number; errors: string[] }>
> {
  await requireAdmin();
  try {
    const result = await syncAllHolidays();
    revalidatePath("/ajustes/general");
    return success(result);
  } catch (err) {
    console.error("[config] syncHolidaysAction error:", err);
    return error(
      err instanceof Error ? err.message : "Error al sincronizar festivos"
    );
  }
}

// ─── Actualizar configuración de oficinas ────────────────────

export const updateOfficeConfig = actionClient
  .schema(updateResourceConfigSchema)
  .action(async ({ parsedInput }) => {
    const currentUser = await requireManagerOrAbove();
    const entityId = await getActiveEntityId();

    const entries = resourceConfigToEntries("office", parsedInput);

    if (entityId) {
      await upsertEntityConfigs(entityId, entries, currentUser.id);
      await invalidateEntityConfigCache();
    } else {
      await upsertConfigs(entries, currentUser.id);
    }

    await invalidateConfigCache();
    revalidatePath("/ajustes/oficinas");
    revalidatePath("/oficinas");

    return { updated: true };
  });

// ─── Restaurar defaults de sede ────────────────────────────

export const restoreParkingDefaults = actionClient
  .schema(z.object({}))
  .action(async () => {
    await requireManagerOrAbove();
    const entityId = await getActiveEntityId();

    if (!entityId) {
      throw new Error("No hay una sede activa seleccionada");
    }

    const keys = ALL_RESOURCE_CONFIG_KEYS.map((k) => `parking.${k}`);

    await db
      .delete(entityConfig)
      .where(
        and(
          eq(entityConfig.entityId, entityId),
          inArray(entityConfig.key, keys)
        )
      );

    await invalidateEntityConfigCache();
    await invalidateConfigCache();
    revalidatePath("/ajustes/parking");
    revalidatePath("/parking");

    return { restored: true };
  });

export const restoreOfficeDefaults = actionClient
  .schema(z.object({}))
  .action(async () => {
    await requireManagerOrAbove();
    const entityId = await getActiveEntityId();

    if (!entityId) {
      throw new Error("No hay una sede activa seleccionada");
    }

    const keys = ALL_RESOURCE_CONFIG_KEYS.map((k) => `office.${k}`);

    await db
      .delete(entityConfig)
      .where(
        and(
          eq(entityConfig.entityId, entityId),
          inArray(entityConfig.key, keys)
        )
      );

    await invalidateEntityConfigCache();
    await invalidateConfigCache();
    revalidatePath("/ajustes/oficinas");
    revalidatePath("/oficinas");

    return { restored: true };
  });

// ─── Constante compartida ────────────────────────────────────

const DEFAULT_OUTLOOK_CALENDAR_NAME = "Reservas";

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

// ─── Sync Microsoft Photo ─────────────────────────────────

export const syncMicrosoftPhoto = actionClient
  .schema(z.object({}))
  .action(async () => {
    const user = await requireAuth();

    const [token] = await db
      .select({ accessToken: userMicrosoftTokens.accessToken })
      .from(userMicrosoftTokens)
      .where(eq(userMicrosoftTokens.userId, user.id))
      .limit(1);

    if (!token) {
      throw new Error(
        "No hay tokens de Microsoft. Conecta tu cuenta en Ajustes > Microsoft."
      );
    }

    const response = await fetch(
      "https://graph.microsoft.com/v1.0/me/photo/$value",
      { headers: { Authorization: `Bearer ${token.accessToken}` } }
    );

    if (!response.ok) {
      throw new Error(
        "No se pudo obtener la foto de Microsoft 365. Asegúrate de tener una foto configurada."
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const dataUrl = `data:${contentType};base64,${base64}`;

    await db
      .update(profiles)
      .set({ avatarUrl: dataUrl, updatedAt: new Date() })
      .where(eq(profiles.id, user.id));

    revalidatePath("/ajustes");
    return { avatarUrl: dataUrl };
  });

// ─── Test Teams Notification ──────────────────────────────

export const testTeamsNotification = actionClient
  .schema(z.object({}))
  .action(async () => {
    const user = await requireAuth();

    const [token] = await db
      .select({ accessToken: userMicrosoftTokens.accessToken })
      .from(userMicrosoftTokens)
      .where(eq(userMicrosoftTokens.userId, user.id))
      .limit(1);

    if (!token) {
      throw new Error(
        "No hay tokens de Microsoft. Conecta tu cuenta en Ajustes > Microsoft."
      );
    }

    const response = await fetch("https://graph.microsoft.com/v1.0/me/chats", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chatType: "oneOnOne",
        members: [
          {
            "@odata.type": "#microsoft.graph.aadUserConversationMember",
            roles: ["owner"],
            "user@odata.bind": "https://graph.microsoft.com/v1.0/me",
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(
        "Error al enviar notificación de Teams. Asegúrate de tener los permisos necesarios."
      );
    }

    return { sent: true };
  });

// ─── Force Calendar Sync ─────────────────────────────────

export const forceCalendarSync = actionClient
  .schema(z.object({}))
  .action(async () => {
    const user = await requireAuth();

    const [token] = await db
      .select({
        accessToken: userMicrosoftTokens.accessToken,
        outlookCalendarId: userMicrosoftTokens.outlookCalendarId,
      })
      .from(userMicrosoftTokens)
      .where(eq(userMicrosoftTokens.userId, user.id))
      .limit(1);

    if (!token) {
      throw new Error(
        "No hay tokens de Microsoft. Conecta tu cuenta en Ajustes > Microsoft."
      );
    }

    const startDate = new Date().toISOString();
    const endDate = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${startDate}&endDateTime=${endDate}`,
      {
        headers: { Authorization: `Bearer ${token.accessToken}` },
      }
    );

    if (!response.ok) {
      throw new Error(
        "Error al sincronizar calendario. Verifica los permisos de Outlook."
      );
    }

    await db
      .update(userMicrosoftTokens)
      .set({
        lastCalendarSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userMicrosoftTokens.userId, user.id));

    revalidatePath("/ajustes");
    return { synced: true };
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

    const deleted = await db
      .delete(users)
      .where(eq(users.id, user.id))
      .returning({ id: users.id });

    if (!deleted || deleted.length === 0) {
      throw new Error("Error al eliminar la cuenta: usuario no encontrado");
    }

    return { deleted: true };
  });
