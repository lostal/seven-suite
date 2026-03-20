/**
 * Queries de Estadísticas
 *
 * Funciones de servidor para analíticas del panel de administración.
 * Todas las funciones requieren rol admin — llamar solo desde páginas admin.
 */

import { db } from "@/lib/db";
import {
  reservations as reservationsTable,
  cessions as cessionsTable,
  visitorReservations as visitorReservationsTable,
  spots as spotsTable,
  profiles as profilesTable,
} from "@/lib/db/schema";
import { toServerDateStr } from "@/lib/utils";
import { eq, and, gte, lte, ne, desc } from "drizzle-orm";

function currentMonthBounds(): { firstOfMonth: string; lastOfMonth: string } {
  const now = new Date();
  const firstOfMonth = toServerDateStr(
    new Date(now.getFullYear(), now.getMonth(), 1)
  );
  const lastOfMonth = toServerDateStr(
    new Date(now.getFullYear(), now.getMonth() + 1, 0)
  );
  return { firstOfMonth, lastOfMonth };
}

export interface DailyCount {
  /** Fecha ISO p.ej. "2025-01-15" */
  date: string;
  /** Etiqueta corta p.ej. "15 ene" */
  label: string;
  reservations: number;
  visitors: number;
}

export interface SpotUsage {
  spot_label: string;
  count: number;
}

export interface MovementDistribution {
  name: string;
  value: number;
}

/**
 * Devuelve los conteos diarios de reservas + visitantes para los últimos N días.
 * Usada por el gráfico de barras del panel admin.
 *
 * @param resourceType - Si se proporciona, filtra reservas por tipo de recurso.
 * @param entityId - Si se proporciona, filtra por sede.
 */
export async function getDailyCountsLast30Days(
  days = 30,
  resourceType?: "parking" | "office",
  entityId?: string | null
): Promise<DailyCount[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));

  const startStr = toServerDateStr(startDate);
  const endStr = toServerDateStr(endDate);

  const resConditions = [
    eq(reservationsTable.status, "confirmed"),
    gte(reservationsTable.date, startStr),
    lte(reservationsTable.date, endStr),
  ];
  const visConditions = [
    eq(visitorReservationsTable.status, "confirmed"),
    gte(visitorReservationsTable.date, startStr),
    lte(visitorReservationsTable.date, endStr),
  ];

  // Fetch reservations with spot join if needed
  const needsReservationJoin = resourceType || entityId;
  const [reservationsData, visitorsData] = await Promise.all([
    needsReservationJoin
      ? db
          .select({
            date: reservationsTable.date,
            spotResourceType: spotsTable.resourceType,
            spotEntityId: spotsTable.entityId,
          })
          .from(reservationsTable)
          .innerJoin(spotsTable, eq(reservationsTable.spotId, spotsTable.id))
          .where(and(...resConditions))
      : db
          .select({ date: reservationsTable.date })
          .from(reservationsTable)
          .where(and(...resConditions)),
    entityId
      ? db
          .select({
            date: visitorReservationsTable.date,
            spotEntityId: spotsTable.entityId,
          })
          .from(visitorReservationsTable)
          .innerJoin(
            spotsTable,
            eq(visitorReservationsTable.spotId, spotsTable.id)
          )
          .where(and(...visConditions))
      : db
          .select({ date: visitorReservationsTable.date })
          .from(visitorReservationsTable)
          .where(and(...visConditions)),
  ]);

  // Construir mapa de fechas → conteos
  const countsByDate = new Map<
    string,
    { reservations: number; visitors: number }
  >();

  // Inicializar todos los días a 0
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = toServerDateStr(d);
    countsByDate.set(dateStr, { reservations: 0, visitors: 0 });
  }

  for (const r of reservationsData) {
    const row = r as {
      date: string;
      spotResourceType?: string;
      spotEntityId?: string | null;
    };
    if (resourceType && row.spotResourceType !== resourceType) continue;
    if (entityId && row.spotEntityId !== entityId) continue;
    const entry = countsByDate.get(row.date);
    if (entry) entry.reservations++;
  }

  for (const v of visitorsData) {
    const row = v as { date: string; spotEntityId?: string | null };
    if (entityId && row.spotEntityId !== entityId) continue;
    const entry = countsByDate.get(row.date);
    if (entry) entry.visitors++;
  }

  return Array.from(countsByDate.entries()).map(([date, counts]) => {
    const d = new Date(date + "T00:00:00");
    const label = d.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
    });
    return { date, label, ...counts };
  });
}

/**
 * Devuelve las N plazas con más reservas confirmadas en el mes actual.
 *
 * @param resourceType - Si se proporciona, filtra por tipo de recurso.
 * @param entityId - Si se proporciona, filtra por sede.
 */
export async function getTopSpots(
  limit = 6,
  resourceType?: "parking" | "office",
  entityId?: string | null
): Promise<SpotUsage[]> {
  const { firstOfMonth, lastOfMonth } = currentMonthBounds();

  const conditions = [
    eq(reservationsTable.status, "confirmed"),
    gte(reservationsTable.date, firstOfMonth),
    lte(reservationsTable.date, lastOfMonth),
  ];

  if (resourceType) {
    conditions.push(eq(spotsTable.resourceType, resourceType));
  }
  if (entityId) {
    conditions.push(eq(spotsTable.entityId, entityId));
  }

  const rows = await db
    .select({ spotLabel: spotsTable.label })
    .from(reservationsTable)
    .innerJoin(spotsTable, eq(reservationsTable.spotId, spotsTable.id))
    .where(and(...conditions));

  // Agrupar por plaza
  const countBySpot = new Map<string, number>();
  for (const r of rows) {
    const label = r.spotLabel ?? "—";
    countBySpot.set(label, (countBySpot.get(label) ?? 0) + 1);
  }

  return Array.from(countBySpot.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([spot_label, count]) => ({ spot_label, count }));
}

/**
 * Devuelve la distribución de tipos de movimiento para el mes actual.
 *
 * @param entityId - Si se proporciona, filtra por sede.
 */
export async function getMovementDistribution(
  entityId?: string | null
): Promise<MovementDistribution[]> {
  const { firstOfMonth, lastOfMonth } = currentMonthBounds();

  if (!entityId) {
    const [resRows, cesRows, visRows] = await Promise.all([
      db
        .select({ id: reservationsTable.id })
        .from(reservationsTable)
        .where(
          and(
            eq(reservationsTable.status, "confirmed"),
            gte(reservationsTable.date, firstOfMonth),
            lte(reservationsTable.date, lastOfMonth)
          )
        ),
      db
        .select({ id: cessionsTable.id })
        .from(cessionsTable)
        .where(
          and(
            ne(cessionsTable.status, "cancelled"),
            gte(cessionsTable.date, firstOfMonth),
            lte(cessionsTable.date, lastOfMonth)
          )
        ),
      db
        .select({ id: visitorReservationsTable.id })
        .from(visitorReservationsTable)
        .where(
          and(
            eq(visitorReservationsTable.status, "confirmed"),
            gte(visitorReservationsTable.date, firstOfMonth),
            lte(visitorReservationsTable.date, lastOfMonth)
          )
        ),
    ]);

    return [
      { name: "Reservas empleados", value: resRows.length },
      { name: "Cesiones dirección", value: cesRows.length },
      { name: "Visitantes", value: visRows.length },
    ];
  }

  // Con filtro de sede — join con spots para filtrar por entity_id
  const [resRows, cesRows, visRows] = await Promise.all([
    db
      .select({ id: reservationsTable.id })
      .from(reservationsTable)
      .innerJoin(spotsTable, eq(reservationsTable.spotId, spotsTable.id))
      .where(
        and(
          eq(reservationsTable.status, "confirmed"),
          gte(reservationsTable.date, firstOfMonth),
          lte(reservationsTable.date, lastOfMonth),
          eq(spotsTable.entityId, entityId)
        )
      ),
    db
      .select({ id: cessionsTable.id })
      .from(cessionsTable)
      .innerJoin(spotsTable, eq(cessionsTable.spotId, spotsTable.id))
      .where(
        and(
          ne(cessionsTable.status, "cancelled"),
          gte(cessionsTable.date, firstOfMonth),
          lte(cessionsTable.date, lastOfMonth),
          eq(spotsTable.entityId, entityId)
        )
      ),
    db
      .select({ id: visitorReservationsTable.id })
      .from(visitorReservationsTable)
      .innerJoin(spotsTable, eq(visitorReservationsTable.spotId, spotsTable.id))
      .where(
        and(
          eq(visitorReservationsTable.status, "confirmed"),
          gte(visitorReservationsTable.date, firstOfMonth),
          lte(visitorReservationsTable.date, lastOfMonth),
          eq(spotsTable.entityId, entityId)
        )
      ),
  ]);

  return [
    { name: "Reservas empleados", value: resRows.length },
    { name: "Cesiones dirección", value: cesRows.length },
    { name: "Visitantes", value: visRows.length },
  ];
}

/**
 * Devuelve el total de reservas confirmadas para el mes actual.
 *
 * @param resourceType - Si se proporciona, filtra por tipo de recurso.
 * @param entityId - Si se proporciona, filtra por sede.
 */
export async function getMonthlyReservationCount(
  resourceType?: "parking" | "office",
  entityId?: string | null
): Promise<number> {
  const { firstOfMonth, lastOfMonth } = currentMonthBounds();

  const conditions = [
    eq(reservationsTable.status, "confirmed"),
    gte(reservationsTable.date, firstOfMonth),
    lte(reservationsTable.date, lastOfMonth),
  ];

  const needsJoin = resourceType || entityId;

  if (!needsJoin) {
    const rows = await db
      .select({ id: reservationsTable.id })
      .from(reservationsTable)
      .where(and(...conditions));
    return rows.length;
  }

  const joinConditions = [...conditions];
  if (resourceType) {
    joinConditions.push(eq(spotsTable.resourceType, resourceType));
  }
  if (entityId) {
    joinConditions.push(eq(spotsTable.entityId, entityId));
  }

  const rows = await db
    .select({ id: reservationsTable.id })
    .from(reservationsTable)
    .innerJoin(spotsTable, eq(reservationsTable.spotId, spotsTable.id))
    .where(and(...joinConditions));

  return rows.length;
}

export interface RecentActivity {
  id: string;
  user_name: string;
  spot_label: string;
  date: string;
  type: "reservation" | "visitor";
  visitor_name?: string;
}

/**
 * Devuelve las últimas N reservas confirmadas + reservas de visitantes
 * combinadas y ordenadas por created_at.
 * Usada por el panel "Actividad reciente" del admin.
 *
 * @param entityId - Si se proporciona, filtra por sede.
 */
export async function getRecentActivity(
  limit = 8,
  entityId?: string | null
): Promise<RecentActivity[]> {
  const resConditions = [eq(reservationsTable.status, "confirmed")];
  const visConditions = [eq(visitorReservationsTable.status, "confirmed")];

  if (entityId) {
    resConditions.push(eq(spotsTable.entityId, entityId));
    visConditions.push(eq(spotsTable.entityId, entityId));
  }

  const [resRows, visRows] = await Promise.all([
    db
      .select({
        id: reservationsTable.id,
        date: reservationsTable.date,
        createdAt: reservationsTable.createdAt,
        spotLabel: spotsTable.label,
        spotEntityId: spotsTable.entityId,
        fullName: profilesTable.fullName,
      })
      .from(reservationsTable)
      .innerJoin(spotsTable, eq(reservationsTable.spotId, spotsTable.id))
      .innerJoin(profilesTable, eq(reservationsTable.userId, profilesTable.id))
      .where(
        entityId
          ? and(...resConditions)
          : eq(reservationsTable.status, "confirmed")
      )
      .orderBy(desc(reservationsTable.createdAt))
      .limit(limit),
    db
      .select({
        id: visitorReservationsTable.id,
        date: visitorReservationsTable.date,
        createdAt: visitorReservationsTable.createdAt,
        visitorName: visitorReservationsTable.visitorName,
        spotLabel: spotsTable.label,
        spotEntityId: spotsTable.entityId,
      })
      .from(visitorReservationsTable)
      .innerJoin(spotsTable, eq(visitorReservationsTable.spotId, spotsTable.id))
      .where(
        entityId
          ? and(...visConditions)
          : eq(visitorReservationsTable.status, "confirmed")
      )
      .orderBy(desc(visitorReservationsTable.createdAt))
      .limit(limit),
  ]);

  // Filtro adicional por entityId
  const resData = entityId
    ? resRows.filter((r) => r.spotEntityId === entityId)
    : resRows;
  const visData = entityId
    ? visRows.filter((v) => v.spotEntityId === entityId)
    : visRows;

  type ActivityWithTime = RecentActivity & { createdAt: Date };

  const reservations: ActivityWithTime[] = resData.map((r) => ({
    id: r.id,
    user_name: r.fullName ?? "Usuario",
    spot_label: r.spotLabel ?? "—",
    date: r.date,
    type: "reservation" as const,
    createdAt: r.createdAt,
  }));

  const visitors: ActivityWithTime[] = visData.map((v) => ({
    id: v.id,
    user_name: v.visitorName ?? "Visitante",
    spot_label: v.spotLabel ?? "—",
    date: v.date,
    type: "visitor" as const,
    visitor_name: v.visitorName ?? undefined,
    createdAt: v.createdAt,
  }));

  return [...reservations, ...visitors]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, limit)
    .map(({ createdAt: _, ...item }) => item);
}

/**
 * @param entityId - Si se proporciona, filtra por sede.
 */
export async function getActiveUsersThisMonth(
  entityId?: string | null
): Promise<number> {
  const { firstOfMonth, lastOfMonth } = currentMonthBounds();

  const conditions = [
    eq(reservationsTable.status, "confirmed"),
    gte(reservationsTable.date, firstOfMonth),
    lte(reservationsTable.date, lastOfMonth),
  ];

  if (entityId) {
    const rows = await db
      .select({
        userId: reservationsTable.userId,
        spotEntityId: spotsTable.entityId,
      })
      .from(reservationsTable)
      .innerJoin(spotsTable, eq(reservationsTable.spotId, spotsTable.id))
      .where(and(...conditions));

    const filtered = rows.filter((r) => r.spotEntityId === entityId);
    const uniqueUsers = new Set(filtered.map((r) => r.userId));
    return uniqueUsers.size;
  }

  const rows = await db
    .select({ userId: reservationsTable.userId })
    .from(reservationsTable)
    .where(and(...conditions));

  const uniqueUsers = new Set(rows.map((r) => r.userId));
  return uniqueUsers.size;
}

/**
 * Devuelve el número de reservas de visitantes confirmadas para una fecha dada.
 * Usada por el panel admin (KPI de visitantes hoy).
 *
 * @param entityId - Si se proporciona, filtra por sede.
 */
export async function getVisitorsTodayCount(
  date: string,
  entityId?: string | null
): Promise<number> {
  if (!entityId) {
    const rows = await db
      .select({ id: visitorReservationsTable.id })
      .from(visitorReservationsTable)
      .where(
        and(
          eq(visitorReservationsTable.date, date),
          eq(visitorReservationsTable.status, "confirmed")
        )
      );
    return rows.length;
  }

  // Con filtro de sede — join con spots
  const rows = await db
    .select({ spotEntityId: spotsTable.entityId })
    .from(visitorReservationsTable)
    .innerJoin(spotsTable, eq(visitorReservationsTable.spotId, spotsTable.id))
    .where(
      and(
        eq(visitorReservationsTable.date, date),
        eq(visitorReservationsTable.status, "confirmed"),
        eq(spotsTable.entityId, entityId)
      )
    );

  return rows.filter((r) => r.spotEntityId === entityId).length;
}
