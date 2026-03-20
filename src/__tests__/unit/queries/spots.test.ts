/**
 * Tests de Queries de Plazas (spots.ts)
 *
 * Verifica la lógica de estados calculados de getSpotsByDate:
 * - free: plaza estándar sin reservas
 * - reserved: plaza con reserva confirmada de empleado
 * - visitor-blocked: plaza con reserva de visitante (máxima prioridad)
 * - occupied: plaza de dirección sin cesión activa
 * - ceded: plaza de dirección cedida y disponible
 * - (reserved vía cesión): plaza de dirección cedida y ya reservada
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ db: mockDb }));

import { mockDb, resetDbMocks, setupSelectMock } from "../../mocks/db";
import { getSpots, getSpotsByDate } from "@/lib/queries/spots";

// ─── Helpers de datos en camelCase (formato Drizzle) ─────────────────────────

function makeSpot(overrides?: Record<string, unknown>) {
  return {
    id: "spot-00000000-0000-0000-0000-000000000001",
    label: "A-01",
    type: "standard",
    assignedTo: null,
    resourceType: "parking",
    isActive: true,
    positionX: 10,
    positionY: 20,
    entityId: null,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  };
}

// Shapes returned by getSpotsByDate parallel queries:
// Query 2: { id, spotId, userId, fullName }
function makeReservationRow(overrides?: Record<string, unknown>) {
  return {
    id: "res-00000000-0000-0000-0000-000000000001",
    spotId: "spot-00000000-0000-0000-0000-000000000001",
    userId: "user-00000000-0000-0000-0000-000000000001",
    fullName: "Usuario Test",
    ...overrides,
  };
}

// Query 3: { id, spotId, status }
function makeCessionRow(overrides?: Record<string, unknown>) {
  return {
    id: "ces-00000000-0000-0000-0000-000000000001",
    spotId: "spot-00000000-0000-0000-0000-000000000001",
    status: "available",
    ...overrides,
  };
}

// Query 4: { id, spotId, visitorName }
function makeVisitorRow(overrides?: Record<string, unknown>) {
  return {
    id: "vis-00000000-0000-0000-0000-000000000001",
    spotId: "spot-00000000-0000-0000-0000-000000000001",
    visitorName: "Visitante Test",
    ...overrides,
  };
}

const DATE = "2025-03-15";

// ─── getSpots ─────────────────────────────────────────────────────────────────

describe("getSpots", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("devuelve las plazas activas", async () => {
    setupSelectMock([makeSpot({ label: "A-01" })]);

    const result = await getSpots();

    expect(result).toHaveLength(1);
    expect(result[0]?.label).toBe("A-01");
  });

  it("devuelve array vacío si no hay plazas", async () => {
    setupSelectMock([]);
    const result = await getSpots();
    expect(result).toEqual([]);
  });

  it("con entityId incluye plazas de la sede y globales", async () => {
    setupSelectMock([
      makeSpot({ id: "s1", entityId: "ent-1" }),
      makeSpot({ id: "s2", entityId: null }),
    ]);

    const result = await getSpots(undefined, false, "ent-1");

    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("lanza error si la query falla", async () => {
    vi.mocked(mockDb.select).mockImplementationOnce(() => {
      throw new Error("DB error");
    });
    await expect(getSpots()).rejects.toThrow(
      "No se pudieron obtener las plazas"
    );
  });
});

// ─── getSpotsByDate ───────────────────────────────────────────────────────────

describe("getSpotsByDate", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  // ── Plaza estándar libre ────────────────────────────────────────────────────

  it("devuelve estado 'free' para plaza estándar sin reservas", async () => {
    // getSpotsByDate makes 4 parallel selects via Promise.all:
    // 1. spots, 2. reservations+profiles join, 3. cessions, 4. visitor_reservations
    setupSelectMock([
      makeSpot({ id: "spot-1", type: "standard", assignedTo: null }),
    ]);
    setupSelectMock([]); // reservations
    setupSelectMock([]); // cessions
    setupSelectMock([]); // visitor_reservations

    const result = await getSpotsByDate(DATE);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "spot-1",
      status: "free",
      reservation_id: undefined,
      reserved_by_name: undefined,
    });
  });

  // ── Plaza estándar reservada ────────────────────────────────────────────────

  it("devuelve estado 'reserved' para plaza con reserva confirmada", async () => {
    setupSelectMock([
      makeSpot({ id: "spot-1", type: "standard", assignedTo: null }),
    ]);
    setupSelectMock([
      makeReservationRow({
        id: "res-1",
        spotId: "spot-1",
        fullName: "Ana Pérez",
      }),
    ]);
    setupSelectMock([]); // cessions
    setupSelectMock([]); // visitor_reservations

    const result = await getSpotsByDate(DATE);

    expect(result[0]).toMatchObject({
      status: "reserved",
      reservation_id: "res-1",
      reserved_by_name: "Ana Pérez",
    });
  });

  it("devuelve reserved_by_name undefined si el perfil fullName es null", async () => {
    setupSelectMock([
      makeSpot({ id: "spot-1", type: "standard", assignedTo: null }),
    ]);
    setupSelectMock([makeReservationRow({ spotId: "spot-1", fullName: null })]);
    setupSelectMock([]);
    setupSelectMock([]);

    const result = await getSpotsByDate(DATE);

    expect(result[0]?.reserved_by_name).toBeUndefined();
  });

  // ── Plaza con reserva de visitante ─────────────────────────────────────────

  it("devuelve estado 'visitor-blocked' para plaza con reserva de visitante", async () => {
    setupSelectMock([
      makeSpot({ id: "spot-1", type: "standard", assignedTo: null }),
    ]);
    setupSelectMock([]); // reservations
    setupSelectMock([]); // cessions
    setupSelectMock([
      makeVisitorRow({
        id: "vis-1",
        spotId: "spot-1",
        visitorName: "Visitante Externo",
      }),
    ]);

    const result = await getSpotsByDate(DATE);

    expect(result[0]).toMatchObject({
      status: "visitor-blocked",
      reservation_id: "vis-1",
      reserved_by_name: "Visitante Externo",
    });
  });

  it("visitante tiene prioridad sobre reserva de empleado en la misma plaza", async () => {
    setupSelectMock([
      makeSpot({ id: "spot-1", type: "standard", assignedTo: null }),
    ]);
    setupSelectMock([makeReservationRow({ spotId: "spot-1" })]);
    setupSelectMock([]);
    setupSelectMock([
      makeVisitorRow({
        id: "vis-priority",
        spotId: "spot-1",
        visitorName: "Visitante Prioritario",
      }),
    ]);

    const result = await getSpotsByDate(DATE);

    expect(result[0]?.status).toBe("visitor-blocked");
    expect(result[0]?.reservation_id).toBe("vis-priority");
  });

  // ── Plaza asignada sin cesión ──────────────────────────────────────────────────────────

  it("devuelve estado 'occupied' para plaza asignada sin cesión", async () => {
    setupSelectMock([
      makeSpot({
        id: "spot-mgmt",
        type: "standard",
        assignedTo: "owner-00000000-0000-0000-0000-000000000001",
      }),
    ]);
    setupSelectMock([]); // reservations
    setupSelectMock([]); // cessions
    setupSelectMock([]); // visitor_reservations

    const result = await getSpotsByDate(DATE);

    expect(result[0]).toMatchObject({
      status: "occupied",
      reservation_id: undefined,
    });
  });

  // ── Plaza asignada cedida disponible ──────────────────────────────────────────

  it("devuelve estado 'ceded' para plaza asignada con cesión 'available'", async () => {
    setupSelectMock([
      makeSpot({
        id: "spot-mgmt",
        type: "standard",
        assignedTo: "owner-00000000-0000-0000-0000-000000000001",
      }),
    ]);
    setupSelectMock([]); // reservations
    setupSelectMock([
      makeCessionRow({ id: "ces-1", spotId: "spot-mgmt", status: "available" }),
    ]);
    setupSelectMock([]);

    const result = await getSpotsByDate(DATE);

    expect(result[0]).toMatchObject({
      status: "ceded",
      reservation_id: "ces-1",
    });
  });

  // ── Plaza asignada cedida y ya reservada ────────────────────────────────────────

  it("devuelve estado 'reserved' para plaza asignada con cesión 'reserved'", async () => {
    setupSelectMock([
      makeSpot({
        id: "spot-mgmt",
        type: "standard",
        assignedTo: "owner-00000000-0000-0000-0000-000000000001",
      }),
    ]);
    setupSelectMock([]); // reservations
    setupSelectMock([
      makeCessionRow({ id: "ces-1", spotId: "spot-mgmt", status: "reserved" }),
    ]);
    setupSelectMock([]);

    const result = await getSpotsByDate(DATE);

    expect(result[0]).toMatchObject({
      status: "reserved",
      reservation_id: "ces-1",
    });
  });

  // ── Plaza visitor sin reservas ────────────────────────────────────────────
  // Las plazas de visitas (parking) y flexibles (oficina) deben ser siempre
  // "free" independientemente de assigned_to, salvo reserva activa.

  it("devuelve 'free' para plaza visitor sin reservas (parking)", async () => {
    setupSelectMock([
      makeSpot({ id: "spot-visitor", type: "visitor", assignedTo: null }),
    ]);
    setupSelectMock([]);
    setupSelectMock([]);
    setupSelectMock([]);

    const result = await getSpotsByDate(DATE);

    expect(result[0]).toMatchObject({ id: "spot-visitor", status: "free" });
  });

  it("devuelve 'free' para plaza visitor/flexible en oficina sin reservas", async () => {
    setupSelectMock([
      makeSpot({
        id: "spot-flex",
        type: "visitor",
        assignedTo: null,
        resourceType: "office",
      }),
    ]);
    setupSelectMock([]);
    setupSelectMock([]);
    setupSelectMock([]);

    const result = await getSpotsByDate(DATE, "office");

    expect(result[0]).toMatchObject({ id: "spot-flex", status: "free" });
  });

  it("devuelve 'reserved' para plaza visitor con reserva confirmada", async () => {
    setupSelectMock([
      makeSpot({ id: "spot-visitor", type: "visitor", assignedTo: null }),
    ]);
    setupSelectMock([
      makeReservationRow({ id: "res-v", spotId: "spot-visitor" }),
    ]);
    setupSelectMock([]);
    setupSelectMock([]);

    const result = await getSpotsByDate(DATE);

    expect(result[0]).toMatchObject({
      status: "reserved",
      reservation_id: "res-v",
    });
  });

  it("devuelve 'visitor-blocked' para plaza visitor con reserva de visitante externo", async () => {
    setupSelectMock([
      makeSpot({ id: "spot-visitor", type: "visitor", assignedTo: null }),
    ]);
    setupSelectMock([]);
    setupSelectMock([]);
    setupSelectMock([
      makeVisitorRow({
        id: "vis-ext",
        spotId: "spot-visitor",
        visitorName: "Carlos Externo",
      }),
    ]);

    const result = await getSpotsByDate(DATE);

    expect(result[0]).toMatchObject({
      status: "visitor-blocked",
      reservation_id: "vis-ext",
      reserved_by_name: "Carlos Externo",
    });
  });

  // ── Visitante en plaza asignada ──────────────────────────────────────────────────

  it("visitante en plaza asignada tiene prioridad sobre la lógica de cesión", async () => {
    setupSelectMock([
      makeSpot({
        id: "spot-mgmt",
        type: "standard",
        assignedTo: "owner-00000000-0000-0000-0000-000000000001",
      }),
    ]);
    setupSelectMock([]);
    setupSelectMock([
      makeCessionRow({ spotId: "spot-mgmt", status: "available" }),
    ]);
    setupSelectMock([makeVisitorRow({ id: "vis-mgmt", spotId: "spot-mgmt" })]);

    const result = await getSpotsByDate(DATE);

    expect(result[0]?.status).toBe("visitor-blocked");
  });

  // ── Múltiples plazas ──────────────────────────────────────────────────────

  it("calcula el estado de cada plaza de forma independiente", async () => {
    setupSelectMock([
      makeSpot({ id: "spot-free", type: "standard", assignedTo: null }),
      makeSpot({ id: "spot-reserved", type: "standard", assignedTo: null }),
      makeSpot({
        id: "spot-mgmt",
        type: "standard",
        assignedTo: "owner-00000000-0000-0000-0000-000000000001",
      }),
    ]);
    setupSelectMock([makeReservationRow({ spotId: "spot-reserved" })]);
    setupSelectMock([]);
    setupSelectMock([]);

    const result = await getSpotsByDate(DATE);
    const byId = Object.fromEntries(result.map((s) => [s.id, s.status]));

    expect(byId["spot-free"]).toBe("free");
    expect(byId["spot-reserved"]).toBe("reserved");
    expect(byId["spot-mgmt"]).toBe("occupied");
  });

  // ── Error de DB ─────────────────────────────────────────────────────────────

  it("lanza error si la query de plazas falla", async () => {
    vi.mocked(mockDb.select).mockImplementationOnce(() => {
      throw new Error("Error de base de datos");
    });
    await expect(getSpotsByDate(DATE)).rejects.toThrow(
      "Error de base de datos"
    );
  });

  // ── Mapeo de campos ────────────────────────────────────────────────────────

  it("mapea correctamente los campos de la plaza al resultado", async () => {
    setupSelectMock([
      makeSpot({
        id: "spot-map",
        label: "B-05",
        type: "visitor",
        assignedTo: "user-abc",
        positionX: 100,
        positionY: 200,
      }),
    ]);
    setupSelectMock([]);
    setupSelectMock([]);
    setupSelectMock([]);

    const result = await getSpotsByDate(DATE);

    expect(result[0]).toMatchObject({
      id: "spot-map",
      label: "B-05",
      type: "visitor",
      assigned_to: "user-abc",
      position_x: 100,
      position_y: 200,
    });
  });
});
