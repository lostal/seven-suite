/**
 * Office Calendar View
 *
 * Thin wrapper sobre ResourceCalendarView que inyecta
 * la server action de oficinas y los sheets específicos.
 */

"use client";

import { getOfficeCalendarMonthData } from "../calendar-actions";
import { ResourceCalendarView } from "@/components/booking/resource-calendar-view";
import { OfficeDaySheet } from "./office-day-sheet";
import { OfficeCessionSheet } from "./office-cession-sheet";

// ─── Props ────────────────────────────────────────────────────

interface OfficeCalendarViewProps {
  hasAssignedSpot: boolean;
  assignedSpot?: { id: string; label: string } | null;
  mapMimeType: string | null;
  mapUrl: string | null;
}

// ─── Componente ──────────────────────────────────────────────

export function OfficeCalendarView({
  hasAssignedSpot,
  assignedSpot,
  mapMimeType,
  mapUrl,
}: OfficeCalendarViewProps) {
  return (
    <ResourceCalendarView
      hasAssignedSpot={hasAssignedSpot}
      assignedSpot={assignedSpot ?? null}
      loadMonthData={getOfficeCalendarMonthData}
      showAvailableCount
      resourceLabel="puesto de oficina"
      renderBookingSheet={({ date, data, onClose, onSuccess }) => (
        <OfficeDaySheet
          date={date}
          myReservationId={data?.myReservationId}
          myReservationSpotLabel={data?.myReservationSpotLabel}
          availableCount={data?.availableCount}
          onClose={onClose}
          onActionSuccess={onSuccess}
          mapMimeType={mapMimeType}
          mapUrl={mapUrl}
        />
      )}
      renderCessionSheet={({
        open,
        selectedDates,
        spotId,
        spotLabel,
        dayData,
        onClose,
        onSuccess,
      }) => (
        <OfficeCessionSheet
          open={open}
          selectedDates={selectedDates}
          dayData={dayData}
          spotId={spotId}
          spotLabel={spotLabel}
          onClose={onClose}
          onActionSuccess={onSuccess}
        />
      )}
    />
  );
}
