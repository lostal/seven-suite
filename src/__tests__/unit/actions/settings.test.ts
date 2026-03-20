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
import {
  mockDb,
  resetDbMocks,
  setupUpdateMock,
  setupDeleteMock,
} from "../../mocks/db";
import { createMockAuthUser } from "../../mocks/factories";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/db", async () => {
  const { mockDb } = await import("../../mocks/db");
  return { db: mockDb };
});

vi.mock("@/lib/auth/helpers", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { requireAuth } from "@/lib/auth/helpers";

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_ID = "user-00000000-0000-0000-0000-000000000001";

function setupAuthUser() {
  vi.mocked(requireAuth).mockResolvedValue(
    createMockAuthUser({ id: USER_ID }) as never
  );
}

// ─── updateProfile ────────────────────────────────────────────────────────────

describe("updateProfile", () => {
  beforeEach(() => {
    resetDbMocks();
    setupAuthUser();
  });

  it("actualiza el perfil con éxito", async () => {
    setupUpdateMock([]);

    const result = await updateProfile({ full_name: "Nuevo Nombre" });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ updated: true });
  });

  it("devuelve error si la BD falla", async () => {
    mockDb.update.mockImplementationOnce(() => {
      throw new Error("Error de BD");
    });

    const result = await updateProfile({ full_name: "Nombre" });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeDefined();
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
    resetDbMocks();
    setupAuthUser();
  });

  it("actualiza preferencias con éxito", async () => {
    setupUpdateMock([]);

    const result = await updateNotificationPreferences(validInput);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ updated: true });
  });

  it("devuelve error si la BD falla", async () => {
    mockDb.update.mockImplementationOnce(() => {
      throw new Error("Error al guardar preferencias");
    });

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
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});

// ─── updateCessionRules ───────────────────────────────────────────────────────

describe("updateCessionRules", () => {
  beforeEach(() => {
    resetDbMocks();
    setupAuthUser();
  });

  it("actualiza reglas de cesión con éxito", async () => {
    setupUpdateMock([]);

    const result = await updateCessionRules({
      auto_cede_on_ooo: true,
      auto_cede_notify: true,
      auto_cede_days: [1, 2, 3, 4, 5],
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ updated: true });
  });

  it("devuelve error si la BD falla", async () => {
    mockDb.update.mockImplementationOnce(() => {
      throw new Error("Error en cesiones");
    });

    const result = await updateCessionRules({
      auto_cede_on_ooo: false,
      auto_cede_notify: false,
      auto_cede_days: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeDefined();
  });
});

// ─── disconnectMicrosoftAccount ───────────────────────────────────────────────

describe("disconnectMicrosoftAccount", () => {
  beforeEach(() => {
    resetDbMocks();
    setupAuthUser();
  });

  it("desvincula la cuenta de Microsoft con éxito", async () => {
    setupDeleteMock([]);

    const result = await disconnectMicrosoftAccount({});

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ disconnected: true });
  });

  it("devuelve error si la BD falla al eliminar el token", async () => {
    mockDb.delete.mockImplementationOnce(() => {
      throw new Error("No se pudo eliminar el token");
    });

    const result = await disconnectMicrosoftAccount({});

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeDefined();
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
    resetDbMocks();
    setupAuthUser();
  });

  it("elimina la propia cuenta con éxito", async () => {
    // delete users → returns deleted row
    setupDeleteMock([{ id: USER_ID }]);

    const result = await deleteSelfAccount({});

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ deleted: true });
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("devuelve error si delete no retorna filas (usuario no encontrado)", async () => {
    // delete returns empty rows
    setupDeleteMock([]);

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
    resetDbMocks();
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
    resetDbMocks();
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
