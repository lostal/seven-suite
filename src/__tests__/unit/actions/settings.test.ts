/**
 * Tests de Server Actions de Ajustes
 *
 * Verifica la lógica de negocio de:
 * - updateProfile: actualización de perfil de usuario
 * - updateNotificationPreferences: preferencias de notificaciones
 * - updateCessionRules: reglas de auto-cesión
 * - disconnectMicrosoftAccount: desvinculación de cuenta Microsoft
 * - deleteSelfAccount: eliminación de propia cuenta
 * - testTeamsNotification / forceCalendarSync: stubs sin implementar
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  updateProfile,
  updateNotificationPreferences,
  updateCessionRules,
  disconnectMicrosoftAccount,
  deleteSelfAccount,
  testTeamsNotification,
  forceCalendarSync,
} from "@/app/(dashboard)/ajustes/actions";
import { createQueryChain } from "../../mocks/supabase";
import { createMockAuthUser } from "../../mocks/factories";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_ID = "user-00000000-0000-0000-0000-000000000001";

function setupAuthUser() {
  vi.mocked(requireAuth).mockResolvedValue(
    createMockAuthUser({ id: USER_ID }) as never
  );
}

function setupSupabaseOk() {
  const chain = createQueryChain({ data: null, error: null });
  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn(() => chain),
  } as never);
  return chain;
}

function setupSupabaseError(message: string) {
  const chain = createQueryChain({ data: null, error: { message } });
  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn(() => chain),
  } as never);
  return chain;
}

// ─── updateProfile ────────────────────────────────────────────────────────────

describe("updateProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthUser();
  });

  it("actualiza el perfil con éxito", async () => {
    setupSupabaseOk();

    const result = await updateProfile({ full_name: "Nuevo Nombre" });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ updated: true });
  });

  it("devuelve error si la BD falla", async () => {
    setupSupabaseError("Error de BD");

    const result = await updateProfile({ full_name: "Nombre" });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("actualizar el perfil");
  });

  it("rechaza full_name vacío (schema Zod)", async () => {
    const result = await updateProfile({ full_name: "" });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors).toBeDefined();
  });
});

// ─── updateNotificationPreferences ───────────────────────────────────────────

describe("updateNotificationPreferences", () => {
  const validInput = {
    notification_channel: "teams" as const,
    notify_reservation_confirmed: true,
    notify_reservation_reminder: true,
    notify_cession_reserved: true,
    notify_alert_triggered: true,
    notify_visitor_confirmed: true,
    notify_daily_digest: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthUser();
  });

  it("actualiza preferencias con éxito", async () => {
    setupSupabaseOk();

    const result = await updateNotificationPreferences(validInput);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ updated: true });
  });

  it("devuelve error si la BD falla", async () => {
    setupSupabaseError("Error al guardar preferencias");

    const result = await updateNotificationPreferences(validInput);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("preferencias");
  });

  it("rechaza canal de notificación inválido", async () => {
    const result = await updateNotificationPreferences({
      ...validInput,
      notification_channel: "sms" as never,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Datos inválidos");
    expect(createClient).not.toHaveBeenCalled();
  });
});

// ─── updateCessionRules ───────────────────────────────────────────────────────

describe("updateCessionRules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthUser();
  });

  it("actualiza reglas de cesión con éxito", async () => {
    setupSupabaseOk();

    const result = await updateCessionRules({
      auto_cede_on_ooo: true,
      auto_cede_notify: true,
      auto_cede_days: [1, 2, 3, 4, 5],
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ updated: true });
  });

  it("devuelve error si la BD falla", async () => {
    setupSupabaseError("Error en cesiones");

    const result = await updateCessionRules({
      auto_cede_on_ooo: false,
      auto_cede_notify: false,
      auto_cede_days: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("cesión");
  });
});

// ─── disconnectMicrosoftAccount ───────────────────────────────────────────────

describe("disconnectMicrosoftAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthUser();
  });

  it("desvincula la cuenta de Microsoft con éxito", async () => {
    setupSupabaseOk();

    const result = await disconnectMicrosoftAccount({});

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ disconnected: true });
  });

  it("devuelve error si la BD falla al eliminar el token", async () => {
    setupSupabaseError("No se pudo eliminar el token");

    const result = await disconnectMicrosoftAccount({});

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("desvincular");
  });

  it("devuelve error si requireAuth falla", async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error("No autenticado"));

    const result = await disconnectMicrosoftAccount({});

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("No autenticado");
  });
});

// ─── deleteSelfAccount ────────────────────────────────────────────────────────

describe("deleteSelfAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthUser();
  });

  it("elimina la propia cuenta con éxito", async () => {
    const mockAdminClient = {
      auth: {
        admin: {
          deleteUser: vi.fn().mockResolvedValue({ error: null }),
        },
      },
    };
    vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as never);

    const result = await deleteSelfAccount({});

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ deleted: true });
    expect(mockAdminClient.auth.admin.deleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it("devuelve error si el adminClient falla", async () => {
    vi.mocked(createAdminClient).mockReturnValue({
      auth: {
        admin: {
          deleteUser: vi
            .fn()
            .mockResolvedValue({ error: { message: "User not found" } }),
        },
      },
    } as never);

    const result = await deleteSelfAccount({});

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toContain("Error al eliminar la cuenta");
  });

  it("devuelve error si requireAuth falla", async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error("No autenticado"));

    const result = await deleteSelfAccount({});

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("No autenticado");
  });
});

// ─── Stubs (testTeamsNotification / forceCalendarSync) ────────────────────────

describe("testTeamsNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthUser();
  });

  it("devuelve success:false con campo error (no message)", async () => {
    const result = await testTeamsNotification({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
      expect((result as { message?: string }).message).toBeUndefined();
    }
  });
});

describe("forceCalendarSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthUser();
  });

  it("devuelve success:false con campo error (no message)", async () => {
    const result = await forceCalendarSync({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
      expect((result as { message?: string }).message).toBeUndefined();
    }
  });
});
