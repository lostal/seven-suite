"use client";

/**
 * AdminSpotsContent
 *
 * Componente cliente que gestiona las pestañas Parking/Oficinas en el panel
 * de administración. Al cambiar de pestaña, sincroniza el `activeResourceType`
 * del SpotsProvider para que "Nueva plaza" se pre-rellene correctamente.
 */

import { ParkingCircle, Building2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SpotsTable } from "./spots-table";
import { SpotsPrimaryButtons } from "./spots-primary-buttons";
import { useSpots } from "./spots-provider";
import type { Profile, Spot } from "@/lib/db/types";

interface AdminSpotsContentProps {
  parkingSpots: Spot[];
  officeSpots: Spot[];
  profiles: Profile[];
}

export function AdminSpotsContent({
  parkingSpots,
  officeSpots,
  profiles,
}: AdminSpotsContentProps) {
  const { setActiveResourceType } = useSpots();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Plazas</h2>
          <p className="text-muted-foreground text-sm">
            Gestiona las plazas de parking y puestos de oficina.
          </p>
        </div>
        <SpotsPrimaryButtons />
      </div>
      <Tabs
        defaultValue="parking"
        className="flex flex-1 flex-col"
        onValueChange={(v) => setActiveResourceType(v as "parking" | "office")}
      >
        <TabsList className="w-fit">
          <TabsTrigger value="parking" className="gap-1.5">
            <ParkingCircle className="size-4" />
            Parking
            <span className="text-muted-foreground text-xs">
              ({parkingSpots.length})
            </span>
          </TabsTrigger>
          <TabsTrigger value="office" className="gap-1.5">
            <Building2 className="size-4" />
            Oficinas
            <span className="text-muted-foreground text-xs">
              ({officeSpots.length})
            </span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="parking" className="flex flex-1 flex-col">
          <SpotsTable spots={parkingSpots} profiles={profiles} />
        </TabsContent>
        <TabsContent value="office" className="flex flex-1 flex-col">
          <SpotsTable spots={officeSpots} profiles={profiles} />
        </TabsContent>
      </Tabs>
    </>
  );
}
