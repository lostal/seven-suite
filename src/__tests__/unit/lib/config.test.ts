import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", async () => {
  const { mockDb } = await import("../../mocks/db");
  return { db: mockDb };
});
vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((fn: unknown) => fn),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

import { revalidateTag } from "next/cache";

import { resetDbMocks, setupSelectMock } from "../../mocks/db";

// Import after mocks are set up
import {
  getAllResourceConfigs,
  getGlobalConfigs,
  getResourceConfig,
  invalidateConfigCache,
  CONFIG_CACHE_TAG,
} from "@/lib/config";

type MockRow = { key: string; value: unknown };

function setupConfigMock(rows: MockRow[]) {
  setupSelectMock(rows);
}

describe("getAllResourceConfigs", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("empty DB → returns parking defaults", async () => {
    setupConfigMock([]);
    const config = await getAllResourceConfigs("parking");
    expect(config.booking_enabled).toBe(true);
    expect(config.max_advance_days).toBe(14);
    expect(config.allowed_days).toEqual([1, 2, 3, 4, 5]);
    expect(config.cession_enabled).toBe(true);
    expect(config.time_slots_enabled).toBe(false);
  });

  it("empty DB → returns office defaults", async () => {
    setupConfigMock([]);
    const config = await getAllResourceConfigs("office");
    expect(config.booking_enabled).toBe(true);
    expect(config.max_advance_days).toBe(7);
    expect(config.time_slots_enabled).toBe(true);
    expect(config.slot_duration_minutes).toBe(60);
    expect(config.day_start_hour).toBe(8);
    expect(config.day_end_hour).toBe(20);
  });

  it("DB has parking.max_advance_days=30 → returns 30", async () => {
    setupConfigMock([{ key: "parking.max_advance_days", value: 30 }]);
    const config = await getAllResourceConfigs("parking");
    expect(config.max_advance_days).toBe(30);
  });

  it("DB has parking.booking_enabled=true (boolean) → true", async () => {
    setupConfigMock([{ key: "parking.booking_enabled", value: true }]);
    const config = await getAllResourceConfigs("parking");
    expect(config.booking_enabled).toBe(true);
  });

  it("DB has parking.booking_enabled=1 (integer) → true", async () => {
    setupConfigMock([{ key: "parking.booking_enabled", value: 1 }]);
    const config = await getAllResourceConfigs("parking");
    expect(config.booking_enabled).toBe(true);
  });

  it("DB has parking.booking_enabled=false (boolean) → false", async () => {
    setupConfigMock([{ key: "parking.booking_enabled", value: false }]);
    const config = await getAllResourceConfigs("parking");
    expect(config.booking_enabled).toBe(false);
  });

  it("DB has parking.booking_enabled=0 → false", async () => {
    setupConfigMock([{ key: "parking.booking_enabled", value: 0 }]);
    const config = await getAllResourceConfigs("parking");
    expect(config.booking_enabled).toBe(false);
  });

  it("DB has parking.allowed_days as non-array string → falls back to default [1,2,3,4,5]", async () => {
    setupConfigMock([{ key: "parking.allowed_days", value: "1,2,3" }]);
    const config = await getAllResourceConfigs("parking");
    expect(config.allowed_days).toEqual([1, 2, 3, 4, 5]);
  });

  it("DB has parking.allowed_days as array → returns that array", async () => {
    setupConfigMock([{ key: "parking.allowed_days", value: [1, 3, 5] }]);
    const config = await getAllResourceConfigs("parking");
    expect(config.allowed_days).toEqual([1, 3, 5]);
  });

  it("DB has parking.slot_duration_minutes=null → null", async () => {
    setupConfigMock([{ key: "parking.slot_duration_minutes", value: null }]);
    const config = await getAllResourceConfigs("parking");
    expect(config.slot_duration_minutes).toBeNull();
  });

  it("DB has office.max_consecutive_days=2 → returns 2", async () => {
    setupConfigMock([{ key: "office.max_consecutive_days", value: 2 }]);
    const config = await getAllResourceConfigs("office");
    expect(config.max_consecutive_days).toBe(2);
  });
});

describe("getGlobalConfigs", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("empty DB → defaults (notifications_enabled=true, email=true, teams=true)", async () => {
    setupConfigMock([]);
    const config = await getGlobalConfigs();
    expect(config.notifications_enabled).toBe(true);
    expect(config.email_notifications_enabled).toBe(true);
    expect(config.teams_notifications_enabled).toBe(true);
  });

  it("DB has notifications_enabled=false → false", async () => {
    setupConfigMock([{ key: "notifications_enabled", value: false }]);
    const config = await getGlobalConfigs();
    expect(config.notifications_enabled).toBe(false);
  });

  it("DB has email_notifications_enabled=0 → false", async () => {
    setupConfigMock([{ key: "email_notifications_enabled", value: 0 }]);
    const config = await getGlobalConfigs();
    expect(config.email_notifications_enabled).toBe(false);
  });

  it("DB has teams_notifications_enabled=1 → true", async () => {
    setupConfigMock([{ key: "teams_notifications_enabled", value: 1 }]);
    const config = await getGlobalConfigs();
    expect(config.teams_notifications_enabled).toBe(true);
  });
});

describe("getResourceConfig", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("delegates to getAllResourceConfigs and returns single key value", async () => {
    setupConfigMock([{ key: "parking.max_advance_days", value: 21 }]);
    const value = await getResourceConfig("parking", "max_advance_days");
    expect(value).toBe(21);
  });

  it("returns default when key not in DB", async () => {
    setupConfigMock([]);
    const value = await getResourceConfig("parking", "max_advance_days");
    expect(value).toBe(14);
  });

  it("returns boolean config correctly", async () => {
    setupConfigMock([{ key: "office.booking_enabled", value: false }]);
    const value = await getResourceConfig("office", "booking_enabled");
    expect(value).toBe(false);
  });
});

describe("getAllResourceConfigs with entity overlay", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("applies entity_config override on top of system_config", async () => {
    // First select: system_config has max_advance_days=30
    setupConfigMock([{ key: "parking.max_advance_days", value: 30 }]);
    // Second select: entity_config overrides to 60
    setupConfigMock([{ key: "parking.max_advance_days", value: 60 }]);

    const config = await getAllResourceConfigs("parking", "ent-1");

    expect(config.max_advance_days).toBe(60);
  });

  it("entity_config overrides only the keys it provides, falls back to system_config for others", async () => {
    setupConfigMock([{ key: "parking.max_advance_days", value: 30 }]);
    setupConfigMock([{ key: "parking.max_advance_days", value: 60 }]);

    const config = await getAllResourceConfigs("parking", "ent-1");

    // entity overrides this one
    expect(config.max_advance_days).toBe(60);
    // system_config or default for the rest
    expect(config.booking_enabled).toBe(true);
  });

  it("empty entity_config has no effect", async () => {
    setupConfigMock([{ key: "parking.max_advance_days", value: 30 }]);
    setupConfigMock([]);

    const config = await getAllResourceConfigs("parking", "ent-1");

    expect(config.max_advance_days).toBe(30);
  });

  it("entity_config with different keys does not affect other keys", async () => {
    setupConfigMock([]);
    setupConfigMock([{ key: "parking.cession_enabled", value: false }]);

    const config = await getAllResourceConfigs("parking", "ent-1");

    expect(config.cession_enabled).toBe(false);
    expect(config.booking_enabled).toBe(true); // default
  });

  it("entityId=null → no entity_config fetch (same as without entityId)", async () => {
    setupConfigMock([{ key: "parking.allowed_days", value: [1, 3, 5] }]);

    const config = await getAllResourceConfigs("parking", null);

    expect(config.allowed_days).toEqual([1, 3, 5]);
    // Only one select call (no entity_config fetch)
  });
});

describe("getResourceConfig with entityId", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("delegates to getAllResourceConfigs and returns single key with entity overlay", async () => {
    setupConfigMock([]);
    setupConfigMock([{ key: "office.max_advance_days", value: 14 }]);

    const value = await getResourceConfig(
      "office",
      "max_advance_days",
      "ent-1"
    );

    expect(value).toBe(14);
  });

  it("returns default when entity has no override", async () => {
    setupConfigMock([]);
    setupConfigMock([]);

    const value = await getResourceConfig(
      "parking",
      "cession_enabled",
      "ent-1"
    );

    expect(value).toBe(true);
  });
});

describe("invalidateConfigCache", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("calls revalidateTag with CONFIG_CACHE_TAG and 'default'", async () => {
    await invalidateConfigCache();
    expect(revalidateTag).toHaveBeenCalledWith(CONFIG_CACHE_TAG, "default");
  });

  it("calls revalidateTag exactly once", async () => {
    await invalidateConfigCache();
    expect(revalidateTag).toHaveBeenCalledTimes(1);
  });
});
