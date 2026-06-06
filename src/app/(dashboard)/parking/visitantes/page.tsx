/**
 * Visitors Page
 *
 * Gestión de reservas de aparcamiento para visitantes externos.
 * Cualquier empleado autenticado puede crear reservas; el visitante
 * recibe un email con su plaza y pases digitales (Apple/Google Wallet).
 *
 * Server Component: pasa `key={entityId}` al componente cliente para
 * forzar un remount completo (y re-fetch de datos) al cambiar de sede.
 */

import { requireAuth } from "@/lib/auth/helpers";
import { getEffectiveEntityId } from "@/lib/queries/active-entity";
import { Header } from "@/components/layout";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/layout/theme-switch";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { VisitantesClient } from "./_components/visitors-client";

export default async function VisitantesPage() {
  const user = await requireAuth();
  const entityId = await getEffectiveEntityId();

  return (
    <>
      <Header fixed>
        <Search />
        <div className="ms-auto flex items-center space-x-4">
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>
      <VisitantesClient
        key={entityId ?? "global"}
        currentUserId={user.id}
        currentUserRole={user.profile?.role === "admin" ? "admin" : "employee"}
      />
    </>
  );
}
