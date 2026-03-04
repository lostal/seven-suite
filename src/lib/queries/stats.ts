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
 */
export async function getDailyCountsLast30Days(
  days = 30,
  resourceType?: "parking" | "office"
): Promise<DailyCount[]> {
  const supabase = await createClient();

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));

  const startStr = startDate.toISOString().split("T")[0]!;
  const endStr = endDate.toISOString().split("T")[0]!;

  // Para filtrar por resource_type necesitamos hacer join con spots
  const reservationsSelect = resourceType
    ? "date, spots!reservations_spot_id_fkey(resource_type)"
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

  const [reservationsResult, visitorsResult] = await Promise.all([
    reservationsQuery,
    supabase
      .from("visitor_reservations")
      .select("date")
      .eq("status", "confirmed")
      .gte("date", startStr)
      .lte("date", endStr),
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

  type ReservationForCount = {
    date: string;
    spots?: { resource_type: string } | null;
  };
  for (const r of (reservationsResult.data ??
    []) as unknown as ReservationForCount[]) {
    if (resourceType && r.spots?.resource_type !== resourceType) continue;
    const entry = countsByDate.get(r.date);
    if (entry) entry.reservations++;
  }

  for (const v of visitorsResult.data ?? []) {
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
 */
export async function getTopSpots(
  limit = 6,
  resourceType?: "parking" | "office"
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
    .select("id, date, spots!reservations_spot_id_fkey(label, resource_type)")
    .eq("status", "confirmed")
    .gte("date", firstOfMonth)
    .lte("date", lastOfMonth);

  if (resourceType) {
    query = query.eq("spots.resource_type", resourceType);
  }

  type ReservaConPlazaFiltrada = {
    id: string;
    date: string;
    spots: { label: string; resource_type: string } | null;
  };

  const { data, error } = await query.returns<ReservaConPlazaFiltrada[]>();

  if (error) {
    console.error("[stats] getTopSpots DB error:", error.message);
    return [];
  }

  // Filtrar en JS las filas cuyo join no matched (spots is null) si resourceType dado
  const filtered = resourceType
    ? data.filter((r) => r.spots?.resource_type === resourceType)
    : data;

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
 */
export async function getMovementDistribution(): Promise<
  MovementDistribution[]
> {
  const supabase = await createClient();

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0]!;
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0]!;

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

/**
 * Devuelve el total de reservas confirmadas para el mes actual.
 *
 * @param resourceType - Si se proporciona, filtra por tipo de recurso.
 */
export async function getMonthlyReservationCount(
  resourceType?: "parking" | "office"
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
      resourceType
        ? "id, spots!reservations_spot_id_fkey(resource_type)"
        : "id",
      {
        count: "exact",
        head: !resourceType, // head:true solo si no filtramos por resource_type
      }
    )
    .eq("status", "confirmed")
    .gte("date", firstOfMonth)
    .lte("date", lastOfMonth);

  if (resourceType) {
    query = query.eq("spots.resource_type", resourceType);
  }

  const { count, data } = await query;

  // Si filtramos por resource_type, el count de head:false puede no ser exacto
  // por el comportamiento del join — usamos el tamaño real del array
  if (resourceType && data) {
    const filtered = (
      data as unknown as { spots: { resource_type: string } | null }[]
    ).filter((r) => r.spots?.resource_type === resourceType);
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
 */
export async function getRecentActivity(limit = 8): Promise<RecentActivity[]> {
  const supabase = await createClient();

  const [resResult, visResult] = await Promise.all([
    supabase
      .from("reservations")
      .select(
        "id, date, created_at, spots!reservations_spot_id_fkey(label), profiles!reservations_user_id_fkey(full_name)"
      )
      .eq("status", "confirmed")
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<ReservaActividad[]>(),
    supabase
      .from("visitor_reservations")
      .select(
        "id, date, created_at, visitor_name, spots!visitor_reservations_spot_id_fkey(label)"
      )
      .eq("status", "confirmed")
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<VisitanteActividad[]>(),
  ]);

  type ActivityWithTime = RecentActivity & { created_at: string };

  const reservations: ActivityWithTime[] = (resResult.data ?? []).map((r) => ({
    id: r.id,
    user_name: r.profiles?.full_name ?? "Usuario",
    spot_label: r.spots?.label ?? "—",
    date: r.date,
    type: "reservation" as const,
    created_at: r.created_at,
  }));

  const visitors: ActivityWithTime[] = (visResult.data ?? []).map((v) => ({
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

export async function getActiveUsersThisMonth(): Promise<number> {
  const supabase = await createClient();

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0]!;
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0]!;

  const { data, error } = await supabase
    .from("reservations")
    .select("user_id")
    .eq("status", "confirmed")
    .gte("date", firstOfMonth)
    .lte("date", lastOfMonth);

  if (error) {
    console.error("Error al obtener usuarios activos:", error);
    return 0;
  }

  const uniqueUsers = new Set(data.map((r) => r.user_id));
  return uniqueUsers.size;
}

/**
 * Devuelve el número de reservas de visitantes confirmadas para una fecha dada.
 * Usada por el panel admin (KPI de visitantes hoy).
 */
export async function getVisitorsTodayCount(date: string): Promise<number> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("visitor_reservations")
    .select("id", { count: "exact", head: true })
    .eq("date", date)
    .eq("status", "confirmed");

  return count ?? 0;
}
