/**
 * Visitors Dialogs
 *
 * Orquestador de todos los diálogos/drawers de la sección de visitantes.
 * Patrón idéntico al de shadcn-admin (tasks-dialogs / users-dialogs).
 */

"use client";

import { VisitorsMutateDrawer } from "./visitors-mutate-drawer";
import { VisitorsDeleteDialog } from "./visitors-delete-dialog";
import { useVisitantes } from "./visitors-provider";

export function VisitantesDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useVisitantes();

  return (
    <>
      {/* Drawer de creación */}
      <VisitorsMutateDrawer
        key="visitor-create"
        open={open === "create"}
        onOpenChange={() => setOpen("create")}
      />

      {/* Drawer de edición */}
      {currentRow && (
        <VisitorsMutateDrawer
          key={`visitor-edit-${currentRow.id}`}
          open={open === "edit"}
          onOpenChange={() => {
            setOpen("edit");
            setTimeout(() => setCurrentRow(null), 500);
          }}
          currentRow={currentRow}
        />
      )}

      {/* Diálogo de cancelación */}
      {currentRow && (
        <VisitorsDeleteDialog
          key={`visitor-cancel-${currentRow.id}`}
          open={open === "cancel"}
          onOpenChange={() => {
            setOpen("cancel");
            setTimeout(() => setCurrentRow(null), 500);
          }}
          currentRow={currentRow}
        />
      )}
    </>
  );
}
