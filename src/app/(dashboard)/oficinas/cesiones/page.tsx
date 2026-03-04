/**
 * Cesiones de Oficinas
 *
 * Cesiones de oficina del usuario con puesto asignado.
 * Redirige a /oficinas/reservas si el usuario no tiene puesto asignado.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";

import { requireAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getUserCessions } from "@/lib/queries/cessions";
import { Header, Main } from "@/components/layout";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/layout/theme-switch";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { MisReservasClient } from "../../mis-reservas/_components/mis-reservas-client";

export default async function OfficeCesionesPage() {
  const user = await requireAuth();
  const role = user.profile?.role ?? "employee";

  if (role === "admin") {
    redirect(ROUTES.DASHBOARD);
  }

  const supabase = await createClient();

  const [cessions, officeSpotResult] = await Promise.all([
    getUserCessions(user.id, "office"),
    supabase
      .from("spots")
      .select("id")
      .eq("assigned_to", user.id)
      .eq("resource_type", "office")
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  const hasOfficeSpot = !!officeSpotResult.data;

  if (!hasOfficeSpot) {
    redirect(ROUTES.OFFICES_RESERVAS);
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
            <Link href={ROUTES.OFFICES}>
              <Building2 className="mr-1.5 size-3.5" />
              Ir a oficinas
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
