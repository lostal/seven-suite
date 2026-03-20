/**
 * Tests de Server Actions de Cesiones de Parking
 *
 * Verifica la lógica de negocio de:
 * - createCession: verificación de propiedad ANTES de antelación (Bug 6)
 * - cancelCession: bloqueo de no-admin si hay reserva activa
 * - cancelCession: cascade admin para cancelar reserva + cesión
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createCession,
  cancelCession,
} from "@/app/(dashboard)/parking/cession-actions";
import {
  mockDb,
  resetDbMocks,
  setupSelectMock,
  setupInsertMock,
  setupUpdateMock,
} from "../../mocks/db";
import { createMockAuthUser } from "../../mocks/factories";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/db", async () => {
  const { mockDb } = await import("../../mocks/db");
  return { db: mockDb };
});

vi.mock("@/lib/auth/helpers", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  getAllResourceConfigs: vi.fn().mockResolvedValue({
    cession_enabled: true,
    cession_min_advance_hours: 0,
  }),
}));

vi.mock("@/lib/calendar/calendar-utils", () => ({
  isTooSoonForCession: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/queries/active-entity", () => ({
  getEffectiveEntityId: vi.fn().mockResolvedValue(null),
}));

import { getCurrentUser } from "@/lib/auth/helpers";
import { getAllResourceConfigs } from "@/lib/config";
import { isTooSoonForCession } from "@/lib/calendar/calendar-utils";

// ─── Constantes ───────────────────────────────────────────────────────────────

const USER_ID = "user-00000000-0000-0000-0000-000000000001";
const OTHER_USER_ID = "other-0000-0000-0000-000000000002";
const SPOT_UUID = "550e8400-e29b-41d4-a716-446655440000";
const CESSION_UUID = "660e8400-e29b-41d4-a716-446655440001";
const RESERVATION_UUID = "770e8400-e29b-41d4-a716-446655440002";
// 2025-01-13 = lunes (día laborable futuro para evitar problemas de fecha)
const FUTURE_DATE = "2025-01-13";

// ─── createCession ────────────────────────────────────────────────────────────

describe("createCession", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(
      createMockAuthUser({ id: USER_ID }) as never
    );
    vi.mocked(isTooSoonForCession).mockReturnValue(false);
    // Resetear config a valores por defecto para evitar contaminación entre tests
    vi.mocked(getAllResourceConfigs).mockResolvedValue({
      cession_enabled: true,
      cession_min_advance_hours: 0,
    } as never);
  });

  it("lanza error si las cesiones están deshabilitadas", async () => {
    vi.mocked(getAllResourceConfigs).mockResolvedValue({
      cession_enabled: false,
    } as never);

    const result = await createCession({
      spot_id: SPOT_UUID,
      dates: [FUTURE_DATE],
    });

    expect(result?.success).toBe(false);
    if (!result?.success) expect(result.error).toContain("deshabilitadas");
  });

  it("lanza error si la plaza no existe", async () => {
    // select returns empty
    setupSelectMock([]);

    const result = await createCession({
      spot_id: SPOT_UUID,
      dates: [FUTURE_DATE],
    });

    expect(result?.success).toBe(false);
    if (!result?.success) expect(result.error).toContain("no encontrada");
  });

  it("lanza error si la plaza no es de tipo parking", async () => {
    setupSelectMock([
      {
        id: SPOT_UUID,
        assignedTo: USER_ID,
        resourceType: "office",
      },
    ]);

    const result = await createCession({
      spot_id: SPOT_UUID,
      dates: [FUTURE_DATE],
    });

    expect(result?.success).toBe(false);
    if (!result?.success)
      expect(result.error).toContain("no es un espacio de parking");
  });

  it("verifica propiedad ANTES del check de antelación (Bug 6)", async () => {
    // La antelación falla para este escenario
    vi.mocked(isTooSoonForCession).mockReturnValue(true);
    vi.mocked(getAllResourceConfigs).mockResolvedValue({
      cession_enabled: true,
      cession_min_advance_hours: 24,
    } as never);

    setupSelectMock([
      {
        id: SPOT_UUID,
        assignedTo: OTHER_USER_ID, // el usuario NO es el dueño
        resourceType: "parking",
      },
    ]);

    const result = await createCession({
      spot_id: SPOT_UUID,
      dates: [FUTURE_DATE],
    });

    // Debe devolver error de propiedad, NO de antelación
    expect(result?.success).toBe(false);
    if (!result?.success) {
      expect(result.error).toContain("Solo puedes ceder tu propia plaza");
      expect(result.error).not.toContain("antelación");
    }
  });

  it("lanza error si el usuario no es el propietario de la plaza", async () => {
    setupSelectMock([
      {
        id: SPOT_UUID,
        assignedTo: OTHER_USER_ID,
        resourceType: "parking",
      },
    ]);

    const result = await createCession({
      spot_id: SPOT_UUID,
      dates: [FUTURE_DATE],
    });

    expect(result?.success).toBe(false);
    if (!result?.success)
      expect(result.error).toContain("Solo puedes ceder tu propia plaza");
  });

  it("lanza error si la fecha no cumple la antelación mínima", async () => {
    vi.mocked(isTooSoonForCession).mockReturnValue(true);
    vi.mocked(getAllResourceConfigs).mockResolvedValue({
      cession_enabled: true,
      cession_min_advance_hours: 24,
    } as never);

    setupSelectMock([
      {
        id: SPOT_UUID,
        assignedTo: USER_ID, // el usuario ES el dueño
        resourceType: "parking",
      },
    ]);

    const result = await createCession({
      spot_id: SPOT_UUID,
      dates: [FUTURE_DATE],
    });

    expect(result?.success).toBe(false);
    if (!result?.success)
      expect(result.error).toContain("antelación mínima de 24 horas");
  });

  it("lanza error si ya existe una cesión para esa fecha (23505)", async () => {
    setupSelectMock([
      {
        id: SPOT_UUID,
        assignedTo: USER_ID,
        resourceType: "parking",
      },
    ]);

    mockDb.insert.mockImplementationOnce(() => {
      throw Object.assign(new Error("duplicate key value"), { code: "23505" });
    });

    const result = await createCession({
      spot_id: SPOT_UUID,
      dates: [FUTURE_DATE],
    });

    expect(result?.success).toBe(false);
    if (!result?.success)
      expect(result.error).toContain("Ya existe una cesión");
  });

  it("crea la cesión con éxito y devuelve el count", async () => {
    setupSelectMock([
      {
        id: SPOT_UUID,
        assignedTo: USER_ID,
        resourceType: "parking",
      },
    ]);
    setupInsertMock([{ id: CESSION_UUID }]);

    const result = await createCession({
      spot_id: SPOT_UUID,
      dates: [FUTURE_DATE],
    });

    expect(result?.success).toBe(true);
    if (result?.success) expect(result.data).toEqual({ count: 1 });
  });
});

// ─── cancelCession ────────────────────────────────────────────────────────────

describe("cancelCession", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(
      createMockAuthUser({ id: USER_ID }) as never
    );
  });

  it("lanza error si la cesión no existe", async () => {
    // select cession → empty
    setupSelectMock([]);

    const result = await cancelCession({ id: CESSION_UUID });

    expect(result?.success).toBe(false);
    if (!result?.success)
      expect(result.error).toContain("Cesión no encontrada");
  });

  it("lanza error si el usuario no es el propietario", async () => {
    // select cession → belongs to other user
    setupSelectMock([
      {
        id: CESSION_UUID,
        userId: OTHER_USER_ID,
        spotId: SPOT_UUID,
        date: FUTURE_DATE,
        status: "available",
      },
    ]);

    const result = await cancelCession({ id: CESSION_UUID });

    expect(result?.success).toBe(false);
    if (!result?.success)
      expect(result.error).toContain("No puedes cancelar esta cesión");
  });

  it("lanza error para no-admin si hay una reserva activa", async () => {
    // 1. select cession → owned by user
    setupSelectMock([
      {
        id: CESSION_UUID,
        userId: USER_ID,
        spotId: SPOT_UUID,
        date: FUTURE_DATE,
        status: "reserved",
      },
    ]);
    // 2. select active reservation → exists
    setupSelectMock([{ id: RESERVATION_UUID }]);

    const result = await cancelCession({ id: CESSION_UUID });

    expect(result?.success).toBe(false);
    if (!result?.success)
      expect(result.error).toContain("alguien ya ha reservado esta plaza");
  });

  it("cancela con éxito sin reserva activa", async () => {
    // 1. select cession
    setupSelectMock([
      {
        id: CESSION_UUID,
        userId: USER_ID,
        spotId: SPOT_UUID,
        date: FUTURE_DATE,
        status: "available",
      },
    ]);
    // 2. select active reservation → none
    setupSelectMock([]);
    // 3. update cession
    setupUpdateMock([]);

    const result = await cancelCession({ id: CESSION_UUID });

    expect(result?.success).toBe(true);
    if (result?.success)
      expect(result.data).toEqual({
        cancelled: true,
        reservationAlsoCancelled: false,
      });
  });

  it("admin cancela con cascade cuando hay reserva activa", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(
      createMockAuthUser({
        id: USER_ID,
        profile: { role: "admin" },
      }) as never
    );

    // 1. select cession → owned by other user
    setupSelectMock([
      {
        id: CESSION_UUID,
        userId: OTHER_USER_ID,
        spotId: SPOT_UUID,
        date: FUTURE_DATE,
        status: "reserved",
      },
    ]);
    // 2. select active reservation → exists
    setupSelectMock([{ id: RESERVATION_UUID }]);
    // 3. update reservation (cancel it)
    setupUpdateMock([]);
    // 4. update cession (cancel it)
    setupUpdateMock([]);

    const result = await cancelCession({ id: CESSION_UUID });

    expect(result?.success).toBe(true);
    if (result?.success)
      expect(result.data).toEqual({
        cancelled: true,
        reservationAlsoCancelled: true,
      });
  });

  it("rechaza id no UUID sin llamar a BD (validación Zod)", async () => {
    const result = await cancelCession({ id: "no-es-uuid" });

    expect(result?.success).toBe(false);
    expect(mockDb.select).not.toHaveBeenCalled();
  });
});
