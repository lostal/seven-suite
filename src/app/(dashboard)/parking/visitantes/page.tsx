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
import { getResourceConfig } from "@/lib/config";
import { Header } from "@/components/layout";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/layout/theme-switch";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TriangleAlert } from "lucide-react";
import { VisitantesClient } from "./_components/visitors-client";

export default async function VisitantesPage() {
  const user = await requireAuth();
  const entityId = await getEffectiveEntityId();

  const [bookingEnabled, visitorBookingEnabled] = await Promise.all([
    getResourceConfig("parking", "booking_enabled", entityId),
    getResourceConfig("parking", "visitor_booking_enabled", entityId),
  ]);

  return (
    <>
      <Header fixed>
        <Search />
        <div className="ms-auto flex items-center space-x-4">
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>
      {!bookingEnabled ? (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertTitle>Parking deshabilitado</AlertTitle>
          <AlertDescription>
            El administrador ha desactivado temporalmente las reservas de
            parking. Las reservas de visitantes también están deshabilitadas.
          </AlertDescription>
        </Alert>
      ) : !visitorBookingEnabled ? (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertTitle>Visitantes deshabilitados</AlertTitle>
          <AlertDescription>
            El administrador ha desactivado temporalmente las reservas para
            visitantes.
          </AlertDescription>
        </Alert>
      ) : (
        <VisitantesClient
          key={entityId ?? "global"}
          currentUserId={user.id}
          currentUserRole={
            user.profile?.role === "admin" ? "admin" : "employee"
          }
        />
      )}
    </>
  );
}
