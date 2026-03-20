/**
 * Cesiones de Parking
 *
 * Cesiones de parking del usuario con plaza asignada.
 * Redirige a /parking/reservas si el usuario no tiene plaza asignada.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ParkingCircle } from "lucide-react";

import { requireAuth } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { spots } from "@/lib/db/schema";
import { getUserCessions } from "@/lib/queries/cessions";
import { eq, and } from "drizzle-orm";
import { Header, Main } from "@/components/layout";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/layout/theme-switch";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { MisReservasClient } from "../../mis-reservas/_components/mis-reservas-client";

export default async function ParkingCesionesPage() {
  const user = await requireAuth();
  const role = user.profile?.role ?? "employee";

  if (role === "admin") {
    redirect(ROUTES.DASHBOARD);
  }

  const [cessions, parkingSpotRows] = await Promise.all([
    getUserCessions(user.id, "parking"),
    db
      .select({ id: spots.id })
      .from(spots)
      .where(
        and(
          eq(spots.assignedTo, user.id),
          eq(spots.resourceType, "parking"),
          eq(spots.isActive, true)
        )
      )
      .limit(1),
  ]);

  const hasParkingSpot = parkingSpotRows.length > 0;

  if (!hasParkingSpot) {
    redirect(ROUTES.PARKING_RESERVAS);
  }

  const totalCount = cessions.length;
  const countLabel =
    totalCount === 0
      ? "No tienes cesiones programadas"
      : `${totalCount} cesión${totalCount !== 1 ? "es" : ""}`;

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
            <h1 className="text-2xl font-bold tracking-tight">Cesiones</h1>
            <p className="text-muted-foreground text-sm">{countLabel}</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={ROUTES.PARKING}>
              <ParkingCircle className="mr-1.5 size-3.5" />
              Ir al parking
              <ArrowRight className="ml-1.5 size-3.5" />
            </Link>
          </Button>
        </div>

        <MisReservasClient
          cessions={cessions}
          hasParkingSpot
          hasOfficeSpot
          hideCtaLinks
        />
      </Main>
    </>
  );
}
