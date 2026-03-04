/**
 * Office Map Page
 *
 * Interactive map view for visualizing office spots.
 * Accessible to all authenticated users.
 */

import { Header, Main } from "@/components/layout";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/layout/theme-switch";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { requireAuth } from "@/lib/supabase/auth";
import { ComingSoon } from "@/components/coming-soon";

export default async function OfficeMapPage() {
  await requireAuth();

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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Mapa de Oficinas
            </h2>
            <p className="text-muted-foreground">
              Vista del plano de oficinas con disponibilidad en tiempo real
            </p>
          </div>
        </div>

        <ComingSoon
          title="Mapa interactivo"
          description="La vista de mapa interactivo estará disponible próximamente. Por ahora, usa la vista de Reservas para gestionar tus puestos."
        />
      </Main>
    </>
  );
}
