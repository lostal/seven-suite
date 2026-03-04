/**
 * Reservas de Parking
 *
 * Reservas y cesiones de parking del usuario actual.
 * Redirige a /parking/cesiones si el usuario tiene una plaza asignada (modo cesión).
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Car } from "lucide-react";

import { requireAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getUserReservations } from "@/lib/queries/reservations";
import { getUserCessions } from "@/lib/queries/cessions";
import { Header, Main } from "@/components/layout";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/layout/theme-switch";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { MisReservasClient } from "../../mis-reservas/_components/mis-reservas-client";

export default async function ParkingReservasPage() {
  const user = await requireAuth();
  const role = user.profile?.role ?? "employee";

  if (role === "admin") {
    redirect(ROUTES.DASHBOARD);
  }

  const supabase = await createClient();

  const [reservations, cessions, parkingSpotResult] = await Promise.all([
    getUserReservations(user.id, "parking"),
    getUserCessions(user.id, "parking"),
    supabase
      .from("spots")
      .select("id")
      .eq("assigned_to", user.id)
      .eq("resource_type", "parking")
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  const hasParkingSpot = !!parkingSpotResult.data;

  // Usuarios con plaza van al calendario de cesiones de parking
  if (hasParkingSpot) {
    redirect(ROUTES.PARKING_CESSIONS);
  }

  const totalCount = reservations.length;
  const countLabel =
    totalCount === 0
      ? "No tienes reservas de parking próximas"
      : `${totalCount} reserva${totalCount !== 1 ? "s" : ""}`;

  return (
    <>
      <Header fixed>
        <Search />
        <div className="ms-auto flex items-center space-x-4">
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reservas</h1>
            <p className="text-muted-foreground text-sm">{countLabel}</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={ROUTES.PARKING}>
              <Car className="mr-1.5 size-3.5" />
              Ir al parking
              <ArrowRight className="ml-1.5 size-3.5" />
            </Link>
          </Button>
        </div>

        <MisReservasClient
          reservations={reservations}
          cessions={cessions}
          hasParkingSpot={hasParkingSpot}
          hasOfficeSpot={false}
          hideCtaLinks
        />
      </Main>
    </>
  );
}
