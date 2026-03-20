/**
 * Oficinas Page – Vista de calendario de puestos de trabajo
 *
 * Sin puesto asignado: reserva puestos por día (con o sin franja horaria).
 * Con puesto asignado (assigned_to != null): cede su puesto los días que no lo use.
 */

import { Header, Main } from "@/components/layout";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/layout/theme-switch";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { requireAuth } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { spots } from "@/lib/db/schema";
import { getAllResourceConfigs } from "@/lib/config";
import { eq, and } from "drizzle-orm";
import { OfficeCalendarView } from "./_components/office-calendar-view";
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

export default async function OficinasPage() {
  const user = await requireAuth();

  const entityId = await getEffectiveEntityId();
  const [assignedSpotRows, officeConfig] = await Promise.all([
    db
      .select({ id: spots.id, label: spots.label })
      .from(spots)
      .where(
        and(eq(spots.assignedTo, user.id), eq(spots.resourceType, "office"))
      )
      .limit(1),
    getAllResourceConfigs("office", entityId),
  ]);
  const assignedSpot = assignedSpotRows[0] ?? null;
  const {
    booking_enabled: bookingEnabled,
    time_slots_enabled: timeSlotsEnabled,
  } = officeConfig;

  const title = "Oficinas";
  const description = assignedSpot
    ? `Cede tu puesto asignado (${assignedSpot.label}) los días que no lo uses`
    : "Consulta la disponibilidad y reserva tu puesto de trabajo";

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
            {assignedSpot ? (
              <Link href={ROUTES.OFFICES_CESSIONS}>
                <ArrowLeftRight className="mr-1.5 size-3.5" />
                Ir a cesiones
                <ArrowRight className="ml-1.5 size-3.5" />
              </Link>
            ) : (
              <Link href={ROUTES.OFFICES_RESERVAS}>
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
                reservas de oficinas.
              </AlertDescription>
            </Alert>
          )}
          <OfficeCalendarView
            key={entityId ?? "global"}
            hasAssignedSpot={!!assignedSpot}
            assignedSpot={assignedSpot ?? null}
            timeSlotsEnabled={Boolean(timeSlotsEnabled)}
          />
        </div>
      </Main>
    </>
  );
}
