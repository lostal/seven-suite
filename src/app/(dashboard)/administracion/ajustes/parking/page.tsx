/**
 * Admin Settings — Configuración de Parking
 */

export const dynamic = "force-dynamic";

import { getAllResourceConfigs } from "@/lib/config";
import { ContentSection } from "@/components/content-section";
import { ResourceConfigForm } from "../_components/resource-config-form";
import { updateParkingConfig } from "../actions";

export default async function AdminSettingsParkingPage() {
  const config = await getAllResourceConfigs("parking");

  return (
    <ContentSection
      title="Configuración de Parking"
      desc="Reglas de disponibilidad, límites de reserva y cesiones para las plazas de aparcamiento."
    >
      <ResourceConfigForm
        config={config}
        onSave={updateParkingConfig}
        showTimeSlots={false}
      />
    </ContentSection>
  );
}
