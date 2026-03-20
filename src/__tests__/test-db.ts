import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { randomUUID } from "crypto";

/**
 * Truncates all main tables in the test database to ensure a clean state between tests.
 * Only call this in tests!
 */
export async function clearTestDatabase() {
  // DO NOT RUN in production
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
      roles,
      user_preferences
    CASCADE`
  );
}

/**
 * Creates seed entities for test purposes (like default entity and test profiles)
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
  });

  return { entityId, userId };
}
