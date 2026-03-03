/**
 * Panel de Administración (Admin Dashboard)
 *
 * Server Component — admin only.
 * Non-admin roles are redirected to /parking.
 *
 * Follows the shadcn-admin dashboard pattern:
 *   - Tabs: Resumen + Analítica
 *   - Stats cards, bar chart, recent activity, analytics area chart + bar lists
 */

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/supabase/auth";
import { getSpotsByDate } from "@/lib/queries/spots";
import { getProfiles } from "@/lib/queries/profiles";
import {
  getDailyCountsLast30Days,
  getTopSpots,
  getMovementDistribution,
  getMonthlyReservationCount,
  getActiveUsersThisMonth,
  getRecentActivity,
  getVisitorsTodayCount,
} from "@/lib/queries/stats";
import { Header, Main } from "@/components/layout";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/layout/theme-switch";
import { ProfileDropdown } from "@/components/profile-dropdown";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/lib/constants";
import { AdminStatsCards } from "./_components/admin-stats-cards";
import { ReservationsOverviewChart } from "./_components/reservations-overview-chart";
import { OccupancyAreaChart } from "./_components/occupancy-area-chart";
import { SimpleBarList } from "./_components/simple-bar-list";
import { RecentActivity } from "./_components/recent-activity";
import { AdminAlerts } from "./_components/admin-alerts";
import { DashboardTopNav } from "./_components/dashboard-top-nav";

export default async function PanelPage() {
  const user = await requireAuth();
  const role = user.profile?.role ?? "employee";

  // Only admin can access this page
  if (role !== "admin") {
    redirect(ROUTES.PARKING);
  }

  const today = new Date().toISOString().split("T")[0]!;

  // Fetch all data in parallel
  const [
    spots,
    _profiles,
    dailyCounts,
    topSpots,
    movementDistribution,
    monthlyReservations,
    activeUsers,
    recentActivity,
    visitorsToday,
  ] = await Promise.all([
    getSpotsByDate(today),
    getProfiles(),
    getDailyCountsLast30Days(30),
    getTopSpots(6),
    getMovementDistribution(),
    getMonthlyReservationCount(),
    getActiveUsersThisMonth(),
    getRecentActivity(8),
    getVisitorsTodayCount(today),
  ]);

  // Compute occupancy
  const totalSpots = spots.length;
  const freeSpots = spots.filter(
    (s) => s.status === "free" || s.status === "ceded"
  ).length;
  const occupiedSpots = spots.filter(
    (s) =>
      s.status === "reserved" ||
      s.status === "occupied" ||
      s.status === "visitor-blocked"
  ).length;
  const occupancyPercent =
    totalSpots > 0 ? Math.round((occupiedSpots / totalSpots) * 100) : 0;

  // El rol "management" ya no existe – no hay alertas de este tipo
  const pendingManagement: typeof _profiles = [];

  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header fixed>
        <DashboardTopNav role="admin" />
        <div className="ms-auto flex items-center space-x-4">
          <Search />
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      {/* ===== Main ===== */}
      <Main>
        <div className="mb-2 flex items-center justify-between space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Panel</h1>
          <p className="text-muted-foreground text-sm">
            {formatDateLong(today)}
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <div className="w-full overflow-x-auto pb-2">
            <TabsList>
              <TabsTrigger value="overview">Resumen</TabsTrigger>
              <TabsTrigger value="analytics">Analítica</TabsTrigger>
            </TabsList>
          </div>

          {/* ── Resumen ─────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-4">
            {/* Stats cards */}
            <AdminStatsCards
              freeSpots={freeSpots}
              totalSpots={totalSpots}
              occupancyPercent={occupancyPercent}
              monthlyReservations={monthlyReservations}
              activeUsersMonth={activeUsers}
              visitorsToday={visitorsToday}
            />

            {/* Chart + Recent Activity */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
              {/* Bar chart — reservas últimos 30 días */}
              <Card className="col-span-1 lg:col-span-4">
                <CardHeader>
                  <CardTitle>Reservas — últimos 30 días</CardTitle>
                  <CardDescription>
                    Reservas de empleados y visitas confirmadas por día
                  </CardDescription>
                </CardHeader>
                <CardContent className="ps-2">
                  <ReservationsOverviewChart data={dailyCounts} />
                </CardContent>
              </Card>

              {/* Recent activity */}
              <Card className="col-span-1 lg:col-span-3">
                <CardHeader>
                  <CardTitle>Actividad reciente</CardTitle>
                  <CardDescription>
                    Últimas reservas registradas en el sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RecentActivity items={recentActivity} />
                </CardContent>
              </Card>
            </div>

            {/* Admin alerts */}
            <Card>
              <CardHeader>
                <CardTitle>Estado del sistema</CardTitle>
                <CardDescription>
                  Alertas y ocupación actual del parking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdminAlerts
                  pendingManagement={pendingManagement}
                  occupancyPercent={occupancyPercent}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Analítica ────────────────────────────────────── */}
          <TabsContent value="analytics" className="space-y-4">
            {/* Area chart — tendencia diaria */}
            <Card>
              <CardHeader>
                <CardTitle>Tendencia diaria de ocupación</CardTitle>
                <CardDescription>
                  Reservas de empleados y visitas de los últimos 30 días
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6">
                <OccupancyAreaChart data={dailyCounts} />
              </CardContent>
            </Card>

            {/* Bar lists */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
              <Card className="col-span-1 lg:col-span-4">
                <CardHeader>
                  <CardTitle>Plazas más reservadas</CardTitle>
                  <CardDescription>
                    Plazas con más reservas confirmadas este mes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {topSpots.length > 0 ? (
                    <SimpleBarList
                      items={topSpots.map((s) => ({
                        name: `Plaza ${s.spot_label}`,
                        value: s.count,
                      }))}
                      barClass="bg-primary"
                    />
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Sin datos este mes
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="col-span-1 lg:col-span-3">
                <CardHeader>
                  <CardTitle>Distribución de movimientos</CardTitle>
                  <CardDescription>Tipos de ocupación este mes</CardDescription>
                </CardHeader>
                <CardContent>
                  <SimpleBarList
                    items={movementDistribution}
                    barClass="bg-muted-foreground"
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </Main>
    </>
  );
}

function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
