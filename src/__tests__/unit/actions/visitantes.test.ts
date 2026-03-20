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
  updateVisitorReservation,
} from "@/app/(dashboard)/parking/visitantes/actions";
import {
  mockDb,
  resetDbMocks,
  setupSelectMock,
  setupInsertMock,
  setupUpdateMock,
} from "../../mocks/db";
import { createMockAuthUser } from "../../mocks/factories";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/helpers", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/db", async () => {
  const { mockDb } = await import("../../mocks/db");
  return { db: mockDb };
});

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

vi.mock("@/lib/queries/active-entity", () => ({
  getEffectiveEntityId: vi.fn().mockResolvedValue(null),
}));

import { getCurrentUser } from "@/lib/auth/helpers";
import { getUpcomingVisitorReservations } from "@/lib/queries/visitor-reservations";
import { getEffectiveEntityId } from "@/lib/queries/active-entity";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VISITOR_ID = "550e8400-e29b-41d4-a716-446655440001";
const SPOT_ID = "550e8400-e29b-41d4-a716-446655440002";
const USER_ID = "550e8400-e29b-41d4-a716-446655440003";

const DEFAULT_VISITOR_ROW = {
  visitorEmail: "visitor@test.com",
  visitorName: "Visitante Test",
  visitorCompany: "Test Corp",
  date: "2026-04-15",
  spotId: SPOT_ID,
};

// ─── getVisitorReservationsAction ─────────────────────────────────────────────

describe("getVisitorReservationsAction", () => {
  beforeEach(() => {
    resetDbMocks();
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
    expect(getUpcomingVisitorReservations).toHaveBeenCalledWith(
      undefined,
      null
    );
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
    expect(getUpcomingVisitorReservations).toHaveBeenCalledWith(USER_ID, null);
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
    resetDbMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(createMockAuthUser() as never);
  });

  it("happy path: crea reserva y devuelve { id }", async () => {
    // 1. select spot
    setupSelectMock([
      {
        label: "V-01",
        entityId: null,
        type: "visitor",
        resourceType: "parking",
      },
    ]);
    // 2. insert visitor reservation
    setupInsertMock([{ id: VISITOR_ID }]);
    // 3. update notificationSent (non-blocking, called in try/catch)
    setupUpdateMock([]);

    const result = await createVisitorReservation(validInput);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.id).toBe(VISITOR_ID);
  });

  it("error 23505: plaza ya reservada ese día devuelve mensaje claro", async () => {
    // 1. select spot
    setupSelectMock([
      {
        label: "V-01",
        entityId: null,
        type: "visitor",
        resourceType: "parking",
      },
    ]);
    // 2. insert throws 23505
    mockDb.insert.mockImplementationOnce(() => {
      throw Object.assign(new Error("duplicate key"), { code: "23505" });
    });

    const result = await createVisitorReservation(validInput);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("ya tiene una reserva");
  });

  it("rechaza crear si el spot no es de tipo visitor", async () => {
    // 1. select spot → standard type
    setupSelectMock([
      {
        label: "P-01",
        entityId: null,
        type: "standard",
        resourceType: "parking",
      },
    ]);

    const result = await createVisitorReservation(validInput);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("plaza de visitantes");
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
    resetDbMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(createMockAuthUser() as never);
  });

  it("happy path: cancela y devuelve { cancelled: true }", async () => {
    // 1. select reservation
    setupSelectMock([DEFAULT_VISITOR_ROW]);
    // 2. select spot (for label)
    setupSelectMock([{ label: "V-01" }]);
    // 3. update reservation (cancel)
    setupUpdateMock([{ id: VISITOR_ID }]);

    const result = await cancelVisitorReservation(validInput);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cancelled).toBe(true);
  });

  it("lanza error si la reserva no se encuentra o no tiene permisos", async () => {
    // 1. select reservation → empty
    setupSelectMock([]);

    const result = await cancelVisitorReservation(validInput);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("no encontrada");
  });

  it("devuelve error si el usuario no está autenticado", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await cancelVisitorReservation(validInput);

    expect(result.success).toBe(false);
  });

  it("falla si la reserva fue cambiada y no se actualiza ninguna fila", async () => {
    // 1. select reservation → found
    setupSelectMock([DEFAULT_VISITOR_ROW]);
    // 2. select spot
    setupSelectMock([{ label: "V-01" }]);
    // 3. update returns empty (no rows affected)
    setupUpdateMock([]);

    const result = await cancelVisitorReservation(validInput);

    // The action checks if updatedRows.length === 0 and throws "ya cancelada"
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("ya cancelada");
  });
});

// ─── updateVisitorReservation ──────────────────────────────────────────────────

describe("updateVisitorReservation", () => {
  const validInput = {
    id: VISITOR_ID,
    spot_id: SPOT_ID,
    date: "2026-06-15",
    visitor_name: "Juan Visitante",
    visitor_company: "Empresa SA",
    visitor_email: "juan@empresa.com",
  };

  beforeEach(() => {
    resetDbMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(createMockAuthUser() as never);
    vi.mocked(getEffectiveEntityId).mockResolvedValue(null);
  });

  it("happy path: spot con entity_id null actualiza sin error", async () => {
    // 1. select spot
    setupSelectMock([
      {
        label: "V-01",
        entityId: null,
        type: "visitor",
        resourceType: "parking",
      },
    ]);
    // 2. update visitor reservation
    setupUpdateMock([{ id: VISITOR_ID }]);
    // 3. update notificationSent (non-blocking)
    setupUpdateMock([]);

    const result = await updateVisitorReservation(validInput);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveProperty("id", VISITOR_ID);
  });

  it("rechaza si el spot pertenece a una sede distinta a la activa", async () => {
    vi.mocked(getEffectiveEntityId).mockResolvedValue("entity-A");
    // 1. select spot with different entityId
    setupSelectMock([
      {
        label: "V-02",
        entityId: "entity-B",
        type: "visitor",
        resourceType: "parking",
      },
    ]);

    const result = await updateVisitorReservation(validInput);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("sede activa");
  });

  it("rechaza editar si el spot no es de tipo visitor", async () => {
    // 1. select spot → standard type
    setupSelectMock([
      {
        label: "P-01",
        entityId: null,
        type: "standard",
        resourceType: "parking",
      },
    ]);

    const result = await updateVisitorReservation(validInput);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("plaza de visitantes");
  });
});
