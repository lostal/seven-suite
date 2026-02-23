"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Building2, ConciergeBell, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/data-table";
import type { Profile, Spot } from "@/lib/supabase/types";
import { SpotRowActions } from "./spot-row-actions";

// ─── Type configuration ────────────────────────────────────────────────────────

export const spotTypeOptions = [
  { label: "Dirección", value: "management", icon: Building2 },
  { label: "Visitas", value: "visitor", icon: ConciergeBell },
] as const;

const typeColors: Record<string, string> = {
  management:
    "bg-blue-100/30 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700",
  visitor:
    "bg-green-100/30 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700",
};

// ─── Column factory ────────────────────────────────────────────────────────────

export function buildSpotsColumns(profiles: Profile[]): ColumnDef<Spot>[] {
  return [
    {
      accessorKey: "label",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Etiqueta" />
      ),
      cell: ({ row }) => (
        <span className="font-mono font-semibold">{row.getValue("label")}</span>
      ),
      meta: { className: "w-28" },
    },
    {
      accessorKey: "type",
      header: "Tipo",
      cell: ({ row }) => {
        const type = row.getValue<string>("type");
        const config = spotTypeOptions.find((o) => o.value === type);
        return (
          <div className="flex items-center gap-x-2">
            {config?.icon && (
              <config.icon
                size={15}
                className="text-muted-foreground shrink-0"
              />
            )}
            <Badge
              variant="outline"
              className={cn("capitalize", typeColors[type] ?? "")}
            >
              {config?.label ?? type}
            </Badge>
          </div>
        );
      },
      filterFn: (row, _id, value: string[]) =>
        value.length === 0 || value.includes(row.getValue("type")),
      enableSorting: false,
    },
    {
      id: "assigned_to",
      header: "Asignada a",
      cell: ({ row }) => {
        const userId = row.original.assigned_to;
        if (!userId) {
          return (
            <span className="text-muted-foreground text-sm italic">
              Sin asignar
            </span>
          );
        }
        const profile = profiles.find((p) => p.id === userId);
        return (
          <span className="text-sm">
            {profile?.full_name || profile?.email || userId}
          </span>
        );
      },
      enableSorting: false,
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
      filterFn: (row, _id, value: string[]) => {
        if (value.length === 0) return true;
        const active = row.getValue<boolean>("is_active");
        return value.includes(active ? "active" : "inactive");
      },
      enableSorting: false,
    },
    {
      id: "actions",
      cell: ({ row }) => <SpotRowActions row={row} />,
      enableHiding: false,
    },
  ];
}
