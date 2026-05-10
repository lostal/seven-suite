/**
 * Configuración del sistema — Parking
 */

export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/helpers";
import { getAllResourceConfigs } from "@/lib/config";
import { getActiveEntityId } from "@/lib/queries/active-entity";
import { db } from "@/lib/db";
import { entities } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ContentSection } from "@/components/content-section";
import { ResourceConfigForm } from "../_components/resource-config-form";
import { updateParkingConfig, restoreParkingDefaults } from "../actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Globe } from "lucide-react";

export default async function ConfiguracionParkingPage() {
  await requireAdmin();
  const entityId = await getActiveEntityId();

  let entityName: string | null = null;
  if (entityId) {
    const [row] = await db
      .select({ name: entities.name })
      .from(entities)
      .where(eq(entities.id, entityId))
      .limit(1);
    entityName = row?.name ?? null;
  }

  const config = await getAllResourceConfigs("parking", entityId);

  return (
    <ContentSection
      title="Configuración de Parking"
      desc="Reglas de disponibilidad, límites de reserva y cesiones para las plazas de aparcamiento."
    >
      {entityId && entityName ? (
        <Alert className="mb-6">
          <Building2 className="h-4 w-4" />
          <AlertDescription>
            Sede <strong>{entityName}</strong> — los cambios solo afectan a esta
            sede.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="mb-6">
          <Globe className="h-4 w-4" />
          <AlertDescription>
            Configuración global — afecta a todas las sedes sin configuración
            propia.
          </AlertDescription>
        </Alert>
      )}
      <ResourceConfigForm
        key={entityId ?? "global"}
        config={config}
        onSave={updateParkingConfig}
        showTimeSlots={false}
        isEntityOverride={!!entityId}
        onRestoreDefaults={entityId ? restoreParkingDefaults : undefined}
      />
    </ContentSection>
  );
}
