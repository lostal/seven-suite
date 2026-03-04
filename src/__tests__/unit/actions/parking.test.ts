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
import { createQueryChain } from "../../mocks/supabase";
import { createMockSpot, createMockAuthUser } from "../../mocks/factories";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/auth", () => ({
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

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Configura el mock de Supabase con respuestas por tabla.
 * Soporta respuestas distintas para la query de duplicado (.maybeSingle)
 * y para el insert (.single).
 */
function setupSupabaseMock(
  config: {
    spots?: ReturnType<typeof createMockSpot>[];
    spotsError?: { message: string };
    /**
     * Datos devueltos por maybeSingle() en la query de verificación resource_type.
     * Usado por createReservation (Bug 2 fix). Por defecto: plaza de parking válida.
     */
    spotSingleData?: { id: string; resource_type: string } | null;
    reservations?: { id: string; spot_id: string }[];
    cessions?: { id: string; spot_id: string; status: string }[];
    visitorReservations?: { id: string; spot_id: string }[];
    existingReservation?: { id: string } | null;
    insertResult?: {
      data: { id: string } | null;
      error: { message: string; code?: string } | null;
    };
    updateError?: { message: string } | null;
  } = {}
) {
  const mockFrom = vi.fn((table: string) => {
    switch (table) {
      case "spots": {
        const chain = createQueryChain({
          data: config.spots ?? [],
          error: config.spotsError ?? null,
        });
        // Override maybeSingle para la verificación de resource_type en createReservation
        (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
          data:
            config.spotSingleData !== undefined
              ? config.spotSingleData
              : { id: UUID, resource_type: "parking" },
          error: null,
        });
        return chain;
      }
      case "reservations": {
        // La query de duplicado usa .maybeSingle() — devolver existingReservation
        // El insert usa .select().single() — devolver insertResult
        const chain = createQueryChain({
          data: config.reservations ?? [],
          error: null,
        });
        // Override maybeSingle para la comprobación de duplicado
        (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: config.existingReservation ?? null,
          error: null,
        });
        // Override single para el resultado del insert
        if (config.insertResult) {
          (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(
            config.insertResult
          );
        } else {
          (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
            data: { id: "new-res-id" },
            error: null,
          });
        }
        return chain;
      }
      case "cessions":
        return createQueryChain({
          data: config.cessions ?? [],
          error: null,
        });
      case "visitor_reservations":
        return createQueryChain({
          data: config.visitorReservations ?? [],
          error: null,
        });
      default:
        return createQueryChain({ data: [], error: null });
    }
  });

  vi.mocked(createClient).mockResolvedValue({ from: mockFrom } as never);
  return mockFrom;
}

const UUID = "550e8400-e29b-41d4-a716-446655440000";

// ─── getAvailableSpotsForDate ─────────────────────────────────────────────────

describe("getAvailableSpotsForDate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(createMockAuthUser() as never);
  });

  // ── Fines de semana ────────────────────────────────────────────────────────

  it("devuelve success([]) el sábado sin consultar BD", async () => {
    // 2025-01-11 es sábado
    const result = await getAvailableSpotsForDate("2025-01-11");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual([]);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("devuelve success([]) el domingo sin consultar BD", async () => {
    // 2025-01-12 es domingo
    const result = await getAvailableSpotsForDate("2025-01-12");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual([]);
  });

  it("procesa normalmente el lunes", async () => {
    // 2025-01-13 es lunes
    setupSupabaseMock({
      spots: [createMockSpot({ id: "s1", type: "standard" })],
    });
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
    setupSupabaseMock({ spotsError: { message: "Error de conexión" } });
    const result = await getAvailableSpotsForDate("2025-03-17");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Error de conexión");
  });

  // ── Plazas estándar ────────────────────────────────────────────────────────

  it("excluye plazas sin propietario (nuevo modelo: solo cesiones son reservables)", async () => {
    // Spot sin assigned_to → no reservable, aunque esté activo y sin reservas
    const spot = createMockSpot({ id: "s1", type: "standard" });
    setupSupabaseMock({ spots: [spot] });

    const result = await getAvailableSpotsForDate("2025-03-17");

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(0);
  });

  it("excluye plazas estándar con reserva confirmada", async () => {
    const spot = createMockSpot({ id: "s1", type: "standard" });
    setupSupabaseMock({
      spots: [spot],
      reservations: [{ id: "r1", spot_id: "s1" }],
    });

    const result = await getAvailableSpotsForDate("2025-03-17");

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(0);
  });

  it("excluye plazas con reserva de visitante", async () => {
    const spot = createMockSpot({ id: "s1", type: "standard" });
    setupSupabaseMock({
      spots: [spot],
      visitorReservations: [{ id: "v1", spot_id: "s1" }],
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
    setupSupabaseMock({ spots: [spot] });

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
    setupSupabaseMock({
      spots: [spot],
      cessions: [{ id: "c1", spot_id: "sm", status: "available" }],
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
    setupSupabaseMock({
      spots: [spot],
      cessions: [{ id: "c1", spot_id: "sm", status: "reserved" }],
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
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(createMockAuthUser() as never);
  });

  it("crea la reserva y devuelve el id", async () => {
    setupSupabaseMock({ existingReservation: null });

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
    setupSupabaseMock({ existingReservation: { id: "existing-id" } });

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
    setupSupabaseMock({
      existingReservation: null,
      insertResult: {
        data: null,
        error: { message: "duplicate key value", code: "23505" },
      },
    });

    const result = await createReservation({
      spot_id: UUID,
      date: "2025-03-17",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("ya está reservada");
    }
  });

  it("falla con error genérico de BD si el código no es 23505", async () => {
    setupSupabaseMock({
      existingReservation: null,
      insertResult: {
        data: null,
        error: { message: "Connection timeout", code: "PGRST999" },
      },
    });

    const result = await createReservation({
      spot_id: UUID,
      date: "2025-03-17",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Connection timeout");
    }
  });

  it("rechaza spot_id inválido sin llamar a BD (validación Zod)", async () => {
    const result = await createReservation({
      spot_id: "no-es-uuid",
      date: "2025-03-17",
    });

    expect(result.success).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rechaza fecha con formato incorrecto (validación Zod)", async () => {
    const result = await createReservation({
      spot_id: UUID,
      date: "17/03/2025",
    });

    expect(result.success).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });
});

// ─── cancelReservation ────────────────────────────────────────────────────────

describe("cancelReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(createMockAuthUser() as never);
  });

  it("cancela la reserva con éxito", async () => {
    const mockFrom = vi.fn(() =>
      createQueryChain({ data: { cancelled: true }, error: null })
    );
    vi.mocked(createClient).mockResolvedValue({ from: mockFrom } as never);

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
    const mockFrom = vi.fn(() =>
      createQueryChain({
        data: null,
        error: { message: "Row not found or no permission" },
      })
    );
    vi.mocked(createClient).mockResolvedValue({ from: mockFrom } as never);

    const result = await cancelReservation({ id: UUID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Row not found or no permission");
    }
  });

  it("rechaza id no UUID sin llamar a BD (validación Zod)", async () => {
    const result = await cancelReservation({ id: "no-es-uuid" });

    expect(result.success).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });
});
