/**
 * Visitors Page
 *
 * Gestión de reservas de aparcamiento para visitantes externos.
 * Cualquier empleado autenticado puede crear reservas; el visitante
 * recibe un email con su plaza y pases digitales (Apple/Google Wallet).
 */

"use client";

import * as React from "react";
import { toast } from "sonner";

import { Header, Main } from "@/components/layout";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/layout/theme-switch";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { useUser } from "@/hooks/use-user";

import { getVisitorReservationsAction } from "./actions";
import type { VisitorReservationWithDetails } from "@/lib/queries/visitor-reservations";
import { VisitantesProvider } from "./_components/visitors-provider";
import { VisitantesPrimaryButtons } from "./_components/visitors-primary-buttons";
import { VisitantesTable } from "./_components/visitors-table";
import { VisitantesDialogs } from "./_components/visitors-dialogs";

export default function VisitantesPage() {
  const { user, profile } = useUser();

  const [data, setData] = React.useState<VisitorReservationWithDetails[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getVisitorReservationsAction();
      if (result.success) {
        setData(result.data);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Error al cargar las reservas de visitantes");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <VisitantesProvider
      onRefresh={fetchData}
      currentUserId={user?.id ?? ""}
      currentUserRole={profile?.role ?? "employee"}
    >
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
            <h2 className="text-2xl font-bold tracking-tight">Visitantes</h2>
            <p className="text-muted-foreground">
              Gestiona las reservas de aparcamiento para visitantes externos.
            </p>
          </div>
          <VisitantesPrimaryButtons />
        </div>

        <VisitantesTable data={data} isLoading={isLoading} />
      </Main>

      <VisitantesDialogs />
    </VisitantesProvider>
  );
}
