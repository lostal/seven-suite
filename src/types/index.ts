/**
 * Global Type Definitions
 *
 * Re-exports domain types from the Drizzle schema
 * and adds app-specific derived types.
 */

import type { SpotType as SpotTypeEnum, ResourceType } from "@/lib/db/types";

// Re-export all DB types as the single source of truth
export type {
  UserRole,
  SpotType,
  ResourceType,
  ReservationStatus,
  CessionStatus,
  CessionRuleType,
  Profile,
  Spot,
  Reservation,
  Cession,
  VisitorReservation,
  Alert,
  CessionRule,
  SystemConfig,
} from "@/lib/db/types";

// Re-export config types
export type {
  ResourceConfigValues,
  GlobalConfigValues,
  ResourceConfigKey,
} from "@/lib/config";

/**
 * Computed spot status for a given date.
 * Derived at query time, not stored in DB.
 */
export type SpotStatus =
  "free" | "occupied" | "reserved" | "ceded" | "visitor-blocked";

/**
 * Spot with its computed status for a specific date.
 * Used by the parking map and calendar views.
 */
export interface SpotWithStatus {
  id: string;
  label: string;
  type: SpotTypeEnum;
  resource_type: ResourceType;
  assigned_to: string | null;
  position_x: number | null;
  position_y: number | null;
  status: SpotStatus;
  /** The reservation/cession occupying this spot, if any */
  reservation_id?: string;
  reserved_by_name?: string;
}

export interface ReservationWithDetails {
  id: string;
  spot_id: string;
  spot_label: string;
  resource_type: ResourceType;
  user_id: string;
  user_name?: string;
  date: string;
  status: string;
  notes?: string | null;
  created_at: string;
}
