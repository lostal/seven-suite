/**
 * Test Database Helpers (extended)
 *
 * Seed helpers para tests de integración contra BD real.
 * Usa la instancia real de Drizzle — no mocks.
 */

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { randomUUID } from "crypto";

/**
 * Truncates all main tables in the test database to ensure a clean state between tests.
 * Only call this in tests!
 */
export async function clearTestDatabase() {
  if (!process.env.DATABASE_URL?.includes("test")) {
    throw new Error("clearTestDatabase should only run on a test database.");
  }

  await db.execute(
    sql`TRUNCATE TABLE
      entities,
      profiles,
      users,
      spots,
      reservations,
      cessions,
      visitor_reservations,
      announcements,
      announcement_reads,
      leave_requests,
      user_preferences
    CASCADE`
  );
}

/**
 * Creates seed entities for test purposes.
 */
export async function seedTestBaseData() {
  const entityId = randomUUID();
  const userId = randomUUID();

  await db.insert(schema.entities).values({
    id: entityId,
    name: "Test Entity",
    shortCode: "TE",
  });

  await db.insert(schema.users).values({
    id: userId,
    email: "test@domain.com",
    name: "Test User",
  });

  await db.insert(schema.profiles).values({
    id: userId,
    email: "test@domain.com",
    entityId: entityId,
    role: "employee",
    fullName: "Test Employee",
  });

  return { entityId, userId };
}

/**
 * Creates a second user in the same entity (for manager/HR tests).
 */
export async function seedTestSecondUser(entityId: string) {
  const userId = randomUUID();

  await db.insert(schema.users).values({
    id: userId,
    email: "manager@domain.com",
    name: "Manager User",
  });

  await db.insert(schema.profiles).values({
    id: userId,
    email: "manager@domain.com",
    entityId,
    role: "manager",
    fullName: "Manager User",
  });

  return { userId };
}

/**
 * Creates a test parking spot.
 */
export async function seedTestSpot(
  entityId: string,
  overrides?: {
    label?: string;
    type?: "standard" | "visitor";
    resourceType?: "parking" | "office";
  }
) {
  const spotId = randomUUID();

  const [spot] = await db
    .insert(schema.spots)
    .values({
      id: spotId,
      label: overrides?.label ?? "P-01",
      type: overrides?.type ?? "standard",
      resourceType: overrides?.resourceType ?? "parking",
      entityId,
    })
    .returning({ id: schema.spots.id });

  return { spotId: spot!.id };
}

/**
 * Creates a test reservation.
 */
export async function seedTestReservation(
  spotId: string,
  userId: string,
  date: string
) {
  const reservationId = randomUUID();

  const [reservation] = await db
    .insert(schema.reservations)
    .values({
      id: reservationId,
      spotId,
      userId,
      date,
      status: "confirmed",
    })
    .returning({ id: schema.reservations.id });

  return { reservationId: reservation!.id };
}

/**
 * Creates a test cession.
 */
export async function seedTestCession(
  spotId: string,
  userId: string,
  date: string,
  status: "available" | "reserved" | "cancelled" = "available"
) {
  const cessionId = randomUUID();

  const [cession] = await db
    .insert(schema.cessions)
    .values({
      id: cessionId,
      spotId,
      userId,
      date,
      status,
    })
    .returning({ id: schema.cessions.id });

  return { cessionId: cession!.id };
}

/**
 * Creates a test announcement.
 */
export async function seedTestAnnouncement(
  createdBy: string,
  entityId: string | null,
  overrides?: { title?: string; published?: boolean }
) {
  const announcementId = randomUUID();

  const [ann] = await db
    .insert(schema.announcements)
    .values({
      id: announcementId,
      title: overrides?.title ?? "Test Announcement",
      body: "<p>Test content</p>",
      entityId,
      publishedAt: overrides?.published ? new Date() : null,
      createdBy,
    })
    .returning({ id: schema.announcements.id });

  return { announcementId: ann!.id };
}

/**
 * Creates a test leave request.
 */
export async function seedTestLeaveRequest(
  employeeId: string,
  overrides?: {
    leaveType?: "vacation" | "sick" | "personal" | "other";
    startDate?: string;
    endDate?: string;
    status?: "pending" | "manager_approved" | "hr_approved" | "rejected";
  }
) {
  const leaveId = randomUUID();

  const [lr] = await db
    .insert(schema.leaveRequests)
    .values({
      id: leaveId,
      employeeId,
      leaveType: overrides?.leaveType ?? "vacation",
      startDate: overrides?.startDate ?? "2026-07-01",
      endDate: overrides?.endDate ?? "2026-07-14",
      status: overrides?.status ?? "pending",
      workingDays: 10,
    })
    .returning({ id: schema.leaveRequests.id });

  return { leaveId: lr!.id };
}
