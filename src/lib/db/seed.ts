/**
 * Database Seed Script
 *
 * Creates initial development data:
 * - Admin user (admin@gruposiete.com / password)
 * - Default entity
 * - Sample spots
 *
 * Usage: npx tsx src/lib/db/seed.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { format } from "node:util";

import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

function log(message: string, ...args: unknown[]) {
  process.stdout.write(`${format(message, ...args)}\n`);
}

async function seed() {
  log("Seeding database...");

  // 1. Create default entity
  const [entity] = await db
    .insert(schema.entities)
    .values({
      name: "Sede Central",
      shortCode: "SC",
    })
    .onConflictDoNothing()
    .returning();

  const entityId = entity?.id;
  log("Entity created: %s", entityId ?? "<none>");

  // 2. Create admin user
  const hashedPassword = await bcrypt.hash("password", 10);
  const [adminUser] = await db
    .insert(schema.users)
    .values({
      email: "admin@gruposiete.com",
      name: "Administrador",
      password: hashedPassword,
    })
    .onConflictDoNothing()
    .returning();

  if (adminUser) {
    await db
      .insert(schema.profiles)
      .values({
        id: adminUser.id,
        email: adminUser.email,
        fullName: "Administrador",
        role: "admin",
        entityId: entityId ?? null,
      })
      .onConflictDoNothing();

    await db
      .insert(schema.userPreferences)
      .values({ userId: adminUser.id })
      .onConflictDoNothing();

    log("Admin user created: %s", adminUser.email);
  }

  // 3. Create sample parking spots
  if (entityId) {
    const parkingSpots = Array.from({ length: 10 }, (_, i) => ({
      label: `P${String(i + 1).padStart(2, "0")}`,
      type: "standard" as const,
      resourceType: "parking" as const,
      entityId,
      isActive: true,
    }));

    await db.insert(schema.spots).values(parkingSpots).onConflictDoNothing();
    log("Created 10 parking spots");

    // 4. Create sample office spots
    const officeSpots = Array.from({ length: 8 }, (_, i) => ({
      label: `D${String(i + 1).padStart(2, "0")}`,
      type: "standard" as const,
      resourceType: "office" as const,
      entityId,
      isActive: true,
    }));

    await db.insert(schema.spots).values(officeSpots).onConflictDoNothing();
    log("Created 8 office spots");
  }

  log("Seed complete!");
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
