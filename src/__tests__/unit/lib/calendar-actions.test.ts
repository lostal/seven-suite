/**
 * Tests de Calendar Data Actions (buildCalendarAction)
 *
 * Verifica la lógica compartida de calendario parametrizada por tipo de recurso.
 * Cubre ambos caminos:
 * - Usuario con plaza asignada → datos de cesión
 * - Usuario sin plaza asignada → datos de disponibilidad (booking)
 *
 * La lógica individual de computeCessionDayStatus, buildMonthRange, etc.
 * ya está cubierta en calendar-utils.test.ts. Aquí se prueba la integración.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetDbMocks, setupSelectMock } from "../../mocks/db";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/db", async () => {
  const { mockDb } = await import("../../mocks/db");
  return { db: mockDb };
});

vi.mock("@/lib/auth/helpers", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  getAllResourceConfigs: vi.fn(),
}));

vi.mock("@/lib/queries/active-entity", () => ({
  getEffectiveEntityId: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...inputs: unknown[]) => inputs.join(" "),
  toServerDateStr: (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
  toClientDateStr: (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
  isPast: vi.fn((_dateStr: string) => false),
  getDayOfWeek: (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y!, m! - 1, d!).getDay();
  },
  getPageNumbers: () => [1],
}));

import { getCurrentUser, type AuthUser } from "@/lib/auth/helpers";
import { getAllResourceConfigs } from "@/lib/config";
import { buildCalendarAction } from "@/lib/actions/calendar-actions";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = "user-00000000-0000-0000-0000-000000000001";
const ASSIGNED_SPOT_ID = "spot-assigned-001";
const STANDARD_SPOT_ID_1 = "spot-standard-001";
const STANDARD_SPOT_ID_2 = "spot-standard-002";
const STANDARD_SPOT_ID_3 = "spot-standard-003";
const STANDARD_SPOT_ID_4 = "spot-standard-004";
const VISITOR_SPOT_ID = "spot-visitor-001";

/** June 2026: starts on Monday, 30 days */
const MONTH = "2026-06-01";

const defaultConfig = {
  booking_enabled: true,
  visitor_booking_enabled: true,
  allowed_days: [1, 2, 3, 4, 5], // Mon-Fri
  max_advance_days: 365,
  max_consecutive_days: 5,
  max_weekly_reservations: 5,
  max_monthly_reservations: 20,
  max_daily_reservations: null,
  time_slots_enabled: false,
  slot_duration_minutes: null,
  day_start_hour: null,
  day_end_hour: null,
  cession_enabled: true,
  cession_min_advance_hours: 24,
  cession_max_per_week: 5,
  auto_cession_enabled: false,
};

function setupAuthUser(overrides?: { id?: string; email?: string }) {
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: overrides?.id ?? USER_ID,
    email: overrides?.email ?? "test@example.com",
    profile: { role: "employee" } as AuthUser["profile"],
  } as AuthUser);
}

function setupConfig(overrides?: Record<string, unknown>) {
  vi.mocked(getAllResourceConfigs).mockResolvedValue({
    ...defaultConfig,
    ...overrides,
  } as typeof defaultConfig);
}

// ─── Input Validation ────────────────────────────────────────────────────────

describe("buildCalendarAction — input validation", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
  });

  it("rejects invalid monthStart format", async () => {
    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: "not-a-date" } as never);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Datos inválidos");
    }
  });

  it("rejects empty string monthStart", async () => {
    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: "" } as never);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Datos inválidos");
    }
  });

  it("rejects monthStart with wrong format (DD-MM-YYYY)", async () => {
    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: "01-06-2026" } as never);

    expect(result.success).toBe(false);
  });

  it("accepts valid YYYY-MM-DD monthStart for parking", async () => {
    setupAuthUser();
    setupConfig();
    // No assigned spot, no spots in DB
    setupSelectMock([]); // assigned spot → none

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
  });

  it("accepts valid monthStart for office", async () => {
    setupAuthUser();
    setupConfig({ time_slots_enabled: true });
    setupSelectMock([]);

    const action = buildCalendarAction("office");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
  });
});

// ─── User not authenticated ──────────────────────────────────────────────────

describe("buildCalendarAction — authentication", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(null);
  });

  it("throws when user is not authenticated", async () => {
    const action = buildCalendarAction("parking");

    // The actionClient catches errors and returns ActionResult
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("No autenticado");
    }
  });
});

// ─── User WITH assigned spot (cession mode) ──────────────────────────────────

describe("buildCalendarAction — cession mode (user with assigned spot)", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
    setupAuthUser();
    setupConfig();
  });

  it("returns cession data with 30 days for June 2026", async () => {
    // First select: assigned spot found
    setupSelectMock([{ id: ASSIGNED_SPOT_ID, label: "A-01" }]);
    // Second select: cessions for that spot
    setupSelectMock([]);

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(30);
      // All days should have cessionDayStatus (not bookingStatus)
      for (const day of result.data) {
        expect(day.cessionDayStatus).toBeDefined();
        expect(day.bookingStatus).toBeUndefined();
        expect(day.availableCount).toBeUndefined();
      }
    }
  });

  it("marks weekends as unavailable in cession mode", async () => {
    setupSelectMock([{ id: ASSIGNED_SPOT_ID, label: "A-01" }]);
    setupSelectMock([]);

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      const saturday = result.data.find((d) => d.date === "2026-06-06");
      const sunday = result.data.find((d) => d.date === "2026-06-07");
      expect(saturday?.cessionDayStatus).toBe("unavailable");
      expect(sunday?.cessionDayStatus).toBe("unavailable");
    }
  });

  it("marks working days without cession as can-cede", async () => {
    setupSelectMock([{ id: ASSIGNED_SPOT_ID, label: "A-01" }]);
    setupSelectMock([]);

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      const monday = result.data.find((d) => d.date === "2026-06-01");
      expect(monday?.cessionDayStatus).toBe("can-cede");
      expect(monday?.myCessionId).toBeUndefined();
    }
  });

  it("shows ceded-free for available cession days", async () => {
    setupSelectMock([{ id: ASSIGNED_SPOT_ID, label: "A-01" }]);
    setupSelectMock([
      { id: "ces-1", date: "2026-06-02", status: "available" },
      { id: "ces-2", date: "2026-06-03", status: "available" },
    ]);

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      const day2 = result.data.find((d) => d.date === "2026-06-02");
      expect(day2?.cessionDayStatus).toBe("ceded-free");
      expect(day2?.myCessionId).toBe("ces-1");
      expect(day2?.cessionStatus).toBe("available");

      const day3 = result.data.find((d) => d.date === "2026-06-03");
      expect(day3?.cessionDayStatus).toBe("ceded-free");
      expect(day3?.myCessionId).toBe("ces-2");
    }
  });

  it("shows ceded-taken for reserved cession days", async () => {
    setupSelectMock([{ id: ASSIGNED_SPOT_ID, label: "A-01" }]);
    setupSelectMock([{ id: "ces-3", date: "2026-06-04", status: "reserved" }]);

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      const day4 = result.data.find((d) => d.date === "2026-06-04");
      expect(day4?.cessionDayStatus).toBe("ceded-taken");
      expect(day4?.cessionStatus).toBe("reserved");
    }
  });

  it("filters out cancelled cessions (ne(status, cancelled))", async () => {
    setupSelectMock([{ id: ASSIGNED_SPOT_ID, label: "A-01" }]);
    // The WHERE clause uses ne(cessions.status, "cancelled"),
    // so cancelled cessions are not returned by the query.
    // We simulate this by not including cancelled in the mock result.
    setupSelectMock([{ id: "ces-1", date: "2026-06-02", status: "available" }]);

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      // Day 2026-06-01 (Monday): no cession → can-cede
      const day1 = result.data.find((d) => d.date === "2026-06-01");
      expect(day1?.cessionDayStatus).toBe("can-cede");
    }
  });

  it("includes correct date keys for each day of the month", async () => {
    setupSelectMock([{ id: ASSIGNED_SPOT_ID, label: "A-01" }]);
    setupSelectMock([]);

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0]?.date).toBe("2026-06-01");
      expect(result.data[14]?.date).toBe("2026-06-15");
      expect(result.data[29]?.date).toBe("2026-06-30");
    }
  });

  it("works with office resource type in cession mode", async () => {
    setupConfig({ time_slots_enabled: true });
    setupSelectMock([{ id: "spot-office-1", label: "OF-01" }]);
    setupSelectMock([]);

    const action = buildCalendarAction("office");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(30);
    }
  });
});

// ─── User WITHOUT assigned spot (booking mode) ───────────────────────────────

describe("buildCalendarAction — booking mode (user without assigned spot)", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
    setupAuthUser();
    setupConfig();
  });

  function setupBookingMode(options?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    spots?: any[];
    reservations?: Array<{ spotId: string; date: string }>;
    cessions?: Array<{ spotId: string; date: string; status: string }>;
    myReservations?: Array<{
      id: string;
      spotId: string;
      date: string;
      startTime?: string;
      endTime?: string;
    }>;
  }) {
    // 1. No assigned spot
    setupSelectMock([]);
    // 2. All spots
    setupSelectMock(
      options?.spots ?? [
        { id: STANDARD_SPOT_ID_1, type: "standard", assignedTo: null },
        { id: STANDARD_SPOT_ID_2, type: "standard", assignedTo: null },
        { id: VISITOR_SPOT_ID, type: "visitor", assignedTo: null },
      ]
    );
    // 3. All reservations
    setupSelectMock(options?.reservations ?? []);
    // 4. All cessions
    setupSelectMock(options?.cessions ?? []);
    // 5. My reservations
    setupSelectMock(options?.myReservations ?? []);
    // 6. Spot labels for my reservations (if any)
    const myResSpots = options?.myReservations ?? [];
    if (myResSpots.length > 0) {
      const spotIds = new Set(myResSpots.map((r) => r.spotId));
      setupSelectMock(
        [...spotIds].map((id) => ({ id, label: `Label-${id.slice(0, 4)}` }))
      );
    }
  }

  it("returns 30 days of booking data for a full month", async () => {
    setupBookingMode();

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(30);
      for (const day of result.data) {
        expect(day.bookingStatus).toBeDefined();
        expect(day.cessionDayStatus).toBeUndefined();
      }
    }
  });

  it("marks weekends as unavailable", async () => {
    setupBookingMode();

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      const saturday = result.data.find((d) => d.date === "2026-06-06");
      const sunday = result.data.find((d) => d.date === "2026-06-07");
      expect(saturday?.bookingStatus).toBe("unavailable");
      expect(sunday?.bookingStatus).toBe("unavailable");
    }
  });

  it("shows plenty when enough spots are available (via cessions + flexible)", async () => {
    // 4 ceded standard spots + 1 visitor = 5 total available → plenty (>3)
    setupBookingMode({
      spots: [
        { id: STANDARD_SPOT_ID_1, type: "standard", assignedTo: null },
        { id: STANDARD_SPOT_ID_2, type: "standard", assignedTo: null },
        { id: STANDARD_SPOT_ID_3, type: "standard", assignedTo: null },
        { id: STANDARD_SPOT_ID_4, type: "standard", assignedTo: null },
        { id: VISITOR_SPOT_ID, type: "visitor", assignedTo: null },
      ],
      cessions: [
        { spotId: STANDARD_SPOT_ID_1, date: "2026-06-01", status: "available" },
        { spotId: STANDARD_SPOT_ID_2, date: "2026-06-01", status: "available" },
        { spotId: STANDARD_SPOT_ID_3, date: "2026-06-01", status: "available" },
        { spotId: STANDARD_SPOT_ID_4, date: "2026-06-01", status: "available" },
      ],
    });

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      const monday = result.data.find((d) => d.date === "2026-06-01");
      expect(monday?.bookingStatus).toBe("plenty");
      // 4 ceded + 1 flexible = 5
      expect(monday?.availableCount).toBe(5);
    }
  });

  it("shows few when 3 or fewer spots are available", async () => {
    // 2 ceded standard + 1 visitor = 3 total → few (≤3)
    setupBookingMode({
      spots: [
        { id: STANDARD_SPOT_ID_1, type: "standard", assignedTo: null },
        { id: STANDARD_SPOT_ID_2, type: "standard", assignedTo: null },
        { id: VISITOR_SPOT_ID, type: "visitor", assignedTo: null },
      ],
      cessions: [
        { spotId: STANDARD_SPOT_ID_1, date: "2026-06-01", status: "available" },
        { spotId: STANDARD_SPOT_ID_2, date: "2026-06-01", status: "available" },
      ],
    });

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      const monday = result.data.find((d) => d.date === "2026-06-01");
      expect(monday?.bookingStatus).toBe("few");
      expect(monday?.availableCount).toBe(3);
    }
  });

  it("shows none when no spots are available at all", async () => {
    setupBookingMode({ spots: [] });

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      const monday = result.data.find((d) => d.date === "2026-06-01");
      expect(monday?.bookingStatus).toBe("none");
      expect(monday?.availableCount).toBe(0);
    }
  });

  it("shows none when standard spots are all reserved and no visitor spots", async () => {
    setupBookingMode({
      spots: [{ id: STANDARD_SPOT_ID_1, type: "standard", assignedTo: null }],
      reservations: [{ spotId: STANDARD_SPOT_ID_1, date: "2026-06-01" }],
    });

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      const day1 = result.data.find((d) => d.date === "2026-06-01");
      expect(day1?.bookingStatus).toBe("none");
      expect(day1?.availableCount).toBe(0);
    }
  });

  it("shows reserved when user already has a reservation", async () => {
    setupBookingMode({
      spots: [
        { id: STANDARD_SPOT_ID_1, type: "standard", assignedTo: null },
        { id: STANDARD_SPOT_ID_2, type: "standard", assignedTo: null },
      ],
      myReservations: [
        {
          id: "res-1",
          spotId: STANDARD_SPOT_ID_1,
          date: "2026-06-01",
        },
      ],
    });

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      const day1 = result.data.find((d) => d.date === "2026-06-01");
      expect(day1?.bookingStatus).toBe("reserved");
      expect(day1?.myReservationId).toBe("res-1");
    }
  });

  it("includes spot label for user's reservation", async () => {
    setupBookingMode({
      spots: [{ id: STANDARD_SPOT_ID_1, type: "standard", assignedTo: null }],
      myReservations: [
        {
          id: "res-1",
          spotId: STANDARD_SPOT_ID_1,
          date: "2026-06-01",
        },
      ],
    });

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      const day1 = result.data.find((d) => d.date === "2026-06-01");
      expect(day1?.myReservationSpotLabel).toBe("Label-spot");
    }
  });

  it("visitor spots are available even when standard spots are reserved", async () => {
    setupBookingMode({
      spots: [
        { id: STANDARD_SPOT_ID_1, type: "standard", assignedTo: null },
        { id: VISITOR_SPOT_ID, type: "visitor", assignedTo: null },
      ],
      reservations: [{ spotId: STANDARD_SPOT_ID_1, date: "2026-06-01" }],
    });

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      const day1 = result.data.find((d) => d.date === "2026-06-01");
      // standard is reserved, but visitor is free → availableCount = 1 → few
      expect(day1?.bookingStatus).toBe("few");
      expect(day1?.availableCount).toBe(1);
    }
  });

  it("ceded available spots increase availability", async () => {
    setupBookingMode({
      spots: [
        { id: STANDARD_SPOT_ID_1, type: "standard", assignedTo: null },
        { id: STANDARD_SPOT_ID_2, type: "standard", assignedTo: null },
      ],
      cessions: [
        { spotId: STANDARD_SPOT_ID_1, date: "2026-06-01", status: "available" },
      ],
    });

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      const day1 = result.data.find((d) => d.date === "2026-06-01");
      // 1 ceded (available) = 1 spot available → few
      expect(day1?.availableCount).toBe(1);
      expect(day1?.bookingStatus).toBe("few");
    }
  });

  it("ceded spots with status other than available do not increase count", async () => {
    setupBookingMode({
      spots: [
        { id: STANDARD_SPOT_ID_1, type: "standard", assignedTo: null },
        { id: STANDARD_SPOT_ID_2, type: "standard", assignedTo: null },
      ],
      cessions: [
        {
          spotId: STANDARD_SPOT_ID_1,
          date: "2026-06-01",
          status: "reserved", // NOT "available" — ignored
        },
      ],
    });

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      const day1 = result.data.find((d) => d.date === "2026-06-01");
      // No available cessions, no flexible spots → 0 available
      expect(day1?.availableCount).toBe(0);
      expect(day1?.bookingStatus).toBe("none");
    }
  });

  it("does not count ceded visitor spots in cededAvailableByDate", async () => {
    setupBookingMode({
      spots: [
        { id: STANDARD_SPOT_ID_1, type: "standard", assignedTo: null },
        { id: VISITOR_SPOT_ID, type: "visitor", assignedTo: null },
      ],
      cessions: [
        {
          spotId: VISITOR_SPOT_ID,
          date: "2026-06-01",
          status: "available",
        },
      ],
    });

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      const day1 = result.data.find((d) => d.date === "2026-06-01");
      // Visitor cession is ignored in cededAvailableByDate.
      // flexibleCount = 1 (visitor is always available) → 1 available
      expect(day1?.availableCount).toBe(1);
    }
  });

  it("non-working days in allowedDays config return unavailable", async () => {
    setupConfig({ allowed_days: [1, 3, 5] }); // Mon, Wed, Fri only
    setupBookingMode({
      spots: [{ id: STANDARD_SPOT_ID_1, type: "standard", assignedTo: null }],
      cessions: [
        { spotId: STANDARD_SPOT_ID_1, date: "2026-06-03", status: "available" },
      ],
    });

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      // Tuesday 2026-06-02 (dow 2) → not allowed
      const tuesday = result.data.find((d) => d.date === "2026-06-02");
      expect(tuesday?.bookingStatus).toBe("unavailable");

      // Wednesday 2026-06-03 (dow 3) → allowed, 1 ceded spot
      const wednesday = result.data.find((d) => d.date === "2026-06-03");
      expect(wednesday?.bookingStatus).toBe("few");
      expect(wednesday?.availableCount).toBe(1);
    }
  });

  it("deduplicates user reservations correctly (only one per date)", async () => {
    // Same date, same user but different spots (should not happen but handled)
    setupBookingMode({
      spots: [
        { id: STANDARD_SPOT_ID_1, type: "standard", assignedTo: null },
        { id: STANDARD_SPOT_ID_2, type: "standard", assignedTo: null },
      ],
      myReservations: [
        {
          id: "res-1",
          spotId: STANDARD_SPOT_ID_1,
          date: "2026-06-01",
        },
        {
          id: "res-2",
          spotId: STANDARD_SPOT_ID_2,
          date: "2026-06-01",
        },
      ],
    });

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      const day1 = result.data.find((d) => d.date === "2026-06-01");
      // Map: last reservation for date wins (res-2 with spot-standard-002)
      expect(day1?.bookingStatus).toBe("reserved");
      // myReservationId is the last one inserted (res-2)
      expect(day1?.myReservationId).toBe("res-2");
    }
  });

  it("reserves reduce availability from ceded spots", async () => {
    setupBookingMode({
      spots: [
        { id: STANDARD_SPOT_ID_1, type: "standard", assignedTo: null },
        { id: STANDARD_SPOT_ID_2, type: "standard", assignedTo: null },
        { id: STANDARD_SPOT_ID_3, type: "standard", assignedTo: null },
        { id: STANDARD_SPOT_ID_4, type: "standard", assignedTo: null },
      ],
      cessions: [
        { spotId: STANDARD_SPOT_ID_1, date: "2026-06-01", status: "available" },
        { spotId: STANDARD_SPOT_ID_2, date: "2026-06-01", status: "available" },
        { spotId: STANDARD_SPOT_ID_3, date: "2026-06-01", status: "available" },
        { spotId: STANDARD_SPOT_ID_4, date: "2026-06-01", status: "available" },
      ],
      reservations: [
        { spotId: STANDARD_SPOT_ID_1, date: "2026-06-01" },
        { spotId: STANDARD_SPOT_ID_2, date: "2026-06-01" },
      ],
    });

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      const day1 = result.data.find((d) => d.date === "2026-06-01");
      // 4 ceded, 2 reserved → 2 available → few
      expect(day1?.availableCount).toBe(2);
      expect(day1?.bookingStatus).toBe("few");
    }
  });

  it("office resource type returns booking data correctly", async () => {
    setupConfig({ time_slots_enabled: true });
    setupSelectMock([]); // no assigned spot
    setupSelectMock([]); // no spots
    setupSelectMock([]); // no reservations
    setupSelectMock([]); // no cessions
    setupSelectMock([]); // no my reservations

    const action = buildCalendarAction("office");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(30);
      const monday = result.data.find((d) => d.date === "2026-06-01");
      expect(monday?.bookingStatus).toBe("none");
    }
  });

  it("includes time fields on my reservations when present", async () => {
    setupBookingMode({
      spots: [{ id: STANDARD_SPOT_ID_1, type: "standard", assignedTo: null }],
      myReservations: [
        {
          id: "res-1",
          spotId: STANDARD_SPOT_ID_1,
          date: "2026-06-01",
          startTime: "09:00",
          endTime: "10:00",
        },
      ],
    });

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      const day1 = result.data.find((d) => d.date === "2026-06-01");
      expect(day1?.myReservationStartTime).toBe("09:00");
      expect(day1?.myReservationEndTime).toBe("10:00");
    }
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────────────

describe("buildCalendarAction — edge cases", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
    setupAuthUser();
    setupConfig();
  });

  it("handles February 2026 (28 days) correctly", async () => {
    // No assigned spot
    setupSelectMock([]); // assigned → none
    setupSelectMock([]); // spots → none
    setupSelectMock([]); // reservations
    setupSelectMock([]); // cessions
    setupSelectMock([]); // my reservations

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: "2026-02-01" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(28);
      expect(result.data[0]?.date).toBe("2026-02-01");
      expect(result.data[27]?.date).toBe("2026-02-28");
    }
  });

  it("handles December 2026 (31 days) correctly", async () => {
    setupSelectMock([]);
    setupSelectMock([]);
    setupSelectMock([]);
    setupSelectMock([]);
    setupSelectMock([]);

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: "2026-12-01" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(31);
    }
  });

  it("filters out reservations from unknown spot IDs in reservedByDate", async () => {
    // A reservation for a spot that's not in allSpots should be ignored
    const spots = [
      { id: STANDARD_SPOT_ID_1, type: "standard", assignedTo: null },
    ];
    setupSelectMock([]); // no assigned
    setupSelectMock(spots);
    setupSelectMock([
      // This reservation references a spot NOT in allSpots
      { spotId: "unknown-spot-id", date: "2026-06-01" },
      { spotId: STANDARD_SPOT_ID_1, date: "2026-06-01" },
    ]);
    setupSelectMock([]); // cessions
    setupSelectMock([]); // my reservations

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      const day1 = result.data.find((d) => d.date === "2026-06-01");
      // Only STANDARD_SPOT_ID_1 is reserved, so 0 available → none
      expect(day1?.bookingStatus).toBe("none");
      expect(day1?.availableCount).toBe(0);
    }
  });

  it("filters out my reservations with unknown spot IDs", async () => {
    setupSelectMock([]); // no assigned
    setupSelectMock([
      { id: STANDARD_SPOT_ID_1, type: "standard", assignedTo: null },
    ]);
    setupSelectMock([]); // reservations
    setupSelectMock([]); // cessions
    setupSelectMock([
      // My reservation references unknown spot — should be filtered
      {
        id: "res-1",
        spotId: "unknown-spot",
        date: "2026-06-01",
        startTime: null,
        endTime: null,
      },
    ]);

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      const day1 = result.data.find((d) => d.date === "2026-06-01");
      // My res was filtered out (unknown spot), so not "reserved"
      expect(day1?.bookingStatus).not.toBe("reserved");
      expect(day1?.myReservationId).toBeUndefined();
    }
  });

  it("all days have consistent shape (all required keys present)", async () => {
    setupSelectMock([{ id: ASSIGNED_SPOT_ID, label: "A-01" }]);
    setupSelectMock([]);

    const action = buildCalendarAction("parking");
    const result = await action({ monthStart: MONTH });

    expect(result.success).toBe(true);
    if (result.success) {
      for (const day of result.data) {
        expect(day).toHaveProperty("date");
        expect(typeof day.date).toBe("string");
        expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });
});
