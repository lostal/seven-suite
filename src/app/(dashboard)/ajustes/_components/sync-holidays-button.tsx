"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { syncHolidaysAction } from "../actions";

export function SyncHolidaysButton() {
  const [pending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleSync = () => {
    startTransition(async () => {
      const result = await syncHolidaysAction();
      if (!result.success) {
        toast.error(result.error ?? "Error al sincronizar festivos");
        return;
      }
      const { synced, errors } = result.data;
      if (errors.length > 0) {
        toast.warning(
          `Sincronizadas ${synced} sedes. Errores: ${errors.length}`
        );
      } else {
        toast.success(`Festivos sincronizados para ${synced} sede(s)`);
      }
      setLastResult(
        errors.length > 0
          ? `${synced} sedes OK, ${errors.length} errores`
          : `${synced} sede(s) sincronizadas`
      );
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-sm">
        Descarga los festivos nacionales y autonómicos para el año actual y el
        siguiente. Requiere que cada sede tenga su comunidad autónoma asignada.
      </p>
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          disabled={pending}
          onClick={handleSync}
          className="w-fit"
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${pending ? "animate-spin" : ""}`}
          />
          Sincronizar festivos
        </Button>
        {lastResult && (
          <span className="text-muted-foreground text-sm">{lastResult}</span>
        )}
      </div>
    </div>
  );
}
