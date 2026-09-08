"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEntidades } from "./entidades-provider";

export function EntidadesPrimaryButtons() {
  const { setOpen, canManageEntities } = useEntidades();

  if (!canManageEntities) return null;

  return (
    <Button size="sm" className="h-8 gap-1.5" onClick={() => setOpen("add")}>
      <Plus className="h-4 w-4" />
      Nueva sede
    </Button>
  );
}
