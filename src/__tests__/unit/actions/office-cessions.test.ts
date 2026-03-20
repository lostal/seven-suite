/**
 * Tests de Server Actions de Cesiones de Oficina
 *
 * Verifica la lógica de negocio de:
 * - createOfficeCession: verificación de propiedad y antelación
 * - cancelOfficeCession: bloqueo de no-admin si hay reserva activa
 * - cancelOfficeCession: cascade admin para cancelar reserva + cesión
 *
 * Los casos son equivalentes a cessions.test.ts (parking) con las
 * diferencias propias de oficinas (resource_type, mensajes de error).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createOfficeCession,
  cancelOfficeCession,
} from "@/app/(dashboard)/oficinas/cession-actions";
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
const FUTURE_DATE = "2025-01-13";

// ─── createOfficeCession ──────────────────────────────────────────────────────

describe("createOfficeCession", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(
      createMockAuthUser({ id: USER_ID }) as never
    );
    vi.mocked(isTooSoonForCession).mockReturnValue(false);
    vi.mocked(getAllResourceConfigs).mockResolvedValue({
      cession_enabled: true,
      cession_min_advance_hours: 0,
    } as never);
  });

  it("lanza error si las cesiones de oficina están deshabilitadas", async () => {
    vi.mocked(getAllResourceConfigs).mockResolvedValue({
      cession_enabled: false,
    } as never);

    const result = await createOfficeCession({
      spot_id: SPOT_UUID,
      dates: [FUTURE_DATE],
    });

    expect(result?.success).toBe(false);
    if (!result?.success) expect(result.error).toContain("deshabilitadas");
  });

  it("lanza error si el puesto no existe", async () => {
    setupSelectMock([]);

    const result = await createOfficeCession({
      spot_id: SPOT_UUID,
      dates: [FUTURE_DATE],
    });

    expect(result?.success).toBe(false);
    if (!result?.success) expect(result.error).toContain("no encontrado");
  });

  it("lanza error si el puesto no es de tipo office", async () => {
    setupSelectMock([
      {
        id: SPOT_UUID,
        assignedTo: USER_ID,
        resourceType: "parking", // ← tipo incorrecto
      },
    ]);

    const result = await createOfficeCession({
      spot_id: SPOT_UUID,
      dates: [FUTURE_DATE],
    });

    expect(result?.success).toBe(false);
    if (!result?.success)
      expect(result.error).toContain("no es un espacio de oficina");
  });

  it("lanza error si el usuario no es el propietario del puesto", async () => {
    setupSelectMock([
      {
        id: SPOT_UUID,
        assignedTo: OTHER_USER_ID,
        resourceType: "office",
      },
    ]);

    const result = await createOfficeCession({
      spot_id: SPOT_UUID,
      dates: [FUTURE_DATE],
    });

    expect(result?.success).toBe(false);
    if (!result?.success)
      expect(result.error).toContain("Solo puedes ceder tu propio puesto");
  });

  it("verifica propiedad ANTES del check de antelación", async () => {
    vi.mocked(isTooSoonForCession).mockReturnValue(true);
    vi.mocked(getAllResourceConfigs).mockResolvedValue({
      cession_enabled: true,
      cession_min_advance_hours: 24,
    } as never);

    setupSelectMock([
      {
        id: SPOT_UUID,
        assignedTo: OTHER_USER_ID, // NO es el dueño
        resourceType: "office",
      },
    ]);

    const result = await createOfficeCession({
      spot_id: SPOT_UUID,
      dates: [FUTURE_DATE],
    });

    // Debe devolver error de propiedad, NO de antelación
    expect(result?.success).toBe(false);
    if (!result?.success) {
      expect(result.error).toContain("Solo puedes ceder tu propio puesto");
      expect(result.error).not.toContain("antelación");
    }
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
        assignedTo: USER_ID,
        resourceType: "office",
      },
    ]);

    const result = await createOfficeCession({
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
        resourceType: "office",
      },
    ]);

    mockDb.insert.mockImplementationOnce(() => {
      throw Object.assign(new Error("duplicate key value"), { code: "23505" });
    });

    const result = await createOfficeCession({
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
        resourceType: "office",
      },
    ]);
    setupInsertMock([{ id: CESSION_UUID }]);

    const result = await createOfficeCession({
      spot_id: SPOT_UUID,
      dates: [FUTURE_DATE],
    });

    expect(result?.success).toBe(true);
    if (result?.success) expect(result.data).toEqual({ count: 1 });
  });
});

// ─── cancelOfficeCession ──────────────────────────────────────────────────────

describe("cancelOfficeCession", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(
      createMockAuthUser({ id: USER_ID }) as never
    );
  });

  it("lanza error si la cesión no existe", async () => {
    // select cession → empty
    setupSelectMock([]);

    const result = await cancelOfficeCession({ id: CESSION_UUID });

    expect(result?.success).toBe(false);
    if (!result?.success)
      expect(result.error).toContain("Cesión no encontrada");
  });

  it("lanza error si el usuario no es el propietario", async () => {
    setupSelectMock([
      {
        id: CESSION_UUID,
        userId: OTHER_USER_ID,
        spotId: SPOT_UUID,
        date: FUTURE_DATE,
        status: "available",
      },
    ]);

    const result = await cancelOfficeCession({ id: CESSION_UUID });

    expect(result?.success).toBe(false);
    if (!result?.success)
      expect(result.error).toContain("No puedes cancelar esta cesión");
  });

  it("lanza error para no-admin si hay una reserva activa", async () => {
    // 1. select cession
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

    const result = await cancelOfficeCession({ id: CESSION_UUID });

    expect(result?.success).toBe(false);
    if (!result?.success)
      expect(result.error).toContain("alguien ya ha reservado este puesto");
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

    const result = await cancelOfficeCession({ id: CESSION_UUID });

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

    // 1. select cession → owned by other
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
    // 3. update reservation (cancel)
    setupUpdateMock([]);
    // 4. update cession (cancel)
    setupUpdateMock([]);

    const result = await cancelOfficeCession({ id: CESSION_UUID });

    expect(result?.success).toBe(true);
    if (result?.success)
      expect(result.data).toEqual({
        cancelled: true,
        reservationAlsoCancelled: true,
      });
  });

  it("rechaza id no UUID sin llamar a BD (validación Zod)", async () => {
    const result = await cancelOfficeCession({ id: "no-es-uuid" });

    expect(result?.success).toBe(false);
    expect(mockDb.select).not.toHaveBeenCalled();
  });
});
