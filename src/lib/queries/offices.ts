/**
 * Queries de Oficinas.
 * Las reservas de oficina son siempre de día completo.
 */

import { db } from "@/lib/db";
import {
  spots as spotsTable,
  reservations as reservationsTable,
  cessions as cessionsTable,
  profiles as profilesTable,
} from "@/lib/db/schema";
import type { Spot } from "@/lib/db/types";
import type { SpotWithStatus, ReservationWithDetails } from "@/types";
import { toServerDateStr } from "@/lib/utils";
import { eq, and, gte, or, isNull, ne, inArray } from "drizzle-orm";

export async function getOfficeSpots(
  entityId?: string | null
): Promise<Spot[]> {
  const conditions = [
    eq(spotsTable.isActive, true),
    eq(spotsTable.resourceType, "office"),
  ];

  if (entityId) {
    conditions.push(
      or(eq(spotsTable.entityId, entityId), isNull(spotsTable.entityId))!
    );
  }

  try {
    return await db
      .select()
      .from(spotsTable)
      .where(and(...conditions))
      .orderBy(spotsTable.label);
  } catch (err) {
    console.error("[offices] getOfficeSpots query error", err);
    throw new Error("No se pudieron obtener los puestos");
  }
}

export async function getOfficeAvailabilityForDate(
  date: string,
  entityId?: string | null
): Promise<SpotWithStatus[]> {
  const spotConditions = [
    eq(spotsTable.isActive, true),
    eq(spotsTable.resourceType, "office"),
  ];

  if (entityId) {
    spotConditions.push(
      or(eq(spotsTable.entityId, entityId), isNull(spotsTable.entityId))!
    );
  }

  const spots = await db
    .select()
    .from(spotsTable)
    .where(and(...spotConditions))
    .orderBy(spotsTable.label);

  if (spots.length === 0) return [];

  const spotIds = spots.map((s) => s.id);
  const [reservations, cessions] = await Promise.all([
    db
      .select({ spotId: reservationsTable.spotId, id: reservationsTable.id })
      .from(reservationsTable)
      .where(
        and(
          eq(reservationsTable.date, date),
          eq(reservationsTable.status, "confirmed"),
          inArray(reservationsTable.spotId, spotIds)
        )
      ),
    db
      .select({
        spotId: cessionsTable.spotId,
        status: cessionsTable.status,
      })
      .from(cessionsTable)
      .where(
        and(
          eq(cessionsTable.date, date),
          ne(cessionsTable.status, "cancelled"),
          inArray(cessionsTable.spotId, spotIds)
        )
      ),
  ]);

  const cessionBySpot = new Map(cessions.map((c) => [c.spotId, c]));

  return spots.map((spot) => {
    const reservation = reservations.find((r) => r.spotId === spot.id);
    const base = {
      id: spot.id,
      label: spot.label,
      type: spot.type,
      resource_type: "office" as const,
      assigned_to: spot.assignedTo,
      position_x: spot.positionX,
      position_y: spot.positionY,
    };

    if (reservation) {
      return {
        ...base,
        status: "occupied" as const,
        reservation_id: reservation.id,
      };
    }

    if (spot.type === "visitor") {
      return { ...base, status: "free" as const };
    }

    if (spot.assignedTo !== null) {
      const cession = cessionBySpot.get(spot.id);
      return {
        ...base,
        status:
          cession?.status === "available"
            ? ("ceded" as const)
            : ("occupied" as const),
      };
    }

    return { ...base, status: "occupied" as const };
  });
}

export async function getUserOfficeReservations(
  userId: string
): Promise<ReservationWithDetails[]> {
  const today = toServerDateStr(new Date());
  const rows = await db
    .select({
      id: reservationsTable.id,
      spot_id: reservationsTable.spotId,
      user_id: reservationsTable.userId,
      date: reservationsTable.date,
      status: reservationsTable.status,
      notes: reservationsTable.notes,
      created_at: reservationsTable.createdAt,
      spot_label: spotsTable.label,
      spot_resource_type: spotsTable.resourceType,
      user_name: profilesTable.fullName,
    })
    .from(reservationsTable)
    .innerJoin(spotsTable, eq(reservationsTable.spotId, spotsTable.id))
    .innerJoin(profilesTable, eq(reservationsTable.userId, profilesTable.id))
    .where(
      and(
        eq(reservationsTable.userId, userId),
        eq(reservationsTable.status, "confirmed"),
        eq(spotsTable.resourceType, "office"),
        gte(reservationsTable.date, today)
      )
    )
    .orderBy(reservationsTable.date);

  return rows
    .filter((r) => r.spot_resource_type === "office")
    .map((r) => ({
      id: r.id,
      spot_id: r.spot_id,
      spot_label: r.spot_label,
      resource_type: "office" as const,
      user_id: r.user_id,
      user_name: r.user_name ?? "",
      date: r.date,
      status: r.status,
      notes: r.notes,
      created_at: r.created_at.toISOString(),
    }));
}
