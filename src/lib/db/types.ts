/**
 * Database Types
 *
 * Inferred from the Drizzle schema — no code generation needed.
 *
 * @see schema.ts — source of truth for the database schema
 */

import type * as schema from "./schema";

// ─── Row types (what you get back from a SELECT) ────────────────────────────

export type Profile = typeof schema.profiles.$inferSelect;
export type Spot = typeof schema.spots.$inferSelect;
export type Reservation = typeof schema.reservations.$inferSelect;
export type Cession = typeof schema.cessions.$inferSelect;
export type VisitorReservation = typeof schema.visitorReservations.$inferSelect;
export type Alert = typeof schema.alerts.$inferSelect;
export type CessionRule = typeof schema.cessionRules.$inferSelect;
export type SystemConfig = typeof schema.systemConfig.$inferSelect;
export type UserPreferences = typeof schema.userPreferences.$inferSelect;
export type UserMicrosoftTokens =
  typeof schema.userMicrosoftTokens.$inferSelect;
export type Entity = typeof schema.entities.$inferSelect;
export type EntityModule = typeof schema.entityModules.$inferSelect;
export type EntityConfig = typeof schema.entityConfig.$inferSelect;
export type Document = typeof schema.documents.$inferSelect;
export type LeaveRequest = typeof schema.leaveRequests.$inferSelect;
export type Announcement = typeof schema.announcements.$inferSelect;
export type AnnouncementRead = typeof schema.announcementReads.$inferSelect;
export type HolidayCalendar = typeof schema.holidayCalendars.$inferSelect;
export type Holiday = typeof schema.holidays.$inferSelect;
export type AuditEvent = typeof schema.auditEvents.$inferSelect;
export type User = typeof schema.users.$inferSelect;

// ─── Insert types ───────────────────────────────────────────────────────────

export type ProfileInsert = typeof schema.profiles.$inferInsert;
export type SpotInsert = typeof schema.spots.$inferInsert;
export type ReservationInsert = typeof schema.reservations.$inferInsert;
export type CessionInsert = typeof schema.cessions.$inferInsert;
export type VisitorReservationInsert =
  typeof schema.visitorReservations.$inferInsert;

// ─── Enum types ─────────────────────────────────────────────────────────────

export type UserRole = (typeof schema.userRoleEnum.enumValues)[number];
export type SpotType = (typeof schema.spotTypeEnum.enumValues)[number];
export type ResourceType = (typeof schema.resourceTypeEnum.enumValues)[number];
export type ReservationStatus =
  (typeof schema.reservationStatusEnum.enumValues)[number];
export type CessionStatus =
  (typeof schema.cessionStatusEnum.enumValues)[number];
export type CessionRuleType =
  (typeof schema.cessionRuleTypeEnum.enumValues)[number];
export type LeaveStatus = (typeof schema.leaveStatusEnum.enumValues)[number];
export type LeaveType = (typeof schema.leaveTypeEnum.enumValues)[number];
