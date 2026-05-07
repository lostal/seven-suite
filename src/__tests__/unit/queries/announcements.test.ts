/**
 * Tests de Announcement Queries
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  mockDb,
  resetDbMocks,
  setupSelectMock,
  setupInsertMock,
} from "../../mocks/db";

vi.mock("@/lib/db", async () => {
  const { mockDb } = await import("../../mocks/db");
  return { db: mockDb };
});

import {
  getPublishedAnnouncements,
  getAnnouncementsForManagement,
  countUnreadAnnouncements,
  getUnreadAnnouncementIds,
  markAsRead,
} from "@/lib/queries/announcements";

const NOW = new Date("2026-06-15T12:00:00Z");

const MOCK_ANNOUNCEMENTS = [
  {
    id: "ann-1",
    title: "Comunicado 1",
    body: "Contenido 1",
    entityId: "ent-1",
    publishedAt: new Date("2026-06-01"),
    expiresAt: new Date("2026-12-31"),
    createdBy: "user-1",
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    authorName: "Admin User",
  },
  {
    id: "ann-2",
    title: "Comunicado 2",
    body: "Contenido 2",
    entityId: null,
    publishedAt: new Date("2026-06-10"),
    expiresAt: null,
    createdBy: "user-1",
    createdAt: new Date("2026-06-10"),
    updatedAt: new Date("2026-06-10"),
    authorName: "Admin User",
  },
];

describe("getPublishedAnnouncements", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns published, non-expired announcements for an entity", async () => {
    setupSelectMock(MOCK_ANNOUNCEMENTS);

    const result = await getPublishedAnnouncements("ent-1");

    expect(result).toHaveLength(2);
    expect(result[0]?.authorName).toBe("Admin User");
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });

  it("returns only global announcements when entityId is null", async () => {
    setupSelectMock([MOCK_ANNOUNCEMENTS[1]!]); // Only the global one

    const result = await getPublishedAnnouncements(null);

    expect(result).toHaveLength(1);
    expect(result[0]?.entityId).toBeNull();
  });

  it("returns empty array when no announcements exist", async () => {
    setupSelectMock([]);

    const result = await getPublishedAnnouncements("ent-1");

    expect(result).toHaveLength(0);
  });

  it("uses innerJoin with profiles for author name", async () => {
    setupSelectMock(MOCK_ANNOUNCEMENTS);

    await getPublishedAnnouncements("ent-1");

    const builder = vi.mocked(mockDb.select).mock.results[0]?.value;
    expect(builder.innerJoin).toHaveBeenCalled();
  });

  it("maps authorName to empty string when null", async () => {
    setupSelectMock([{ ...MOCK_ANNOUNCEMENTS[0]!, authorName: null }]);

    const result = await getPublishedAnnouncements("ent-1");

    expect(result[0]?.authorName).toBe("");
  });
});

describe("getAnnouncementsForManagement", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns all announcements for an entity (including drafts)", async () => {
    setupSelectMock([
      {
        ...MOCK_ANNOUNCEMENTS[0]!,
        publishedAt: null, // draft
      },
    ]);

    const result = await getAnnouncementsForManagement("ent-1");

    expect(result).toHaveLength(1);
  });

  it("returns only global when entityId is null", async () => {
    setupSelectMock([MOCK_ANNOUNCEMENTS[1]!]);

    const result = await getAnnouncementsForManagement(null);

    expect(result).toHaveLength(1);
    expect(result[0]?.entityId).toBeNull();
  });

  it("returns all for entity including global", async () => {
    setupSelectMock(MOCK_ANNOUNCEMENTS);

    const result = await getAnnouncementsForManagement("ent-1");

    expect(result).toHaveLength(2);
  });
});

describe("markAsRead", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
  });

  it("inserts a read record with onConflictDoNothing", async () => {
    setupInsertMock([]);

    await markAsRead("ann-1", "user-1");

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    const builder = vi.mocked(mockDb.insert).mock.results[0]?.value;
    expect(builder.values).toHaveBeenCalled();
    expect(builder.onConflictDoNothing).toHaveBeenCalled();
  });

  it("does not throw on conflict (duplicate read)", async () => {
    setupInsertMock([]);

    await expect(markAsRead("ann-1", "user-1")).resolves.toBeUndefined();
  });
});

// ─── countUnreadAnnouncements / getUnreadAnnouncementIds ────────────────────

describe("countUnreadAnnouncements", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns count of unread announcements for entity", async () => {
    // MAIN query (outer db.select runs first in method chain)
    setupSelectMock([{ id: "ann-1" }, { id: "ann-2" }, { id: "ann-3" }]);
    // SUBQUERY (inner db.select runs inside notExists argument evaluation)
    setupSelectMock([]);

    const count = await countUnreadAnnouncements("user-1", "ent-A");

    expect(count).toBe(3);
  });

  it("returns zero when all are read", async () => {
    setupSelectMock([]);
    setupSelectMock([]);

    const count = await countUnreadAnnouncements("user-1", "ent-A");

    expect(count).toBe(0);
  });

  it("filters by null entityId (only global announcements)", async () => {
    setupSelectMock([{ id: "ann-global" }]);
    setupSelectMock([]);

    const count = await countUnreadAnnouncements("user-1", null);

    expect(count).toBe(1);
  });

  it("makes two select calls (subquery + main query)", async () => {
    setupSelectMock([]);
    setupSelectMock([{ id: "ann-1" }]);

    await countUnreadAnnouncements("user-1", "ent-A");

    expect(mockDb.select).toHaveBeenCalledTimes(2);
  });
});

describe("getUnreadAnnouncementIds", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns Set of unread announcement IDs", async () => {
    setupSelectMock([{ id: "ann-1" }, { id: "ann-2" }]);
    setupSelectMock([]);

    const result = await getUnreadAnnouncementIds("user-1", "ent-A");

    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(2);
    expect(result.has("ann-1")).toBe(true);
    expect(result.has("ann-2")).toBe(true);
  });

  it("returns empty Set when all announcements are read", async () => {
    setupSelectMock([]);
    setupSelectMock([]);

    const result = await getUnreadAnnouncementIds("user-1", "ent-A");

    expect(result.size).toBe(0);
  });

  it("returns empty Set when no announcements exist", async () => {
    setupSelectMock([]);
    setupSelectMock([]);

    const result = await getUnreadAnnouncementIds("user-1", null);

    expect(result.size).toBe(0);
  });
});
