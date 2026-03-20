/**
 * Tests de Acciones de Configuración del Sistema (Admin)
 *
 * Verifica la lógica de negocio de:
 * - updateGlobalConfig: actualización de config global con invalidación de cache
 * - updateParkingConfig: config de parking con invalidación
 * - updateOfficeConfig: config de oficinas con invalidación
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  updateGlobalConfig,
  updateParkingConfig,
  updateOfficeConfig,
} from "@/app/(dashboard)/configuracion/actions";
import { mockDb, resetDbMocks, setupInsertMock } from "../../mocks/db";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/db", async () => {
  const { mockDb } = await import("../../mocks/db");
  return { db: mockDb };
});

vi.mock("@/lib/auth/helpers", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  invalidateConfigCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/queries/active-entity", () => ({
  getActiveEntityId: vi.fn().mockResolvedValue(null),
  getEffectiveEntityId: vi.fn().mockResolvedValue(null),
}));

import { requireAdmin } from "@/lib/auth/helpers";
import { invalidateConfigCache } from "@/lib/config";

// ─── Constants ────────────────────────────────────────────────────────────────

const ADMIN_ID = "admin-00000000-0000-0000-0000-000000000001";

function setupAdminUser() {
  vi.mocked(requireAdmin).mockResolvedValue({
    id: ADMIN_ID,
    email: "admin@test.com",
    profile: {
      fullName: "Admin",
      avatarUrl: null,
      entityId: null,
      managerId: null,
      jobTitle: null,
      createdAt: new Date("2025-01-01T00:00:00Z"),
      updatedAt: new Date("2025-01-01T00:00:00Z"),
      id: ADMIN_ID,
      email: "admin@test.com",
      role: "admin" as const,
      dni: null,
      location: null,
      phone: null,
    },
  });
}

// ─── Shared resource config input ────────────────────────────────────────────

const validResourceConfig = {
  booking_enabled: true,
  visitor_booking_enabled: false,
  allowed_days: [1, 2, 3, 4, 5],
  max_advance_days: 30,
  max_consecutive_days: 5,
  max_weekly_reservations: 5,
  max_monthly_reservations: 20,
  max_daily_reservations: null,
  time_slots_enabled: false,
  slot_duration_minutes: 60,
  day_start_hour: 8,
  day_end_hour: 20,
  cession_enabled: true,
  cession_min_advance_hours: 2,
  cession_max_per_week: 5,
  auto_cession_enabled: false,
};

// ─── updateGlobalConfig ───────────────────────────────────────────────────────

describe("updateGlobalConfig", () => {
  beforeEach(() => {
    resetDbMocks();
    setupAdminUser();
  });

  it("guarda la config global y la devuelve como updated:true", async () => {
    // updateGlobalConfig calls upsertConfigs which does N inserts (one per key)
    // 3 keys → 3 inserts
    setupInsertMock([{}]);
    setupInsertMock([{}]);
    setupInsertMock([{}]);

    const result = await updateGlobalConfig({
      notifications_enabled: true,
      email_notifications_enabled: true,
      teams_notifications_enabled: false,
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ updated: true });
  });

  it("invalida el cache después de guardar", async () => {
    setupInsertMock([{}]);
    setupInsertMock([{}]);
    setupInsertMock([{}]);

    await updateGlobalConfig({
      notifications_enabled: false,
      email_notifications_enabled: false,
      teams_notifications_enabled: false,
    });

    expect(invalidateConfigCache).toHaveBeenCalledOnce();
  });

  it("devuelve error si la BD falla en el upsert", async () => {
    mockDb.insert.mockImplementationOnce(() => {
      throw new Error("Error de base de datos");
    });

    const result = await updateGlobalConfig({
      notifications_enabled: true,
      email_notifications_enabled: true,
      teams_notifications_enabled: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeDefined();
  });

  it("NO invalida el cache si la BD falla", async () => {
    mockDb.insert.mockImplementationOnce(() => {
      throw new Error("Error de BD");
    });

    await updateGlobalConfig({
      notifications_enabled: true,
      email_notifications_enabled: true,
      teams_notifications_enabled: true,
    });

    expect(invalidateConfigCache).not.toHaveBeenCalled();
  });

  it("falla si requireAdmin lanza error", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(
      new Error("Acceso no autorizado")
    );

    const result = await updateGlobalConfig({
      notifications_enabled: true,
      email_notifications_enabled: true,
      teams_notifications_enabled: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Acceso no autorizado");
  });
});

// ─── updateParkingConfig ──────────────────────────────────────────────────────

describe("updateParkingConfig", () => {
  beforeEach(() => {
    resetDbMocks();
    setupAdminUser();
  });

  it("guarda la config de parking y devuelve updated:true", async () => {
    // validResourceConfig has 16 keys → 16 inserts
    for (let i = 0; i < 16; i++) {
      setupInsertMock([{}]);
    }

    const result = await updateParkingConfig(validResourceConfig);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ updated: true });
  });

  it("invalida el cache después de guardar", async () => {
    for (let i = 0; i < 16; i++) {
      setupInsertMock([{}]);
    }

    await updateParkingConfig(validResourceConfig);

    expect(invalidateConfigCache).toHaveBeenCalledOnce();
  });

  it("devuelve error si la BD falla", async () => {
    mockDb.insert.mockImplementationOnce(() => {
      throw new Error("Fallo en upsert");
    });

    const result = await updateParkingConfig(validResourceConfig);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeDefined();
  });
});

// ─── updateOfficeConfig ───────────────────────────────────────────────────────

describe("updateOfficeConfig", () => {
  beforeEach(() => {
    resetDbMocks();
    setupAdminUser();
  });

  it("guarda la config de oficinas y devuelve updated:true", async () => {
    for (let i = 0; i < 16; i++) {
      setupInsertMock([{}]);
    }

    const result = await updateOfficeConfig(validResourceConfig);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ updated: true });
  });

  it("invalida el cache después de guardar", async () => {
    for (let i = 0; i < 16; i++) {
      setupInsertMock([{}]);
    }

    await updateOfficeConfig(validResourceConfig);

    expect(invalidateConfigCache).toHaveBeenCalledOnce();
  });

  it("devuelve error si la BD falla", async () => {
    mockDb.insert.mockImplementationOnce(() => {
      throw new Error("Fallo en upsert de oficinas");
    });

    const result = await updateOfficeConfig(validResourceConfig);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeDefined();
  });

  it("invalida el cache solo una vez aunque haya múltiples claves", async () => {
    for (let i = 0; i < 16; i++) {
      setupInsertMock([{}]);
    }

    await updateOfficeConfig({
      ...validResourceConfig,
      time_slots_enabled: true,
      slot_duration_minutes: 30,
    });

    // invalidateConfigCache solo se llama 1 vez por acción
    expect(invalidateConfigCache).toHaveBeenCalledOnce();
  });
});
