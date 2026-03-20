/**
 * Tests de Queries de Preferencias (preferences.ts)
 *
 * Verifica la lógica de consulta y composición de:
 * - getUserPreferences: preferencias validadas o null en error
 * - getMicrosoftConnectionStatus: estado de conexión basado en token/expiración
 * - getAssignedSpotInfo: info de plaza asignada con estado hoy
 * - getUserProfileWithPreferences: composición de perfil + preferencias + Microsoft + plaza
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ db: mockDb }));

import { mockDb, resetDbMocks, setupSelectMock } from "../../mocks/db";
import {
  getUserPreferences,
  getMicrosoftConnectionStatus,
  getAssignedSpotInfo,
  getUserProfileWithPreferences,
} from "@/lib/queries/preferences";

const USER_ID = "user-00000000-0000-0000-0000-000000000001";

// ─── Helpers de datos en camelCase (formato Drizzle) ─────────────────────────

function makeUserPreferencesRow(overrides?: Record<string, unknown>) {
  return {
    userId: USER_ID,
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

function makeTokenRow(overrides?: Record<string, unknown>) {
  return {
    userId: USER_ID,
    accessToken: "tok",
    refreshToken: "ref",
    tokenExpiresAt: new Date(Date.now() + 3600 * 1000), // 1h in the future
    scopes: ["Calendars.Read"],
    lastCalendarSyncAt: new Date("2025-03-15T10:00:00Z"),
    lastOooCheckAt: new Date("2025-03-15T09:00:00Z"),
    currentOooStatus: false,
    teamsUserId: "teams-user-id",
    teamsConversationId: null,
    teamsTenantId: null,
    outlookCalendarId: "calendar-id",
    currentOooUntil: null,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makeProfileRow(overrides?: Record<string, unknown>) {
  return {
    id: USER_ID,
    email: "test@example.com",
    fullName: "Test User",
    role: "employee",
    avatarUrl: null,
    dni: null,
    entityId: null,
    jobTitle: null,
    location: null,
    managerId: null,
    phone: null,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makeSpotRow(overrides?: Record<string, unknown>) {
  return {
    id: "spot-mgmt",
    label: "D-01",
    type: "standard",
    ...overrides,
  };
}

function makeCessionRow(overrides?: Record<string, unknown>) {
  return {
    id: "ces-1",
    status: "available",
    ...overrides,
  };
}

// ─── getUserPreferences ───────────────────────────────────────────────────────

describe("getUserPreferences", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("devuelve las preferencias validadas cuando existen", async () => {
    setupSelectMock([makeUserPreferencesRow({ theme: "dark" })]);

    const result = await getUserPreferences(USER_ID);

    expect(result).not.toBeNull();
    expect(result?.theme).toBe("dark");
  });

  it("devuelve null si no hay preferencias", async () => {
    setupSelectMock([]);

    const result = await getUserPreferences(USER_ID);

    expect(result).toBeNull();
  });

  it("aplica validateUserPreferences: convierte theme inválido a 'system'", async () => {
    setupSelectMock([makeUserPreferencesRow({ theme: "invalid-theme" })]);

    const result = await getUserPreferences(USER_ID);

    expect(result?.theme).toBe("system");
  });
});

// ─── getMicrosoftConnectionStatus ────────────────────────────────────────────

describe("getMicrosoftConnectionStatus", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("devuelve connected=false si no hay token (sin filas)", async () => {
    setupSelectMock([]); // no token rows

    const result = await getMicrosoftConnectionStatus(USER_ID);

    expect(result?.connected).toBe(false);
    expect(result?.scopes).toEqual([]);
    expect(result?.teamsConnected).toBe(false);
    expect(result?.outlookConnected).toBe(false);
  });

  it("devuelve connected=true con token válido (no expirado)", async () => {
    setupSelectMock([makeTokenRow()]);

    const result = await getMicrosoftConnectionStatus(USER_ID);

    expect(result!.connected).toBe(true);
  });

  it("devuelve connected=false con token expirado", async () => {
    setupSelectMock([
      makeTokenRow({ tokenExpiresAt: new Date(Date.now() - 3600 * 1000) }),
    ]);

    const result = await getMicrosoftConnectionStatus(USER_ID);

    expect(result!.connected).toBe(false);
  });

  it("mapea teamsConnected=true si hay teamsUserId", async () => {
    setupSelectMock([makeTokenRow({ teamsUserId: "u-teams-123" })]);

    const result = await getMicrosoftConnectionStatus(USER_ID);

    expect(result!.teamsConnected).toBe(true);
  });

  it("mapea teamsConnected=false si teamsUserId es null", async () => {
    setupSelectMock([makeTokenRow({ teamsUserId: null })]);

    const result = await getMicrosoftConnectionStatus(USER_ID);

    expect(result!.teamsConnected).toBe(false);
  });

  it("mapea outlookConnected=true si hay outlookCalendarId", async () => {
    setupSelectMock([makeTokenRow({ outlookCalendarId: "cal-123" })]);

    const result = await getMicrosoftConnectionStatus(USER_ID);

    expect(result!.outlookConnected).toBe(true);
  });

  it("mapea los campos lastSync y lastOOOCheck del token", async () => {
    setupSelectMock([
      makeTokenRow({
        lastCalendarSyncAt: new Date("2025-03-01T10:00:00Z"),
        lastOooCheckAt: new Date("2025-03-01T09:00:00Z"),
      }),
    ]);

    const result = await getMicrosoftConnectionStatus(USER_ID);

    expect(result!.lastSync).toBe("2025-03-01T10:00:00.000Z");
    expect(result!.lastOOOCheck).toBe("2025-03-01T09:00:00.000Z");
  });

  it("mapea los scopes del token", async () => {
    setupSelectMock([
      makeTokenRow({ scopes: ["Calendars.Read", "Mail.Send"] }),
    ]);

    const result = await getMicrosoftConnectionStatus(USER_ID);

    expect(result!.scopes).toEqual(["Calendars.Read", "Mail.Send"]);
  });
});

// ─── getAssignedSpotInfo ────────────────────────────────────────────────────

describe("getAssignedSpotInfo", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("devuelve spot=null y statusToday='unknown' si no hay plaza asignada", async () => {
    // 1 select: spots query returns empty
    setupSelectMock([]);

    const result = await getAssignedSpotInfo(USER_ID);

    expect(result.spot).toBeNull();
    expect(result.statusToday).toBe("unknown");
    expect(result.nextCession).toBeNull();
  });

  it("devuelve statusToday='occupied' si hay plaza pero sin cesión hoy", async () => {
    // 1st select: spot found
    setupSelectMock([makeSpotRow()]);
    // 2nd select: todayCessions (parallel)
    setupSelectMock([]); // no today cession
    // 3rd select: nextCessions (parallel)
    setupSelectMock([]);

    const result = await getAssignedSpotInfo(USER_ID);

    expect(result.statusToday).toBe("occupied");
  });

  it("devuelve statusToday='ceded' si hay cesión available hoy", async () => {
    setupSelectMock([makeSpotRow()]);
    setupSelectMock([makeCessionRow({ id: "ces-1", status: "available" })]);
    setupSelectMock([]); // nextCessions

    const result = await getAssignedSpotInfo(USER_ID);

    expect(result.statusToday).toBe("ceded");
  });

  it("devuelve statusToday='reserved' si la cesión está reservada", async () => {
    setupSelectMock([makeSpotRow()]);
    setupSelectMock([makeCessionRow({ id: "ces-1", status: "reserved" })]);
    setupSelectMock([]); // nextCessions

    const result = await getAssignedSpotInfo(USER_ID);

    expect(result.statusToday).toBe("reserved");
  });

  it("incluye la info de la plaza en el resultado", async () => {
    setupSelectMock([
      makeSpotRow({ id: "spot-mgmt", label: "D-01", type: "standard" }),
    ]);
    setupSelectMock([]); // todayCessions
    setupSelectMock([]); // nextCessions

    const result = await getAssignedSpotInfo(USER_ID);

    expect(result.spot).toMatchObject({
      id: "spot-mgmt",
      label: "D-01",
      type: "standard",
    });
  });
});

// ─── getUserProfileWithPreferences ────────────────────────────────────────────

describe("getUserProfileWithPreferences", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("devuelve null si el perfil no se encuentra", async () => {
    // 1st select: profiles — empty
    setupSelectMock([]);

    const result = await getUserProfileWithPreferences(USER_ID);

    expect(result).toBeNull();
  });

  it("devuelve el perfil con preferencias para empleado", async () => {
    // getUserProfileWithPreferences call order:
    // 1. profile select
    // Then Promise.all([getUserPreferences, getMicrosoftConnectionStatus, getAssignedSpotInfo(parking), getAssignedSpotInfo(office)])
    // getUserPreferences: 1 select
    // getMicrosoftConnectionStatus: 1 select
    // getAssignedSpotInfo(parking): 1 select (spots) → if empty, done
    // getAssignedSpotInfo(office): 1 select (spots) → if empty, done

    setupSelectMock([makeProfileRow({ role: "employee" })]); // profile
    setupSelectMock([makeUserPreferencesRow()]); // getUserPreferences
    setupSelectMock([]); // getMicrosoftConnectionStatus: no token
    setupSelectMock([]); // getAssignedSpotInfo(parking): no spot
    setupSelectMock([]); // getAssignedSpotInfo(office): no spot

    const result = await getUserProfileWithPreferences(USER_ID);

    expect(result).not.toBeNull();
    expect(result?.profile.role).toBe("employee");
    expect(result?.preferences).not.toBeNull();
    expect(result?.assignedSpots.parking).toBeNull(); // sin plaza asignada
  });

  it("incluye assignedSpots.parking cuando el empleado tiene plaza asignada", async () => {
    setupSelectMock([makeProfileRow({ role: "employee" })]); // profile
    setupSelectMock([makeUserPreferencesRow()]); // getUserPreferences
    setupSelectMock([]); // getMicrosoftConnectionStatus: no token
    // getAssignedSpotInfo(parking):
    setupSelectMock([
      makeSpotRow({ id: "spot-mgmt", label: "P-15", type: "standard" }),
    ]); // spot found
    setupSelectMock([]); // todayCessions
    setupSelectMock([]); // nextCessions
    // getAssignedSpotInfo(office):
    setupSelectMock([]); // no spot

    const result = await getUserProfileWithPreferences(USER_ID);

    expect(result?.assignedSpots.parking).not.toBeNull();
    expect(result?.assignedSpots.parking?.spot?.label).toBe("P-15");
  });

  it("assignedSpots.parking es null cuando no hay plaza asignada", async () => {
    setupSelectMock([makeProfileRow({ role: "admin" })]); // profile
    setupSelectMock([makeUserPreferencesRow()]); // getUserPreferences
    setupSelectMock([]); // getMicrosoftConnectionStatus: no token
    setupSelectMock([]); // getAssignedSpotInfo(parking): no spot
    setupSelectMock([]); // getAssignedSpotInfo(office): no spot

    const result = await getUserProfileWithPreferences(USER_ID);

    expect(result?.assignedSpots.parking).toBeNull();
    expect(result?.assignedSpots.office).toBeNull();
  });

  it("devuelve microsoftStatus desconectado si no hay token", async () => {
    setupSelectMock([makeProfileRow()]); // profile
    setupSelectMock([makeUserPreferencesRow()]); // getUserPreferences
    setupSelectMock([]); // getMicrosoftConnectionStatus: no token → connected=false
    setupSelectMock([]); // getAssignedSpotInfo(parking): no spot
    setupSelectMock([]); // getAssignedSpotInfo(office): no spot

    const result = await getUserProfileWithPreferences(USER_ID);

    expect(result?.microsoftStatus?.connected).toBe(false);
  });

  it("devuelve microsoftStatus conectado si hay token válido", async () => {
    setupSelectMock([makeProfileRow()]); // profile
    setupSelectMock([makeUserPreferencesRow()]); // getUserPreferences
    setupSelectMock([makeTokenRow()]); // getMicrosoftConnectionStatus: valid token
    setupSelectMock([]); // getAssignedSpotInfo(parking): no spot
    setupSelectMock([]); // getAssignedSpotInfo(office): no spot

    const result = await getUserProfileWithPreferences(USER_ID);

    expect(result?.microsoftStatus?.connected).toBe(true);
  });
});
