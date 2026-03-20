import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ db: mockDb }));

import { mockDb, resetDbMocks, setupSelectMock } from "../../mocks/db";
import {
  getUpcomingVisitorReservations,
  getAvailableVisitorSpotsForDate,
} from "@/lib/queries/visitor-reservations";

// ─── Helpers de datos en camelCase (formato Drizzle) ─────────────────────────

/**
 * Shape returned by getUpcomingVisitorReservations Drizzle select:
 * { id, spotId, reservedBy, date, visitorName, visitorCompany, visitorEmail,
 *   status, notificationSent, notes, createdAt, updatedAt,
 *   spot_label, spot_entity_id, reserved_by_name }
 */
function makeVisitorJoinRow(overrides?: Record<string, unknown>) {
  return {
    id: "vis-1",
    spotId: "spot-1",
    reservedBy: "user-1",
    date: "2026-04-01",
    visitorName: "Visitante Test",
    visitorCompany: "",
    visitorEmail: "",
    status: "confirmed",
    notificationSent: false,
    notes: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    spot_label: "V-01",
    spot_entity_id: null,
    reserved_by_name: "Test User",
    ...overrides,
  };
}

describe("getUpcomingVisitorReservations", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  // getUpcomingVisitorReservations makes 1 select (join query)
  // then filters in JS by entityId

  it("empty result → returns []", async () => {
    setupSelectMock([]);

    const result = await getUpcomingVisitorReservations();
    expect(result).toEqual([]);
  });

  it("2 rows, no entityId → returns both mapped with spot_label and reserved_by_name", async () => {
    setupSelectMock([
      makeVisitorJoinRow({
        id: "vis-1",
        spot_label: "V-01",
        spot_entity_id: null,
        reserved_by_name: "User One",
      }),
      makeVisitorJoinRow({
        id: "vis-2",
        spot_label: "V-02",
        spot_entity_id: "ent-1",
        reserved_by_name: "User Two",
      }),
    ]);

    const result = await getUpcomingVisitorReservations();
    expect(result).toHaveLength(2);
    expect(result[0]?.spot_label).toBe("V-01");
    expect(result[0]?.reserved_by_name).toBe("User One");
    expect(result[1]?.spot_label).toBe("V-02");
    expect(result[1]?.reserved_by_name).toBe("User Two");
  });

  it("entityId filter: row with matching entity_id → included", async () => {
    setupSelectMock([
      makeVisitorJoinRow({ id: "vis-1", spot_entity_id: "ent-target" }),
    ]);

    const result = await getUpcomingVisitorReservations(
      undefined,
      "ent-target"
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("vis-1");
  });

  it("entityId filter: row with null entity_id → included (global spots)", async () => {
    setupSelectMock([
      makeVisitorJoinRow({ id: "vis-1", spot_entity_id: null }),
    ]);

    const result = await getUpcomingVisitorReservations(
      undefined,
      "ent-target"
    );
    expect(result).toHaveLength(1);
  });

  it("entityId filter: row with other entity_id → excluded", async () => {
    setupSelectMock([
      makeVisitorJoinRow({ id: "vis-1", spot_entity_id: "ent-other" }),
    ]);

    const result = await getUpcomingVisitorReservations(
      undefined,
      "ent-target"
    );
    expect(result).toHaveLength(0);
  });

  it("entityId filter: mixed rows → returns only matching and null entity_id", async () => {
    setupSelectMock([
      makeVisitorJoinRow({ id: "vis-1", spot_entity_id: "ent-target" }),
      makeVisitorJoinRow({ id: "vis-2", spot_entity_id: null }),
      makeVisitorJoinRow({ id: "vis-3", spot_entity_id: "ent-other" }),
    ]);

    const result = await getUpcomingVisitorReservations(
      undefined,
      "ent-target"
    );
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(["vis-1", "vis-2"]);
  });

  it("DB error → throws", async () => {
    vi.mocked(mockDb.select).mockImplementationOnce(() => {
      throw new Error("No se pudieron obtener las reservas de visitantes");
    });

    await expect(getUpcomingVisitorReservations()).rejects.toThrow(
      "No se pudieron obtener las reservas de visitantes"
    );
  });

  it("userId filter → query is called and returns results", async () => {
    setupSelectMock([]); // userId filter passed to query, returns empty

    const result = await getUpcomingVisitorReservations("user-specific-123");
    expect(result).toEqual([]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("row with null reserved_by_name → mapped with empty string", async () => {
    setupSelectMock([
      makeVisitorJoinRow({
        id: "vis-1",
        spot_label: "",
        reserved_by_name: null,
      }),
    ]);

    const result = await getUpcomingVisitorReservations();
    expect(result[0]?.spot_label).toBe("");
    expect(result[0]?.reserved_by_name).toBe("");
  });
});

describe("getAvailableVisitorSpotsForDate", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  // getAvailableVisitorSpotsForDate makes 2 parallel selects:
  // 1. spots → { id, label }
  // 2. visitor_reservations → { spotId }

  it("all spots available → returns all spots", async () => {
    setupSelectMock([
      { id: "spot-1", label: "V-01" },
      { id: "spot-2", label: "V-02" },
    ]); // spots
    setupSelectMock([]); // no reserved spots

    const result = await getAvailableVisitorSpotsForDate("2026-04-01");
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("spot-1");
    expect(result[1]?.id).toBe("spot-2");
  });

  it("1 spot reserved → excludes it, returns remaining spots", async () => {
    setupSelectMock([
      { id: "spot-1", label: "V-01" },
      { id: "spot-2", label: "V-02" },
    ]);
    setupSelectMock([{ spotId: "spot-1" }]); // spot-1 reserved

    const result = await getAvailableVisitorSpotsForDate("2026-04-01");
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("spot-2");
  });

  it("all spots reserved → returns []", async () => {
    setupSelectMock([
      { id: "spot-1", label: "V-01" },
      { id: "spot-2", label: "V-02" },
    ]);
    setupSelectMock([{ spotId: "spot-1" }, { spotId: "spot-2" }]);

    const result = await getAvailableVisitorSpotsForDate("2026-04-01");
    expect(result).toHaveLength(0);
  });

  it("no spots in DB → returns []", async () => {
    setupSelectMock([]); // no spots
    setupSelectMock([]); // no reserved

    const result = await getAvailableVisitorSpotsForDate("2026-04-01");
    expect(result).toEqual([]);
  });

  it("spots query error → throws", async () => {
    vi.mocked(mockDb.select).mockImplementationOnce(() => {
      throw new Error("No se pudieron obtener las plazas de visitantes");
    });

    await expect(getAvailableVisitorSpotsForDate("2026-04-01")).rejects.toThrow(
      "No se pudieron obtener las plazas de visitantes"
    );
  });

  it("reserved query error → throws", async () => {
    // First select (spots) succeeds
    setupSelectMock([{ id: "spot-1", label: "V-01" }]);
    // Second select (reserved) throws
    vi.mocked(mockDb.select).mockImplementationOnce(() => {
      throw new Error("No se pudieron obtener las plazas de visitantes");
    });

    await expect(getAvailableVisitorSpotsForDate("2026-04-01")).rejects.toThrow(
      "No se pudieron obtener las plazas de visitantes"
    );
  });

  it("excludeReservationId → still calls DB and returns available spots", async () => {
    setupSelectMock([{ id: "spot-1", label: "V-01" }]);
    setupSelectMock([]); // no reserved spots

    const result = await getAvailableVisitorSpotsForDate(
      "2026-04-01",
      "exclude-this-res-id"
    );
    expect(result).toHaveLength(1);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("with entityId → returns spots matching entity filter", async () => {
    setupSelectMock([{ id: "spot-1", label: "V-01" }]);
    setupSelectMock([]);

    const result = await getAvailableVisitorSpotsForDate(
      "2026-04-01",
      undefined,
      "ent-1"
    );
    expect(result).toHaveLength(1);
    expect(mockDb.select).toHaveBeenCalled();
  });
});
