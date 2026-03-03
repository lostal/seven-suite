/**
 * Admin Settings — Configuración de Oficinas
 */

export const dynamic = "force-dynamic";

import { getAllResourceConfigs } from "@/lib/config";
import { ContentSection } from "@/components/content-section";
import { ResourceConfigForm } from "../_components/resource-config-form";
import { updateOfficeConfig } from "../actions";

export default async function AdminSettingsOfficesPage() {
  const config = await getAllResourceConfigs("office");

  return (
    <ContentSection
      title="Configuración de Oficinas"
      desc="Reglas de disponibilidad, franjas horarias, límites de reserva y cesiones para los puestos de oficina."
    >
      <ResourceConfigForm
        config={config}
        onSave={updateOfficeConfig}
        showTimeSlots={true}
      />
    </ContentSection>
  );
}
