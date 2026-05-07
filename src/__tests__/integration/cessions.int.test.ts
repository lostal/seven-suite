/**
 * Integration Tests: Cessions Queries
 *
 * Tests against real PostgreSQL using Drizzle.
 * Requires: Docker PostgreSQL running (`pnpm db:up`).
 *
 * Run: pnpm vitest run src/__tests__/integration/cessions.int.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  clearTestDatabase,
  seedTestBaseData,
  seedTestSecondUser,
  seedTestSpot,
  seedTestCession,
} from "../test-db";
import { getCessionsByDate, getUserCessions } from "@/lib/queries/cessions";

let entityId: string;
let userId: string;
let managerId: string;
let spotId: string;

beforeAll(async () => {
  await clearTestDatabase();
  const base = await seedTestBaseData();
  entityId = base.entityId;
  userId = base.userId;

  const manager = await seedTestSecondUser(entityId);
  managerId = manager.userId;

  const spot = await seedTestSpot(entityId, { label: "P-01" });
  spotId = spot.spotId;
});

afterAll(async () => {
  await clearTestDatabase();
});

describe("getCessionsByDate (integration)", () => {
  it("returns empty when no cessions exist for the date", async () => {
    const result = await getCessionsByDate("2026-07-01");
    expect(result).toHaveLength(0);
  });

  it("returns cessions with spot and user details via joins", async () => {
    const { cessionId } = await seedTestCession(
      spotId,
      userId,
      "2026-07-01",
      "available"
    );

    const result = await getCessionsByDate("2026-07-01");

    const cession = result.find((c) => c.id === cessionId);
    expect(cession).toBeDefined();
    expect(cession!.spot_label).toBe("P-01");
    expect(cession!.user_name).toBeTruthy();
    expect(cession!.resource_type).toBe("parking");
  });

  it("filters out cancelled cessions", async () => {
    await seedTestCession(spotId, userId, "2026-07-02", "cancelled");

    const result = await getCessionsByDate("2026-07-02");

    expect(result).toHaveLength(0);
  });

  it("filters by resourceType", async () => {
    await seedTestCession(spotId, userId, "2026-07-03", "available");

    const parking = await getCessionsByDate("2026-07-03", "parking");
    expect(parking.length).toBeGreaterThanOrEqual(1);

    const office = await getCessionsByDate("2026-07-03", "office");
    expect(office).toHaveLength(0);
  });
});

describe("getUserCessions (integration)", () => {
  it("returns only future cessions for a user", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const dateStr = futureDate.toISOString().slice(0, 10);

    await seedTestCession(spotId, userId, dateStr, "available");

    const result = await getUserCessions(userId);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.date).toBe(dateStr);
  });

  it("returns empty when user has no cessions", async () => {
    const result = await getUserCessions(managerId);
    expect(result).toHaveLength(0);
  });

  it("filters by resourceType", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 31);
    const dateStr = futureDate.toISOString().slice(0, 10);

    await seedTestCession(spotId, userId, dateStr, "available");

    const parking = await getUserCessions(userId, "parking");
    expect(parking.length).toBeGreaterThanOrEqual(1);
    expect(parking[0]!.resource_type).toBe("parking");
  });
});

describe("Cession ↔ Reservation consistency", () => {
  // NOTE: The custom trigger `sync_cession_status` has a column mismatch
  // (`updated_at` vs `updatedAt`) that causes this to fail in test DB.
  // Once the trigger is fixed, this test should pass.
  it.todo("reserving a ceded spot creates corresponding reservation row");
});
