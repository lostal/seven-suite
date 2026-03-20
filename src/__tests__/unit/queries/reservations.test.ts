/**
 * Tests de Queries de Reservas (reservations.ts)
 *
 * Verifica la lógica de mapeo y consulta de:
 * - getReservationsByDate: reservas del día con detalle de plaza y usuario
 * - getUserReservations: reservas futuras de un usuario
 * - getUserReservationForDate: comprobación de reserva existente en una fecha
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ db: mockDb }));

import { mockDb, resetDbMocks, setupSelectMock } from "../../mocks/db";
import {
  getReservationsByDate,
  getUserReservations,
  getUserReservationForDate,
} from "@/lib/queries/reservations";

const DATE = "2025-03-15";
const USER_ID = "user-00000000-0000-0000-0000-000000000001";

// ─── Helpers de datos en camelCase (formato Drizzle) ─────────────────────────

/**
 * Shape returned by getReservationsByDate / getUserReservations Drizzle select:
 * { id, spot_id, user_id, date, status, notes, start_time, end_time, created_at,
 *   updated_at, spot_label, spot_resource_type, spot_entity_id, user_name }
 */
function makeReservationJoinRow(overrides?: Record<string, unknown>) {
  return {
    id: "res-00000000-0000-0000-0000-000000000001",
    spot_id: "spot-00000000-0000-0000-0000-000000000001",
    user_id: USER_ID,
    date: DATE,
    status: "confirmed",
    notes: null,
    start_time: null,
    end_time: null,
    created_at: new Date("2025-01-01T10:00:00Z"),
    updated_at: new Date("2025-01-01T10:00:00Z"),
    spot_label: "A-01",
    spot_resource_type: "parking",
    spot_entity_id: null,
    user_name: "Usuario Test",
    ...overrides,
  };
}

// ─── getReservationsByDate ────────────────────────────────────────────────────

describe("getReservationsByDate", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("devuelve array vacío si no hay reservas", async () => {
    setupSelectMock([]);
    const result = await getReservationsByDate(DATE);
    expect(result).toEqual([]);
  });

  it("mapea correctamente spot_label desde el join de plazas", async () => {
    setupSelectMock([
      makeReservationJoinRow({
        spot_label: "B-03",
        spot_resource_type: "parking",
        spot_entity_id: null,
      }),
    ]);

    const result = await getReservationsByDate(DATE);

    expect(result).toHaveLength(1);
    expect(result[0]?.spot_label).toBe("B-03");
  });

  it("mapea correctamente user_name desde el join de perfiles", async () => {
    setupSelectMock([makeReservationJoinRow({ user_name: "María López" })]);

    const result = await getReservationsByDate(DATE);

    expect(result[0]?.user_name).toBe("María López");
  });

  it("usa cadena vacía como fallback si user_name es null", async () => {
    setupSelectMock([makeReservationJoinRow({ user_name: null })]);

    const result = await getReservationsByDate(DATE);

    expect(result[0]?.user_name).toBe("");
  });

  it("el resultado incluye spot_label y user_name", async () => {
    setupSelectMock([
      makeReservationJoinRow({ spot_label: "A-01", user_name: "Test" }),
    ]);

    const result = await getReservationsByDate(DATE);

    expect(result[0]?.spot_label).toBe("A-01");
    expect(result[0]?.user_name).toBe("Test");
    expect(Object.keys(result[0] as object)).not.toContain("spots_raw");
  });

  it("preserva los campos base de la reserva", async () => {
    setupSelectMock([
      makeReservationJoinRow({
        id: "res-123",
        spot_id: "spot-456",
        user_id: USER_ID,
        date: DATE,
        status: "confirmed",
      }),
    ]);

    const result = await getReservationsByDate(DATE);

    expect(result[0]).toMatchObject({
      id: "res-123",
      spot_id: "spot-456",
      user_id: USER_ID,
      date: DATE,
      status: "confirmed",
    });
  });

  it("lanza error si la query falla", async () => {
    vi.mocked(mockDb.select).mockImplementationOnce(() => {
      throw new Error("No se pudieron obtener las reservas");
    });
    await expect(getReservationsByDate(DATE)).rejects.toThrow(
      "No se pudieron obtener las reservas"
    );
  });

  it("con entityId filtra por sede (entity_id matching o null)", async () => {
    setupSelectMock([
      makeReservationJoinRow({ id: "r1", spot_entity_id: "ent-1" }),
      makeReservationJoinRow({ id: "r2", spot_entity_id: null }),
      makeReservationJoinRow({ id: "r3", spot_entity_id: "ent-2" }),
    ]);

    const result = await getReservationsByDate(DATE, undefined, "ent-1");

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("devuelve múltiples reservas mapeadas", async () => {
    setupSelectMock([
      makeReservationJoinRow({
        id: "r1",
        spot_label: "A-01",
        user_name: "Ana",
      }),
      makeReservationJoinRow({
        id: "r2",
        spot_label: "B-02",
        user_name: "Luis",
      }),
    ]);

    const result = await getReservationsByDate(DATE);

    expect(result).toHaveLength(2);
    expect(result[0]?.spot_label).toBe("A-01");
    expect(result[1]?.spot_label).toBe("B-02");
  });
});

// ─── getUserReservations ──────────────────────────────────────────────────────

describe("getUserReservations", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("devuelve array vacío si no hay reservas futuras", async () => {
    setupSelectMock([]);
    const result = await getUserReservations(USER_ID);
    expect(result).toEqual([]);
  });

  it("mapea spot_label y user_name correctamente", async () => {
    setupSelectMock([
      makeReservationJoinRow({
        spot_label: "C-05",
        spot_resource_type: "parking",
        user_name: "Pedro García",
      }),
    ]);

    const result = await getUserReservations(USER_ID);

    expect(result[0]?.spot_label).toBe("C-05");
    expect(result[0]?.user_name).toBe("Pedro García");
  });

  it("lanza error si la query falla", async () => {
    vi.mocked(mockDb.select).mockImplementationOnce(() => {
      throw new Error("No se pudieron obtener las reservas del usuario");
    });
    await expect(getUserReservations(USER_ID)).rejects.toThrow(
      "No se pudieron obtener las reservas del usuario"
    );
  });

  it("con entityId aplica mismo criterio (sede + global)", async () => {
    setupSelectMock([
      makeReservationJoinRow({
        id: "r1",
        spot_resource_type: "office",
        spot_entity_id: "ent-1",
      }),
      makeReservationJoinRow({
        id: "r2",
        spot_resource_type: "office",
        spot_entity_id: null,
      }),
      makeReservationJoinRow({
        id: "r3",
        spot_resource_type: "office",
        spot_entity_id: "ent-2",
      }),
    ]);

    const result = await getUserReservations(USER_ID, "office", "ent-1");

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(["r1", "r2"]);
  });
});

// ─── getUserReservationForDate ────────────────────────────────────────────────

describe("getUserReservationForDate", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("devuelve la reserva si existe", async () => {
    const row = makeReservationJoinRow({
      id: "res-exists",
      user_id: USER_ID,
      date: DATE,
    });
    // Without resourceType: 1 select call
    setupSelectMock([row]);

    const result = await getUserReservationForDate(USER_ID, DATE);

    expect(result).not.toBeNull();
    expect(result?.id).toBe("res-exists");
  });

  it("devuelve null si no existe reserva", async () => {
    setupSelectMock([]);

    const result = await getUserReservationForDate(USER_ID, DATE);

    expect(result).toBeNull();
  });

  it("lanza error si la query falla", async () => {
    vi.mocked(mockDb.select).mockImplementationOnce(() => {
      throw new Error("No se pudo comprobar la reserva");
    });

    await expect(getUserReservationForDate(USER_ID, DATE)).rejects.toThrow(
      "No se pudo comprobar la reserva"
    );
  });

  it("con resourceType: devuelve null si no hay plazas del tipo", async () => {
    // First select: spot IDs — empty
    setupSelectMock([]);

    const result = await getUserReservationForDate(USER_ID, DATE, "parking");

    expect(result).toBeNull();
  });

  it("con resourceType: devuelve la reserva si existe", async () => {
    // First select: spot IDs
    setupSelectMock([{ id: "spot-park-1" }]);
    // Second select: reservation
    setupSelectMock([
      makeReservationJoinRow({ id: "res-park", user_id: USER_ID, date: DATE }),
    ]);

    const result = await getUserReservationForDate(USER_ID, DATE, "parking");

    expect(result?.id).toBe("res-park");
  });
});
