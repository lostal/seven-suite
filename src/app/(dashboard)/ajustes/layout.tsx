/**
 * Configuración — Layout unificado
 *
 * Layout compartido para todas las páginas de configuración:
 *   • Personal (perfil, notificaciones, apariencia, Microsoft 365, seguridad)
 *   • Sistema  (general, parking, oficinas — solo admin)
 *
 * Acceso: cualquier usuario autenticado. Las páginas de Sistema
 * tienen su propio guard `requireAdmin()`.
 */

import { requireAuth } from "@/lib/auth/helpers";
import { Header, Main } from "@/components/layout";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/layout/theme-switch";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { Separator } from "@/components/ui/separator";
import { SettingsSidebar } from "./_components/settings-sidebar";

export const metadata = {
  title: "Ajustes - Seven Suite",
  description:
    "Configura tus preferencias personales y los parámetros del sistema",
};

export default async function ConfiguracionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  const isAdmin = user.profile?.role === "admin";

  return (
    <>
      <Header fixed>
        <Search />
        <div className="ms-auto flex items-center space-x-4">
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>
      <Main fixed>
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Ajustes
          </h1>
          <p className="text-muted-foreground">
            Gestiona tus preferencias personales
            {isAdmin && " y la configuración del sistema"}
          </p>
        </div>

        <Separator className="my-4 lg:my-6" />

        <div className="flex min-h-0 flex-1 flex-col space-y-2 overflow-hidden md:space-y-2 lg:flex-row lg:space-y-0 lg:space-x-12">
          <aside className="top-0 lg:sticky lg:w-1/5">
            <SettingsSidebar isAdmin={isAdmin} />
          </aside>
          <div className="flex min-h-0 w-full overflow-y-auto p-1">
            {children}
          </div>
        </div>
      </Main>
    </>
  );
}
