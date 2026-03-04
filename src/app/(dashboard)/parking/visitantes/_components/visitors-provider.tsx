/**
 * Visitors Provider
 *
 * Contexto React para la sección de visitantes.
 * Gestiona el estado de los diálogos/drawers y la fila actualmente seleccionada.
 */

"use client";

import * as React from "react";
import useDialogState from "@/hooks/use-dialog-state";
import type { VisitorReservationWithDetails } from "@/lib/queries/visitor-reservations";

type VisitantesDialogType = "create" | "edit" | "cancel";

interface VisitantesContextType {
  open: VisitantesDialogType | null;
  setOpen: (str: VisitantesDialogType | null) => void;
  currentRow: VisitorReservationWithDetails | null;
  setCurrentRow: React.Dispatch<
    React.SetStateAction<VisitorReservationWithDetails | null>
  >;
  /** Callback para refrescar los datos de la tabla tras una mutación */
  onRefresh: () => void;
  /** ID del usuario actual para saber si puede cancelar una reserva */
  currentUserId: string;
  /** Rol del usuario actual */
  currentUserRole: string;
}

const VisitantesContext = React.createContext<VisitantesContextType | null>(
  null
);

interface VisitantesProviderProps {
  children: React.ReactNode;
  onRefresh: () => void;
  currentUserId: string;
  currentUserRole: string;
}

export function VisitantesProvider({
  children,
  onRefresh,
  currentUserId,
  currentUserRole,
}: VisitantesProviderProps) {
  const [open, setOpen] = useDialogState<VisitantesDialogType>(null);
  const [currentRow, setCurrentRow] =
    React.useState<VisitorReservationWithDetails | null>(null);

  return (
    <VisitantesContext
      value={{
        open,
        setOpen,
        currentRow,
        setCurrentRow,
        onRefresh,
        currentUserId,
        currentUserRole,
      }}
    >
      {children}
    </VisitantesContext>
  );
}

export function useVisitantes() {
  const ctx = React.useContext(VisitantesContext);
  if (!ctx) {
    throw new Error("useVisitantes debe usarse dentro de <VisitantesProvider>");
  }
  return ctx;
}
