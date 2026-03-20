import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ db: mockDb }));

import { mockDb, resetDbMocks, setupSelectMock } from "../../mocks/db";
import {
  getOfficeSpots,
  getOfficeAvailabilityForDate,
  getAvailableTimeSlots,
  getUserOfficeReservations,
} from "@/lib/queries/offices";

// ─── Helpers de datos en camelCase (formato Drizzle) ─────────────────────────

function makeSpot(overrides?: Record<string, unknown>) {
  return {
    id: "spot-00000000-0000-0000-0000-000000000002",
    label: "OF-01",
    type: "visitor",
    assignedTo: null,
    resourceType: "office",
    isActive: true,
    positionX: 0,
    positionY: 0,
    entityId: null,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  };
}

// Shape for reservations in getOfficeAvailabilityForDate:
// { id, spotId, startTime, endTime }
function makeReservationRow(overrides?: Record<string, unknown>) {
  return {
    id: "res-1",
    spotId: "spot-00000000-0000-0000-0000-000000000002",
    startTime: null,
    endTime: null,
    ...overrides,
  };
}

// Shape for cessions in getOfficeAvailabilityForDate:
// { id, spotId, status }
function makeCessionRow(overrides?: Record<string, unknown>) {
  return {
    id: "ces-1",
    spotId: "spot-00000000-0000-0000-0000-000000000002",
    status: "available",
    ...overrides,
  };
}

// Shape for getUserOfficeReservations join rows
function makeOfficeReservationJoinRow(overrides?: Record<string, unknown>) {
  return {
    id: "res-1",
    spot_id: "spot-1",
    user_id: "user-1",
    date: "2026-04-15",
    status: "confirmed",
    notes: null,
    start_time: null,
    end_time: null,
    created_at: new Date("2026-01-01T00:00:00Z"),
    spot_label: "OF-01",
    spot_resource_type: "office",
    user_name: "Test User",
    ...overrides,
  };
}

// ─── getOfficeSpots ───────────────────────────────────────────────────────────

describe("getOfficeSpots", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("returns active office spots from DB", async () => {
    setupSelectMock([
      makeSpot({ id: "spot-1", label: "OF-01" }),
      makeSpot({ id: "spot-2", label: "OF-02" }),
    ]);

    const result = await getOfficeSpots();
    expect(result).toHaveLength(2);
    expect(result[0]?.label).toBe("OF-01");
    expect(result[1]?.label).toBe("OF-02");
  });

  it("with entityId → query returns spots for entity", async () => {
    setupSelectMock([makeSpot({ entityId: "ent-1" })]);

    const result = await getOfficeSpots("ent-1");
    expect(result).toHaveLength(1);
  });

  it("empty DB → returns []", async () => {
    setupSelectMock([]);

    const result = await getOfficeSpots();
    expect(result).toEqual([]);
  });

  it("DB error → throws", async () => {
    vi.mocked(mockDb.select).mockImplementationOnce(() => {
      throw new Error("DB error");
    });

    await expect(getOfficeSpots()).rejects.toThrow(
      "No se pudieron obtener los puestos"
    );
  });
});

// ─── getOfficeAvailabilityForDate ────────────────────────────────────────────

describe("getOfficeAvailabilityForDate", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  // getOfficeAvailabilityForDate makes:
  // 1. select spots
  // If spots found: 2. select reservations (parallel), 3. select cessions (parallel)

  it("no reservations → all visitor spots are 'free'", async () => {
    setupSelectMock([
      makeSpot({ id: "spot-1", type: "visitor", assignedTo: null }),
    ]);
    setupSelectMock([]); // reservations
    setupSelectMock([]); // cessions

    const result = await getOfficeAvailabilityForDate("2026-04-01");
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("free");
  });

  it("visitor spot with reservation → status is 'occupied'", async () => {
    setupSelectMock([
      makeSpot({ id: "spot-1", type: "visitor", assignedTo: null }),
    ]);
    setupSelectMock([makeReservationRow({ spotId: "spot-1" })]);
    setupSelectMock([]);

    const result = await getOfficeAvailabilityForDate("2026-04-01");
    expect(result[0]?.status).toBe("occupied");
  });

  it("assigned spot with cession status='available' → status is 'ceded'", async () => {
    setupSelectMock([
      makeSpot({ id: "spot-1", type: "standard", assignedTo: "owner-user" }),
    ]);
    setupSelectMock([]); // no reservations
    setupSelectMock([
      makeCessionRow({ id: "ces-1", spotId: "spot-1", status: "available" }),
    ]);

    const result = await getOfficeAvailabilityForDate("2026-04-01");
    expect(result[0]?.status).toBe("ceded");
  });

  it("assigned spot without cession → status is 'occupied'", async () => {
    setupSelectMock([
      makeSpot({ id: "spot-1", type: "standard", assignedTo: "owner-user" }),
    ]);
    setupSelectMock([]); // no reservations
    setupSelectMock([]); // no cessions

    const result = await getOfficeAvailabilityForDate("2026-04-01");
    expect(result[0]?.status).toBe("occupied");
  });

  it("assigned spot with cession but has reservation → status is 'occupied'", async () => {
    setupSelectMock([
      makeSpot({ id: "spot-1", type: "standard", assignedTo: "owner-user" }),
    ]);
    setupSelectMock([makeReservationRow({ spotId: "spot-1" })]);
    setupSelectMock([
      makeCessionRow({ spotId: "spot-1", status: "available" }),
    ]);

    // Has reservation → occupied even if cession is available
    const result = await getOfficeAvailabilityForDate("2026-04-01");
    expect(result[0]?.status).toBe("occupied");
  });

  it("unassigned standard spot (assignedTo=null) → status is 'occupied'", async () => {
    setupSelectMock([
      makeSpot({ id: "spot-1", type: "standard", assignedTo: null }),
    ]);
    setupSelectMock([]);
    setupSelectMock([]);

    const result = await getOfficeAvailabilityForDate("2026-04-01");
    expect(result[0]?.status).toBe("occupied");
  });

  it("empty spots → returns []", async () => {
    setupSelectMock([]);
    // No further selects needed since spots is empty

    const result = await getOfficeAvailabilityForDate("2026-04-01");
    expect(result).toEqual([]);
  });

  it("spots query error → throws", async () => {
    vi.mocked(mockDb.select).mockImplementationOnce(() => {
      throw new Error("spots error");
    });

    await expect(getOfficeAvailabilityForDate("2026-04-01")).rejects.toThrow(
      "spots error"
    );
  });
});

// ─── getAvailableTimeSlots ────────────────────────────────────────────────────

describe("getAvailableTimeSlots", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  // getAvailableTimeSlots makes 1 select: { startTime, endTime } from reservations

  it("no existing reservations → all slots available (8am-10am, 60min = 2 slots)", async () => {
    setupSelectMock([]); // no reservations

    const slots = await getAvailableTimeSlots(
      "spot-1",
      "2026-04-01",
      8,
      10,
      60
    );
    expect(slots).toHaveLength(2);
    expect(slots[0]).toEqual({
      start_time: "08:00",
      end_time: "09:00",
      available: true,
    });
    expect(slots[1]).toEqual({
      start_time: "09:00",
      end_time: "10:00",
      available: true,
    });
  });

  it("existing reservation at 08:00-09:00 → that slot is not available", async () => {
    // Query returns { startTime, endTime } in camelCase
    setupSelectMock([{ startTime: "08:00", endTime: "09:00" }]);

    const slots = await getAvailableTimeSlots(
      "spot-1",
      "2026-04-01",
      8,
      10,
      60
    );
    expect(slots).toHaveLength(2);
    expect(slots[0]).toEqual({
      start_time: "08:00",
      end_time: "09:00",
      available: false,
    });
    expect(slots[1]).toEqual({
      start_time: "09:00",
      end_time: "10:00",
      available: true,
    });
  });

  it("all-day reservation (null start/end) → no slots available", async () => {
    setupSelectMock([{ startTime: null, endTime: null }]);

    const slots = await getAvailableTimeSlots(
      "spot-1",
      "2026-04-01",
      8,
      10,
      60
    );
    expect(slots).toHaveLength(2);
    expect(slots.every((s) => !s.available)).toBe(true);
  });

  it("8am-20am with 60min slots → 12 slots total", async () => {
    setupSelectMock([]);

    const slots = await getAvailableTimeSlots(
      "spot-1",
      "2026-04-01",
      8,
      20,
      60
    );
    expect(slots).toHaveLength(12);
    expect(slots[0]?.start_time).toBe("08:00");
    expect(slots[11]?.end_time).toBe("20:00");
  });

  it("30-minute slots 8am-10am → 4 slots", async () => {
    setupSelectMock([]);

    const slots = await getAvailableTimeSlots(
      "spot-1",
      "2026-04-01",
      8,
      10,
      30
    );
    expect(slots).toHaveLength(4);
    expect(slots[0]).toEqual({
      start_time: "08:00",
      end_time: "08:30",
      available: true,
    });
    expect(slots[1]).toEqual({
      start_time: "08:30",
      end_time: "09:00",
      available: true,
    });
  });

  it("DB error → throws", async () => {
    vi.mocked(mockDb.select).mockImplementationOnce(() => {
      throw new Error("No se pudieron obtener las franjas");
    });

    await expect(
      getAvailableTimeSlots("spot-1", "2026-04-01", 8, 10, 60)
    ).rejects.toThrow("No se pudieron obtener las franjas");
  });

  it("overlapping reservation (09:00-10:00) blocks the 09:00-10:00 slot", async () => {
    setupSelectMock([{ startTime: "09:00", endTime: "10:00" }]);

    const slots = await getAvailableTimeSlots(
      "spot-1",
      "2026-04-01",
      8,
      10,
      60
    );
    expect(slots[0]?.available).toBe(true); // 08:00-09:00 free
    expect(slots[1]?.available).toBe(false); // 09:00-10:00 blocked
  });

  it("all-day reservation with null start blocks even when there are other timed reservations", async () => {
    setupSelectMock([
      { startTime: null, endTime: null },
      { startTime: "09:00", endTime: "10:00" },
    ]);

    const slots = await getAvailableTimeSlots(
      "spot-1",
      "2026-04-01",
      8,
      10,
      60
    );
    expect(slots.every((s) => !s.available)).toBe(true);
  });
});

// ─── getUserOfficeReservations ────────────────────────────────────────────────

describe("getUserOfficeReservations", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("returns future confirmed reservations with spot details", async () => {
    setupSelectMock([
      makeOfficeReservationJoinRow({
        id: "res-1",
        date: "2026-04-15",
        spot_label: "OF-01",
        spot_resource_type: "office",
        user_name: "Test User",
      }),
    ]);

    const result = await getUserOfficeReservations("user-1");
    expect(result).toHaveLength(1);
    expect(result[0]?.spot_label).toBe("OF-01");
    expect(result[0]?.resource_type).toBe("office");
    expect(result[0]?.user_name).toBe("Test User");
    expect(result[0]?.date).toBe("2026-04-15");
  });

  it("empty result → returns []", async () => {
    setupSelectMock([]);

    const result = await getUserOfficeReservations("user-1");
    expect(result).toEqual([]);
  });

  it("DB error → throws", async () => {
    vi.mocked(mockDb.select).mockImplementationOnce(() => {
      throw new Error("No se pudieron obtener las reservas de oficina");
    });

    await expect(getUserOfficeReservations("user-1")).rejects.toThrow(
      "No se pudieron obtener las reservas de oficina"
    );
  });

  it("filters out rows where spot_resource_type is not 'office'", async () => {
    setupSelectMock([
      makeOfficeReservationJoinRow({
        id: "res-1",
        spot_resource_type: "office",
      }),
      makeOfficeReservationJoinRow({
        id: "res-2",
        spot_resource_type: "parking",
      }),
    ]);

    const result = await getUserOfficeReservations("user-1");
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("res-1");
  });

  it("maps start_time and end_time correctly for time-slot reservations", async () => {
    setupSelectMock([
      makeOfficeReservationJoinRow({
        id: "res-1",
        notes: "morning slot",
        start_time: "09:00",
        end_time: "10:00",
        spot_label: "OF-02",
        user_name: "Slot User",
      }),
    ]);

    const result = await getUserOfficeReservations("user-1");
    expect(result[0]?.start_time).toBe("09:00");
    expect(result[0]?.end_time).toBe("10:00");
    expect(result[0]?.notes).toBe("morning slot");
  });
});
