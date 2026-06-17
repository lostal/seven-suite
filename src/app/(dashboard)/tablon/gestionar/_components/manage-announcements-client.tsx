"use client";

import type { AnnouncementWithAuthor } from "@/lib/queries/announcements";
import { AnnouncementsProvider } from "./announcements-provider";
import { AnnouncementsPrimaryButtons } from "./announcements-primary-buttons";
import { AnnouncementsTable } from "./announcements-table";
import { AnnouncementsDialogs } from "./announcements-dialogs";

interface ManageAnnouncementsClientProps {
  announcements: AnnouncementWithAuthor[];
  currentUserId: string;
  currentUserRole: string;
}

export function ManageAnnouncementsClient({
  announcements,
  currentUserId,
  currentUserRole,
}: ManageAnnouncementsClientProps) {
  return (
    <AnnouncementsProvider>
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {announcements.length} comunicado
          {announcements.length !== 1 ? "s" : ""}
        </p>
        <AnnouncementsPrimaryButtons />
      </div>
      <AnnouncementsTable
        announcements={announcements}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
      />
      <AnnouncementsDialogs currentUserRole={currentUserRole} />
    </AnnouncementsProvider>
  );
}
