/**
 * Queries de Estadísticas
 *
 * Funciones de servidor para analíticas del panel de administración.
 * Todas las funciones requieren rol admin — llamar solo desde páginas admin.
 */

import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));

  const startStr = startDate.toISOString().split("T")[0]!;
  const endStr = endDate.toISOString().split("T")[0]!;

  // Para filtrar por resource_type o entity_id necesitamos hacer join con spots
  const needsJoin = resourceType || entityId;
  const reservationsSelect = needsJoin
    ? "date, spots!reservations_spot_id_fkey(resource_type, entity_id)"
    : "date";

  let reservationsQuery = supabase
    .from("reservations")
    .select(reservationsSelect)
    .eq("status", "confirmed")
    .gte("date", startStr)
    .lte("date", endStr);

  if (resourceType) {
    reservationsQuery = reservationsQuery.eq(
      "spots.resource_type",
      resourceType
    );
  }
  if (entityId) {
    reservationsQuery = reservationsQuery.eq("spots.entity_id", entityId);
  }

  type ReservationForCount = {
    date: string;
    spots?: { resource_type: string; entity_id: string | null } | null;
  };

  let visitorsQuery = supabase
    .from("visitor_reservations")
    .select(
      entityId
        ? "date, spots!visitor_reservations_spot_id_fkey(entity_id)"
        : "date"
    )
    .eq("status", "confirmed")
    .gte("date", startStr)
    .lte("date", endStr);

  if (entityId) {
    visitorsQuery = visitorsQuery.eq("spots.entity_id", entityId);
  }

  type VisitorForCount = {
    date: string;
    spots?: { entity_id: string | null } | null;
  };

  const [reservationsResult, visitorsResult] = await Promise.all([
    reservationsQuery.returns<ReservationForCount[]>(),
    visitorsQuery.returns<VisitorForCount[]>(),
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
    const dateStr = d.toISOString().split("T")[0]!;
    countsByDate.set(dateStr, { reservations: 0, visitors: 0 });
  }

  for (const r of reservationsResult.data ?? []) {
    if (resourceType && r.spots?.resource_type !== resourceType) continue;
    if (entityId && r.spots?.entity_id !== entityId) continue;
    const entry = countsByDate.get(r.date);
    if (entry) entry.reservations++;
  }

  for (const v of visitorsResult.data ?? []) {
    if (entityId && v.spots?.entity_id !== entityId) continue;
    const entry = countsByDate.get(v.date);
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
  const supabase = await createClient();

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0]!;
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0]!;

  let query = supabase
    .from("reservations")
    .select(
      "id, date, spots!reservations_spot_id_fkey(label, resource_type, entity_id)"
    )
    .eq("status", "confirmed")
    .gte("date", firstOfMonth)
    .lte("date", lastOfMonth);

  if (resourceType) {
    query = query.eq("spots.resource_type", resourceType);
  }
  if (entityId) {
    query = query.eq("spots.entity_id", entityId);
  }

  type ReservaConPlazaFiltrada = {
    id: string;
    date: string;
    spots: {
      label: string;
      resource_type: string;
      entity_id: string | null;
    } | null;
  };

  const { data, error } = await query.returns<ReservaConPlazaFiltrada[]>();

  if (error) {
    console.error("[stats] getTopSpots DB error:", error.message);
    return [];
  }

  // Filtrar en JS las filas cuyo join no matched (spots is null)
  let filtered = data;
  if (resourceType) {
    filtered = filtered.filter((r) => r.spots?.resource_type === resourceType);
  }
  if (entityId) {
    filtered = filtered.filter((r) => r.spots?.entity_id === entityId);
  }

  // Agrupar por plaza
  const countBySpot = new Map<string, number>();
  for (const r of filtered) {
    const label = r.spots?.label ?? "—";
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
  const supabase = await createClient();

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0]!;
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0]!;

  if (!entityId) {
    // Sin filtro de sede → head:true para rendimiento
    const [resResult, cesResult, visResult] = await Promise.all([
      supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("status", "confirmed")
        .gte("date", firstOfMonth)
        .lte("date", lastOfMonth),
      supabase
        .from("cessions")
        .select("id", { count: "exact", head: true })
        .neq("status", "cancelled")
        .gte("date", firstOfMonth)
        .lte("date", lastOfMonth),
      supabase
        .from("visitor_reservations")
        .select("id", { count: "exact", head: true })
        .eq("status", "confirmed")
        .gte("date", firstOfMonth)
        .lte("date", lastOfMonth),
    ]);

    return [
      { name: "Reservas empleados", value: resResult.count ?? 0 },
      { name: "Cesiones dirección", value: cesResult.count ?? 0 },
      { name: "Visitantes", value: visResult.count ?? 0 },
    ];
  }

  // Con filtro de sede — join con spots para filtrar por entity_id
  type WithSpot = { spots: { entity_id: string | null } | null };

  const [resResult, cesResult, visResult] = await Promise.all([
    supabase
      .from("reservations")
      .select("id, spots!reservations_spot_id_fkey(entity_id)")
      .eq("status", "confirmed")
      .gte("date", firstOfMonth)
      .lte("date", lastOfMonth)
      .eq("spots.entity_id", entityId)
      .returns<WithSpot[]>(),
    supabase
      .from("cessions")
      .select("id, spots!cessions_spot_id_fkey(entity_id)")
      .neq("status", "cancelled")
      .gte("date", firstOfMonth)
      .lte("date", lastOfMonth)
      .eq("spots.entity_id", entityId)
      .returns<WithSpot[]>(),
    supabase
      .from("visitor_reservations")
      .select("id, spots!visitor_reservations_spot_id_fkey(entity_id)")
      .eq("status", "confirmed")
      .gte("date", firstOfMonth)
      .lte("date", lastOfMonth)
      .eq("spots.entity_id", entityId)
      .returns<WithSpot[]>(),
  ]);

  // Filtro JS adicional por si PostgREST devuelve filas con spots:null
  const resCount = (resResult.data ?? []).filter(
    (r) => r.spots?.entity_id === entityId
  ).length;
  const cesCount = (cesResult.data ?? []).filter(
    (r) => r.spots?.entity_id === entityId
  ).length;
  const visCount = (visResult.data ?? []).filter(
    (r) => r.spots?.entity_id === entityId
  ).length;

  return [
    { name: "Reservas empleados", value: resCount },
    { name: "Cesiones dirección", value: cesCount },
    { name: "Visitantes", value: visCount },
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
  const supabase = await createClient();

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0]!;
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0]!;

  const needsJoin = resourceType || entityId;

  let query = supabase
    .from("reservations")
    .select(
      needsJoin
        ? "id, spots!reservations_spot_id_fkey(resource_type, entity_id)"
        : "id",
      {
        count: "exact",
        head: !needsJoin, // head:true solo si no necesitamos filtrar el join
      }
    )
    .eq("status", "confirmed")
    .gte("date", firstOfMonth)
    .lte("date", lastOfMonth);

  if (resourceType) {
    query = query.eq("spots.resource_type", resourceType);
  }
  if (entityId) {
    query = query.eq("spots.entity_id", entityId);
  }

  const { count, data } = await query;

  // Si usamos join, el count puede no ser exacto — usamos filtro JS
  if (needsJoin && data) {
    const rows = data as unknown as {
      spots: { resource_type: string; entity_id: string | null } | null;
    }[];
    const filtered = rows.filter((r) => {
      if (resourceType && r.spots?.resource_type !== resourceType) return false;
      if (entityId && r.spots?.entity_id !== entityId) return false;
      return true;
    });
    return filtered.length;
  }

  return count ?? 0;
}

export interface RecentActivity {
  id: string;
  user_name: string;
  spot_label: string;
  date: string;
  type: "reservation" | "visitor";
  visitor_name?: string;
}

/** Tipo interno para reservas en la actividad reciente */
type ReservaActividad = {
  id: string;
  date: string;
  created_at: string;
  spots: { label: string } | null;
  profiles: { full_name: string } | null;
};

/** Tipo interno para visitantes en la actividad reciente */
type VisitanteActividad = {
  id: string;
  date: string;
  created_at: string;
  visitor_name: string | null;
  spots: { label: string } | null;
};

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
  const supabase = await createClient();

  /** Tipo interno para reservas en la actividad reciente con entity_id */
  type ReservaActividadConEntidad = ReservaActividad & {
    spots: { label: string; entity_id: string | null } | null;
  };
  /** Tipo interno para visitantes en la actividad reciente con entity_id */
  type VisitanteActividadConEntidad = VisitanteActividad & {
    spots: { label: string; entity_id: string | null } | null;
  };

  const resSelect = entityId
    ? "id, date, created_at, spots!reservations_spot_id_fkey(label, entity_id), profiles!reservations_user_id_fkey(full_name)"
    : "id, date, created_at, spots!reservations_spot_id_fkey(label), profiles!reservations_user_id_fkey(full_name)";

  const visSelect = entityId
    ? "id, date, created_at, visitor_name, spots!visitor_reservations_spot_id_fkey(label, entity_id)"
    : "id, date, created_at, visitor_name, spots!visitor_reservations_spot_id_fkey(label)";

  let resQuery = supabase
    .from("reservations")
    .select(resSelect)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(limit);

  let visQuery = supabase
    .from("visitor_reservations")
    .select(visSelect)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (entityId) {
    resQuery = resQuery.eq("spots.entity_id", entityId);
    visQuery = visQuery.eq("spots.entity_id", entityId);
  }

  const [resResult, visResult] = await Promise.all([
    resQuery.returns<ReservaActividadConEntidad[]>(),
    visQuery.returns<VisitanteActividadConEntidad[]>(),
  ]);

  type ActivityWithTime = RecentActivity & { created_at: string };

  // Filtro JS adicional por si PostgREST devuelve filas con spots:null en lugar de excluirlas
  const resData = entityId
    ? (resResult.data ?? []).filter((r) => r.spots?.entity_id === entityId)
    : (resResult.data ?? []);
  const visData = entityId
    ? (visResult.data ?? []).filter((v) => v.spots?.entity_id === entityId)
    : (visResult.data ?? []);

  const reservations: ActivityWithTime[] = resData.map((r) => ({
    id: r.id,
    user_name: r.profiles?.full_name ?? "Usuario",
    spot_label: r.spots?.label ?? "—",
    date: r.date,
    type: "reservation" as const,
    created_at: r.created_at,
  }));

  const visitors: ActivityWithTime[] = visData.map((v) => ({
    id: v.id,
    user_name: v.visitor_name ?? "Visitante",
    spot_label: v.spots?.label ?? "—",
    date: v.date,
    type: "visitor" as const,
    visitor_name: v.visitor_name ?? undefined,
    created_at: v.created_at,
  }));

  return [...reservations, ...visitors]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, limit)
    .map(({ created_at: _, ...item }) => item);
}

/**
 * @param entityId - Si se proporciona, filtra por sede.
 */
export async function getActiveUsersThisMonth(
  entityId?: string | null
): Promise<number> {
  const supabase = await createClient();

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0]!;
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0]!;

  let query = supabase
    .from("reservations")
    .select(
      entityId
        ? "user_id, spots!reservations_spot_id_fkey(entity_id)"
        : "user_id"
    )
    .eq("status", "confirmed")
    .gte("date", firstOfMonth)
    .lte("date", lastOfMonth);

  if (entityId) {
    query = query.eq("spots.entity_id", entityId);
  }

  type Row = { user_id: string; spots?: { entity_id: string | null } | null };

  const { data, error } = await query.returns<Row[]>();

  if (error) {
    console.error("Error al obtener usuarios activos:", error);
    return 0;
  }

  const rows = entityId
    ? data.filter((r) => r.spots?.entity_id === entityId)
    : data;

  const uniqueUsers = new Set(rows.map((r) => r.user_id));
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
  const supabase = await createClient();

  if (!entityId) {
    const { count } = await supabase
      .from("visitor_reservations")
      .select("id", { count: "exact", head: true })
      .eq("date", date)
      .eq("status", "confirmed");

    return count ?? 0;
  }

  // Con filtro de sede — join con spots
  type Row = { spots: { entity_id: string | null } | null };

  const { data } = await supabase
    .from("visitor_reservations")
    .select("id, spots!visitor_reservations_spot_id_fkey(entity_id)")
    .eq("date", date)
    .eq("status", "confirmed")
    .eq("spots.entity_id", entityId)
    .returns<Row[]>();

  return (data ?? []).filter((r) => r.spots?.entity_id === entityId).length;
}
