/**
 * Tests de Server Actions de Visitantes
 *
 * Cubre:
 * - getVisitorReservationsAction: autenticación, filtrado por rol
 * - createVisitorReservation: happy path, error de duplicado
 * - cancelVisitorReservation: happy path, reserva no encontrada
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getVisitorReservationsAction,
  createVisitorReservation,
  cancelVisitorReservation,
} from "@/app/(dashboard)/parking/visitantes/actions";
import { createQueryChain } from "../../mocks/supabase";
import { createMockAuthUser } from "../../mocks/factories";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/queries/visitor-reservations", () => ({
  getUpcomingVisitorReservations: vi.fn().mockResolvedValue([]),
  getAvailableVisitorSpotsForDate: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/config", () => ({
  getResourceConfig: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/email", () => ({
  sendVisitorReservationEmail: vi.fn().mockResolvedValue(undefined),
  sendVisitorCancellationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/calendar", () => ({
  generateICSBuffer: vi.fn().mockReturnValue(Buffer.from("")),
  generateCancellationICSBuffer: vi.fn().mockReturnValue(Buffer.from("")),
  generateGoogleCalendarUrl: vi
    .fn()
    .mockReturnValue("https://calendar.google.com"),
  generateOutlookUrl: vi.fn().mockReturnValue("https://outlook.com"),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getUpcomingVisitorReservations } from "@/lib/queries/visitor-reservations";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VISITOR_ID = "550e8400-e29b-41d4-a716-446655440001";
const SPOT_ID = "550e8400-e29b-41d4-a716-446655440002";
const USER_ID = "550e8400-e29b-41d4-a716-446655440003";

const DEFAULT_VISITOR = {
  visitor_email: "visitor@test.com",
  visitor_name: "Visitante Test",
  visitor_company: "Test Corp",
  date: "2026-04-15",
  spots: { label: "V-01" },
};

function setupSupabaseMock(
  opts: {
    insertResult?: {
      data: { id: string } | null;
      error: { message: string; code?: string } | null;
    };
    visitorFetchData?: typeof DEFAULT_VISITOR | null;
  } = {}
) {
  // Chain compartido para spots (solo necesita maybeSingle para el label)
  const spotsChain = createQueryChain({ data: null, error: null });
  (spotsChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: { label: "V-01" },
    error: null,
  });

  // Chain para visitor_reservations
  const insertResult = opts.insertResult ?? {
    data: { id: VISITOR_ID },
    error: null,
  };
  const fetchData =
    "visitorFetchData" in opts ? opts.visitorFetchData : DEFAULT_VISITOR;
  const visitorChain = createQueryChain({ data: null, error: null });
  (visitorChain.single as ReturnType<typeof vi.fn>).mockResolvedValue(
    insertResult
  );
  (visitorChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: fetchData,
    error: null,
  });

  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn((table: string) =>
      table === "spots" ? spotsChain : visitorChain
    ),
  } as never);
}

// ─── getVisitorReservationsAction ─────────────────────────────────────────────

describe("getVisitorReservationsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve success:false si no hay usuario autenticado", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await getVisitorReservationsAction();

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("autenticado");
  });

  it("admin recibe todas las reservas sin filtro de usuario", async () => {
    const mockReservations = [
      { id: VISITOR_ID, spot_label: "V-01", reserved_by_name: "Emp 1" },
    ];
    vi.mocked(getCurrentUser).mockResolvedValue(
      createMockAuthUser({ profile: { role: "admin" } }) as never
    );
    vi.mocked(getUpcomingVisitorReservations).mockResolvedValue(
      mockReservations as never
    );

    const result = await getVisitorReservationsAction();

    expect(result.success).toBe(true);
    // Admin: se llama sin userId (undefined)
    expect(getUpcomingVisitorReservations).toHaveBeenCalledWith(undefined);
    if (result.success) expect(result.data).toEqual(mockReservations);
  });

  it("empleado solo recibe sus propias reservas (filtro por userId)", async () => {
    const user = createMockAuthUser({
      id: USER_ID,
      profile: { role: "employee" },
    });
    vi.mocked(getCurrentUser).mockResolvedValue(user as never);
    vi.mocked(getUpcomingVisitorReservations).mockResolvedValue([]);

    const result = await getVisitorReservationsAction();

    expect(result.success).toBe(true);
    // Empleado: se llama con su propio userId
    expect(getUpcomingVisitorReservations).toHaveBeenCalledWith(USER_ID);
  });
});

// ─── createVisitorReservation ──────────────────────────────────────────────────

describe("createVisitorReservation", () => {
  const validInput = {
    spot_id: SPOT_ID,
    date: "2026-06-15",
    visitor_name: "Juan Visitante",
    visitor_company: "Empresa SA",
    visitor_email: "juan@empresa.com",
    notes: undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(createMockAuthUser() as never);
  });

  it("happy path: crea reserva y devuelve { id }", async () => {
    setupSupabaseMock();

    const result = await createVisitorReservation(validInput);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.id).toBe(VISITOR_ID);
  });

  it("error 23505: plaza ya reservada ese día devuelve mensaje claro", async () => {
    setupSupabaseMock({
      insertResult: {
        data: null,
        error: { message: "duplicate key", code: "23505" },
      },
    });

    const result = await createVisitorReservation(validInput);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("ya tiene una reserva");
  });

  it("devuelve error si el usuario no está autenticado", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await createVisitorReservation(validInput);

    expect(result.success).toBe(false);
  });
});

// ─── cancelVisitorReservation ──────────────────────────────────────────────────

describe("cancelVisitorReservation", () => {
  const validInput = { id: VISITOR_ID };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(createMockAuthUser() as never);
  });

  it("happy path: cancela y devuelve { cancelled: true }", async () => {
    setupSupabaseMock();

    const result = await cancelVisitorReservation(validInput);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cancelled).toBe(true);
  });

  it("lanza error si la reserva no se encuentra o no tiene permisos", async () => {
    setupSupabaseMock({ visitorFetchData: null });

    const result = await cancelVisitorReservation(validInput);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("no encontrada");
  });

  it("devuelve error si el usuario no está autenticado", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await cancelVisitorReservation(validInput);

    expect(result.success).toBe(false);
  });
});
