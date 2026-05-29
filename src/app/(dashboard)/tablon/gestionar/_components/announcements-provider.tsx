"use client";

import { createContext, useContext, useState } from "react";
import useDialogState from "@/hooks/use-dialog-state";
import type { AnnouncementWithAuthor } from "@/lib/queries/announcements";

type DialogType = "create" | "edit" | "delete";

type AnnouncementsContextType = {
  open: DialogType | null;
  setOpen: (type: DialogType | null) => void;
  currentRow: AnnouncementWithAuthor | null;
  setCurrentRow: React.Dispatch<
    React.SetStateAction<AnnouncementWithAuthor | null>
  >;
};

const AnnouncementsContext = createContext<AnnouncementsContextType | null>(
  null
);

export function AnnouncementsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useDialogState<DialogType>(null);
  const [currentRow, setCurrentRow] = useState<AnnouncementWithAuthor | null>(
    null
  );

  return (
    <AnnouncementsContext value={{ open, setOpen, currentRow, setCurrentRow }}>
      {children}
    </AnnouncementsContext>
  );
}

export function useAnnouncements() {
  const ctx = useContext(AnnouncementsContext);
  if (!ctx)
    throw new Error(
      "useAnnouncements must be used within AnnouncementsProvider"
    );
  return ctx;
}
