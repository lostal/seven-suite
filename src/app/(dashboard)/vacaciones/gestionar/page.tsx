import { requireHROrAbove } from "@/lib/auth/helpers";
import { requireModuleEnabled } from "@/lib/module-guard";
import { getLeaveRequestsByEntity } from "@/lib/queries/leave-requests";
import { getEffectiveEntityId } from "@/lib/queries/active-entity";
import { ManageLeaveClient } from "./_components/manage-leave-client";

export const metadata = { title: "Gestionar vacaciones - Seven Suite" };

export default async function GestionarVacacionesPage() {
  const user = await requireHROrAbove();
  const entityId = await getEffectiveEntityId();
  await requireModuleEnabled("vacaciones", entityId);

  const requests = entityId ? await getLeaveRequestsByEntity(entityId) : [];

  return (
    <ManageLeaveClient
      initialData={requests}
      currentUserId={user.id}
      currentUserRole={user.profile?.role ?? "manager"}
    />
  );
}
