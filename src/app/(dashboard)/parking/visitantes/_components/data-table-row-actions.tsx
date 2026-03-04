/**
 * Data Table Row Actions
 *
 * Menú desplegable de acciones por fila en la tabla de visitantes.
 * Permite editar o cancelar la reserva (solo el creador o admin).
 */

"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { type Row } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { VisitorReservationWithDetails } from "@/lib/queries/visitor-reservations";

import { useVisitantes } from "./visitors-provider";

interface DataTableRowActionsProps {
  row: Row<VisitorReservationWithDetails>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const { setOpen, setCurrentRow, currentUserId, currentUserRole } =
    useVisitantes();

  const reservation = row.original;
  const canManage =
    reservation.reserved_by === currentUserId || currentUserRole === "admin";

  if (!canManage) {
    return (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="data-[state=open]:bg-muted flex h-8 w-8 p-0"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Abrir menú</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[160px]">
          <DropdownMenuItem disabled className="text-muted-foreground text-xs">
            Sin acciones disponibles
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="data-[state=open]:bg-muted flex h-8 w-8 p-0"
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Abrir menú</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px]">
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(reservation);
            setOpen("edit");
          }}
        >
          Editar reserva
          <Pencil size={14} className="ml-auto" />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => {
            setCurrentRow(reservation);
            setOpen("cancel");
          }}
        >
          Cancelar reserva
          <Trash2 size={16} className="text-destructive ml-auto" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
