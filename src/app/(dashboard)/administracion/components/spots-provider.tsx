"use client";

import React, { useState } from "react";
import useDialogState from "@/hooks/use-dialog-state";
import type { Spot } from "@/lib/db/types";

export type SpotsDialogType = "add" | "edit" | "delete";

type SpotsContextType = {
  open: SpotsDialogType | null;
  setOpen: (type: SpotsDialogType | null) => void;
  currentRow: Spot | null;
  setCurrentRow: React.Dispatch<React.SetStateAction<Spot | null>>;
  /** Tipo de recurso activo en la pestaña actual — determina el default en "Nueva plaza" */
  activeResourceType: "parking" | "office";
  setActiveResourceType: (rt: "parking" | "office") => void;
};

const SpotsContext = React.createContext<SpotsContextType | null>(null);

export function SpotsProvider({
  children,
  defaultResourceType = "parking",
}: {
  children: React.ReactNode;
  defaultResourceType?: "parking" | "office";
}) {
  const [open, setOpen] = useDialogState<SpotsDialogType>(null);
  const [currentRow, setCurrentRow] = useState<Spot | null>(null);
  const [activeResourceType, setActiveResourceType] = useState<
    "parking" | "office"
  >(defaultResourceType);

  return (
    <SpotsContext
      value={{
        open,
        setOpen,
        currentRow,
        setCurrentRow,
        activeResourceType,
        setActiveResourceType,
      }}
    >
      {children}
    </SpotsContext>
  );
}

export function useSpots() {
  const ctx = React.useContext(SpotsContext);
  if (!ctx) throw new Error("useSpots must be used within <SpotsProvider>");
  return ctx;
}
