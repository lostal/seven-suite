"use client";

import { type ColumnDef } from "@tanstack/react-table";
import {
  CheckCircle2,
  XCircle,
  Pencil,
  LayoutGrid,
  Trash2,
  Map,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/data-table";
import type { Entidad } from "./entidades-schema";
import { useEntidades } from "./entidades-provider";
import { AUTONOMOUS_COMMUNITIES } from "@/lib/constants";

// ─── Row Actions ──────────────────────────────────────────────

function EntidadRowActions({ entidad }: { entidad: Entidad }) {
  const { setOpen, setCurrentRow, canManageEntities } = useEntidades();

  return (
    <div className="flex items-center gap-2">
      {canManageEntities && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => {
            setCurrentRow(entidad);
            setOpen("edit");
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5"
        onClick={() => {
          setCurrentRow(entidad);
          setOpen("maps");
        }}
      >
        <Map className="h-3.5 w-3.5" />
        Planos
      </Button>
      {canManageEntities && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => {
              setCurrentRow(entidad);
              setOpen("modules");
            }}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Módulos
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive h-8 gap-1.5"
            onClick={() => {
              setCurrentRow(entidad);
              setOpen("delete");
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </Button>
        </>
      )}
    </div>
  );
}

// ─── Column definitions ──────────────────────────────────────

export const entidadesColumns: ColumnDef<Entidad>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nombre" />
    ),
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: "autonomous_community",
    header: "CCAA",
    cell: ({ row }) => {
      const code = row.getValue<string | null>("autonomous_community");
      if (!code)
        return <span className="text-muted-foreground text-sm">—</span>;
      const cc = AUTONOMOUS_COMMUNITIES.find((c) => c.code === code);
      return <span className="text-sm">{cc?.name ?? code}</span>;
    },
    meta: { className: "hidden @lg/content:table-cell" },
  },
  {
    accessorKey: "is_active",
    header: "Estado",
    cell: ({ row }) => {
      const active = row.getValue<boolean>("is_active");
      return active ? (
        <div className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 size={14} />
          Activa
        </div>
      ) : (
        <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <XCircle size={14} />
          Inactiva
        </div>
      );
    },
    // Convertir booleano a string para que el filtro de DataTableToolbar funcione
    filterFn: (row, columnId, filterValues: string[]) => {
      const val = row.getValue<boolean>(columnId).toString();
      return filterValues.includes(val);
    },
    enableSorting: false,
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Creada" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue<string>("created_at"));
      return (
        <span className="text-muted-foreground text-sm">
          {date.toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
      );
    },
    meta: { className: "hidden @lg/content:table-cell" },
  },
  {
    id: "actions",
    cell: ({ row }) => <EntidadRowActions entidad={row.original} />,
    enableHiding: false,
  },
];

// Badge helper used in table header
export { Badge };
