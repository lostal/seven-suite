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
import { createQueryChain } from "../../mocks/supabase";
import { createMockAuthUser } from "../../mocks/factories";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/auth", () => ({
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

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getAllResourceConfigs } from "@/lib/config";
import {
  getOfficeAvailabilityForDate,
  getAvailableTimeSlots,
} from "@/lib/queries/offices";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupSupabaseMock(
  config: {
    existingReservation?: { id: string } | null;
    insertResult?: {
      data: { id: string } | null;
      error: { message: string; code?: string } | null;
    };
    updateData?: { id: string }[] | null;
    updateError?: { message: string } | null;
    spotData?: { id: string; resource_type: string } | null;
  } = {}
) {
  const mockFrom = vi.fn((table: string) => {
    switch (table) {
      case "spots": {
        const chain = createQueryChain({
          data: null,
          error: null,
        });
        (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
          data:
            config.spotData !== undefined
              ? config.spotData
              : { id: UUID, resource_type: "office" },
          error: null,
        });
        return chain;
      }
      case "reservations": {
        const chain = createQueryChain({
          data: config.updateData ?? [{ id: "res-id" }],
          error: config.updateError ?? null,
        });
        // Override maybeSingle para la comprobación de duplicado
        (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: config.existingReservation ?? null,
          error: null,
        });
        // Override single para el resultado del insert
        (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(
          config.insertResult ?? { data: { id: "new-res-id" }, error: null }
        );
        return chain;
      }
      default:
        return createQueryChain({ data: [], error: null });
    }
  });

  vi.mocked(createClient).mockResolvedValue({ from: mockFrom } as never);
  return mockFrom;
}

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
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(createMockAuthUser() as never);
  });

  it("crea la reserva y devuelve el id", async () => {
    setupSupabaseMock();

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
    setupSupabaseMock({
      insertResult: {
        data: null,
        error: { message: "duplicate key value", code: "23505" },
      },
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

  it("rechaza spot_id inválido sin llamar a BD (validación Zod)", async () => {
    const result = await createOfficeReservation({
      spot_id: "no-es-uuid",
      date: "2025-03-17",
    });

    expect(result.success).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rechaza fecha con formato incorrecto (validación Zod)", async () => {
    const result = await createOfficeReservation({
      spot_id: UUID,
      date: "17/03/2025",
    });

    expect(result.success).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });
});

// ─── cancelOfficeReservation ──────────────────────────────────────────────────

describe("cancelOfficeReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(createMockAuthUser() as never);
  });

  it("cancela la reserva con éxito cuando se afecta una fila", async () => {
    const mockFrom = vi.fn(() =>
      createQueryChain({ data: [{ id: UUID }], error: null })
    );
    vi.mocked(createClient).mockResolvedValue({ from: mockFrom } as never);

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
    const mockFrom = vi.fn(() => createQueryChain({ data: [], error: null }));
    vi.mocked(createClient).mockResolvedValue({ from: mockFrom } as never);

    const result = await cancelOfficeReservation({ id: UUID });

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toContain("no pertenece a tu cuenta");
  });

  it("falla si la BD devuelve error al actualizar", async () => {
    const mockFrom = vi.fn(() =>
      createQueryChain({
        data: null,
        error: { message: "DB error" },
      })
    );
    vi.mocked(createClient).mockResolvedValue({ from: mockFrom } as never);

    const result = await cancelOfficeReservation({ id: UUID });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("DB error");
  });

  it("rechaza id no UUID sin llamar a BD (validación Zod)", async () => {
    const result = await cancelOfficeReservation({ id: "no-es-uuid" });

    expect(result.success).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });
});

// ─── getOfficeSpotsForDate ────────────────────────────────────────────────────

describe("getOfficeSpotsForDate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(createMockAuthUser() as never);
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
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(createMockAuthUser() as never);
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
