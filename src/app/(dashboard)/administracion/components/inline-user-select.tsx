"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Profile, Spot } from "@/lib/db/types";
import { assignUserToSpot } from "../actions";

const USER_NONE = "__none__";

interface InlineUserSelectProps {
  spotId: string;
  spotResourceType: "parking" | "office";
  currentUserId: string | null;
  profiles: Profile[];
  allSpots: Spot[];
}

export function InlineUserSelect({
  spotId,
  spotResourceType,
  currentUserId,
  profiles,
  allSpots,
}: InlineUserSelectProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Only employee profiles can be assigned spots
  const employeeProfiles = profiles.filter((p) => p.role === "employee");

  // Users already assigned to a different spot of the same resource_type
  const takenUserIds = new Set(
    allSpots
      .filter((s) => s.id !== spotId && s.assignedTo)
      .map((s) => s.assignedTo as string)
  );

  // Show: current user (always) + unassigned employees
  const available = employeeProfiles.filter(
    (p) => p.id === currentUserId || !takenUserIds.has(p.id)
  );

  return (
    <Select
      value={currentUserId ?? USER_NONE}
      disabled={pending}
      onValueChange={(value) => {
        const userId = value === USER_NONE ? null : value;
        startTransition(async () => {
          const result = await assignUserToSpot({
            spot_id: spotId,
            user_id: userId,
            resource_type: spotResourceType,
          });
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          toast.success(userId ? "Usuario asignado" : "Plaza desasignada");
          router.refresh();
        });
      }}
    >
      <SelectTrigger className="h-8 w-40">
        <SelectValue placeholder="Sin asignar" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={USER_NONE}>Sin asignar</SelectItem>
        {available.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.fullName || p.email || p.id}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
