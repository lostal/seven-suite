/**
 * Seguridad — Gestión de cuenta y sesiones
 */

import { requireAuth } from "@/lib/auth/helpers";
import { ContentSection } from "@/components/content-section";
import { SecuritySection } from "../components/security-section";

export default async function SeguridadPage() {
  const user = await requireAuth();

  return (
    <ContentSection
      title="Seguridad"
      desc="Gestiona la seguridad de tu cuenta y sesiones activas."
    >
      <SecuritySection
        user={{
          email: user.email ?? "",
          created_at:
            user.profile?.createdAt?.toISOString() ?? new Date().toISOString(),
        }}
      />
    </ContentSection>
  );
}
