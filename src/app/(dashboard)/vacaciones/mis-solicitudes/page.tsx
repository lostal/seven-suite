import { requireAuth } from "@/lib/auth/helpers";
import { requireModuleEnabled } from "@/lib/module-guard";
import { getEffectiveEntityId } from "@/lib/queries/active-entity";
import { getUserLeaveRequests } from "@/lib/queries/leave-requests";
import { LeaveRequestsClient } from "./_components/leave-requests-client";

export const metadata = { title: "Mis solicitudes - Vacaciones" };

export default async function MisSolicitudesPage() {
  const user = await requireAuth();
  const entityId = await getEffectiveEntityId();
  await requireModuleEnabled("vacaciones", entityId);
  const requests = await getUserLeaveRequests(user.id);

  return <LeaveRequestsClient initialData={requests} currentUserId={user.id} />;
}
