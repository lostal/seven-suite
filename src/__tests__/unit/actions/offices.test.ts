/**
 * Tests de Server Actions de Oficinas
 *
 * Verifica la lógica de negocio de:
 * - createOfficeReservation: validación, duplicado, constraint violation
 * - cancelOfficeReservation: autenticación y verificación de filas afectadas
 * - getOfficeSpotsForDate: autenticación, booking_enabled, allowed_days
 * - getOfficeTimeSlotsForSpot: time_slots_enabled, config incompleta
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  beforeAll,
  afterAll,
} from "vitest";
import {
  createOfficeReservation,
  cancelOfficeReservation,
  getOfficeSpotsForDate,
  getOfficeTimeSlotsForSpot,
} from "@/app/(dashboard)/oficinas/actions";
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
    booking_enabled: true,
    visitor_booking_enabled: false,
    allowed_days: [1, 2, 3, 4, 5],
    max_advance_days: 365,
    max_consecutive_days: 5,
    max_weekly_reservations: 5,
    max_monthly_reservations: 20,
    time_slots_enabled: false,
    slot_duration_minutes: 60,
    day_start_hour: 8,
    day_end_hour: 18,
  }),
}));

vi.mock("@/lib/queries/offices", () => ({
  getOfficeAvailabilityForDate: vi.fn().mockResolvedValue([]),
  getAvailableTimeSlots: vi.fn().mockResolvedValue([]),
  getUserOfficeReservations: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/queries/active-entity", () => ({
  getEffectiveEntityId: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/booking-validation", () => ({
  validateBookingDate: vi.fn(),
}));

import { getCurrentUser } from "@/lib/auth/helpers";
import { getAllResourceConfigs } from "@/lib/config";
import {
  getOfficeAvailabilityForDate,
  getAvailableTimeSlots,
} from "@/lib/queries/offices";
import { getEffectiveEntityId } from "@/lib/queries/active-entity";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const UUID = "550e8400-e29b-41d4-a716-446655440000";

// ─── createOfficeReservation ──────────────────────────────────────────────────

describe("createOfficeReservation", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    resetDbMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(createMockAuthUser() as never);
    vi.mocked(getEffectiveEntityId).mockResolvedValue(null);
  });

  it("crea la reserva y devuelve el id", async () => {
    // 1. select spot
    setupSelectMock([{ id: UUID, resourceType: "office", entityId: null }]);
    // 2. insert reservation
    setupInsertMock([{ id: "new-res-id" }]);

    const result = await createOfficeReservation({
      spot_id: UUID,
      date: "2025-03-17",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveProperty("id");
  });

  it("falla si el usuario no está autenticado", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await createOfficeReservation({
      spot_id: UUID,
      date: "2025-03-17",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("No autenticado");
  });

  it("falla si las reservas de oficina están deshabilitadas", async () => {
    vi.mocked(getAllResourceConfigs).mockResolvedValueOnce({
      booking_enabled: false,
      visitor_booking_enabled: false,
      allowed_days: [1, 2, 3, 4, 5],
      max_advance_days: 365,
      max_consecutive_days: 5,
      max_weekly_reservations: 5,
      max_monthly_reservations: 20,
      time_slots_enabled: false,
    } as never);

    const result = await createOfficeReservation({
      spot_id: UUID,
      date: "2025-03-17",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("deshabilitadas");
  });

  it("falla si el usuario ya tiene reserva de oficina ese día (constraint 23505)", async () => {
    // 1. select spot succeeds
    setupSelectMock([{ id: UUID, resourceType: "office", entityId: null }]);
    // 2. insert throws 23505
    mockDb.insert.mockImplementationOnce(() => {
      throw Object.assign(new Error("duplicate key value"), { code: "23505" });
    });

    const result = await createOfficeReservation({
      spot_id: UUID,
      date: "2025-03-17",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("ya está reservad");
    }
  });

  it("falla con error genérico si el insert devuelve un error no controlado", async () => {
    // 1. select spot succeeds
    setupSelectMock([{ id: UUID, resourceType: "office", entityId: null }]);
    // 2. insert throws generic error
    mockDb.insert.mockImplementationOnce(() => {
      throw new Error("timeout");
    });

    const result = await createOfficeReservation({
      spot_id: UUID,
      date: "2025-03-17",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("No se pudo crear la reserva");
    }
  });

  it("rechaza spot_id inválido sin llamar a BD (validación Zod)", async () => {
    const result = await createOfficeReservation({
      spot_id: "no-es-uuid",
      date: "2025-03-17",
    });

    expect(result.success).toBe(false);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("rechaza fecha con formato incorrecto (validación Zod)", async () => {
    const result = await createOfficeReservation({
      spot_id: UUID,
      date: "17/03/2025",
    });

    expect(result.success).toBe(false);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("rechaza reservar un puesto de otra sede", async () => {
    vi.mocked(getEffectiveEntityId).mockResolvedValue("entity-A");
    // 1. select spot with different entityId
    setupSelectMock([
      { id: UUID, resourceType: "office", entityId: "entity-B" },
    ]);

    const result = await createOfficeReservation({
      spot_id: UUID,
      date: "2025-03-17",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("sede activa");
  });
});

// ─── cancelOfficeReservation ──────────────────────────────────────────────────

describe("cancelOfficeReservation", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(createMockAuthUser() as never);
  });

  it("cancela la reserva con éxito cuando se afecta una fila", async () => {
    setupUpdateMock([{ id: UUID }]);

    const result = await cancelOfficeReservation({ id: UUID });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ cancelled: true });
  });

  it("falla si el usuario no está autenticado", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await cancelOfficeReservation({ id: UUID });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("No autenticado");
  });

  it("falla si no se afectan filas (reserva no pertenece al usuario)", async () => {
    // update returns empty array → no rows affected
    setupUpdateMock([]);

    const result = await cancelOfficeReservation({ id: UUID });

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toContain("no pertenece a tu cuenta");
  });

  it("falla si la BD devuelve error al actualizar", async () => {
    mockDb.update.mockImplementationOnce(() => {
      throw new Error("DB error");
    });

    const result = await cancelOfficeReservation({ id: UUID });

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toContain("No se pudo cancelar la reserva");
  });

  it("rechaza id no UUID sin llamar a BD (validación Zod)", async () => {
    const result = await cancelOfficeReservation({ id: "no-es-uuid" });

    expect(result.success).toBe(false);
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});

// ─── getOfficeSpotsForDate ────────────────────────────────────────────────────

describe("getOfficeSpotsForDate", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(createMockAuthUser() as never);
    vi.mocked(getEffectiveEntityId).mockResolvedValue(null);
    vi.mocked(getAllResourceConfigs).mockResolvedValue({
      booking_enabled: true,
      allowed_days: [1, 2, 3, 4, 5],
      max_advance_days: 365,
      max_consecutive_days: 5,
      max_weekly_reservations: 5,
      max_monthly_reservations: 20,
      time_slots_enabled: false,
      visitor_booking_enabled: false,
      slot_duration_minutes: 60,
      day_start_hour: 8,
      day_end_hour: 18,
      cession_enabled: false,
      cession_min_advance_hours: 0,
    } as never);
  });

  it("devuelve lista vacía si booking_enabled es false", async () => {
    vi.mocked(getAllResourceConfigs).mockResolvedValue({
      booking_enabled: false,
      allowed_days: [1, 2, 3, 4, 5],
    } as never);

    // 2025-01-13 es lunes
    const result = await getOfficeSpotsForDate("2025-01-13");

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual([]);
    expect(getOfficeAvailabilityForDate).not.toHaveBeenCalled();
  });

  it("devuelve lista vacía si la fecha es sábado (día no permitido)", async () => {
    // 2025-01-11 es sábado
    const result = await getOfficeSpotsForDate("2025-01-11");

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual([]);
    expect(getOfficeAvailabilityForDate).not.toHaveBeenCalled();
  });

  it("devuelve lista vacía si la fecha es domingo (día no permitido)", async () => {
    // 2025-01-12 es domingo
    const result = await getOfficeSpotsForDate("2025-01-12");

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual([]);
  });

  it("llama a getOfficeAvailabilityForDate para día laborable", async () => {
    const mockSpots = [{ id: UUID, label: "A1", status: "available" }];
    vi.mocked(getOfficeAvailabilityForDate).mockResolvedValue(
      mockSpots as never
    );

    // 2025-01-13 es lunes
    const result = await getOfficeSpotsForDate("2025-01-13");

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(mockSpots);
    expect(getOfficeAvailabilityForDate).toHaveBeenCalledWith(
      "2025-01-13",
      undefined,
      undefined,
      null
    );
  });

  it("pasa startTime y endTime a getOfficeAvailabilityForDate", async () => {
    vi.mocked(getOfficeAvailabilityForDate).mockResolvedValue([]);

    await getOfficeSpotsForDate("2025-01-13", "09:00", "11:00");

    expect(getOfficeAvailabilityForDate).toHaveBeenCalledWith(
      "2025-01-13",
      "09:00",
      "11:00",
      null
    );
  });

  it("falla si el usuario no está autenticado", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await getOfficeSpotsForDate("2025-01-13");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("No autenticado");
  });
});

// ─── getOfficeTimeSlotsForSpot ────────────────────────────────────────────────

describe("getOfficeTimeSlotsForSpot", () => {
  const SPOT_UUID = "770e8400-e29b-41d4-a716-446655440002";

  beforeEach(() => {
    resetDbMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(createMockAuthUser() as never);
    vi.mocked(getEffectiveEntityId).mockResolvedValue(null);
    vi.mocked(getAllResourceConfigs).mockResolvedValue({
      booking_enabled: true,
      time_slots_enabled: true,
      slot_duration_minutes: 60,
      day_start_hour: 8,
      day_end_hour: 18,
      allowed_days: [1, 2, 3, 4, 5],
    } as never);
  });

  it("falla si el usuario no está autenticado", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await getOfficeTimeSlotsForSpot(SPOT_UUID, "2025-01-13");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("No autenticado");
  });

  it("falla si time_slots_enabled es false", async () => {
    vi.mocked(getAllResourceConfigs).mockResolvedValue({
      time_slots_enabled: false,
    } as never);

    const result = await getOfficeTimeSlotsForSpot(SPOT_UUID, "2025-01-13");

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toContain("franjas horarias no están habilitadas");
  });

  it("falla si la configuración de franjas está incompleta (null values)", async () => {
    vi.mocked(getAllResourceConfigs).mockResolvedValue({
      time_slots_enabled: true,
      slot_duration_minutes: null,
      day_start_hour: null,
      day_end_hour: null,
    } as never);

    const result = await getOfficeTimeSlotsForSpot(SPOT_UUID, "2025-01-13");

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toContain(
        "configuración de franjas no está completa"
      );
  });

  it("devuelve franjas cuando la configuración es válida", async () => {
    const mockSlots = [
      { start_time: "09:00", end_time: "10:00" },
      { start_time: "10:00", end_time: "11:00" },
    ];
    vi.mocked(getAvailableTimeSlots).mockResolvedValue(mockSlots as never);

    const result = await getOfficeTimeSlotsForSpot(SPOT_UUID, "2025-01-13");

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(mockSlots);
    expect(getAvailableTimeSlots).toHaveBeenCalledWith(
      SPOT_UUID,
      "2025-01-13",
      8,
      18,
      60
    );
  });
});
