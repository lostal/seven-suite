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
} from "@/app/(dashboard)/administracion/ajustes/actions";
import { createQueryChain } from "../../mocks/supabase";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  invalidateConfigCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { invalidateConfigCache } from "@/lib/config";

// ─── Constants ────────────────────────────────────────────────────────────────

const ADMIN_ID = "admin-00000000-0000-0000-0000-000000000001";

function setupAdminUser() {
  vi.mocked(requireAdmin).mockResolvedValue({
    id: ADMIN_ID,
    email: "admin@test.com",
    profile: {
      id: ADMIN_ID,
      email: "admin@test.com",
      role: "admin" as const,
      full_name: "Admin",
      avatar_url: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  });
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

// ─── Shared resource config input ────────────────────────────────────────────

const validResourceConfig = {
  booking_enabled: true,
  visitor_booking_enabled: false,
  allowed_days: [1, 2, 3, 4, 5],
  max_advance_days: 30,
  max_consecutive_days: 5,
  max_weekly_reservations: 5,
  max_monthly_reservations: 20,
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
    vi.clearAllMocks();
    setupAdminUser();
  });

  it("guarda la config global y la devuelve como updated:true", async () => {
    setupSupabaseOk();

    const result = await updateGlobalConfig({
      notifications_enabled: true,
      email_notifications_enabled: true,
      teams_notifications_enabled: false,
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ updated: true });
  });

  it("invalida el cache después de guardar", async () => {
    setupSupabaseOk();

    await updateGlobalConfig({
      notifications_enabled: false,
      email_notifications_enabled: false,
      teams_notifications_enabled: false,
    });

    expect(invalidateConfigCache).toHaveBeenCalledOnce();
  });

  it("devuelve error si la BD falla en el upsert", async () => {
    setupSupabaseError("Error de base de datos");

    const result = await updateGlobalConfig({
      notifications_enabled: true,
      email_notifications_enabled: true,
      teams_notifications_enabled: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("configuración");
  });

  it("NO invalida el cache si la BD falla", async () => {
    setupSupabaseError("Error de BD");

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
    vi.clearAllMocks();
    setupAdminUser();
  });

  it("guarda la config de parking y devuelve updated:true", async () => {
    setupSupabaseOk();

    const result = await updateParkingConfig(validResourceConfig);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ updated: true });
  });

  it("invalida el cache después de guardar", async () => {
    setupSupabaseOk();

    await updateParkingConfig(validResourceConfig);

    expect(invalidateConfigCache).toHaveBeenCalledOnce();
  });

  it("devuelve error si la BD falla", async () => {
    setupSupabaseError("Fallo en upsert");

    const result = await updateParkingConfig(validResourceConfig);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("configuración");
  });
});

// ─── updateOfficeConfig ───────────────────────────────────────────────────────

describe("updateOfficeConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAdminUser();
  });

  it("guarda la config de oficinas y devuelve updated:true", async () => {
    setupSupabaseOk();

    const result = await updateOfficeConfig(validResourceConfig);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ updated: true });
  });

  it("invalida el cache después de guardar", async () => {
    setupSupabaseOk();

    await updateOfficeConfig(validResourceConfig);

    expect(invalidateConfigCache).toHaveBeenCalledOnce();
  });

  it("devuelve error si la BD falla", async () => {
    setupSupabaseError("Fallo en upsert de oficinas");

    const result = await updateOfficeConfig(validResourceConfig);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("configuración");
  });

  it("invalida el cache solo una vez aunque haya múltiples claves", async () => {
    setupSupabaseOk();

    await updateOfficeConfig({
      ...validResourceConfig,
      time_slots_enabled: true,
      slot_duration_minutes: 30,
    });

    // invalidateConfigCache solo se llama 1 vez por acción
    expect(invalidateConfigCache).toHaveBeenCalledOnce();
  });
});
