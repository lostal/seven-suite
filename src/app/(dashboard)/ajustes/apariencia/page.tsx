/**
 * Apariencia — Personalización visual de la aplicación
 */

import { requireAuth } from "@/lib/auth/helpers";
import { getUserProfileWithPreferences } from "@/lib/queries/preferences";
import { redirect } from "next/navigation";
import { ContentSection } from "@/components/content-section";
import { AppearanceForm } from "./_components/appearance-form";

export default async function AparienciaPage() {
  const user = await requireAuth();

  const data = await getUserProfileWithPreferences(user.id);

  if (!data || !data.preferences) {
    redirect("/panel");
  }

  return (
    <ContentSection
      title="Apariencia"
      desc="Personaliza el aspecto visual de la aplicación."
    >
      <AppearanceForm preferences={data.preferences} />
    </ContentSection>
  );
}
