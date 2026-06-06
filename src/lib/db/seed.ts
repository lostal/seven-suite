/**
 * Database Seed Script
 *
 * Creates demo data for development:
 * - 3 entities (multi-tenant)
 * - 4 users with different roles (dev login via email)
 * - Parking & office spots with manager assignments
 * - Sample reservations, cessions, visitor reservations
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
  },
  entities: {
    central: "00000000-0000-0000-0000-000000000010",
    norte: "00000000-0000-0000-0000-000000000011",
    levante: "00000000-0000-0000-0000-000000000012",
  },
  calendar: "00000000-0000-0000-0000-000000000020",
};

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

// ─── Main ──────────────────────────────────────────────────────────────────

async function seed() {
  const now = new Date();
  const t = today();

  log("Seeding database...\n");

  // ─── Entities ──────────────────────────────────────────────────────────

  await db
    .insert(schema.entities)
    .values({
      id: UUIDS.entities.central,
      name: "Sede Central",
      shortCode: "SC",
      autonomousCommunity: "Comunidad de Madrid",
    })
    .onConflictDoNothing();

  await db
    .insert(schema.entities)
    .values({
      id: UUIDS.entities.norte,
      name: "Sede Norte",
      shortCode: "SN",
      autonomousCommunity: "Cantabria",
    })
    .onConflictDoNothing();

  await db
    .insert(schema.entities)
    .values({
      id: UUIDS.entities.levante,
      name: "Sede Levante",
      shortCode: "SL",
      autonomousCommunity: "Comunitat Valenciana",
    })
    .onConflictDoNothing();

  log("Entities: Sede Central, Sede Norte, Sede Levante");

  // ─── Users ─────────────────────────────────────────────────────────────

  const userRows = [
    {
      id: UUIDS.users.admin,
      email: "admin@gruposiete.es",
      name: "Administrador del Sistema",
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
  ];

  for (const u of userRows) {
    await db
      .insert(schema.users)
      .values({ id: u.id, email: u.email, name: u.name, emailVerified: now })
      .onConflictDoNothing();
  }
  log("Users: 4 created");

  // ─── Profiles ──────────────────────────────────────────────────────────

  const profileRows = [
    {
      id: UUIDS.users.admin,
      email: "admin@gruposiete.es",
      fullName: "Administrador del Sistema",
      role: "admin" as const,
      entityId: UUIDS.entities.central,
      jobTitle: "Director de IT",
      location: "Alcobendas",
    },
    {
      id: UUIDS.users.manager,
      email: "manager@gruposiete.es",
      fullName: "Carlos García López",
      role: "manager" as const,
      entityId: UUIDS.entities.central,
      jobTitle: "Director Comercial",
      location: "Alcobendas",
    },
    {
      id: UUIDS.users.hr,
      email: "rrhh@gruposiete.es",
      fullName: "Laura Martínez Ruiz",
      role: "hr" as const,
      entityId: UUIDS.entities.central,
      jobTitle: "Responsable de RRHH",
      location: "Alcobendas",
    },
    {
      id: UUIDS.users.employee,
      email: "empleado@gruposiete.es",
      fullName: "Ana López Fernández",
      role: "employee" as const,
      entityId: UUIDS.entities.central,
      jobTitle: "Analista de Logística",
      location: "Alcobendas",
    },
  ];

  for (const p of profileRows) {
    await db.insert(schema.profiles).values(p).onConflictDoNothing();
  }

  // Set manager relationship: Ana is managed by Carlos
  await db
    .update(schema.profiles)
    .set({ managerId: UUIDS.users.manager })
    .where(sql`${schema.profiles.id} = ${UUIDS.users.employee}`);

  log("Profiles: 4 with roles (admin, manager, hr, employee)");

  // ─── User preferences ──────────────────────────────────────────────────

  for (const u of userRows) {
    await db
      .insert(schema.userPreferences)
      .values({ userId: u.id })
      .onConflictDoNothing();
  }
  log("Preferences: 4 defaults created");

  // ─── Spots ─────────────────────────────────────────────────────────────
  // Parking: P01-P10, Office: D01-D08 for Sede Central
  // Also spots for other entities. Labels must be globally unique.

  const spotConfigs: {
    prefix: string;
    entityId: string;
    parking: number;
    office: number;
    assignedParking?: number[];
  }[] = [
    {
      prefix: "SC",
      entityId: UUIDS.entities.central,
      parking: 10,
      office: 8,
      assignedParking: [1, 2],
    },
    { prefix: "SN", entityId: UUIDS.entities.norte, parking: 5, office: 4 },
    { prefix: "SL", entityId: UUIDS.entities.levante, parking: 4, office: 3 },
  ];

  const managerProfileId = UUIDS.users.manager;

  for (const cfg of spotConfigs) {
    for (let i = 1; i <= cfg.parking; i++) {
      const label = `${cfg.prefix}-P${String(i).padStart(2, "0")}`;
      const isAssigned = cfg.assignedParking?.includes(i) ?? false;

      await db
        .insert(schema.spots)
        .values({
          label,
          type: "standard",
          resourceType: "parking",
          entityId: cfg.entityId,
          assignedTo: isAssigned ? managerProfileId : null,
          isActive: true,
          positionX: 10 + i * 15,
          positionY: 10 + i * 10,
        })
        .onConflictDoNothing();
    }

    for (let i = 1; i <= cfg.office; i++) {
      const label = `${cfg.prefix}-D${String(i).padStart(2, "0")}`;

      await db
        .insert(schema.spots)
        .values({
          label,
          type: "standard",
          resourceType: "office",
          entityId: cfg.entityId,
          isActive: true,
          positionX: 10 + i * 15,
          positionY: 50 + i * 10,
        })
        .onConflictDoNothing();
    }
  }

  // Query created spots to get real IDs
  const allSpots = await db.select().from(schema.spots);
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

  for (const eid of [
    UUIDS.entities.central,
    UUIDS.entities.norte,
    UUIDS.entities.levante,
  ]) {
    for (const mod of modules) {
      await db
        .insert(schema.entityModules)
        .values({ entityId: eid, module: mod, enabled: true })
        .onConflictDoNothing();
    }
  }
  log("Modules: all enabled for all entities");

  // ─── Reservations ──────────────────────────────────────────────────────
  // Ana reserves spots over the next 2 weeks (skip SC-P01/P02 which are assigned)

  const employeeId = UUIDS.users.employee;
  const centralParkingFree = allSpots.filter(
    (s) =>
      s.resourceType === "parking" &&
      s.entityId === UUIDS.entities.central &&
      s.label !== "SC-P01" &&
      s.label !== "SC-P02"
  );

  const reservationDays = [-3, -1, 1, 3, 4, 8, 9, 10];
  for (let i = 0; i < reservationDays.length; i++) {
    const spot = centralParkingFree[i % centralParkingFree.length]!;
    await db
      .insert(schema.reservations)
      .values({
        spotId: spot.id,
        userId: employeeId,
        date: dstr(addDays(t, reservationDays[i]!)),
        status: "confirmed",
      })
      .onConflictDoNothing();
  }

  // Additional reservations for a denser calendar (creates "few spots" visuals)
  const denseReservations: { day: number; spots: number }[] = [
    { day: 1, spots: 3 },
    { day: 3, spots: 6 },
    { day: 5, spots: 2 },
    { day: 8, spots: 4 },
    { day: 10, spots: 5 },
    { day: 12, spots: 3 },
    { day: 15, spots: 6 },
    { day: 17, spots: 4 },
    { day: 20, spots: 2 },
  ];

  const userIds = [employeeId, UUIDS.users.manager, UUIDS.users.hr];
  for (const { day, spots: count } of denseReservations) {
    const dateStr = dstr(addDays(t, day));
    const taken = new Set<string>();
    for (let j = 0; j < count; j++) {
      const spot = centralParkingFree[j % centralParkingFree.length]!;
      const key = `${spot.id}-${dateStr}`;
      if (taken.has(key)) continue;
      taken.add(key);
      await db
        .insert(schema.reservations)
        .values({
          spotId: spot.id,
          userId: userIds[j % userIds.length]!,
          date: dateStr,
          status: "confirmed",
        })
        .onConflictDoNothing();
    }
    taken.clear();
  }

  log("Reservations: 50+ created (dense calendar with Ana, Carlos, Laura)");

  // ─── Cessions ──────────────────────────────────────────────────────────
  // Carlos cedes P01 on several days, some get reserved by Ana

  const managerSpotP01 = allSpots.find(
    (s) => s.label === "SC-P01" && s.entityId === UUIDS.entities.central
  )!;

  const cessionDays = [
    { offset: -2, status: "reserved" as const }, // past, was reserved
    { offset: 0, status: "available" as const }, // today, still available
    { offset: 2, status: "available" as const }, // future, available
    { offset: 5, status: "available" as const }, // future, available
    { offset: 7, status: "available" as const }, // future, available
  ];

  for (const cd of cessionDays) {
    const dateStr = dstr(addDays(t, cd.offset));
    await db
      .insert(schema.cessions)
      .values({
        spotId: managerSpotP01.id,
        userId: managerProfileId,
        date: dateStr,
        status: cd.status,
      })
      .onConflictDoNothing();
  }

  // Ana reserved the past cession
  await db
    .insert(schema.reservations)
    .values({
      spotId: managerSpotP01.id,
      userId: employeeId,
      date: dstr(addDays(t, -2)),
      status: "confirmed",
    })
    .onConflictDoNothing();

  // Carlos also cedes P02 on some days
  const managerSpotP02 = allSpots.find(
    (s) => s.label === "SC-P02" && s.entityId === UUIDS.entities.central
  )!;

  const p02CessionDays = [
    { offset: 0, status: "available" as const },
    { offset: 3, status: "available" as const },
    { offset: 6, status: "available" as const },
    { offset: 9, status: "available" as const },
    { offset: 12, status: "available" as const },
  ];

  for (const cd of p02CessionDays) {
    await db
      .insert(schema.cessions)
      .values({
        spotId: managerSpotP02.id,
        userId: managerProfileId,
        date: dstr(addDays(t, cd.offset)),
        status: cd.status,
      })
      .onConflictDoNothing();
  }

  log("Cessions: 10 from Carlos (P01: 5, P02: 5) — diverse availability");

  // ─── Visitor reservation ───────────────────────────────────────────────

  const visitorSpot = allSpots.find(
    (s) => s.label === "SC-P10" && s.resourceType === "parking"
  )!;
  await db
    .insert(schema.visitorReservations)
    .values({
      spotId: visitorSpot.id,
      reservedBy: employeeId,
      date: dstr(addDays(t, 11)),
      visitorName: "María Sánchez",
      visitorCompany: "Proveedora del Norte S.L.",
      visitorEmail: "maria.sanchez@proveedora.com",
      status: "confirmed",
      notificationSent: false,
    })
    .onConflictDoNothing();
  // Additional visitor reservations
  const extraVisitors = [
    {
      spotId: visitorSpot.id,
      reservedBy: UUIDS.users.manager,
      date: dstr(addDays(t, 8)),
      visitorName: "Pedro Gómez",
      visitorCompany: "Transportes Gómez S.A.",
      visitorEmail: "pedro.gomez@transgomez.com",
      status: "confirmed" as const,
      notificationSent: false,
    },
    {
      spotId: allSpots.find(
        (s) => s.label === "SC-P09" && s.resourceType === "parking"
      )!.id,
      reservedBy: UUIDS.users.hr,
      date: dstr(addDays(t, 14)),
      visitorName: "Elena Torres",
      visitorCompany: "Consultora Torres & Asociados",
      visitorEmail: "elena@torresconsultores.es",
      status: "confirmed" as const,
      notificationSent: false,
    },
  ];

  for (const v of extraVisitors) {
    await db.insert(schema.visitorReservations).values(v).onConflictDoNothing();
  }
  log("Visitors: 3 reservations created");

  // ─── Leave requests ────────────────────────────────────────────────────

  const leaveRequests = [
    {
      employeeId,
      leaveType: "vacation" as const,
      startDate: dstr(new Date(2026, 6, 14)), // July 14, 2026
      endDate: dstr(new Date(2026, 6, 28)), // July 28, 2026
      status: "pending" as const,
      reason: "Vacaciones de verano",
      workingDays: 11,
    },
    {
      employeeId,
      leaveType: "vacation" as const,
      startDate: dstr(new Date(2026, 7, 14)), // Aug 14, 2026
      endDate: dstr(new Date(2026, 7, 22)), // Aug 22, 2026
      status: "approved" as const,
      reason: "Viaje familiar",
      reviewerId: managerProfileId,
      reviewedAt: now,
      reviewerNotes: "Aprobado sin incidencias",
      workingDays: 7,
    },
    {
      employeeId,
      leaveType: "personal" as const,
      startDate: dstr(addDays(t, 5)),
      endDate: dstr(addDays(t, 5)),
      status: "pending" as const,
      reason: "Asunto personal",
      workingDays: 1,
    },
    {
      employeeId,
      leaveType: "vacation" as const,
      startDate: dstr(new Date(2026, 2, 10)), // March 10, 2026
      endDate: dstr(new Date(2026, 2, 12)), // March 12, 2026
      status: "approved" as const,
      reason: "Puente de marzo",
      reviewerId: UUIDS.users.hr,
      reviewedAt: new Date(2026, 1, 22),
      workingDays: 3,
    },
  ];

  for (const lr of leaveRequests) {
    await db.insert(schema.leaveRequests).values(lr).onConflictDoNothing();
  }
  // Additional pending requests for a populated bandeja
  const extraLeaveRequests = [
    {
      employeeId: UUIDS.users.manager,
      leaveType: "vacation" as const,
      startDate: dstr(new Date(2026, 5, 2)),
      endDate: dstr(new Date(2026, 5, 6)),
      status: "pending" as const,
      reason: "Asuntos personales",
      workingDays: 5,
    },
    {
      employeeId: UUIDS.users.hr,
      leaveType: "vacation" as const,
      startDate: dstr(new Date(2026, 8, 1)),
      endDate: dstr(new Date(2026, 8, 15)),
      status: "pending" as const,
      reason: "Vacaciones de septiembre",
      workingDays: 11,
    },
    {
      employeeId,
      leaveType: "vacation" as const,
      startDate: dstr(new Date(2026, 5, 22)),
      endDate: dstr(new Date(2026, 5, 24)),
      status: "pending" as const,
      reason: "Puente de San Juan",
      workingDays: 2,
    },
    {
      employeeId,
      leaveType: "personal" as const,
      startDate: dstr(addDays(t, 2)),
      endDate: dstr(addDays(t, 2)),
      status: "rejected" as const,
      reason: "Cita médica",
      reviewerId: managerProfileId,
      reviewedAt: new Date(),
      reviewerNotes: "Día con mucha carga de trabajo, solicitar otra fecha",
      workingDays: 1,
    },
  ];

  for (const lr of extraLeaveRequests) {
    await db.insert(schema.leaveRequests).values(lr).onConflictDoNothing();
  }
  log("Leave requests: 8 total (pending, approved, rejected, personal)");

  // ─── Announcements ─────────────────────────────────────────────────────

  const announcementRows = [
    {
      title: "Bienvenidos a Seven Suite",
      body: "Nos complace presentar el nuevo portal del empleado de GRUPOSIETE. Desde aquí podrás gestionar tus reservas de parking y oficina, solicitar vacaciones, consultar el directorio de compañeros y estar al día de las comunicaciones internas. Si tienes cualquier duda, contacta con el equipo de RRHH.",
      entityId: UUIDS.entities.central,
      publishedAt: addDays(t, -10),
      createdBy: UUIDS.users.hr,
    },
    {
      title: "Nuevo protocolo de reserva de plazas",
      body: "Recordamos a todos los empleados el procedimiento para la reserva de plazas de parking:\n\n1. Las plazas asignadas a directores pueden ser cedidas cuando no estén en la oficina.\n2. Las reservas pueden hacerse con hasta 30 días de antelación.\n3. Las cancelaciones deben realizarse con al menos 2 horas de antelación para liberar la plaza.\n4. Los visitantes deben ser registrados por el empleado anfitrión.\n\nCualquier incidencia puede reportarse a través de la sección de Ajustes.",
      entityId: UUIDS.entities.central,
      publishedAt: addDays(t, -5),
      createdBy: UUIDS.users.hr,
    },
    {
      title: "Próximo cierre de nóminas — Mayo 2026",
      body: "Informamos que el cierre de nóminas del mes de mayo se realizará el día 26. Rogamos que todas las incidencias (horas extra, bajas, ausencias) estén registradas antes del día 24 a las 14:00.\n\nPara cualquier consulta relacionada con la nómina, podéis contactar con Laura Martínez (rrhh@gruposiete.es).",
      entityId: UUIDS.entities.central,
      publishedAt: addDays(t, -2),
      createdBy: UUIDS.users.hr,
    },
    {
      title: "Calendario de festivos 2026",
      body: "Ya está disponible el calendario de festivos para el año 2026. Los días no laborables se reflejan automáticamente en el sistema de reservas. Podéis consultar los festivos nacionales, autonómicos y locales en el calendario de vuestra sede.",
      entityId: null, // global
      publishedAt: addDays(t, -15),
      createdBy: UUIDS.users.hr,
    },
  ];

  for (const a of announcementRows) {
    await db.insert(schema.announcements).values(a).onConflictDoNothing();
  }
  log("Announcements: 4 published");

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
  for (const eid of [
    UUIDS.entities.central,
    UUIDS.entities.norte,
    UUIDS.entities.levante,
  ]) {
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
  log("  admin@gruposiete.es      — Administrador");
  log("  manager@gruposiete.es    — Manager (spots P01, P02 asignados)");
  log("  rrhh@gruposiete.es       — RRHH");
  log("  empleado@gruposiete.es   — Empleado");

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
