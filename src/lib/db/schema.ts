import { relations, sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Enums ──────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", [
  "employee",
  "manager",
  "hr",
  "admin",
]);

export const spotTypeEnum = pgEnum("spot_type", ["standard", "visitor"]);

export const resourceTypeEnum = pgEnum("resource_type", ["parking", "office"]);

export const reservationStatusEnum = pgEnum("reservation_status", [
  "confirmed",
  "cancelled",
]);

export const cessionStatusEnum = pgEnum("cession_status", [
  "available",
  "reserved",
  "cancelled",
]);

export const cessionRuleTypeEnum = pgEnum("cession_rule_type", [
  "out_of_office",
  "day_of_week",
]);

export const documentCategoryEnum = pgEnum("document_category", [
  "payslip",
  "corporate",
  "contract",
  "other",
]);

export const documentAccessEnum = pgEnum("document_access", [
  "own",
  "entity",
  "global",
]);

export const leaveStatusEnum = pgEnum("leave_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

export const leaveTypeEnum = pgEnum("leave_type", [
  "vacation",
  "personal",
  "sick",
  "other",
]);

// ─── Auth.js tables ─────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  password: text("password"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })]
);

// ─── Entities ───────────────────────────────────────────────────────────────

export const entities = pgTable("entities", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  shortCode: text("short_code").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  autonomousCommunity: text("autonomous_community"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Profiles ───────────────────────────────────────────────────────────────

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    fullName: text("full_name").notNull().default(""),
    avatarUrl: text("avatar_url"),
    role: userRoleEnum("role").notNull().default("employee"),
    entityId: uuid("entity_id").references(() => entities.id, {
      onDelete: "set null",
    }),
    dni: text("dni").unique(),
    managerId: uuid("manager_id"),
    jobTitle: text("job_title"),
    phone: text("phone"),
    location: text("location"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_profiles_entity_id").on(table.entityId),
    index("idx_profiles_dni").on(table.dni),
  ]
);

// ─── Spots ──────────────────────────────────────────────────────────────────

export const spots = pgTable(
  "spots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: text("label").notNull().unique(),
    type: spotTypeEnum("type").notNull().default("standard"),
    resourceType: resourceTypeEnum("resource_type")
      .notNull()
      .default("parking"),
    assignedTo: uuid("assigned_to").references(() => profiles.id, {
      onDelete: "set null",
    }),
    isActive: boolean("is_active").notNull().default(true),
    positionX: real("position_x"),
    positionY: real("position_y"),
    entityId: uuid("entity_id").references(() => entities.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_spots_type").on(table.type),
    index("idx_spots_resource_type").on(table.resourceType),
    index("idx_spots_assigned_to").on(table.assignedTo),
  ]
);

// ─── Reservations ───────────────────────────────────────────────────────────

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spotId: uuid("spot_id")
      .notNull()
      .references(() => spots.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    status: reservationStatusEnum("status").notNull().default("confirmed"),
    notes: text("notes"),
    startTime: time("start_time"),
    endTime: time("end_time"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_reservations_date").on(table.date),
    // Partial unique indexes for full-day reservations
    uniqueIndex("idx_reservations_spot_date")
      .on(table.spotId, table.date)
      .where(sql`status = 'confirmed' AND start_time IS NULL`),
    uniqueIndex("idx_reservations_user_date")
      .on(table.userId, table.date)
      .where(sql`status = 'confirmed' AND start_time IS NULL`),
  ]
);

// ─── Cessions ───────────────────────────────────────────────────────────────

export const cessions = pgTable(
  "cessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spotId: uuid("spot_id")
      .notNull()
      .references(() => spots.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    status: cessionStatusEnum("status").notNull().default("available"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_cessions_spot_date")
      .on(table.spotId, table.date)
      .where(sql`status != 'cancelled'`),
    index("idx_cessions_date").on(table.date),
    index("idx_cessions_user_id").on(table.userId),
  ]
);

// ─── Visitor Reservations ───────────────────────────────────────────────────

export const visitorReservations = pgTable(
  "visitor_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spotId: uuid("spot_id")
      .notNull()
      .references(() => spots.id, { onDelete: "cascade" }),
    reservedBy: uuid("reserved_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    visitorName: text("visitor_name").notNull(),
    visitorCompany: text("visitor_company").notNull(),
    visitorEmail: text("visitor_email").notNull(),
    status: reservationStatusEnum("status").notNull().default("confirmed"),
    notificationSent: boolean("notification_sent").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_visitor_reservations_spot_date")
      .on(table.spotId, table.date)
      .where(sql`status = 'confirmed'`),
    index("idx_visitor_reservations_date").on(table.date),
    index("idx_visitor_reservations_reserved_by").on(table.reservedBy),
  ]
);

// ─── Alerts ─────────────────────────────────────────────────────────────────

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    notified: boolean("notified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_alerts_user_date")
      .on(table.userId, table.date)
      .where(sql`notified = false`),
    index("idx_alerts_date").on(table.date),
  ]
);

// ─── Cession Rules ──────────────────────────────────────────────────────────

export const cessionRules = pgTable(
  "cession_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    resourceType: resourceTypeEnum("resource_type")
      .notNull()
      .default("parking"),
    ruleType: cessionRuleTypeEnum("rule_type").notNull(),
    dayOfWeek: smallint("day_of_week"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_cession_rules_user_resource").on(
      table.userId,
      table.resourceType
    ),
  ]
);

// ─── System Config ──────────────────────────────────────────────────────────

export const systemConfig = pgTable("system_config", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedBy: uuid("updated_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
});

// ─── User Preferences ──────────────────────────────────────────────────────

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  notificationChannel: text("notification_channel").notNull().default("teams"),
  notifyReservationConfirmed: boolean("notify_reservation_confirmed")
    .notNull()
    .default(true),
  notifyReservationReminder: boolean("notify_reservation_reminder")
    .notNull()
    .default(true),
  notifyCessionReserved: boolean("notify_cession_reserved")
    .notNull()
    .default(true),
  notifyAlertTriggered: boolean("notify_alert_triggered")
    .notNull()
    .default(true),
  notifyVisitorConfirmed: boolean("notify_visitor_confirmed")
    .notNull()
    .default(false),
  notifyDailyDigest: boolean("notify_daily_digest").notNull().default(false),
  dailyDigestTime: time("daily_digest_time").default("09:00"),
  outlookCreateEvents: boolean("outlook_create_events").notNull().default(true),
  outlookCalendarName: text("outlook_calendar_name").default("Parking"),
  outlookSyncEnabled: boolean("outlook_sync_enabled").notNull().default(true),
  outlookSyncInterval: integer("outlook_sync_interval").default(15),
  autoCedeOnOoo: boolean("auto_cede_on_ooo").notNull().default(true),
  autoCedeNotify: boolean("auto_cede_notify").notNull().default(true),
  autoCedeDays: integer("auto_cede_days").array().default([]),
  defaultView: text("default_view").notNull().default("map"),
  favoriteSpotIds: uuid("favorite_spot_ids").array().default([]),
  usualArrivalTime: time("usual_arrival_time").default("09:00"),
  theme: text("theme").notNull().default("system"),
  locale: text("locale").notNull().default("es"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── User Microsoft Tokens ─────────────────────────────────────────────────

export const userMicrosoftTokens = pgTable("user_microsoft_tokens", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at", {
    withTimezone: true,
  }).notNull(),
  scopes: text("scopes").array().notNull().default([]),
  teamsTenantId: text("teams_tenant_id"),
  teamsUserId: text("teams_user_id"),
  teamsConversationId: text("teams_conversation_id"),
  outlookCalendarId: text("outlook_calendar_id"),
  lastCalendarSyncAt: timestamp("last_calendar_sync_at", {
    withTimezone: true,
  }),
  lastOooCheckAt: timestamp("last_ooo_check_at", { withTimezone: true }),
  currentOooStatus: boolean("current_ooo_status").notNull().default(false),
  currentOooUntil: timestamp("current_ooo_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Documents ──────────────────────────────────────────────────────────────

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: documentCategoryEnum("category").notNull(),
    accessLevel: documentAccessEnum("access_level").notNull().default("own"),
    ownerId: uuid("owner_id").references(() => profiles.id, {
      onDelete: "cascade",
    }),
    entityId: uuid("entity_id").references(() => entities.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    storagePath: text("storage_path").notNull(),
    fileSizeBytes: integer("file_size_bytes"),
    mimeType: text("mime_type").notNull().default("application/pdf"),
    periodYear: smallint("period_year"),
    periodMonth: smallint("period_month"),
    uploadedBy: uuid("uploaded_by").references(() => profiles.id),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_documents_owner_id").on(table.ownerId),
    index("idx_documents_entity_id").on(table.entityId),
    index("idx_documents_category").on(table.category),
    index("idx_documents_period")
      .on(table.periodYear, table.periodMonth)
      .where(sql`category = 'payslip'`),
  ]
);

// ─── Entity Modules ─────────────────────────────────────────────────────────

export const entityModules = pgTable(
  "entity_modules",
  {
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    module: text("module").notNull(),
    enabled: boolean("enabled").notNull().default(true),
  },
  (table) => [primaryKey({ columns: [table.entityId, table.module] })]
);

// ─── Entity Config ──────────────────────────────────────────────────────────

export const entityConfig = pgTable(
  "entity_config",
  {
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: jsonb("value")
      .notNull()
      .default(sql`'null'::jsonb`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: uuid("updated_by").references(() => profiles.id),
  },
  (table) => [primaryKey({ columns: [table.entityId, table.key] })]
);

// ─── Leave Requests ─────────────────────────────────────────────────────────

export const leaveRequests = pgTable(
  "leave_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    leaveType: leaveTypeEnum("leave_type").notNull().default("vacation"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: leaveStatusEnum("status").notNull().default("pending"),
    reason: text("reason"),
    reviewerId: uuid("reviewer_id").references(() => profiles.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewerNotes: text("reviewer_notes"),
    workingDays: smallint("working_days"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_leave_requests_employee_id").on(table.employeeId),
    index("idx_leave_requests_reviewer_id").on(table.reviewerId),
    index("idx_leave_requests_status").on(table.status),
  ]
);

// ─── Notification Subscriptions ─────────────────────────────────────────────

export const notificationSubscriptions = pgTable(
  "notification_subscriptions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    module: text("module").notNull(),
    eventType: text("event_type").notNull(),
    channel: text("channel").notNull().default("email"),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.module, table.eventType] }),
  ]
);

// ─── Announcements ──────────────────────────────────────────────────────────

export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    entityId: uuid("entity_id").references(() => entities.id, {
      onDelete: "cascade",
    }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_announcements_entity_id").on(table.entityId),
    index("idx_announcements_published_at")
      .on(table.publishedAt)
      .where(sql`published_at IS NOT NULL`),
  ]
);

// ─── Announcement Reads ─────────────────────────────────────────────────────

export const announcementReads = pgTable(
  "announcement_reads",
  {
    announcementId: uuid("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.announcementId, table.userId] })]
);

// ─── Holiday Calendars ──────────────────────────────────────────────────────

export const holidayCalendars = pgTable("holiday_calendars", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  country: text("country").notNull().default("ES"),
  region: text("region"),
  year: smallint("year").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Holidays ───────────────────────────────────────────────────────────────

export const holidays = pgTable(
  "holidays",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    calendarId: uuid("calendar_id")
      .notNull()
      .references(() => holidayCalendars.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    name: text("name").notNull(),
    isOptional: boolean("is_optional").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_holidays_calendar_date").on(table.calendarId, table.date),
    index("idx_holidays_date").on(table.date),
  ]
);

// ─── Entity Holiday Calendars ───────────────────────────────────────────────

export const entityHolidayCalendars = pgTable(
  "entity_holiday_calendars",
  {
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    calendarId: uuid("calendar_id")
      .notNull()
      .references(() => holidayCalendars.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.entityId, table.calendarId] })]
);

// ─── Audit Events ───────────────────────────────────────────────────────────

export const auditEvents = pgTable(
  "audit_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: uuid("actor_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    actorEmail: text("actor_email").notNull(),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_audit_events_actor_id").on(table.actorId),
    index("idx_audit_events_event_type").on(table.eventType),
    index("idx_audit_events_entity_id").on(table.entityId),
    index("idx_audit_events_created_at").on(table.createdAt),
  ]
);

// ─── Relations ──────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.id],
  }),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  user: one(users, {
    fields: [profiles.id],
    references: [users.id],
  }),
  entity: one(entities, {
    fields: [profiles.entityId],
    references: [entities.id],
  }),
  manager: one(profiles, {
    fields: [profiles.managerId],
    references: [profiles.id],
    relationName: "manager",
  }),
  assignedSpots: many(spots),
  reservations: many(reservations),
  cessions: many(cessions),
  preferences: one(userPreferences, {
    fields: [profiles.id],
    references: [userPreferences.userId],
  }),
  microsoftTokens: one(userMicrosoftTokens, {
    fields: [profiles.id],
    references: [userMicrosoftTokens.userId],
  }),
  cessionRules: many(cessionRules),
  alerts: many(alerts),
}));

export const entitiesRelations = relations(entities, ({ many }) => ({
  profiles: many(profiles),
  spots: many(spots),
  modules: many(entityModules),
  config: many(entityConfig),
  holidayCalendars: many(entityHolidayCalendars),
  announcements: many(announcements),
  documents: many(documents),
}));

export const spotsRelations = relations(spots, ({ one, many }) => ({
  assignedUser: one(profiles, {
    fields: [spots.assignedTo],
    references: [profiles.id],
  }),
  entity: one(entities, {
    fields: [spots.entityId],
    references: [entities.id],
  }),
  reservations: many(reservations),
  cessions: many(cessions),
  visitorReservations: many(visitorReservations),
}));

export const reservationsRelations = relations(reservations, ({ one }) => ({
  spot: one(spots, {
    fields: [reservations.spotId],
    references: [spots.id],
  }),
  user: one(profiles, {
    fields: [reservations.userId],
    references: [profiles.id],
  }),
}));

export const cessionsRelations = relations(cessions, ({ one }) => ({
  spot: one(spots, {
    fields: [cessions.spotId],
    references: [spots.id],
  }),
  user: one(profiles, {
    fields: [cessions.userId],
    references: [profiles.id],
  }),
}));

export const visitorReservationsRelations = relations(
  visitorReservations,
  ({ one }) => ({
    spot: one(spots, {
      fields: [visitorReservations.spotId],
      references: [spots.id],
    }),
    reservedByUser: one(profiles, {
      fields: [visitorReservations.reservedBy],
      references: [profiles.id],
    }),
  })
);

export const alertsRelations = relations(alerts, ({ one }) => ({
  user: one(profiles, {
    fields: [alerts.userId],
    references: [profiles.id],
  }),
}));

export const cessionRulesRelations = relations(cessionRules, ({ one }) => ({
  user: one(profiles, {
    fields: [cessionRules.userId],
    references: [profiles.id],
  }),
}));

export const systemConfigRelations = relations(systemConfig, ({ one }) => ({
  updatedByUser: one(profiles, {
    fields: [systemConfig.updatedBy],
    references: [profiles.id],
  }),
}));

export const userPreferencesRelations = relations(
  userPreferences,
  ({ one }) => ({
    profile: one(profiles, {
      fields: [userPreferences.userId],
      references: [profiles.id],
    }),
  })
);

export const userMicrosoftTokensRelations = relations(
  userMicrosoftTokens,
  ({ one }) => ({
    profile: one(profiles, {
      fields: [userMicrosoftTokens.userId],
      references: [profiles.id],
    }),
  })
);

export const documentsRelations = relations(documents, ({ one }) => ({
  owner: one(profiles, {
    fields: [documents.ownerId],
    references: [profiles.id],
    relationName: "documentOwner",
  }),
  entity: one(entities, {
    fields: [documents.entityId],
    references: [entities.id],
  }),
  uploader: one(profiles, {
    fields: [documents.uploadedBy],
    references: [profiles.id],
    relationName: "documentUploader",
  }),
}));

export const entityModulesRelations = relations(entityModules, ({ one }) => ({
  entity: one(entities, {
    fields: [entityModules.entityId],
    references: [entities.id],
  }),
}));

export const entityConfigRelations = relations(entityConfig, ({ one }) => ({
  entity: one(entities, {
    fields: [entityConfig.entityId],
    references: [entities.id],
  }),
  updatedByUser: one(profiles, {
    fields: [entityConfig.updatedBy],
    references: [profiles.id],
  }),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  employee: one(profiles, {
    fields: [leaveRequests.employeeId],
    references: [profiles.id],
    relationName: "leaveEmployee",
  }),
  reviewer: one(profiles, {
    fields: [leaveRequests.reviewerId],
    references: [profiles.id],
    relationName: "leaveReviewer",
  }),
}));

export const notificationSubscriptionsRelations = relations(
  notificationSubscriptions,
  ({ one }) => ({
    user: one(profiles, {
      fields: [notificationSubscriptions.userId],
      references: [profiles.id],
    }),
  })
);

export const announcementsRelations = relations(
  announcements,
  ({ one, many }) => ({
    entity: one(entities, {
      fields: [announcements.entityId],
      references: [entities.id],
    }),
    createdByUser: one(profiles, {
      fields: [announcements.createdBy],
      references: [profiles.id],
    }),
    reads: many(announcementReads),
  })
);

export const announcementReadsRelations = relations(
  announcementReads,
  ({ one }) => ({
    announcement: one(announcements, {
      fields: [announcementReads.announcementId],
      references: [announcements.id],
    }),
    user: one(profiles, {
      fields: [announcementReads.userId],
      references: [profiles.id],
    }),
  })
);

export const holidayCalendarsRelations = relations(
  holidayCalendars,
  ({ many }) => ({
    holidays: many(holidays),
    entityCalendars: many(entityHolidayCalendars),
  })
);

export const holidaysRelations = relations(holidays, ({ one }) => ({
  calendar: one(holidayCalendars, {
    fields: [holidays.calendarId],
    references: [holidayCalendars.id],
  }),
}));

export const entityHolidayCalendarsRelations = relations(
  entityHolidayCalendars,
  ({ one }) => ({
    entity: one(entities, {
      fields: [entityHolidayCalendars.entityId],
      references: [entities.id],
    }),
    calendar: one(holidayCalendars, {
      fields: [entityHolidayCalendars.calendarId],
      references: [holidayCalendars.id],
    }),
  })
);

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  actor: one(profiles, {
    fields: [auditEvents.actorId],
    references: [profiles.id],
  }),
}));
