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
      const { ccaaCount, totalHolidays, errors } = result.data;
      if (errors.length > 0) {
        const ccaaErrors = errors.map((e) => e.ccaa).join(", ");
        toast.warning(
          `Sincronizadas ${ccaaCount} CCAA, ${totalHolidays} festivos. Errores: ${ccaaErrors}`
        );
        setLastResult(
          `${ccaaCount} CCAA OK, ${totalHolidays} festivos. ${errors.length} error(es): ${ccaaErrors}`
        );
      } else {
        toast.success(
          `${ccaaCount} CCAA sincronizadas, ${totalHolidays} festivos importados`
        );
        setLastResult(`${ccaaCount} CCAA, ${totalHolidays} festivos`);
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-sm">
        Descarga los festivos nacionales y autonómicos para el año actual y el
        siguiente. Se agrupan por comunidad autónoma (sin duplicar llamadas).
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
