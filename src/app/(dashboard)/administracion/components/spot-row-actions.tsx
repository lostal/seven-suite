"use client";

import { type Row } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Spot } from "@/lib/db/types";
import { useSpots } from "./spots-provider";

interface SpotRowActionsProps {
  row: Row<Spot>;
}

export function SpotRowActions({ row }: SpotRowActionsProps) {
  const { setOpen, setCurrentRow } = useSpots();

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5"
        onClick={() => {
          setCurrentRow(row.original);
          setOpen("edit");
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
        Editar
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive h-8 gap-1.5"
        onClick={() => {
          setCurrentRow(row.original);
          setOpen("delete");
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Eliminar
      </Button>
    </div>
  );
}
