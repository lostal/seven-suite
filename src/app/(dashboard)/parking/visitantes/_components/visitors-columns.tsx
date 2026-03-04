/**
 * Visitors Columns
 *
 * Definición de columnas para la tabla de reservas de visitantes.
 */

"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/data-table";
import type { VisitorReservationWithDetails } from "@/lib/queries/visitor-reservations";

import { DataTableRowActions } from "./data-table-row-actions";

export const visitantesColumns: ColumnDef<VisitorReservationWithDetails>[] = [
  {
    accessorKey: "date",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Fecha" />
    ),
    meta: {},
    cell: ({ row }) => {
      const dateStr = row.getValue<string>("date");
      return (
        <span className="font-medium whitespace-nowrap">
          {format(new Date(dateStr + "T00:00:00"), "EEE d MMM yyyy", {
            locale: es,
          })}
        </span>
      );
    },
    sortingFn: "alphanumeric",
  },
  {
    accessorKey: "spot_label",
    header: "Plaza",
    cell: ({ row }) => (
      <Badge variant="outline" className="font-mono font-semibold">
        {row.getValue("spot_label")}
      </Badge>
    ),
  },
  {
    accessorKey: "visitor_name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Visitante" />
    ),
    meta: {},
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("visitor_name")}</span>
    ),
  },
  {
    accessorKey: "visitor_company",
    header: "Empresa",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.getValue("visitor_company")}
      </span>
    ),
    meta: { className: "hidden @lg/content:table-cell" },
  },
  {
    accessorKey: "visitor_email",
    header: "Email",
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {row.getValue("visitor_email")}
      </span>
    ),
    meta: { className: "hidden @xl/content:table-cell" },
  },
  {
    accessorKey: "reserved_by_name",
    header: "Reservado por",
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {row.getValue("reserved_by_name")}
      </span>
    ),
    meta: { className: "hidden @xl/content:table-cell" },
  },
  {
    accessorKey: "notification_sent",
    header: "Email",
    cell: ({ row }) => {
      const sent = row.getValue<boolean>("notification_sent");
      return sent ? (
        <span className="flex items-center gap-1 text-xs text-emerald-600">
          <CheckCircle2 size={14} />
          Enviado
        </span>
      ) : (
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          <Clock size={14} />
          Pendiente
        </span>
      );
    },
    enableSorting: false,
    meta: { className: "hidden @lg/content:table-cell" },
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
];
