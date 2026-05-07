/**
 * Integration Tests: Spots & Reservations Queries
 *
 * Requires: Docker PostgreSQL running (`pnpm db:up`).
 *
 * Run: pnpm vitest run src/__tests__/integration/spots.int.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  clearTestDatabase,
  seedTestBaseData,
  seedTestSpot,
  seedTestReservation,
} from "../test-db";
import { getSpots, getSpotsByDate } from "@/lib/queries/spots";
import { getUserReservations } from "@/lib/queries/reservations";

let entityId: string;
let userId: string;
let spotId: string;

beforeAll(async () => {
  await clearTestDatabase();
  const base = await seedTestBaseData();
  entityId = base.entityId;
  userId = base.userId;

  const spot = await seedTestSpot(entityId, { label: "P-INT-01" });
  spotId = spot.spotId;
});

afterAll(async () => {
  await clearTestDatabase();
});

describe("getSpots (integration)", () => {
  it("returns spots for an entity", async () => {
    const spots = await getSpots(undefined, false, entityId);

    expect(spots.length).toBeGreaterThanOrEqual(1);
    const created = spots.find((s) => s.id === spotId);
    expect(created).toBeDefined();
    expect(created!.label).toBe("P-INT-01");
  });

  it("returns empty for non-existent entity", async () => {
    const spots = await getSpots(
      undefined,
      false,
      "00000000-0000-0000-0000-000000000000"
    );
    expect(spots).toHaveLength(0);
  });
});

describe("getSpotsByDate (integration)", () => {
  it("shows spot as free when no reservations exist", async () => {
    const spots = await getSpotsByDate("2026-09-01", undefined, entityId);
    const created = spots.find((s) => s.id === spotId);

    expect(created).toBeDefined();
    expect(created!.status).toBe("free");
  });

  it("shows spot as occupied when reserved", async () => {
    await seedTestReservation(spotId, userId, "2026-09-15");

    const spots = await getSpotsByDate("2026-09-15", undefined, entityId);
    const created = spots.find((s) => s.id === spotId);

    expect(created).toBeDefined();
    expect(created!.status).not.toBe("free");
  });
});

describe("getUserReservations (integration)", () => {
  it("returns user reservations with spot details", async () => {
    await seedTestReservation(spotId, userId, "2026-10-01");

    const reservations = await getUserReservations(userId);

    expect(reservations.length).toBeGreaterThanOrEqual(1);
    const res = reservations.find((r) => r.spot_id === spotId);
    expect(res).toBeDefined();
  });

  it("returns empty for user with no reservations", async () => {
    const reservations = await getUserReservations(
      "00000000-0000-0000-0000-000000000000"
    );
    expect(reservations).toHaveLength(0);
  });
});
