/**
 * Tests de Queries de Cesiones (cessions.ts)
 *
 * Verifica:
 * - getUserCessions: filtro de filas con spots null, mismatch de resource_type, happy path
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getUserCessions } from "@/lib/queries/cessions";
import { createQueryChain } from "../../mocks/supabase";

// ─── Mock de Supabase ─────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";

// ─── Helper ───────────────────────────────────────────────────────────────────

const USER_ID = "550e8400-e29b-41d4-a716-446655440010";
const CESSION_ID = "550e8400-e29b-41d4-a716-446655440011";

function makeCessionJoin(overrides: {
  spots?: { label: string; resource_type: string } | null;
}) {
  return {
    id: CESSION_ID,
    spot_id: "550e8400-e29b-41d4-a716-446655440012",
    user_id: USER_ID,
    date: "2026-06-01",
    status: "pending" as const,
    created_at: "2026-05-01T00:00:00Z",
    spots:
      overrides.spots === undefined
        ? { label: "P-01", resource_type: "parking" }
        : overrides.spots,
    profiles: { full_name: "Test User" },
  };
}

function setupMock(data: unknown[]) {
  const chain = createQueryChain({ data, error: null });
  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn().mockReturnValue(chain),
  } as never);
}

// ─── getUserCessions ───────────────────────────────────────────────────────────

describe("getUserCessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filtra filas donde spots es null", async () => {
    setupMock([makeCessionJoin({ spots: null })]);

    const result = await getUserCessions(USER_ID);

    expect(result).toHaveLength(0);
  });

  it("filtra filas con resource_type incorrecto y emite console.warn", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    setupMock([
      makeCessionJoin({ spots: { label: "OF-01", resource_type: "office" } }),
    ]);

    const result = await getUserCessions(USER_ID, "parking");

    expect(result).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("getUserCessions"),
      expect.objectContaining({ expected: "parking", got: "office" })
    );

    warnSpy.mockRestore();
  });

  it("happy path: devuelve cesión con resource_type correcto", async () => {
    setupMock([
      makeCessionJoin({ spots: { label: "P-01", resource_type: "parking" } }),
    ]);

    const result = await getUserCessions(USER_ID, "parking");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: CESSION_ID,
      spot_label: "P-01",
      resource_type: "parking",
      user_name: "Test User",
    });
  });

  it("sin resourceType devuelve todas las cesiones con spots no nulos", async () => {
    setupMock([
      makeCessionJoin({ spots: { label: "P-01", resource_type: "parking" } }),
      makeCessionJoin({ spots: { label: "OF-01", resource_type: "office" } }),
      makeCessionJoin({ spots: null }),
    ]);

    const result = await getUserCessions(USER_ID);

    expect(result).toHaveLength(2);
  });
});
