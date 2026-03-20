/**
 * Tests de Server Actions de Parking
 *
 * Verifica la lógica de negocio de:
 * - getAvailableSpotsForDate: filtrado por día, tipo de plaza y cesiones
 * - createReservation: validación, duplicado, constraint violation
 * - cancelReservation: autenticación y cancelación en BD
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
  getAvailableSpotsForDate,
  createReservation,
  cancelReservation,
} from "@/app/(dashboard)/parking/actions";
import {
  mockDb,
  resetDbMocks,
  setupSelectMock,
  setupInsertMock,
  setupUpdateMock,
} from "../../mocks/db";
import { createMockSpot, createMockAuthUser } from "../../mocks/factories";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/db", async () => {
  const { mockDb } = await import("../../mocks/db");
  return { db: mockDb };
});

vi.mock("@/lib/auth/helpers", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/queries/reservations", () => ({
  getUserReservations: vi.fn().mockResolvedValue([]),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  getAllResourceConfigs: vi.fn().mockResolvedValue({
    booking_enabled: true,
    visitor_booking_enabled: true,
    allowed_days: [1, 2, 3, 4, 5],
    max_advance_days: 365,
    max_consecutive_days: 5,
    max_weekly_reservations: 5,
    max_monthly_reservations: 20,
    max_daily_reservations: null,
    time_slots_enabled: false,
    cession_enabled: true,
  }),
}));

vi.mock("@/lib/queries/active-entity", () => ({
  getEffectiveEntityId: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/booking-validation", () => ({
  validateBookingDate: vi.fn(),
}));

import { getCurrentUser } from "@/lib/auth/helpers";
import { getEffectiveEntityId } from "@/lib/queries/active-entity";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const UUID = "550e8400-e29b-41d4-a716-446655440000";

/**
 * Setup the 4 parallel selects that getAvailableSpotsForDate uses:
 * spots, reservations, cessions, visitorReservations
 */
function setupGetAvailableSpotsMocks(
  config: {
    spots?: ReturnType<typeof createMockSpot>[];
    spotsError?: boolean;
    reservations?: { id: string; spotId: string }[];
    reservationsError?: boolean;
    cessions?: { id: string; spotId: string; status: string }[];
    cessionsError?: boolean;
    visitorReservations?: { id: string; spotId: string }[];
    visitorReservationsError?: boolean;
  } = {}
) {
  if (config.spotsError) {
    mockDb.select.mockImplementationOnce(() => {
      throw new Error("Error de conexión");
    });
    return;
  }

  if (config.reservationsError) {
    // spots returns ok
    setupSelectMock(config.spots ?? []);
    // reservations throws
    mockDb.select.mockImplementationOnce(() => {
      // spots select already consumed from queue, need to intercept reservations
      throw new Error("fallo");
    });
    return;
  }

  // Normal case: queue all 4 selects
  // The action uses Promise.all so they are called in parallel
  // With our queue implementation, each call pops from queue in order
  setupSelectMock(
    config.spots?.map((s) => ({
      id: s.id,
      label: s.label,
      type: s.type,
      resourceType: s.resource_type,
      assignedTo: s.assigned_to,
      positionX: s.position_x,
      positionY: s.position_y,
      isActive: s.is_active,
      entityId: s.entity_id,
    })) ?? []
  );
  setupSelectMock(config.reservations ?? []);
  setupSelectMock(config.cessions ?? []);
  setupSelectMock(config.visitorReservations ?? []);
}

// ─── getAvailableSpotsForDate ─────────────────────────────────────────────────

describe("getAvailableSpotsForDate", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(createMockAuthUser() as never);
  });

  // ── Fines de semana ────────────────────────────────────────────────────────

  it("devuelve success([]) el sábado sin consultar BD", async () => {
    // 2025-01-11 es sábado
    const result = await getAvailableSpotsForDate("2025-01-11");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual([]);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("devuelve success([]) el domingo sin consultar BD", async () => {
    // 2025-01-12 es domingo
    const result = await getAvailableSpotsForDate("2025-01-12");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual([]);
  });

  it("procesa normalmente el lunes", async () => {
    // 2025-01-13 es lunes
    const spot = createMockSpot({ id: "s1", type: "standard" });
    setupGetAvailableSpotsMocks({ spots: [spot] });
    const result = await getAvailableSpotsForDate("2025-01-13");
    expect(result.success).toBe(true);
  });

  // ── Autenticación ──────────────────────────────────────────────────────────

  it("devuelve error 'No autenticado' si getCurrentUser devuelve null", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await getAvailableSpotsForDate("2025-03-17"); // lunes
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("No autenticado");
  });

  // ── Error de BD ────────────────────────────────────────────────────────────

  it("devuelve error si la query de plazas falla", async () => {
    mockDb.select.mockImplementationOnce(() => {
      throw new Error("Error de conexión");
    });
    const result = await getAvailableSpotsForDate("2025-03-17");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeDefined();
  });

  it("devuelve error si falla cualquiera de las queries auxiliares", async () => {
    // First select (spots) succeeds, second (reservations via Promise.all) fails
    setupSelectMock([]);
    mockDb.select.mockImplementationOnce(() => {
      throw new Error("fallo");
    });

    const result = await getAvailableSpotsForDate("2025-03-17");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeDefined();
  });

  // ── Plazas estándar ────────────────────────────────────────────────────────

  it("excluye plazas sin propietario (nuevo modelo: solo cesiones son reservables)", async () => {
    // Spot sin assigned_to → no reservable, aunque esté activo y sin reservas
    const spot = createMockSpot({ id: "s1", type: "standard" });
    setupGetAvailableSpotsMocks({ spots: [spot] });

    const result = await getAvailableSpotsForDate("2025-03-17");

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(0);
  });

  it("excluye plazas estándar con reserva confirmada", async () => {
    const spot = createMockSpot({ id: "s1", type: "standard" });
    setupGetAvailableSpotsMocks({
      spots: [spot],
      reservations: [{ id: "r1", spotId: "s1" }],
    });

    const result = await getAvailableSpotsForDate("2025-03-17");

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(0);
  });

  it("excluye plazas con reserva de visitante", async () => {
    const spot = createMockSpot({ id: "s1", type: "standard" });
    setupGetAvailableSpotsMocks({
      spots: [spot],
      visitorReservations: [{ id: "v1", spotId: "s1" }],
    });

    const result = await getAvailableSpotsForDate("2025-03-17");

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(0);
  });

  // ── Plazas asignadas ────────────────────────────────────────────────────

  it("excluye plazas asignadas sin cesión activa", async () => {
    const spot = createMockSpot({
      id: "sm",
      type: "standard",
      assigned_to: "owner-00000000-0000-0000-0000-000000000001",
    });
    setupGetAvailableSpotsMocks({ spots: [spot] });

    const result = await getAvailableSpotsForDate("2025-03-17");

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(0);
  });

  it("incluye plaza asignada con cesión 'available' con status 'ceded'", async () => {
    const spot = createMockSpot({
      id: "sm",
      type: "standard",
      assigned_to: "owner-00000000-0000-0000-0000-000000000001",
    });
    setupGetAvailableSpotsMocks({
      spots: [spot],
      cessions: [{ id: "c1", spotId: "sm", status: "available" }],
    });

    const result = await getAvailableSpotsForDate("2025-03-17");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.status).toBe("ceded");
    }
  });

  it("excluye plaza asignada con cesión 'reserved'", async () => {
    const spot = createMockSpot({
      id: "sm",
      type: "standard",
      assigned_to: "owner-00000000-0000-0000-0000-000000000001",
    });
    setupGetAvailableSpotsMocks({
      spots: [spot],
      cessions: [{ id: "c1", spotId: "sm", status: "reserved" }],
    });

    const result = await getAvailableSpotsForDate("2025-03-17");

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(0);
  });

  // ── Plazas de visitas (visitor) ────────────────────────────────────────────

  it("incluye plaza de visitas sin reservas con status 'free'", async () => {
    const spot = createMockSpot({ id: "v1", type: "visitor" });
    setupGetAvailableSpotsMocks({ spots: [spot] });

    const result = await getAvailableSpotsForDate("2025-03-17");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.status).toBe("free");
    }
  });

  it("excluye plaza de visitas con reserva de empleado confirmada", async () => {
    const spot = createMockSpot({ id: "v1", type: "visitor" });
    setupGetAvailableSpotsMocks({
      spots: [spot],
      reservations: [{ id: "r1", spotId: "v1" }],
    });

    const result = await getAvailableSpotsForDate("2025-03-17");

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(0);
  });

  it("excluye plaza de visitas con reserva de visitante confirmada", async () => {
    const spot = createMockSpot({ id: "v1", type: "visitor" });
    setupGetAvailableSpotsMocks({
      spots: [spot],
      visitorReservations: [{ id: "vr1", spotId: "v1" }],
    });

    const result = await getAvailableSpotsForDate("2025-03-17");

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(0);
  });
});

// ─── createReservation ────────────────────────────────────────────────────────

describe("createReservation", () => {
  beforeAll(() => {
    // Mock del tiempo para que "2025-03-17" sea fecha futura
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
    setupSelectMock([{ id: UUID, resourceType: "parking", entityId: null }]);
    // 2. select existing reservation → none
    setupSelectMock([]);
    // 3. insert reservation
    setupInsertMock([{ id: "new-res-id" }]);

    const result = await createReservation({
      spot_id: UUID,
      date: "2025-03-17",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveProperty("id");
  });

  it("falla si el usuario no está autenticado", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await createReservation({
      spot_id: UUID,
      date: "2025-03-17",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("No autenticado");
  });

  it("falla si el usuario ya tiene reserva ese día", async () => {
    // 1. select spot
    setupSelectMock([{ id: UUID, resourceType: "parking", entityId: null }]);
    // 2. select existing reservation → exists
    setupSelectMock([{ id: "existing-id" }]);

    const result = await createReservation({
      spot_id: UUID,
      date: "2025-03-17",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Ya tienes una reserva para este día");
    }
  });

  it("falla con mensaje claro en violación de constraint único (23505)", async () => {
    // 1. select spot
    setupSelectMock([{ id: UUID, resourceType: "parking", entityId: null }]);
    // 2. select existing reservation → none
    setupSelectMock([]);
    // 3. insert throws 23505
    mockDb.insert.mockImplementationOnce(() => {
      throw Object.assign(new Error("duplicate key value"), { code: "23505" });
    });
    // 4. select for user duplicate check → empty
    setupSelectMock([]);

    const result = await createReservation({
      spot_id: UUID,
      date: "2025-03-17",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("ya está reservada");
    }
  });

  it("si hay carrera concurrente y termina existiendo reserva del usuario, devuelve mensaje de duplicado de usuario", async () => {
    // 1. select spot
    setupSelectMock([{ id: UUID, resourceType: "parking", entityId: null }]);
    // 2. select existing reservation → none (pre-insert check)
    setupSelectMock([]);
    // 3. insert throws 23505
    mockDb.insert.mockImplementationOnce(() => {
      throw Object.assign(new Error("duplicate key value"), { code: "23505" });
    });
    // 4. select for user duplicate check → found (race condition)
    setupSelectMock([{ id: "race-user-res" }]);

    const result = await createReservation({
      spot_id: UUID,
      date: "2025-03-17",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Ya tienes una reserva para este día");
    }
  });

  it("falla con error genérico de BD si el código no es 23505", async () => {
    // 1. select spot
    setupSelectMock([{ id: UUID, resourceType: "parking", entityId: null }]);
    // 2. select existing reservation → none
    setupSelectMock([]);
    // 3. insert throws generic error
    mockDb.insert.mockImplementationOnce(() => {
      throw new Error("Connection timeout");
    });

    const result = await createReservation({
      spot_id: UUID,
      date: "2025-03-17",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("No se pudo crear la reserva");
    }
  });

  it("rechaza reservar una plaza de otra sede", async () => {
    vi.mocked(getEffectiveEntityId).mockResolvedValue("entity-A");
    // 1. select spot with different entityId
    setupSelectMock([
      { id: UUID, resourceType: "parking", entityId: "entity-B" },
    ]);

    const result = await createReservation({
      spot_id: UUID,
      date: "2025-03-17",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("sede activa");
  });

  it("rechaza spot_id inválido sin llamar a BD (validación Zod)", async () => {
    const result = await createReservation({
      spot_id: "no-es-uuid",
      date: "2025-03-17",
    });

    expect(result.success).toBe(false);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("rechaza fecha con formato incorrecto (validación Zod)", async () => {
    const result = await createReservation({
      spot_id: UUID,
      date: "17/03/2025",
    });

    expect(result.success).toBe(false);
    expect(mockDb.select).not.toHaveBeenCalled();
  });
});

// ─── cancelReservation ────────────────────────────────────────────────────────

describe("cancelReservation", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(createMockAuthUser() as never);
  });

  it("cancela la reserva con éxito", async () => {
    setupUpdateMock([{ id: UUID }]);

    const result = await cancelReservation({ id: UUID });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ cancelled: true });
  });

  it("falla si el usuario no está autenticado", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await cancelReservation({ id: UUID });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("No autenticado");
  });

  it("falla si la BD devuelve error al actualizar", async () => {
    mockDb.update.mockImplementationOnce(() => {
      throw new Error("Row not found or no permission");
    });

    const result = await cancelReservation({ id: UUID });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeDefined();
  });

  it("rechaza id no UUID sin llamar a BD (validación Zod)", async () => {
    const result = await cancelReservation({ id: "no-es-uuid" });

    expect(result.success).toBe(false);
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});
