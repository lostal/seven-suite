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
import {
  getUserPreferences,
  getMicrosoftConnectionStatus,
  getAssignedSpotInfo,
  getUserProfileWithPreferences,
} from "@/lib/queries/preferences";
import { createQueryChain } from "../../mocks/supabase";
import {
  createMockProfile,
  createMockUserPreferencesRow,
} from "../../mocks/factories";

// ─── Mock de Supabase ─────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";

const USER_ID = "user-00000000-0000-0000-0000-000000000001";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Crea un token de Microsoft válido (no expirado).
 */
function createMockToken(overrides?: Record<string, unknown>) {
  return {
    user_id: USER_ID,
    access_token: "tok",
    refresh_token: "ref",
    token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // 1h en el futuro
    scopes: ["Calendars.Read"],
    last_calendar_sync_at: "2025-03-15T10:00:00Z",
    last_ooo_check_at: "2025-03-15T09:00:00Z",
    current_ooo_status: false,
    teams_user_id: "teams-user-id",
    teams_conversation_id: null,
    teams_tenant_id: null,
    outlook_calendar_id: "calendar-id",
    current_ooo_until: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * Configura el mock de Supabase con respuestas por tabla.
 * Usa .single() para tablas de usuario único y .maybeSingle() para spots/cesiones.
 */
function setupSupabaseMock(config: {
  preferencesData?: unknown;
  preferencesError?: { message: string } | null;
  tokenData?: unknown;
  tokenError?: { code?: string; message: string } | null;
  profileData?: unknown;
  profileError?: { message: string } | null;
  spotData?: unknown;
  cessionData?: unknown;
}) {
  const mockFrom = vi.fn((table: string) => {
    switch (table) {
      case "user_preferences": {
        const chain = createQueryChain({ data: null, error: null });
        (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
          data:
            config.preferencesData !== undefined
              ? config.preferencesData
              : createMockUserPreferencesRow(),
          error: config.preferencesError ?? null,
        });
        return chain;
      }
      case "user_microsoft_tokens": {
        const chain = createQueryChain({ data: null, error: null });
        (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: config.tokenData ?? null,
          // Usar !== undefined para que null explícito signifique "sin error"
          error:
            config.tokenError !== undefined
              ? config.tokenError
              : { message: "Not found" },
        });
        return chain;
      }
      case "profiles": {
        const chain = createQueryChain({ data: null, error: null });
        (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
          data:
            config.profileData !== undefined
              ? config.profileData
              : createMockProfile(),
          error: config.profileError ?? null,
        });
        return chain;
      }
      case "spots": {
        const chain = createQueryChain({ data: null, error: null });
        (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: config.spotData ?? null,
          error: null,
        });
        return chain;
      }
      case "cessions": {
        const chain = createQueryChain({ data: null, error: null });
        (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: config.cessionData ?? null,
          error: null,
        });
        return chain;
      }
      default:
        return createQueryChain({ data: null, error: null });
    }
  });

  vi.mocked(createClient).mockResolvedValue({ from: mockFrom } as never);
  return mockFrom;
}

// ─── getUserPreferences ───────────────────────────────────────────────────────

describe("getUserPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve las preferencias validadas cuando existen", async () => {
    const prefs = createMockUserPreferencesRow({ theme: "dark" });
    setupSupabaseMock({ preferencesData: prefs });

    const result = await getUserPreferences(USER_ID);

    expect(result).not.toBeNull();
    expect(result?.theme).toBe("dark");
  });

  it("devuelve null si Supabase devuelve error", async () => {
    setupSupabaseMock({
      preferencesData: null,
      preferencesError: { message: "No encontrado" },
    });

    const result = await getUserPreferences(USER_ID);

    expect(result).toBeNull();
  });

  it("aplica validateUserPreferences: convierte theme inválido a 'system'", async () => {
    const prefs = createMockUserPreferencesRow({ theme: "invalid-theme" });
    setupSupabaseMock({ preferencesData: prefs });

    const result = await getUserPreferences(USER_ID);

    expect(result?.theme).toBe("system");
  });
});

// ─── getMicrosoftConnectionStatus ────────────────────────────────────────────

describe("getMicrosoftConnectionStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve connected=false si no hay token (PGRST116 = sin filas)", async () => {
    setupSupabaseMock({
      tokenError: { code: "PGRST116", message: "No row found" },
    });

    const result = await getMicrosoftConnectionStatus(USER_ID);

    expect(result?.connected).toBe(false);
    expect(result?.scopes).toEqual([]);
    expect(result?.teamsConnected).toBe(false);
    expect(result?.outlookConnected).toBe(false);
  });

  it("devuelve null si hay error real de DB (no PGRST116)", async () => {
    setupSupabaseMock({
      tokenError: { message: "Connection refused" },
    });

    const result = await getMicrosoftConnectionStatus(USER_ID);

    expect(result).toBeNull();
  });

  it("devuelve connected=true con token válido (no expirado)", async () => {
    const token = createMockToken();
    setupSupabaseMock({ tokenData: token, tokenError: null });

    const result = await getMicrosoftConnectionStatus(USER_ID);

    expect(result!.connected).toBe(true);
  });

  it("devuelve connected=false con token expirado", async () => {
    const token = createMockToken({
      token_expires_at: new Date(Date.now() - 3600 * 1000).toISOString(), // 1h en el pasado
    });
    setupSupabaseMock({ tokenData: token, tokenError: null });

    const result = await getMicrosoftConnectionStatus(USER_ID);

    expect(result!.connected).toBe(false);
  });

  it("mapea teamsConnected=true si hay teams_user_id", async () => {
    const token = createMockToken({ teams_user_id: "u-teams-123" });
    setupSupabaseMock({ tokenData: token, tokenError: null });

    const result = await getMicrosoftConnectionStatus(USER_ID);

    expect(result!.teamsConnected).toBe(true);
  });

  it("mapea teamsConnected=false si teams_user_id es null", async () => {
    const token = createMockToken({ teams_user_id: null });
    setupSupabaseMock({ tokenData: token, tokenError: null });

    const result = await getMicrosoftConnectionStatus(USER_ID);

    expect(result!.teamsConnected).toBe(false);
  });

  it("mapea outlookConnected=true si hay outlook_calendar_id", async () => {
    const token = createMockToken({ outlook_calendar_id: "cal-123" });
    setupSupabaseMock({ tokenData: token, tokenError: null });

    const result = await getMicrosoftConnectionStatus(USER_ID);

    expect(result!.outlookConnected).toBe(true);
  });

  it("mapea los campos lastSync y lastOOOCheck del token", async () => {
    const token = createMockToken({
      last_calendar_sync_at: "2025-03-01T10:00:00Z",
      last_ooo_check_at: "2025-03-01T09:00:00Z",
    });
    setupSupabaseMock({ tokenData: token, tokenError: null });

    const result = await getMicrosoftConnectionStatus(USER_ID);

    expect(result!.lastSync).toBe("2025-03-01T10:00:00Z");
    expect(result!.lastOOOCheck).toBe("2025-03-01T09:00:00Z");
  });

  it("mapea los scopes del token", async () => {
    const token = createMockToken({
      scopes: ["Calendars.Read", "Mail.Send"],
    });
    setupSupabaseMock({ tokenData: token, tokenError: null });

    const result = await getMicrosoftConnectionStatus(USER_ID);

    expect(result!.scopes).toEqual(["Calendars.Read", "Mail.Send"]);
  });
});

// ─── getAssignedSpotInfo ────────────────────────────────────────────────────

describe("getAssignedSpotInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve spot=null y statusToday='unknown' si no hay plaza asignada", async () => {
    setupSupabaseMock({ spotData: null });

    const result = await getAssignedSpotInfo(USER_ID);

    expect(result.spot).toBeNull();
    expect(result.statusToday).toBe("unknown");
    expect(result.nextCession).toBeNull();
  });

  it("devuelve statusToday='occupied' si hay plaza pero sin cesión hoy", async () => {
    setupSupabaseMock({
      spotData: { id: "spot-mgmt", label: "D-01", type: "standard" },
      cessionData: null,
    });

    const result = await getAssignedSpotInfo(USER_ID);

    expect(result.statusToday).toBe("occupied");
  });

  it("devuelve statusToday='ceded' si hay cesión available hoy", async () => {
    setupSupabaseMock({
      spotData: { id: "spot-mgmt", label: "D-01", type: "standard" },
      cessionData: { id: "ces-1", status: "available", date: "2025-03-15" },
    });

    const result = await getAssignedSpotInfo(USER_ID);

    expect(result.statusToday).toBe("ceded");
  });

  it("devuelve statusToday='reserved' si la cesión está reservada", async () => {
    setupSupabaseMock({
      spotData: { id: "spot-mgmt", label: "D-01", type: "standard" },
      cessionData: { id: "ces-1", status: "reserved", date: "2025-03-15" },
    });

    const result = await getAssignedSpotInfo(USER_ID);

    expect(result.statusToday).toBe("reserved");
  });

  it("incluye la info de la plaza en el resultado", async () => {
    setupSupabaseMock({
      spotData: { id: "spot-mgmt", label: "D-01", type: "standard" },
    });

    const result = await getAssignedSpotInfo(USER_ID);

    expect(result.spot).toMatchObject({
      id: "spot-mgmt",
      label: "D-01",
      type: "standard",
    });
  });
});

describe("getUserProfileWithPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve null si el perfil no se encuentra", async () => {
    setupSupabaseMock({
      profileData: null,
      profileError: { message: "No encontrado" },
    });

    const result = await getUserProfileWithPreferences(USER_ID);

    expect(result).toBeNull();
  });

  it("devuelve el perfil con preferencias para empleado", async () => {
    const profile = createMockProfile({ role: "employee" });
    const prefs = createMockUserPreferencesRow();
    setupSupabaseMock({
      profileData: profile,
      preferencesData: prefs,
      tokenError: { code: "PGRST116", message: "Not found" },
    });

    const result = await getUserProfileWithPreferences(USER_ID);

    expect(result).not.toBeNull();
    expect(result?.profile.role).toBe("employee");
    expect(result?.preferences).not.toBeNull();
    expect(result?.assignedSpots.parking).toBeNull(); // sin plaza asignada
  });

  it("incluye assignedSpots.parking cuando el empleado tiene plaza asignada", async () => {
    const profile = createMockProfile({ role: "employee" });
    setupSupabaseMock({
      profileData: profile,
      preferencesData: createMockUserPreferencesRow(),
      tokenError: { code: "PGRST116", message: "Not found" },
      spotData: { id: "spot-mgmt", label: "P-15", type: "standard" },
    });

    const result = await getUserProfileWithPreferences(USER_ID);

    expect(result?.assignedSpots.parking).not.toBeNull();
    expect(result?.assignedSpots.parking?.spot?.label).toBe("P-15");
  });

  it("assignedSpots.parking es null cuando no hay plaza asignada", async () => {
    const profile = createMockProfile({ role: "admin" });
    setupSupabaseMock({
      profileData: profile,
      preferencesData: createMockUserPreferencesRow(),
      tokenError: { code: "PGRST116", message: "Not found" },
      spotData: null, // sin plaza asignada
    });

    const result = await getUserProfileWithPreferences(USER_ID);

    expect(result?.assignedSpots.parking).toBeNull();
    expect(result?.assignedSpots.office).toBeNull();
  });

  it("devuelve microsoftStatus desconectado si no hay token (PGRST116)", async () => {
    setupSupabaseMock({
      profileData: createMockProfile(),
      tokenError: { code: "PGRST116", message: "Not found" },
    });

    const result = await getUserProfileWithPreferences(USER_ID);

    expect(result?.microsoftStatus?.connected).toBe(false);
  });

  it("devuelve microsoftStatus conectado si hay token válido", async () => {
    const token = createMockToken();
    setupSupabaseMock({
      profileData: createMockProfile(),
      tokenData: token,
      tokenError: null,
    });

    const result = await getUserProfileWithPreferences(USER_ID);

    expect(result?.microsoftStatus?.connected).toBe(true);
  });
});
