/**
 * Notificaciones — Preferencias de notificación del usuario
 */

import { requireAuth } from "@/lib/auth/helpers";
import { getUserProfileWithPreferences } from "@/lib/queries/preferences";
import { redirect } from "next/navigation";
import { ContentSection } from "@/components/content-section";
import { NotificationsForm } from "../components/notifications-form";

export default async function NotificacionesPage() {
  const user = await requireAuth();

  const data = await getUserProfileWithPreferences(user.id);

  if (!data || !data.preferences) {
    redirect("/panel");
  }

  return (
    <ContentSection
      title="Notificaciones"
      desc="Configura cómo y cuándo quieres recibir notificaciones."
    >
      <NotificationsForm
        preferences={data.preferences}
        microsoftConnected={data.microsoftStatus?.connected ?? false}
      />
    </ContentSection>
  );
}
