/**
 * Parking Page – Vista unificada de calendario
 *
 * Empleado sin plaza asignada: reservar plazas por día.
 * Empleado/admin con plaza asignada: ceder su plaza de parking.
 */

import { Header, Main } from "@/components/layout";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/layout/theme-switch";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { requireAuth } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { spots } from "@/lib/db/schema";
import { ParkingCalendarView } from "./_components/parking-calendar-view";
import { getResourceConfig } from "@/lib/config";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeftRight,
  ArrowRight,
  CalendarCheck,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { getEffectiveEntityId } from "@/lib/queries/active-entity";
import { eq, and } from "drizzle-orm";

export default async function ParkingPage() {
  const user = await requireAuth();

  const entityId = await getEffectiveEntityId();
  const [[assignedParkingSpot], bookingEnabled] = await Promise.all([
    db
      .select()
      .from(spots)
      .where(
        and(eq(spots.assignedTo, user.id), eq(spots.resourceType, "parking"))
      )
      .limit(1),
    getResourceConfig("parking", "booking_enabled", entityId),
  ]);

  const title = "Parking";
  const description = assignedParkingSpot
    ? `Cede tu plaza asignada (${assignedParkingSpot.label}) los días que no la uses`
    : "Consulta la disponibilidad y reserva tu plaza";

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
            <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
            <p className="text-muted-foreground">{description}</p>
          </div>
          <Button asChild variant="outline" size="sm">
            {assignedParkingSpot ? (
              <Link href={ROUTES.PARKING_CESSIONS}>
                <ArrowLeftRight className="mr-1.5 size-3.5" />
                Ir a cesiones
                <ArrowRight className="ml-1.5 size-3.5" />
              </Link>
            ) : (
              <Link href={ROUTES.PARKING_RESERVAS}>
                <CalendarCheck className="mr-1.5 size-3.5" />
                Ir a reservas
                <ArrowRight className="ml-1.5 size-3.5" />
              </Link>
            )}
          </Button>
        </div>

        <div className="mx-auto max-w-lg">
          {!bookingEnabled && (
            <Alert variant="destructive" className="mb-6">
              <TriangleAlert className="size-4" />
              <AlertTitle>Reservas deshabilitadas</AlertTitle>
              <AlertDescription>
                El administrador ha desactivado temporalmente las nuevas
                reservas de parking.
              </AlertDescription>
            </Alert>
          )}
          <ParkingCalendarView
            key={entityId ?? "global"}
            hasAssignedSpot={!!assignedParkingSpot}
            assignedSpot={assignedParkingSpot}
          />
        </div>
      </Main>
    </>
  );
}
