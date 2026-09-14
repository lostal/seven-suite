import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", async () => {
  const { mockDb } = await import("../../mocks/db");
  return { db: mockDb };
});

import { mockDb, resetDbMocks, setupSelectMock } from "../../mocks/db";

import {
  getAllEntities,
  getEntityWithModules,
  getEntityEnabledModules,
} from "@/lib/queries/entities";

const ALL_MODULES = ["parking", "office", "visitors", "vacaciones", "tablon"];

describe("getAllEntities", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("empty DB → returns []", async () => {
    setupSelectMock([]);
    const result = await getAllEntities();
    expect(result).toEqual([]);
  });

  it("DB returns 2 entities → returns both", async () => {
    const entity1 = {
      id: "ent-1",
      name: "Sede A",
      shortCode: "SA",
      isActive: true,
      createdAt: new Date("2025-01-01T00:00:00Z"),
    };
    const entity2 = {
      id: "ent-2",
      name: "Sede B",
      shortCode: "SB",
      isActive: true,
      createdAt: new Date("2025-01-01T00:00:00Z"),
    };
    setupSelectMock([entity1, entity2]);

    const result = await getAllEntities();
    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe("Sede A");
    expect(result[1]?.name).toBe("Sede B");
  });

  it("DB error → returns [] (graceful — data is null)", async () => {
    setupSelectMock(null);
    // The Drizzle implementation returns [] when rows is null/empty
    const result = await getAllEntities();
    expect(result).toEqual([]);
  });
});

describe("getEntityWithModules", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("entity not found → returns null", async () => {
    // First select: entities (empty)
    setupSelectMock([]);
    // Second select: entity_modules
    setupSelectMock([]);

    const result = await getEntityWithModules("non-existent-id");
    expect(result).toBeNull();
  });

  it("entity found with no modules → returns entity with modules=[]", async () => {
    const mockEntity = {
      id: "ent-1",
      name: "Empresa Test S.L.",
      shortCode: "TST",
      isActive: true,
      createdAt: new Date("2025-01-01T00:00:00Z"),
    };
    // First select: entities
    setupSelectMock([mockEntity]);
    // Second select: entity_modules
    setupSelectMock([]);

    const result = await getEntityWithModules("ent-1");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("ent-1");
    expect(result?.modules).toEqual([]);
  });

  it("entity found with 2 modules → returns entity with modules array", async () => {
    const mockEntity = {
      id: "ent-1",
      name: "Empresa Test S.L.",
      shortCode: "TST",
      isActive: true,
      createdAt: new Date("2025-01-01T00:00:00Z"),
    };
    const mockModules = [
      { entityId: "ent-1", module: "parking", enabled: true },
      { entityId: "ent-1", module: "office", enabled: false },
    ];
    setupSelectMock([mockEntity]);
    setupSelectMock(mockModules);

    const result = await getEntityWithModules("ent-1");
    expect(result?.modules).toHaveLength(2);
    expect(result?.modules[0]?.module).toBe("parking");
    expect(result?.modules[1]?.module).toBe("office");
  });
});

describe("getEntityEnabledModules", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("no rows in entity_modules → returns all 5 modules (opt-out model)", async () => {
    setupSelectMock([]);

    const result = await getEntityEnabledModules("ent-1");
    expect(result).toHaveLength(5);
    expect(result).toEqual(expect.arrayContaining(ALL_MODULES));
  });

  it("parking disabled → returns 5 modules without parking", async () => {
    const modules = [{ module: "parking", enabled: false }];
    setupSelectMock(modules);

    const result = await getEntityEnabledModules("ent-1");
    expect(result).toHaveLength(4);
    expect(result).not.toContain("parking");
    expect(result).toContain("office");
    expect(result).toContain("visitors");
  });

  it("all modules disabled → returns []", async () => {
    const modules = ALL_MODULES.map((m) => ({ module: m, enabled: false }));
    setupSelectMock(modules);

    const result = await getEntityEnabledModules("ent-1");
    expect(result).toHaveLength(0);
  });

  it("enabled=true rows are included in result", async () => {
    const modules = [
      { module: "parking", enabled: true },
      { module: "office", enabled: false },
    ];
    setupSelectMock(modules);

    const result = await getEntityEnabledModules("ent-1");
    expect(result).toContain("parking");
    expect(result).not.toContain("office");
  });

  it("DB throws (e.g. migration pending) → disables modules safely", async () => {
    // Simulate DB error by making the select mock throw
    vi.spyOn(mockDb, "select").mockImplementationOnce(() => {
      throw new Error("relation does not exist");
    });

    const result = await getEntityEnabledModules("ent-1");
    expect(result).toHaveLength(0);
  });
});
