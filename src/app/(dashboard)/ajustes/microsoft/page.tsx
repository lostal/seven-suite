/**
 * Settings - Microsoft 365 Page
 *
 * Microsoft 365 integration and Outlook sync settings.
 */

import { requireAuth } from "@/lib/auth/helpers";
import { getUserProfileWithPreferences } from "@/lib/queries/preferences";
import { redirect } from "next/navigation";
import { MicrosoftConnectionCard } from "../components/microsoft-connection-card";
import { OutlookSyncForm } from "../components/outlook-sync-form";
import { ManagementCessionRules } from "../components/management-cession-rules";
import { ContentSection } from "@/components/content-section";

export default async function SettingsMicrosoftPage() {
  const user = await requireAuth();

  // Fetch user profile with preferences
  const data = await getUserProfileWithPreferences(user.id);

  if (!data || !data.profile || !data.preferences) {
    redirect("/panel");
  }

  const { profile, preferences, microsoftStatus, assignedSpots } = data;
  const preferencesCompat = {
    ...preferences,
    outlook_create_events: preferences.outlookCreateEvents,
    outlook_calendar_name: preferences.outlookCalendarName,
    outlook_sync_enabled: preferences.outlookSyncEnabled,
    outlook_sync_interval: preferences.outlookSyncInterval,
    auto_cede_on_ooo: preferences.autoCedeOnOoo,
    auto_cede_notify: preferences.autoCedeNotify,
    auto_cede_days: preferences.autoCedeDays,
  };

  return (
    <ContentSection
      title="Integración con Microsoft 365"
      desc="Conecta tu cuenta de Microsoft 365 y sincroniza tu calendario de Outlook."
    >
      <div className="space-y-6">
        <MicrosoftConnectionCard status={microsoftStatus} />
        <OutlookSyncForm
          preferences={preferencesCompat}
          microsoftConnected={microsoftStatus?.connected || false}
          lastSync={microsoftStatus?.lastSync || null}
        />
        {profile.role === "admin" && (
          <ManagementCessionRules
            preferences={preferencesCompat}
            spotInfo={assignedSpots.parking}
            microsoftConnected={microsoftStatus?.connected || false}
          />
        )}
      </div>
    </ContentSection>
  );
}
