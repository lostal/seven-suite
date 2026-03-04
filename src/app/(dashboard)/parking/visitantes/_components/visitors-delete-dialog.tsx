/**
 * Visitors Delete Dialog
 *
 * Diálogo de confirmación para cancelar una reserva de visitante.
 */

"use client";

import * as React from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { VisitorReservationWithDetails } from "@/lib/queries/visitor-reservations";

import { cancelVisitorReservation } from "../actions";
import { useVisitantes } from "./visitors-provider";

interface VisitorsDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRow: VisitorReservationWithDetails;
}

export function VisitorsDeleteDialog({
  open,
  onOpenChange,
  currentRow,
}: VisitorsDeleteDialogProps) {
  const { onRefresh, setCurrentRow } = useVisitantes();
  const [isLoading, setIsLoading] = React.useState(false);

  const formattedDate = format(
    new Date(currentRow.date + "T00:00:00"),
    "d 'de' MMMM 'de' yyyy",
    { locale: es }
  );

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      const result = await cancelVisitorReservation({ id: currentRow.id });

      if (result.success) {
        toast.success("Reserva cancelada correctamente");
        onOpenChange(false);
        setTimeout(() => setCurrentRow(null), 500);
        onRefresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Error al cancelar la reserva");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ConfirmDialog
      destructive
      open={open}
      onOpenChange={onOpenChange}
      handleConfirm={handleConfirm}
      isLoading={isLoading}
      className="max-w-md"
      title="¿Cancelar esta reserva?"
      desc={
        <>
          Vas a cancelar la reserva de{" "}
          <strong>{currentRow.visitor_name}</strong> (
          {currentRow.visitor_company}) para el{" "}
          <strong>
            {currentRow.spot_label} — {formattedDate}
          </strong>
          .<br />
          Esta acción no se puede deshacer.
        </>
      }
      confirmText="Cancelar reserva"
      cancelBtnText="Volver"
    />
  );
}
