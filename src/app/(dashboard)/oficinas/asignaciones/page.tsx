import { requireAdmin } from "@/lib/auth/helpers";
import { Header, Main } from "@/components/layout";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/layout/theme-switch";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { getSpots } from "@/lib/queries/spots";
import { getProfiles } from "@/lib/queries/profiles";
import { getEffectiveEntityId } from "@/lib/queries/active-entity";
import { SpotsProvider } from "@/app/(dashboard)/administracion/components/spots-provider";
import { SpotsDialogs } from "@/app/(dashboard)/administracion/components/spots-dialogs";
import { SpotsPrimaryButtons } from "@/app/(dashboard)/administracion/components/spots-primary-buttons";
import { SpotsTable } from "@/app/(dashboard)/administracion/components/spots-table";
export default async function OficinaAsignacionesPage() {
  await requireAdmin();

  const entityId = await getEffectiveEntityId();

  const [spotsData, profilesData] = await Promise.all([
    getSpots("office", true, entityId),
    getProfiles(entityId),
  ]);

  return (
    <SpotsProvider defaultResourceType="office">
      <Header fixed>
        <Search />
        <div className="ms-auto flex items-center space-x-4">
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>
      <Main className="flex flex-1 flex-col gap-4 sm:gap-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Oficinas — Asignaciones
            </h2>
            <p className="text-muted-foreground text-sm">
              Gestiona los puestos de oficina y sus asignaciones.
            </p>
          </div>
          <SpotsPrimaryButtons />
        </div>
        <SpotsTable spots={spotsData} profiles={profilesData} />
      </Main>
      <SpotsDialogs />
    </SpotsProvider>
  );
}
