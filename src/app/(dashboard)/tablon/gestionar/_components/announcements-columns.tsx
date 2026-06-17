"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { DataTableColumnHeader } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import type { AnnouncementWithAuthor } from "@/lib/queries/announcements";
import { AnnouncementRowActions } from "./announcement-row-actions";

export type AnnouncementStatus = "draft" | "published" | "expired";

export function getAnnouncementStatus(
  a: AnnouncementWithAuthor
): AnnouncementStatus {
  if (!a.publishedAt) return "draft";
  if (a.expiresAt && a.expiresAt < new Date()) return "expired";
  return "published";
}

export const statusOptions = [
  { label: "Publicado", value: "published" },
  { label: "Borrador", value: "draft" },
  { label: "Expirado", value: "expired" },
] as const;

function StatusBadge({ status }: { status: AnnouncementStatus }) {
  if (status === "published")
    return (
      <Badge className="border-0 bg-green-500/15 text-green-700 dark:text-green-400">
        Publicado
      </Badge>
    );
  if (status === "draft")
    return (
      <Badge className="border-0 bg-yellow-500/15 text-yellow-700 dark:text-yellow-400">
        Borrador
      </Badge>
    );
  return (
    <Badge className="bg-muted text-muted-foreground border-0">Expirado</Badge>
  );
}

export function buildAnnouncementsColumns(
  currentUserId: string,
  currentUserRole: string
): ColumnDef<AnnouncementWithAuthor>[] {
  return [
    {
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Título" />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("title")}</span>
      ),
    },
    {
      id: "scope",
      accessorFn: (row) => (row.entityId === null ? "Global" : "Sede"),
      header: "Alcance",
      cell: ({ row }) => {
        const isGlobal = row.original.entityId === null;
        return isGlobal ? (
          <Badge className="border-0 bg-blue-500/15 text-blue-700 dark:text-blue-400">
            Global
          </Badge>
        ) : (
          <Badge className="bg-muted text-muted-foreground border-0">
            Sede
          </Badge>
        );
      },
      filterFn: (row, id, values: string[]) =>
        values.includes(row.getValue(id)),
    },
    {
      id: "status",
      accessorFn: (row) => getAnnouncementStatus(row),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Estado" />
      ),
      cell: ({ getValue }) => (
        <StatusBadge status={getValue() as AnnouncementStatus} />
      ),
      filterFn: (row, id, values: string[]) =>
        values.includes(row.getValue(id)),
    },
    {
      accessorKey: "authorName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Autor" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {row.getValue("authorName")}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Fecha" />
      ),
      cell: ({ row }) => {
        const date = row.getValue<Date>("createdAt");
        return (
          <span className="text-muted-foreground text-sm">
            {formatDistanceToNow(new Date(date), {
              addSuffix: true,
              locale: es,
            })}
          </span>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <AnnouncementRowActions
          row={row}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
        />
      ),
    },
  ];
}
