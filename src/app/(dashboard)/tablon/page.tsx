import { requireAuth } from "@/lib/auth/helpers";
import { requireModuleEnabled } from "@/lib/module-guard";
import { getEffectiveEntityId } from "@/lib/queries/active-entity";
import {
  getPublishedAnnouncements,
  getUnreadAnnouncementIds,
} from "@/lib/queries/announcements";
import { AnnouncementsFeed } from "./_components/announcements-feed";

export default async function TablonPage() {
  const user = await requireAuth();
  const entityId = await getEffectiveEntityId();
  await requireModuleEnabled("tablon", entityId);

  const [announcements, unreadIds] = await Promise.all([
    getPublishedAnnouncements(entityId),
    getUnreadAnnouncementIds(user.id, entityId),
  ]);

  const announcementsWithRead = announcements.map((a) => ({
    ...a,
    isRead: !unreadIds.has(a.id),
  }));

  return <AnnouncementsFeed announcements={announcementsWithRead} />;
}
