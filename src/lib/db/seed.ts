/**
 * Database Seed Script
 *
 * Creates demo data for development:
 * - 3 entities (multi-tenant)
 * - 5 users with different roles (dev login via email)
 * - Parking & office spots with assignments
 * - Realistic reservations, cessions, visitor reservations
 * - Leave requests in various approval states
 * - Professional announcements
 * - Spanish holiday calendar
 *
 * Usage: pnpm db:seed
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { format } from "node:util";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";

import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

// ─── Deterministic UUIDs ──────────────────────────────────────────────────

const UUIDS = {
  users: {
    admin: "00000000-0000-0000-0000-000000000001",
    manager: "00000000-0000-0000-0000-000000000002",
    hr: "00000000-0000-0000-0000-000000000003",
    employee: "00000000-0000-0000-0000-000000000004",
    employee2: "00000000-0000-0000-0000-000000000005",
  },
  entities: {
    central: "00000000-0000-0000-0000-000000000010",
    norte: "00000000-0000-0000-0000-000000000011",
    levante: "00000000-0000-0000-0000-000000000012",
  },
  calendar: "00000000-0000-0000-0000-000000000020",
  announcements: {
    welcome: "00000000-0000-0000-0000-000000000030",
    protocol: "00000000-0000-0000-0000-000000000031",
    nominas: "00000000-0000-0000-0000-000000000032",
    holidays: "00000000-0000-0000-0000-000000000033",
    newhire: "00000000-0000-0000-0000-000000000034",
  },
  leaves: {
    summer: "00000000-0000-0000-0000-000000000040",
    family: "00000000-0000-0000-0000-000000000041",
    medical: "00000000-0000-0000-0000-000000000042",
    rejectedPersonal: "00000000-0000-0000-0000-000000000043",
    carlos: "00000000-0000-0000-0000-000000000044",
    laura: "00000000-0000-0000-0000-000000000045",
    sanjuan: "00000000-0000-0000-0000-000000000046",
    sanjose: "00000000-0000-0000-0000-000000000047",
  },
};

const seedUserIds = Object.values(UUIDS.users);
const seedEntityIds = Object.values(UUIDS.entities);
const seedAnnouncementIds = Object.values(UUIDS.announcements);

// ─── Date helpers ─────────────────────────────────────────────────────────

function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dstr(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// ─── Cleanup ──────────────────────────────────────────────────────────────

async function cleanPreviousSeed() {
  await db.delete(schema.reservations).where(
    sql`${schema.reservations.userId} IN (${sql.join(
      seedUserIds.map((id) => sql`${id}::uuid`),
      sql`, `
    )})`
  );
  await db.delete(schema.cessions).where(
    sql`${schema.cessions.userId} IN (${sql.join(
      seedUserIds.map((id) => sql`${id}::uuid`),
      sql`, `
    )})`
  );
  await db.delete(schema.visitorReservations).where(
    sql`${schema.visitorReservations.reservedBy} IN (${sql.join(
      seedUserIds.map((id) => sql`${id}::uuid`),
      sql`, `
    )})`
  );
  await db.delete(schema.leaveRequests).where(
    sql`${schema.leaveRequests.employeeId} IN (${sql.join(
      seedUserIds.map((id) => sql`${id}::uuid`),
      sql`, `
    )})`
  );
  await db.delete(schema.announcements).where(
    sql`${schema.announcements.id} IN (${sql.join(
      seedAnnouncementIds.map((id) => sql`${id}::uuid`),
      sql`, `
    )})`
  );
  await db.delete(schema.spots).where(
    sql`${schema.spots.entityId} IN (${sql.join(
      seedEntityIds.map((id) => sql`${id}::uuid`),
      sql`, `
    )})`
  );
  log("Cleaned previous seed data");
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function seed() {
  const now = new Date();
  const t = today();

  log("Seeding database...\n");

  await cleanPreviousSeed();

  // ─── Entities ──────────────────────────────────────────────────────────

  await db
    .insert(schema.entities)
    .values({
      id: UUIDS.entities.central,
      name: "Sede Central",
      shortCode: "SC",
      autonomousCommunity: "ES-MD",
    })
    .onConflictDoNothing();

  await db
    .insert(schema.entities)
    .values({
      id: UUIDS.entities.norte,
      name: "Sede Norte",
      shortCode: "SN",
      autonomousCommunity: "ES-CB",
    })
    .onConflictDoNothing();

  await db
    .insert(schema.entities)
    .values({
      id: UUIDS.entities.levante,
      name: "Sede Levante",
      shortCode: "SL",
      autonomousCommunity: "ES-VC",
    })
    .onConflictDoNothing();

  log("Entities: Sede Central, Sede Norte, Sede Levante");

  // ─── Users ─────────────────────────────────────────────────────────────

  const userRows = [
    {
      id: UUIDS.users.admin,
      email: "admin@gruposiete.es",
      name: "Alejandro Torres Vega",
    },
    {
      id: UUIDS.users.manager,
      email: "manager@gruposiete.es",
      name: "Carlos García López",
    },
    {
      id: UUIDS.users.hr,
      email: "rrhh@gruposiete.es",
      name: "Laura Martínez Ruiz",
    },
    {
      id: UUIDS.users.employee,
      email: "empleado@gruposiete.es",
      name: "Ana López Fernández",
    },
    {
      id: UUIDS.users.employee2,
      email: "empleado2@gruposiete.es",
      name: "Miguel Ángel Sánchez Gil",
    },
  ];

  for (const u of userRows) {
    await db
      .insert(schema.users)
      .values({ id: u.id, email: u.email, name: u.name, emailVerified: now })
      .onConflictDoNothing();
  }
  log("Users: 5 created");

  // ─── Profiles ──────────────────────────────────────────────────────────

  const managerId = UUIDS.users.manager;
  const hrId = UUIDS.users.hr;
  const employeeId = UUIDS.users.employee;
  const employee2Id = UUIDS.users.employee2;
  const centralId = UUIDS.entities.central;

  const profileRows = [
    {
      id: UUIDS.users.admin,
      email: "admin@gruposiete.es",
      fullName: "Alejandro Torres Vega",
      role: "admin" as const,
      entityId: centralId,
      jobTitle: "Director de IT",
      location: "Alcobendas",
    },
    {
      id: managerId,
      email: "manager@gruposiete.es",
      fullName: "Carlos García López",
      role: "manager" as const,
      entityId: centralId,
      jobTitle: "Director Comercial",
      location: "Alcobendas",
    },
    {
      id: hrId,
      email: "rrhh@gruposiete.es",
      fullName: "Laura Martínez Ruiz",
      role: "hr" as const,
      entityId: centralId,
      jobTitle: "Responsable de RRHH",
      location: "Alcobendas",
    },
    {
      id: employeeId,
      email: "empleado@gruposiete.es",
      fullName: "Ana López Fernández",
      role: "employee" as const,
      entityId: centralId,
      jobTitle: "Analista de Logística",
      location: "Alcobendas",
    },
    {
      id: employee2Id,
      email: "empleado2@gruposiete.es",
      fullName: "Miguel Ángel Sánchez Gil",
      role: "employee" as const,
      entityId: centralId,
      jobTitle: "Desarrollador Senior",
      location: "Alcobendas",
    },
  ];

  for (const p of profileRows) {
    await db.insert(schema.profiles).values(p).onConflictDoNothing();
  }

  // Both employees report to Carlos
  await db
    .update(schema.profiles)
    .set({ managerId })
    .where(
      sql`${schema.profiles.id} IN (${sql.join(
        [employeeId, employee2Id].map((id) => sql`${id}::uuid`),
        sql`, `
      )})`
    );

  log("Profiles: 5 with roles (admin, manager, hr, employee, employee2)");

  // ─── User preferences ──────────────────────────────────────────────────

  for (const u of userRows) {
    await db
      .insert(schema.userPreferences)
      .values({ userId: u.id })
      .onConflictDoNothing();
  }
  log("Preferences: 5 defaults created");

  // ─── Spots ─────────────────────────────────────────────────────────────
  //
  // Sede Central (focused):
  //   Parking:  SC-P01 (Carlos), SC-P02 (Miguel), SC-P03–P07 (free),
  //             SC-P08 (visitor)
  //   Office:   SC-D01 (Miguel), SC-D02–D06 (free)
  //
  // Other entities: minimal spots (3 parking + 3 office each, none assigned)

  // Sede Central — Parking
  const centralParkingLabels = [
    { label: "SC-P01", assignedTo: managerId },
    { label: "SC-P02", assignedTo: employee2Id },
    { label: "SC-P03" },
    { label: "SC-P04" },
    { label: "SC-P05" },
    { label: "SC-P06" },
    { label: "SC-P07" },
  ];

  for (let i = 0; i < centralParkingLabels.length; i++) {
    const cfg = centralParkingLabels[i]!;
    await db.insert(schema.spots).values({
      label: cfg.label,
      type: "standard",
      resourceType: "parking",
      entityId: centralId,
      assignedTo: cfg.assignedTo ?? null,
      isActive: true,
      positionX: 10 + (i + 1) * 15,
      positionY: 10 + (i + 1) * 10,
    });
  }

  // SC-P08 — visitor parking spot
  await db.insert(schema.spots).values({
    label: "SC-P08",
    type: "visitor",
    resourceType: "parking",
    entityId: centralId,
    isActive: true,
    positionX: 130,
    positionY: 90,
  });

  // Sede Central — Office
  const centralOfficeLabels = [
    { label: "SC-D01", assignedTo: employee2Id },
    { label: "SC-D02" },
    { label: "SC-D03" },
    { label: "SC-D04" },
    { label: "SC-D05" },
    { label: "SC-D06" },
  ];

  for (let i = 0; i < centralOfficeLabels.length; i++) {
    const cfg = centralOfficeLabels[i]!;
    await db.insert(schema.spots).values({
      label: cfg.label,
      type: "standard",
      resourceType: "office",
      entityId: centralId,
      assignedTo: cfg.assignedTo ?? null,
      isActive: true,
      positionX: 10 + (i + 1) * 15,
      positionY: 50 + (i + 1) * 10,
    });
  }

  // Sede Norte — 3 parking + 3 office
  for (let i = 1; i <= 3; i++) {
    await db.insert(schema.spots).values({
      label: `SN-P${String(i).padStart(2, "0")}`,
      type: "standard",
      resourceType: "parking",
      entityId: UUIDS.entities.norte,
      isActive: true,
      positionX: 10 + i * 15,
      positionY: 10 + i * 10,
    });
    await db.insert(schema.spots).values({
      label: `SN-D${String(i).padStart(2, "0")}`,
      type: "standard",
      resourceType: "office",
      entityId: UUIDS.entities.norte,
      isActive: true,
      positionX: 10 + i * 15,
      positionY: 50 + i * 10,
    });
  }

  // Sede Levante — 3 parking + 3 office
  for (let i = 1; i <= 3; i++) {
    await db.insert(schema.spots).values({
      label: `SL-P${String(i).padStart(2, "0")}`,
      type: "standard",
      resourceType: "parking",
      entityId: UUIDS.entities.levante,
      isActive: true,
      positionX: 10 + i * 15,
      positionY: 10 + i * 10,
    });
    await db.insert(schema.spots).values({
      label: `SL-D${String(i).padStart(2, "0")}`,
      type: "standard",
      resourceType: "office",
      entityId: UUIDS.entities.levante,
      isActive: true,
      positionX: 10 + i * 15,
      positionY: 50 + i * 10,
    });
  }

  const allSpots = await db.select().from(schema.spots);
  const spotByLabel = (label: string) =>
    allSpots.find((s) => s.label === label)!;

  log(`Spots: ${allSpots.length} created (parking + office across 3 entities)`);

  // ─── Entity modules ────────────────────────────────────────────────────

  const modules = [
    "parking",
    "office",
    "vacaciones",
    "tablon",
    "directorio",
    "panel",
    "administracion",
    "ajustes",
  ];

  for (const eid of seedEntityIds) {
    for (const mod of modules) {
      await db
        .insert(schema.entityModules)
        .values({ entityId: eid, module: mod, enabled: true })
        .onConflictDoNothing();
    }
  }
  log("Modules: all enabled for all entities");

  // ─── Parking reservations ──────────────────────────────────────────────
  //
  // Free pool: SC-P03 to SC-P07 (5 spots)
  // Ana reserves regularly (no assigned spot)
  // Carlos, Laura, Miguel reserve occasionally

  type ParkRes = { user: string; spot: string; day: number };

  const anaParking: ParkRes[] = [
    { user: "employee", spot: "SC-P03", day: 0 },
    { user: "employee", spot: "SC-P04", day: 1 },
    { user: "employee", spot: "SC-P05", day: 2 },
    { user: "employee", spot: "SC-P04", day: 6 },
    { user: "employee", spot: "SC-P05", day: 7 },
    { user: "employee", spot: "SC-P03", day: 8 },
    { user: "employee", spot: "SC-P04", day: 9 },
    { user: "employee", spot: "SC-P05", day: 13 },
    { user: "employee", spot: "SC-P03", day: 12 },
    { user: "employee", spot: "SC-P04", day: 14 },
    { user: "employee", spot: "SC-P05", day: 15 },
  ];

  const otherParking: ParkRes[] = [
    { user: "manager", spot: "SC-P06", day: 1 },
    { user: "hr", spot: "SC-P07", day: 2 },
    { user: "manager", spot: "SC-P06", day: 6 },
    { user: "hr", spot: "SC-P07", day: 5 },
    { user: "employee2", spot: "SC-P07", day: 7 },
    { user: "employee2", spot: "SC-P06", day: 9 },
    { user: "manager", spot: "SC-P06", day: 13 },
    { user: "hr", spot: "SC-P07", day: 12 },
  ];

  const allParking = [...anaParking, ...otherParking];

  for (const r of allParking) {
    const userId =
      r.user === "manager"
        ? managerId
        : r.user === "hr"
          ? hrId
          : r.user === "employee"
            ? employeeId
            : employee2Id;
    await db.insert(schema.reservations).values({
      spotId: spotByLabel(r.spot).id,
      userId,
      resourceType: "parking",
      date: dstr(addDays(t, r.day)),
      status: "confirmed",
    });
  }
  log(`Parking reservations: ${allParking.length} created`);

  // ─── Office reservations ────────────────────────────────────────────────
  //
  // Free office desks: SC-D02 to SC-D06 (5 desks)
  // Ana, Carlos, Laura, Miguel reserve in varied pattern

  type OfficeRes = { user: string; spot: string; day: number };

  const officeReservations: OfficeRes[] = [
    // Ana — regular office presence (~3 days/week)
    { user: "employee", spot: "SC-D02", day: 0 },
    { user: "employee", spot: "SC-D02", day: 1 },
    { user: "employee", spot: "SC-D02", day: 5 },
    { user: "employee", spot: "SC-D02", day: 7 },
    { user: "employee", spot: "SC-D02", day: 8 },
    { user: "employee", spot: "SC-D02", day: 9 },
    { user: "employee", spot: "SC-D02", day: 12 },
    { user: "employee", spot: "SC-D02", day: 14 },
    { user: "employee", spot: "SC-D02", day: 15 },
    // Carlos — 2-3 days/week in office
    { user: "manager", spot: "SC-D03", day: 0 },
    { user: "manager", spot: "SC-D03", day: 2 },
    { user: "manager", spot: "SC-D03", day: 5 },
    { user: "manager", spot: "SC-D03", day: 8 },
    { user: "manager", spot: "SC-D03", day: 13 },
    { user: "manager", spot: "SC-D03", day: 12 },
    // Laura — 2-3 days/week
    { user: "hr", spot: "SC-D04", day: 1 },
    { user: "hr", spot: "SC-D04", day: 5 },
    { user: "hr", spot: "SC-D04", day: 7 },
    { user: "hr", spot: "SC-D04", day: 9 },
    { user: "hr", spot: "SC-D04", day: 14 },
    // Miguel — some days (has D01 assigned for his regular days)
    { user: "employee2", spot: "SC-D05", day: 0 },
    { user: "employee2", spot: "SC-D05", day: 2 },
    { user: "employee2", spot: "SC-D05", day: 6 },
    { user: "employee2", spot: "SC-D05", day: 13 },
  ];

  for (const r of officeReservations) {
    const userId =
      r.user === "manager"
        ? managerId
        : r.user === "hr"
          ? hrId
          : r.user === "employee"
            ? employeeId
            : employee2Id;
    await db.insert(schema.reservations).values({
      spotId: spotByLabel(r.spot).id,
      userId,
      resourceType: "office",
      date: dstr(addDays(t, r.day)),
      status: "confirmed",
    });
  }
  log(`Office reservations: ${officeReservations.length} created`);

  // ─── Cessions ──────────────────────────────────────────────────────────
  //
  // Carlos cedes SC-P01 on days he won't come
  // Miguel cedes SC-P02 on days he won't come

  const managerSpotP01 = spotByLabel("SC-P01");
  const employee2SpotP02 = spotByLabel("SC-P02");

  // Carlos cedes P01
  const p01Cessions: { offset: number; status: "available" | "reserved" }[] = [
    { offset: -2, status: "reserved" }, // past — Ana took it
    { offset: 0, status: "available" }, // today — still free
    { offset: 2, status: "available" }, // Fri — up for grabs
    { offset: 5, status: "reserved" }, // Mon — Ana took it
    { offset: 7, status: "available" }, // Wed — up for grabs
    { offset: 9, status: "available" }, // Fri — up for grabs
  ];

  for (const cd of p01Cessions) {
    await db.insert(schema.cessions).values({
      spotId: managerSpotP01.id,
      userId: managerId,
      date: dstr(addDays(t, cd.offset)),
      status: cd.status,
    });
  }

  // Miguel cedes P02
  const p02Cessions: { offset: number; status: "available" | "reserved" }[] = [
    { offset: -1, status: "reserved" }, // Jun 16 (Tue) — Ana took it
    { offset: 1, status: "reserved" }, // Jun 18 (Thu) — Laura took it
    { offset: 6, status: "available" }, // Jun 23 (Tue) — up for grabs
    { offset: 8, status: "available" }, // Jun 25 (Thu) — up for grabs
    { offset: 13, status: "available" }, // Jun 30 (Tue) — up for grabs
  ];

  for (const cd of p02Cessions) {
    await db.insert(schema.cessions).values({
      spotId: employee2SpotP02.id,
      userId: employee2Id,
      date: dstr(addDays(t, cd.offset)),
      status: cd.status,
    });
  }

  // Reservations for ceded spots
  // Ana reserved past cessions
  await db.insert(schema.reservations).values({
    spotId: managerSpotP01.id,
    userId: employeeId,
    resourceType: "parking",
    date: dstr(addDays(t, -2)),
    status: "confirmed",
  });
  await db.insert(schema.reservations).values({
    spotId: employee2SpotP02.id,
    userId: employeeId,
    resourceType: "parking",
    date: dstr(addDays(t, -1)),
    status: "confirmed",
  });
  // Ana reserves Carlos's ceded P01 on t+5 (Mon)
  await db.insert(schema.reservations).values({
    spotId: managerSpotP01.id,
    userId: employeeId,
    resourceType: "parking",
    date: dstr(addDays(t, 5)),
    status: "confirmed",
  });
  // Laura reserves Miguel's ceded P02 on t+1 (Thu)
  await db.insert(schema.reservations).values({
    spotId: employee2SpotP02.id,
    userId: hrId,
    resourceType: "parking",
    date: dstr(addDays(t, 1)),
    status: "confirmed",
  });
  log("Cessions: 11 from Carlos (P01) and Miguel (P02)");

  // ─── Visitor reservations ───────────────────────────────────────────────

  const visitorSpotP08 = spotByLabel("SC-P08");

  await db.insert(schema.visitorReservations).values({
    spotId: visitorSpotP08.id,
    reservedBy: employeeId,
    date: dstr(addDays(t, 5)),
    visitorName: "María Sánchez",
    visitorCompany: "Proveedora del Norte S.L.",
    visitorEmail: "maria.sanchez@proveedora.com",
    status: "confirmed",
    notificationSent: false,
  });
  await db.insert(schema.visitorReservations).values({
    spotId: visitorSpotP08.id,
    reservedBy: managerId,
    date: dstr(addDays(t, 9)),
    visitorName: "Pedro Gómez",
    visitorCompany: "Transportes Gómez S.A.",
    visitorEmail: "pedro.gomez@transgomez.com",
    status: "confirmed",
    notificationSent: false,
  });
  await db.insert(schema.visitorReservations).values({
    spotId: visitorSpotP08.id,
    reservedBy: hrId,
    date: dstr(addDays(t, 13)),
    visitorName: "Elena Torres",
    visitorCompany: "Consultora Torres & Asociados",
    visitorEmail: "elena@torresconsultores.es",
    status: "confirmed",
    notificationSent: false,
  });

  log("Visitors: 3 reservations created");

  // ─── Leave requests ────────────────────────────────────────────────────

  const leaveRequests = [
    {
      id: UUIDS.leaves.summer,
      employeeId,
      leaveType: "vacation" as const,
      startDate: dstr(new Date(2026, 6, 14)), // Jul 14
      endDate: dstr(new Date(2026, 6, 28)), // Jul 28
      status: "pending" as const,
      reason: "Vacaciones de verano",
      workingDays: 11,
    },
    {
      id: UUIDS.leaves.family,
      employeeId,
      leaveType: "vacation" as const,
      startDate: dstr(new Date(2026, 7, 14)), // Aug 14
      endDate: dstr(new Date(2026, 7, 22)), // Aug 22
      status: "approved" as const,
      reason: "Viaje familiar",
      reviewerId: managerId,
      reviewedAt: now,
      reviewerNotes: "Aprobado sin incidencias",
      workingDays: 7,
    },
    {
      id: UUIDS.leaves.medical,
      employeeId,
      leaveType: "personal" as const,
      startDate: dstr(addDays(t, 2)), // Jun 19 (Fri)
      endDate: dstr(addDays(t, 2)),
      status: "pending" as const,
      reason: "Cita médica",
      workingDays: 1,
    },
    {
      id: UUIDS.leaves.rejectedPersonal,
      employeeId,
      leaveType: "personal" as const,
      startDate: dstr(addDays(t, 5)), // Jun 22 (Mon)
      endDate: dstr(addDays(t, 5)),
      status: "rejected" as const,
      reason: "Asunto personal",
      reviewerId: managerId,
      reviewedAt: now,
      reviewerNotes: "Día con mucha carga de trabajo, solicitar otra fecha",
      workingDays: 1,
    },
    {
      id: UUIDS.leaves.carlos,
      employeeId: managerId,
      leaveType: "vacation" as const,
      startDate: dstr(addDays(t, 20)), // Jul 7 (Mon)
      endDate: dstr(addDays(t, 24)), // Jul 11 (Fri)
      status: "pending" as const,
      reason: "Asuntos personales",
      workingDays: 5,
    },
    {
      id: UUIDS.leaves.laura,
      employeeId: hrId,
      leaveType: "vacation" as const,
      startDate: dstr(new Date(2026, 8, 1)), // Sep 1
      endDate: dstr(new Date(2026, 8, 15)), // Sep 15
      status: "pending" as const,
      reason: "Vacaciones de septiembre",
      workingDays: 11,
    },
    {
      id: UUIDS.leaves.sanjuan,
      employeeId: employee2Id,
      leaveType: "vacation" as const,
      startDate: dstr(addDays(t, 5)), // Jun 22 (Mon)
      endDate: dstr(addDays(t, 7)), // Jun 24 (Wed)
      status: "approved" as const,
      reason: "Puente de San Juan",
      reviewerId: hrId,
      reviewedAt: addDays(t, -1),
      reviewerNotes: "Aprobado. Buen viaje.",
      workingDays: 3,
    },
    {
      id: UUIDS.leaves.sanjose,
      employeeId,
      leaveType: "vacation" as const,
      startDate: dstr(new Date(2026, 2, 19)), // Mar 19
      endDate: dstr(new Date(2026, 2, 21)), // Mar 21
      status: "approved" as const,
      reason: "Puente de San José",
      reviewerId: hrId,
      reviewedAt: new Date(2026, 2, 10),
      workingDays: 2,
    },
  ];

  for (const lr of leaveRequests) {
    await db.insert(schema.leaveRequests).values(lr);
  }
  log("Leave requests: 8 total (pending, approved, rejected)");

  // ─── Announcements ─────────────────────────────────────────────────────

  await db.insert(schema.announcements).values({
    id: UUIDS.announcements.welcome,
    title: "Bienvenidos a Seven Suite",
    body: "Nos complace presentar el nuevo portal del empleado de GRUPOSIETE. Desde aquí podrás gestionar tus reservas de parking y oficina, solicitar vacaciones, consultar el directorio de compañeros y estar al día de las comunicaciones internas. Si tienes cualquier duda, contacta con el equipo de RRHH.",
    entityId: centralId,
    publishedAt: addDays(t, -10),
    createdBy: hrId,
  });
  await db.insert(schema.announcements).values({
    id: UUIDS.announcements.protocol,
    title: "Nuevo protocolo de reserva de plazas",
    body: "Recordamos a todos los empleados el procedimiento para la reserva de plazas de parking:\n\n1. Las plazas asignadas a directores pueden ser cedidas cuando no estén en la oficina.\n2. Las reservas pueden hacerse con hasta 30 días de antelación.\n3. Las cancelaciones deben realizarse con al menos 2 horas de antelación para liberar la plaza.\n4. Los visitantes deben ser registrados por el empleado anfitrión.\n\nCualquier incidencia puede reportarse a través de la sección de Ajustes.",
    entityId: centralId,
    publishedAt: addDays(t, -5),
    createdBy: hrId,
  });
  await db.insert(schema.announcements).values({
    id: UUIDS.announcements.nominas,
    title: "Próximo cierre de nóminas — Junio 2026",
    body: "Informamos que el cierre de nóminas del mes de junio se realizará el día 27. Rogamos que todas las incidencias (horas extra, bajas, ausencias) estén registradas antes del día 25 a las 14:00.\n\nPara cualquier consulta relacionada con la nómina, podéis contactar con Laura Martínez (rrhh@gruposiete.es).",
    entityId: centralId,
    publishedAt: addDays(t, -2),
    createdBy: hrId,
  });
  await db.insert(schema.announcements).values({
    id: UUIDS.announcements.holidays,
    title: "Calendario de festivos 2026",
    body: "Ya está disponible el calendario de festivos para el año 2026. Los días no laborables se reflejan automáticamente en el sistema de reservas. Podéis consultar los festivos nacionales, autonómicos y locales en el calendario de vuestra sede.",
    entityId: null,
    publishedAt: addDays(t, -15),
    createdBy: hrId,
  });
  await db.insert(schema.announcements).values({
    id: UUIDS.announcements.newhire,
    title: "Nuevo fichaje en el equipo de IT",
    body: "Damos la bienvenida a Miguel Ángel Sánchez Gil, que se incorpora al equipo de IT como Desarrollador Senior. Miguel aporta más de 8 años de experiencia en desarrollo de software y trabajará desde nuestra Sede Central en Alcobendas.\n\n¡Bienvenido al equipo, Miguel!",
    entityId: centralId,
    publishedAt: addDays(t, -1),
    createdBy: hrId,
  });

  log("Announcements: 5 published");

  // ─── Holiday calendar ──────────────────────────────────────────────────

  await db
    .insert(schema.holidayCalendars)
    .values({
      id: UUIDS.calendar,
      name: "Festivos España 2026",
      country: "ES",
      year: 2026,
      isActive: true,
    })
    .onConflictDoNothing();

  const nationalHolidays: [string, string][] = [
    ["2026-01-01", "Año Nuevo"],
    ["2026-01-06", "Epifanía del Señor"],
    ["2026-04-02", "Jueves Santo"],
    ["2026-04-03", "Viernes Santo"],
    ["2026-05-01", "Fiesta del Trabajo"],
    ["2026-08-15", "Asunción de la Virgen"],
    ["2026-10-12", "Fiesta Nacional de España"],
    ["2026-11-01", "Todos los Santos"],
    ["2026-12-06", "Día de la Constitución"],
    ["2026-12-08", "Inmaculada Concepción"],
    ["2026-12-25", "Natividad del Señor"],
  ];

  const regionalHolidays: [string, string, boolean][] = [
    ["2026-05-02", "Fiesta de la Comunidad de Madrid", false],
    ["2026-07-25", "Santiago Apóstol", false],
    ["2026-10-09", "Día de la Comunitat Valenciana", false],
  ];

  for (const [date, name] of nationalHolidays) {
    await db
      .insert(schema.holidays)
      .values({
        calendarId: UUIDS.calendar,
        date,
        name,
        isOptional: false,
      })
      .onConflictDoNothing();
  }

  for (const [date, name, optional] of regionalHolidays) {
    await db
      .insert(schema.holidays)
      .values({
        calendarId: UUIDS.calendar,
        date,
        name,
        isOptional: optional,
      })
      .onConflictDoNothing();
  }

  // Link calendar to all entities
  for (const eid of seedEntityIds) {
    await db
      .insert(schema.entityHolidayCalendars)
      .values({
        entityId: eid,
        calendarId: UUIDS.calendar,
      })
      .onConflictDoNothing();
  }

  log("Holidays: 14 days (national + regional) linked to all entities");

  // ─── Done ──────────────────────────────────────────────────────────────

  log("\nSeed complete!");
  log("───────────────");
  log("Dev login: http://localhost:3000/dev-login");
  log("───────────────");
  log("  admin@gruposiete.es      — Administrador (Alejandro)");
  log("  manager@gruposiete.es    — Manager (Carlos) — P01 asignada");
  log("  rrhh@gruposiete.es       — RRHH (Laura)");
  log("  empleado@gruposiete.es   — Empleado 1 (Ana) — sin plazas asignadas");
  log("  empleado2@gruposiete.es  — Empleado 2 (Miguel) — P02 + D01 asignadas");

  await client.end();
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function log(message: string, ...args: unknown[]) {
  process.stdout.write(`${format(message, ...args)}\n`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
