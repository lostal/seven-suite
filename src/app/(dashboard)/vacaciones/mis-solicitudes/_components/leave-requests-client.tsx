"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LeaveRequestWithDetails } from "@/lib/queries/leave-requests";
import { getMyLeaveRequests } from "../../actions";
import {
  LeaveRequestsProvider,
  useLeaveRequests,
} from "./leave-requests-provider";
import { LeaveRequestsTable } from "./leave-requests-table";
import { LeaveRequestsDialogs } from "./leave-requests-dialogs";

interface LeaveRequestsClientProps {
  initialData: LeaveRequestWithDetails[];
  currentUserId: string;
}

function NewRequestButton() {
  const { setOpen } = useLeaveRequests();
  return (
    <Button size="sm" onClick={() => setOpen("create")}>
      <Plus className="mr-2 h-4 w-4" />
      Nueva solicitud
    </Button>
  );
}

export function LeaveRequestsClient({
  initialData,
  currentUserId,
}: LeaveRequestsClientProps) {
  const [data, setData] =
    React.useState<LeaveRequestWithDetails[]>(initialData);
  const [isLoading, setIsLoading] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getMyLeaveRequests();
      if (result.success) {
        setData(result.data);
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      console.error("Error loading my leave requests:", error);
      toast.error("Error al cargar las solicitudes");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <LeaveRequestsProvider onRefresh={fetchData} currentUserId={currentUserId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {data.length === 0
            ? "No tienes solicitudes registradas"
            : `${data.length} solicitud${data.length !== 1 ? "es" : ""}`}
        </p>
        <NewRequestButton />
      </div>

      <LeaveRequestsTable data={data} isLoading={isLoading} />
      <LeaveRequestsDialogs />
    </LeaveRequestsProvider>
  );
}
