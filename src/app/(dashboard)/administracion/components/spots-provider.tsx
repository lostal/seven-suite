"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useState,
} from "react";
import useDialogState from "@/hooks/use-dialog-state";
import type { Spot } from "@/lib/db/types";

export type SpotsDialogType = "add" | "edit" | "delete";

type SpotsContextType = {
  open: SpotsDialogType | null;
  setOpen: (type: SpotsDialogType | null) => void;
  currentRow: Spot | null;
  setCurrentRow: Dispatch<SetStateAction<Spot | null>>;
  /** Tipo de recurso activo en la pestaña actual — determina el default en "Nueva plaza" */
  activeResourceType: "parking" | "office";
  setActiveResourceType: (rt: "parking" | "office") => void;
  /** Si true, el selector de recurso no se muestra en los dialogs */
  resourceTypeLocked: boolean;
};

const SpotsContext = createContext<SpotsContextType | null>(null);

export function SpotsProvider({
  children,
  defaultResourceType = "parking",
  resourceTypeLocked = false,
}: {
  children: ReactNode;
  defaultResourceType?: "parking" | "office";
  resourceTypeLocked?: boolean;
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
        resourceTypeLocked,
      }}
    >
      {children}
    </SpotsContext>
  );
}

export function useSpots() {
  const ctx = useContext(SpotsContext);
  if (!ctx) throw new Error("useSpots must be used within <SpotsProvider>");
  return ctx;
}
