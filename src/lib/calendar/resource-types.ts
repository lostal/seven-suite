/**
 * Resource Calendar Shared Types
 *
 * Unified types for both the parking and office calendar views.
 * Replaces the split BookingDayStatus/OfficeDayStatus and
 * CessionDayStatus/OfficeCessionDayStatus enums with a single set.
 *
 * Key change: "weekend" (parking) and "non-working" (office) are merged
 * into a single "unavailable" value, reflecting the concept of "day not
 * applicable for this resource" without coupling to a specific reason.
 */

import type { CessionStatus } from "@/types";

// ─── Status enums ─────────────────────────────────────────────

/** Day availability status when employee is booking a spot (any resource type) */
export type ResourceDayStatus =
  | "plenty" // Green – spots available
  | "few" // Amber – ≤3 spots left
  | "none" // Red – no spots
  | "reserved" // Blue – user already has a reservation
  | "past" // Muted – past day
  | "unavailable"; // Invisible – weekend or non-working day

/** Day cession status when user has an assigned spot */
export type ResourceCessionDayStatus =
  | "can-cede" // Green – user can cede this day
  | "ceded-free" // Orange – ceded but not yet taken
  | "ceded-taken" // Blue – ceded and reserved by someone
  | "in-use" // Muted – spot in use (not ceded, future working day)
  | "past"
  | "unavailable";

/** View mode for the calendar */
export type CalendarMode = "booking" | "cession";

// ─── Day data ─────────────────────────────────────────────────

/**
 * Unified per-day payload for both parking and office calendars.
 */
export interface ResourceDayData {
  date: string; // "yyyy-MM-dd"

  // Booking mode fields
  bookingStatus?: ResourceDayStatus;
  availableCount?: number;
  myReservationId?: string;
  myReservationSpotLabel?: string;
  // Cession mode fields
  cessionDayStatus?: ResourceCessionDayStatus;
  myCessionId?: string;
  cessionStatus?: CessionStatus;
}
