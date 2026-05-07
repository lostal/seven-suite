/**
 * Integration Tests: Announcements Queries
 *
 * Requires: Docker PostgreSQL running (`pnpm db:up`).
 *
 * Run: pnpm vitest run src/__tests__/integration/announcements.int.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  clearTestDatabase,
  seedTestBaseData,
  seedTestSecondUser,
  seedTestAnnouncement,
} from "../test-db";
import {
  getPublishedAnnouncements,
  countUnreadAnnouncements,
  getUnreadAnnouncementIds,
  markAsRead,
} from "@/lib/queries/announcements";

let entityId: string;
let userId: string;
let managerId: string;
let announcementId: string;

beforeAll(async () => {
  await clearTestDatabase();
  const base = await seedTestBaseData();
  entityId = base.entityId;
  userId = base.userId;

  const manager = await seedTestSecondUser(entityId);
  managerId = manager.userId;

  const ann = await seedTestAnnouncement(managerId, entityId, {
    published: true,
  });
  announcementId = ann.announcementId;
});

afterAll(async () => {
  await clearTestDatabase();
});

describe("getPublishedAnnouncements (integration)", () => {
  it("returns published announcements for entity", async () => {
    const result = await getPublishedAnnouncements(entityId);

    const ann = result.find((a) => a.id === announcementId);
    expect(ann).toBeDefined();
    expect(ann!.title).toBe("Test Announcement");
    // authorName may be "" if fullName is null in DB (maps via toRow)
    expect(typeof ann!.authorName).toBe("string");
  });

  it("returns empty for non-existent entity", async () => {
    const result = await getPublishedAnnouncements(
      "00000000-0000-0000-0000-000000000000"
    );
    expect(result).toHaveLength(0);
  });
});

describe("countUnreadAnnouncements (integration)", () => {
  it("counts unread announcements for a user who hasn't read any", async () => {
    const count = await countUnreadAnnouncements(userId, entityId);

    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("returns zero after marking as read", async () => {
    await markAsRead(announcementId, userId);

    const count = await countUnreadAnnouncements(userId, entityId);

    expect(count).toBe(0);
  });
});

describe("getUnreadAnnouncementIds (integration)", () => {
  it("returns Set of unread announcement IDs", async () => {
    const ids = await getUnreadAnnouncementIds(userId, entityId);

    expect(ids).toBeInstanceOf(Set);
    // After marking as read in previous test, should be empty now
    expect(ids.has(announcementId)).toBe(false);
  });
});
