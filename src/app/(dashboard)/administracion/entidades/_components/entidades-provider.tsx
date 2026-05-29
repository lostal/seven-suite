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
import type { Entidad } from "./entidades-schema";

export type EntidadesDialogType = "add" | "edit" | "delete" | "modules";

type EntidadesContextType = {
  open: EntidadesDialogType | null;
  setOpen: (type: EntidadesDialogType | null) => void;
  currentRow: Entidad | null;
  setCurrentRow: Dispatch<SetStateAction<Entidad | null>>;
};

const EntidadesContext = createContext<EntidadesContextType | null>(null);

export function EntidadesProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useDialogState<EntidadesDialogType>(null);
  const [currentRow, setCurrentRow] = useState<Entidad | null>(null);

  return (
    <EntidadesContext
      value={{
        open,
        setOpen,
        currentRow,
        setCurrentRow,
      }}
    >
      {children}
    </EntidadesContext>
  );
}

export function useEntidades() {
  const ctx = useContext(EntidadesContext);
  if (!ctx)
    throw new Error("useEntidades must be used within <EntidadesProvider>");
  return ctx;
}
