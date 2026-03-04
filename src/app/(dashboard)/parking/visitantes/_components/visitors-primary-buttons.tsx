/**
 * Visitors Primary Buttons
 *
 * Botones de acción principal de la sección de visitantes.
 * Se muestran en la cabecera de la página, a la derecha del título.
 */

"use client";

import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVisitantes } from "./visitors-provider";

export function VisitantesPrimaryButtons() {
  const { setOpen } = useVisitantes();

  return (
    <Button className="space-x-1" onClick={() => setOpen("create")}>
      <span>Nueva visita</span>
      <UserPlus size={18} />
    </Button>
  );
}
