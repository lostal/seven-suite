/**
 * Settings - Preferences Page
 *
 * App preferences: theme and parking view settings.
 */

import { requireAuth } from "@/lib/auth/helpers";
import { getUserProfileWithPreferences } from "@/lib/queries/preferences";
import { redirect } from "next/navigation";
import { PreferencesForm } from "../components/preferences-form";
import { ContentSection } from "@/components/content-section";

export default async function SettingsPreferencesPage() {
  const user = await requireAuth();

  // Fetch user profile with preferences
  const data = await getUserProfileWithPreferences(user.id);

  if (!data || !data.preferences) {
    redirect("/panel");
  }

  const { preferences } = data;

  return (
    <ContentSection
      title="Preferencias"
      desc="Personaliza la apariencia y comportamiento de la aplicación."
    >
      <PreferencesForm preferences={preferences} />
    </ContentSection>
  );
}
