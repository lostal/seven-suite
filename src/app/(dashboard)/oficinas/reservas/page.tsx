/**
 * Reservas de Oficinas
 *
 * Reservas y cesiones de oficina del usuario actual.
 * Redirige a /oficinas/cesiones si el usuario tiene un puesto asignado.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";

import { requireAuth } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { spots } from "@/lib/db/schema";
import { getUserOfficeReservations } from "@/lib/queries/offices";
import { getUserCessions } from "@/lib/queries/cessions";
import { eq, and } from "drizzle-orm";
import { Header, Main } from "@/components/layout";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/layout/theme-switch";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { MisReservasClient } from "../../mis-reservas/_components/mis-reservas-client";

export default async function OficinasReservasPage() {
  const user = await requireAuth();
  const role = user.profile?.role ?? "employee";

  if (role === "admin") {
    redirect(ROUTES.DASHBOARD);
  }

  const [officeReservations, cessions, officeSpotRows] = await Promise.all([
    getUserOfficeReservations(user.id),
    getUserCessions(user.id, "office"),
    db
      .select({ id: spots.id })
      .from(spots)
      .where(
        and(
          eq(spots.assignedTo, user.id),
          eq(spots.resourceType, "office"),
          eq(spots.isActive, true)
        )
      )
      .limit(1),
  ]);

  const hasOfficeSpot = officeSpotRows.length > 0;

  // Usuarios con puesto asignado van al calendario de cesiones de oficina
  if (hasOfficeSpot) {
    redirect(ROUTES.OFFICES_CESSIONS);
  }

  const totalCount = officeReservations.length;
  const countLabel =
    totalCount === 0
      ? "No tienes reservas de oficina próximas"
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
            <Link href={ROUTES.OFFICES}>
              <Building2 className="mr-1.5 size-3.5" />
              Ir a oficinas
              <ArrowRight className="ml-1.5 size-3.5" />
            </Link>
          </Button>
        </div>

        <MisReservasClient
          officeReservations={officeReservations}
          cessions={cessions}
          hasParkingSpot={false}
          hasOfficeSpot={hasOfficeSpot}
          hideCtaLinks
        />
      </Main>
    </>
  );
}
