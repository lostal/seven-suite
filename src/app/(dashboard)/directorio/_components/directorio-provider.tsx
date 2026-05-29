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
import { type DirectorioUser } from "./directorio-schema";
import type { Entity } from "@/lib/db/types";

type DirectorioDialogType = "add" | "edit" | "delete";

type DirectorioContextType = {
  open: DirectorioDialogType | null;
  setOpen: (str: DirectorioDialogType | null) => void;
  currentRow: DirectorioUser | null;
  setCurrentRow: Dispatch<SetStateAction<DirectorioUser | null>>;
  isAdmin: boolean;
  entities: Entity[];
};

const DirectorioContext = createContext<DirectorioContextType | null>(null);

export function DirectorioProvider({
  children,
  isAdmin,
  entities,
}: {
  children: ReactNode;
  isAdmin: boolean;
  entities: Entity[];
}) {
  const [open, setOpen] = useDialogState<DirectorioDialogType>(null);
  const [currentRow, setCurrentRow] = useState<DirectorioUser | null>(null);

  return (
    <DirectorioContext
      value={{ open, setOpen, currentRow, setCurrentRow, isAdmin, entities }}
    >
      {children}
    </DirectorioContext>
  );
}

export function useDirectorio() {
  const ctx = useContext(DirectorioContext);
  if (!ctx)
    throw new Error("useDirectorio must be used within DirectorioProvider");
  return ctx;
}
