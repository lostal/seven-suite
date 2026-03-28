/**
 * Settings - Security Page
 *
 * Security settings and account information.
 */

import { requireAuth } from "@/lib/auth/helpers";
import { getUserProfileWithPreferences } from "@/lib/queries/preferences";
import { redirect } from "next/navigation";
import { SecuritySection } from "../components/security-section";
import { ContentSection } from "@/components/content-section";

export default async function SettingsSecurityPage() {
  const user = await requireAuth();

  // Fetch user profile with preferences
  const data = await getUserProfileWithPreferences(user.id);

  if (!data || !data.profile) {
    redirect("/panel");
  }

  const { profile } = data;

  return (
    <ContentSection
      title="Seguridad"
      desc="Gestiona la seguridad de tu cuenta y visualiza información importante."
    >
      <SecuritySection
        user={{
          email: profile.email,
          created_at: profile.createdAt.toISOString(),
        }}
      />
    </ContentSection>
  );
}
