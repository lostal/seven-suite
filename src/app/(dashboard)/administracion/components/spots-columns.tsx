"use client";

import { type ColumnDef } from "@tanstack/react-table";
import {
  Building2,
  ConciergeBell,
  CheckCircle2,
  XCircle,
  Pin,
  Car,
  Shuffle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/data-table";
import type { Profile, Spot } from "@/lib/db/types";
import { getSpotTypeLabel } from "@/lib/constants";
import { SpotRowActions } from "./spot-row-actions";
import { InlineUserSelect } from "./inline-user-select";

// ─── Type configuration ────────────────────────────────────────────────────────

export const spotTypeOptions = [
  { label: "Fija", value: "standard", icon: Pin },
  // El label genérico "Visitas / Flexible" cubre ambos módulos en el filtro
  { label: "Visitas / Flexible", value: "visitor", icon: ConciergeBell },
] as const;

export const resourceTypeOptions = [
  { label: "Parking", value: "parking", icon: Car },
  { label: "Oficina", value: "office", icon: Building2 },
] as const;

const typeColors: Record<string, string> = {
  standard:
    "bg-zinc-100/30 dark:bg-zinc-800/30 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-600",
  visitor:
    "bg-green-100/30 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700",
  office_visitor:
    "bg-sky-100/30 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-700",
};

function getSpotTypeIcon(type: string, resourceType: string) {
  if (type === "visitor") {
    return resourceType === "office" ? Shuffle : ConciergeBell;
  }
  return Pin;
}

function getSpotTypeColor(type: string, resourceType: string): string {
  if (type === "visitor" && resourceType === "office")
    return typeColors.office_visitor ?? "";
  return typeColors[type] ?? "";
}

const resourceColors: Record<string, string> = {
  parking:
    "bg-orange-100/30 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700",
  office:
    "bg-purple-100/30 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700",
};

// ─── Column factory ────────────────────────────────────────────────────────────

export function buildSpotsColumns(
  profiles: Profile[],
  allSpots: Spot[]
): ColumnDef<Spot>[] {
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
        const spot = row.original;
        const type = spot.type;
        const resourceType = spot.resourceType as "parking" | "office";
        const label = getSpotTypeLabel(type, resourceType);
        const Icon = getSpotTypeIcon(type, resourceType);
        const colorClass = getSpotTypeColor(type, resourceType);
        return (
          <div className="flex items-center gap-x-2">
            <Icon size={15} className="text-muted-foreground shrink-0" />
            <Badge variant="outline" className={cn(colorClass)}>
              {label}
            </Badge>
          </div>
        );
      },
      filterFn: (row, _id, value: string[]) =>
        value.length === 0 || value.includes(row.getValue("type")),
      enableSorting: false,
    },
    {
      accessorKey: "resourceType",
      header: "Recurso",
      cell: ({ row }) => {
        const rt = row.getValue<string>("resourceType");
        const config = resourceTypeOptions.find((o) => o.value === rt);
        return (
          <Badge
            variant="outline"
            className={cn("capitalize", resourceColors[rt] ?? "")}
          >
            {config?.label ?? rt}
          </Badge>
        );
      },
      filterFn: (row, _id, value: string[]) =>
        value.length === 0 || value.includes(row.getValue("resourceType")),
      enableSorting: false,
      meta: { className: "hidden @md/content:table-cell" },
    },
    {
      id: "assignedTo",
      header: "Asignada a",
      cell: ({ row }) => {
        const spot = row.original;
        if (spot.type === "visitor") {
          return (
            <span className="text-muted-foreground text-sm italic">N/A</span>
          );
        }
        return (
          <InlineUserSelect
            spotId={spot.id}
            spotResourceType={spot.resourceType as "parking" | "office"}
            currentUserId={spot.assignedTo}
            profiles={profiles}
            allSpots={allSpots}
          />
        );
      },
      enableSorting: false,
      meta: { className: "hidden @lg/content:table-cell" },
    },
    {
      accessorKey: "isActive",
      header: "Estado",
      cell: ({ row }) => {
        const active = row.getValue<boolean>("isActive");
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
        const active = row.getValue<boolean>("isActive");
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
