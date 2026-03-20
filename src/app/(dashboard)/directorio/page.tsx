import { requireAuth } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { profiles, entities } from "@/lib/db/schema";
import { getAllEntities } from "@/lib/queries/entities";
import { eq } from "drizzle-orm";
import { Header, Main } from "@/components/layout";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/layout/theme-switch";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { DirectorioProvider } from "./_components/directorio-provider";
import { DirectorioTable } from "./_components/directorio-table";
import { DirectorioPrimaryButtons } from "./_components/directorio-primary-buttons";
import { DirectorioDialogs } from "./_components/directorio-dialogs";
import { type DirectorioUser } from "./_components/directorio-schema";

export default async function DirectorioPage() {
  const user = await requireAuth();
  const isAdmin = user.profile?.role === "admin";
  const userEntityId = user.profile?.entityId ?? null;

  // Los empleados solo ven usuarios de su propia sede;
  // los administradores ven el directorio global.
  const profilesQuery = db
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      email: profiles.email,
      role: profiles.role,
      jobTitle: profiles.jobTitle,
      phone: profiles.phone,
      entityId: profiles.entityId,
      entityName: entities.name,
    })
    .from(profiles)
    .leftJoin(entities, eq(profiles.entityId, entities.id))
    .orderBy(profiles.fullName);

  const [profileRows, allEntities] = await Promise.all([
    !isAdmin && userEntityId
      ? profilesQuery.where(eq(profiles.entityId, userEntityId))
      : profilesQuery,
    getAllEntities(),
  ]);

  const directorioData: DirectorioUser[] = profileRows.map((p) => ({
    id: p.id,
    nombre: p.fullName,
    correo: p.email,
    rol: p.role ?? "employee",
    puesto: p.jobTitle ?? "",
    telefono: p.phone ?? "",
    entity_id: p.entityId ?? null,
    entity_name: p.entityName ?? "",
  }));

  return (
    <DirectorioProvider isAdmin={isAdmin} entities={allEntities}>
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
            <h2 className="text-2xl font-bold tracking-tight">Directorio</h2>
            <p className="text-muted-foreground">
              Directorio de empleados de todas las sedes.
            </p>
          </div>
          <DirectorioPrimaryButtons />
        </div>
        <DirectorioTable data={directorioData} entities={allEntities} />
      </Main>

      <DirectorioDialogs />
    </DirectorioProvider>
  );
}
