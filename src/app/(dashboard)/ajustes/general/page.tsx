/**
 * Configuración del sistema — General
 */

export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/helpers";
import { getGlobalConfigs } from "@/lib/config";
import { ContentSection } from "@/components/content-section";
import { GlobalConfigForm } from "../_components/global-config-form";
import { SyncHolidaysButton } from "../_components/sync-holidays-button";

export default async function ConfiguracionGeneralPage() {
  await requireAdmin();
  const config = await getGlobalConfigs();

  return (
    <div className="space-y-6">
      <ContentSection
        title="Configuración global"
        desc="Parámetros que afectan a toda la aplicación, independientemente del tipo de recurso."
      >
        <GlobalConfigForm config={config} />
      </ContentSection>

      <ContentSection
        title="Festivos"
        desc="Sincroniza los festivos de cada sede desde OpenHolidays API según su comunidad autónoma."
      >
        <SyncHolidaysButton />
      </ContentSection>
    </div>
  );
}
