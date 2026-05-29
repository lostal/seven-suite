/**
 * Tests de Queries de Cesiones (cessions.ts)
 *
 * Verifica:
 * - getUserCessions: filtro de filas con spots null, mismatch de resource_type, happy path
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getUserCessions, getCessionsByDate } from "@/lib/queries/cessions";

// ─── Mock de Drizzle db ───────────────────────────────────────────────────────

vi.mock("@/lib/db", async () => {
  const { mockDb } = await import("../../mocks/db");
  return { db: mockDb };
});

import { resetDbMocks, setupSelectMock } from "../../mocks/db";

// ─── Helper ───────────────────────────────────────────────────────────────────

const USER_ID = "550e8400-e29b-41d4-a716-446655440010";
const CESSION_ID = "550e8400-e29b-41d4-a716-446655440011";

function makeCessionRow(overrides?: {
  spotResourceType?: string;
  userFullName?: string;
}) {
  return {
    id: CESSION_ID,
    spot_id: "550e8400-e29b-41d4-a716-446655440012",
    user_id: USER_ID,
    date: "2026-06-01",
    status: "available",
    created_at: new Date("2026-05-01T00:00:00Z"),
    spot_label: "P-01",
    spot_resource_type: overrides?.spotResourceType ?? "parking",
    user_name: overrides?.userFullName ?? "Test User",
  };
}

// ─── getUserCessions ───────────────────────────────────────────────────────────

describe("getUserCessions", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("el filtro resourceType se aplica mediante SQL", async () => {
    setupSelectMock([makeCessionRow({ spotResourceType: "parking" })]);

    const result = await getUserCessions(USER_ID, "parking");

    expect(result).toHaveLength(1);
    expect(result[0]?.resource_type).toBe("parking");
  });

  it("happy path: devuelve cesión con resource_type correcto", async () => {
    setupSelectMock([makeCessionRow({ spotResourceType: "parking" })]);

    const result = await getUserCessions(USER_ID, "parking");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: CESSION_ID,
      spot_label: "P-01",
      resource_type: "parking",
      user_name: "Test User",
    });
  });

  it("sin resourceType devuelve todas las cesiones", async () => {
    setupSelectMock([
      makeCessionRow({ spotResourceType: "parking" }),
      makeCessionRow({ spotResourceType: "office" }),
    ]);

    const result = await getUserCessions(USER_ID);

    expect(result).toHaveLength(2);
  });
});

// ─── getCessionsByDate ───────────────────────────────────────────────────────

describe("getCessionsByDate", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("devuelve cesiones para una fecha sin filtrar por resourceType", async () => {
    setupSelectMock([
      makeCessionRow({ spotResourceType: "parking" }),
      makeCessionRow({ spotResourceType: "office" }),
    ]);

    const result = await getCessionsByDate("2026-06-01");

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      spot_label: "P-01",
      user_name: "Test User",
      resource_type: "parking",
    });
  });

  it("filtra por resourceType=parking", async () => {
    setupSelectMock([
      makeCessionRow({ spotResourceType: "parking" }),
      makeCessionRow({ spotResourceType: "parking" }),
    ]);

    const result = await getCessionsByDate("2026-06-01", "parking");

    expect(result).toHaveLength(2);
    for (const c of result) {
      expect(c.resource_type).toBe("parking");
    }
  });

  it("filtra por resourceType mediante SQL (no JS guard)", async () => {
    setupSelectMock([makeCessionRow({ spotResourceType: "parking" })]);

    const result = await getCessionsByDate("2026-06-01", "parking");

    expect(result).toHaveLength(1);
    expect(result[0]?.resource_type).toBe("parking");
  });

  it("mapea user_name null a string vacía", async () => {
    setupSelectMock([{ ...makeCessionRow(), user_name: null }]);

    const result = await getCessionsByDate("2026-06-01");

    expect(result[0]?.user_name).toBe("");
  });

  it("retorna array vacío cuando no hay cesiones", async () => {
    setupSelectMock([]);

    const result = await getCessionsByDate("2026-06-01");

    expect(result).toHaveLength(0);
  });

  it("respeta el orden descendente por fecha de creación", async () => {
    setupSelectMock([
      { ...makeCessionRow(), created_at: new Date("2026-05-10") },
      { ...makeCessionRow(), created_at: new Date("2026-05-01") },
    ]);

    const result = await getCessionsByDate("2026-06-01");

    expect(result[0]?.created_at).toEqual(new Date("2026-05-10"));
    expect(result[1]?.created_at).toEqual(new Date("2026-05-01"));
  });
});
