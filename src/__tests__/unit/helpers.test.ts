/**
 * Tests de Helpers de Base de Datos
 *
 * Verifica que validateUserPreferences convierte correctamente
 * los tipos genéricos de la BD a tipos literales de la aplicación
 * y aplica los fallbacks esperados cuando los valores no son válidos.
 */

import { describe, it, expect } from "vitest";
import { validateUserPreferences } from "@/lib/db/helpers";
import type { UserPreferences } from "@/lib/db/types";

function createMockPrefs(
  overrides?: Partial<UserPreferences>
): UserPreferences {
  return {
    userId: "user-00000000-0000-0000-0000-000000000001",
    theme: "system",
    locale: "es",
    defaultView: "map",
    notificationChannel: "teams",
    favoriteSpotIds: [],
    autoCedeDays: [],
    autoCedeNotify: true,
    autoCedeOnOoo: false,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    dailyDigestTime: null,
    notifyAlertTriggered: true,
    notifyCessionReserved: true,
    notifyDailyDigest: false,
    notifyReservationConfirmed: true,
    notifyReservationReminder: true,
    notifyVisitorConfirmed: true,
    outlookCalendarName: null,
    outlookCreateEvents: false,
    outlookSyncEnabled: false,
    outlookSyncInterval: null,
    usualArrivalTime: null,
    ...overrides,
  };
}

describe("validateUserPreferences", () => {
  // ── theme ──────────────────────────────────────────────────────────────────

  it.each(["light", "dark", "system"] as const)(
    "mantiene theme válido '%s'",
    (theme) => {
      const prefs = createMockPrefs({ theme });
      expect(validateUserPreferences(prefs).theme).toBe(theme);
    }
  );

  it("convierte theme inválido a 'system' (fallback)", () => {
    const prefs = createMockPrefs({ theme: "pink" });
    expect(validateUserPreferences(prefs).theme).toBe("system");
  });

  it("convierte theme vacío a 'system'", () => {
    const prefs = createMockPrefs({ theme: "" });
    expect(validateUserPreferences(prefs).theme).toBe("system");
  });

  // ── locale ─────────────────────────────────────────────────────────────────

  it.each(["es", "en"] as const)("mantiene locale válido '%s'", (locale) => {
    const prefs = createMockPrefs({ locale });
    expect(validateUserPreferences(prefs).locale).toBe(locale);
  });

  it("convierte locale inválido a 'es' (fallback)", () => {
    const prefs = createMockPrefs({ locale: "fr" });
    expect(validateUserPreferences(prefs).locale).toBe("es");
  });

  // ── defaultView ────────────────────────────────────────────────────────────

  it.each(["map", "list", "calendar"] as const)(
    "mantiene vista válida '%s'",
    (view) => {
      const prefs = createMockPrefs({ defaultView: view });
      expect(validateUserPreferences(prefs).defaultView).toBe(view);
    }
  );

  it("convierte vista inválida a 'map' (fallback)", () => {
    const prefs = createMockPrefs({ defaultView: "table" });
    expect(validateUserPreferences(prefs).defaultView).toBe("map");
  });

  // ── notificationChannel ────────────────────────────────────────────────────

  it.each(["teams", "email", "both"] as const)(
    "mantiene canal de notificación válido '%s'",
    (channel) => {
      const prefs = createMockPrefs({ notificationChannel: channel });
      expect(validateUserPreferences(prefs).notificationChannel).toBe(channel);
    }
  );

  it("convierte canal inválido a 'teams' (fallback)", () => {
    const prefs = createMockPrefs({ notificationChannel: "sms" });
    expect(validateUserPreferences(prefs).notificationChannel).toBe("teams");
  });

  // ── arrays con valor null ──────────────────────────────────────────────────

  it("convierte favoriteSpotIds null a array vacío", () => {
    const prefs = createMockPrefs({ favoriteSpotIds: null });
    expect(validateUserPreferences(prefs).favoriteSpotIds).toEqual([]);
  });

  it("mantiene favoriteSpotIds con valores", () => {
    const ids = ["id-1", "id-2"];
    const prefs = createMockPrefs({ favoriteSpotIds: ids });
    expect(validateUserPreferences(prefs).favoriteSpotIds).toEqual(ids);
  });

  it("convierte autoCedeDays null a array vacío", () => {
    const prefs = createMockPrefs({ autoCedeDays: null });
    expect(validateUserPreferences(prefs).autoCedeDays).toEqual([]);
  });

  it("mantiene autoCedeDays con valores", () => {
    const days = [1, 2, 3];
    const prefs = createMockPrefs({ autoCedeDays: days });
    expect(validateUserPreferences(prefs).autoCedeDays).toEqual(days);
  });

  // ── resto de campos no modificados ─────────────────────────────────────────

  it("preserva el resto de campos sin modificarlos", () => {
    const prefs = createMockPrefs({
      userId: "user-abc-123",
      notifyReservationConfirmed: false,
      outlookSyncEnabled: true,
    });
    const result = validateUserPreferences(prefs);
    expect(result.userId).toBe("user-abc-123");
    expect(result.notifyReservationConfirmed).toBe(false);
    expect(result.outlookSyncEnabled).toBe(true);
  });
});
