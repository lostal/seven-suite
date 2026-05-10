/**
 * Perfil — Página de configuración personal
 */

import { requireAuth } from "@/lib/auth/helpers";
import { getUserProfileWithPreferences } from "@/lib/queries/preferences";
import { redirect } from "next/navigation";
import { ContentSection } from "@/components/content-section";
import { ProfileForm } from "../components/profile-form";

export default async function PerfilPage() {
  const user = await requireAuth();

  const data = await getUserProfileWithPreferences(user.id);

  if (!data || !data.profile) {
    redirect("/panel");
  }

  return (
    <ContentSection
      title="Perfil"
      desc="Gestiona tu información personal y foto de perfil."
    >
      <ProfileForm profile={data.profile} />
    </ContentSection>
  );
}
