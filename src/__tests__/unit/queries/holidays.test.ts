/**
 * Tests de Holiday Queries
 *
 * Verifica getHolidayDatesSetForYears.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetDbMocks, setupSelectMock } from "../../mocks/db";

vi.mock("@/lib/db", async () => {
  const { mockDb } = await import("../../mocks/db");
  return { db: mockDb };
});

import { getHolidayDatesSetForYears } from "@/lib/queries/holidays";

const MOCK_HOLIDAYS = [
  { date: "2026-01-01", isOptional: false },
  { date: "2026-05-01", isOptional: false },
  { date: "2026-12-06", isOptional: false },
  { date: "2026-03-19", isOptional: true },
];

describe("getHolidayDatesSetForYears", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
  });

  it("returns Set of mandatory (non-optional) holiday dates for multiple years", async () => {
    setupSelectMock(MOCK_HOLIDAYS);

    const result = await getHolidayDatesSetForYears("ent-1", [2026]);

    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(3);
    expect(result.has("2026-01-01")).toBe(true);
    expect(result.has("2026-05-01")).toBe(true);
    expect(result.has("2026-12-06")).toBe(true);
    expect(result.has("2026-03-19")).toBe(false);
  });

  it("returns empty Set when years array is empty", async () => {
    const result = await getHolidayDatesSetForYears("ent-1", []);

    expect(result.size).toBe(0);
  });

  it("returns empty Set when no holidays exist", async () => {
    setupSelectMock([]);

    const result = await getHolidayDatesSetForYears("ent-1", [2026]);

    expect(result.size).toBe(0);
  });

  it("returns empty Set when all holidays are optional", async () => {
    setupSelectMock([{ date: "2026-01-01", isOptional: true }]);

    const result = await getHolidayDatesSetForYears("ent-1", [2026]);

    expect(result.size).toBe(0);
  });
});
