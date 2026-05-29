"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Copy, MoreHorizontal, Trash2, UserPen } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTableColumnHeader } from "@/components/data-table";
import { LongText } from "@/components/long-text";
import { type DirectorioUser } from "./directorio-schema";
import { useDirectorio } from "./directorio-provider";

function CopyableCell({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado al portapapeles`);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "group hover:text-foreground flex cursor-pointer items-center gap-1.5 p-0 text-start transition-colors",
        className
      )}
      title={`Copiar ${label.toLowerCase()}`}
    >
      <span className="truncate">{value}</span>
      <Copy className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" />
    </button>
  );
}

function RowActions({ row }: { row: { original: DirectorioUser } }) {
  const { setOpen, setCurrentRow, isAdmin } = useDirectorio();

  if (!isAdmin) return null;

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
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(row.original);
            setOpen("edit");
          }}
        >
          Editar
          <DropdownMenuShortcut>
            <UserPen size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(row.original);
            setOpen("delete");
          }}
          className="text-red-500!"
        >
          Eliminar
          <DropdownMenuShortcut>
            <Trash2 size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const directorioColumns: ColumnDef<DirectorioUser>[] = [
  {
    accessorKey: "nombre",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nombre" />
    ),
    cell: ({ row }) => (
      <CopyableCell
        value={row.getValue("nombre")}
        label="Nombre"
        className="max-w-48"
      />
    ),
    enableHiding: false,
  },
  {
    accessorKey: "puesto",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Puesto" />
    ),
    cell: ({ row }) => (
      <LongText className="max-w-52">{row.getValue("puesto")}</LongText>
    ),
    meta: { className: "w-52" },
    enableSorting: false,
    enableHiding: false,
  },
  {
    // Hidden column used only for filtering by entity_id (UUID)
    accessorKey: "entity_id",
    header: () => null,
    cell: () => null,
    filterFn: (row, id, value: string[]) => {
      const val = row.getValue(id);
      return (
        Array.isArray(value) && val !== null && value.includes(val as string)
      );
    },
    enableSorting: false,
    enableHiding: true,
  },
  {
    accessorKey: "entity_name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sede" />
    ),
    cell: ({ row }) => (
      <div className="text-sm text-nowrap">{row.getValue("entity_name")}</div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "correo",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Correo" />
    ),
    cell: ({ row }) => (
      <CopyableCell
        value={row.getValue("correo")}
        label="Correo"
        className="text-muted-foreground max-w-56 text-sm"
      />
    ),
    enableSorting: false,
  },
  {
    accessorKey: "telefono",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Teléfono" />
    ),
    cell: ({ row }) => (
      <CopyableCell
        value={row.getValue("telefono")}
        label="Teléfono"
        className="text-muted-foreground text-sm"
      />
    ),
    enableSorting: false,
  },
  {
    id: "actions",
    cell: ({ row }) => <RowActions row={row} />,
  },
];
