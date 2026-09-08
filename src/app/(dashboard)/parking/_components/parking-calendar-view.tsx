/**
 * Parking Calendar View
 *
 * Thin wrapper sobre ResourceCalendarView que inyecta
 * la server action de parking y los sheets específicos.
 */

"use client";

import type { Spot } from "@/types";
import { getCalendarMonthData } from "../calendar-actions";
import { ResourceCalendarView } from "@/components/booking/resource-calendar-view";
import { EmployeeDaySheet } from "./employee-day-sheet";
import { ManagementCessionSheet } from "./management-cession-sheet";

interface ParkingCalendarViewProps {
  hasAssignedSpot: boolean;
  assignedSpot?: Spot | null;
  mapMimeType: string | null;
  mapUrl: string | null;
}

export function ParkingCalendarView({
  hasAssignedSpot,
  assignedSpot,
  mapMimeType,
  mapUrl,
}: ParkingCalendarViewProps) {
  const spot = assignedSpot
    ? { id: assignedSpot.id, label: assignedSpot.label }
    : null;

  return (
    <ResourceCalendarView
      hasAssignedSpot={hasAssignedSpot}
      assignedSpot={spot}
      loadMonthData={getCalendarMonthData}
      showAvailableCount
      resourceLabel="plaza de parking"
      renderBookingSheet={({ date, data, onClose, onSuccess }) => (
        <EmployeeDaySheet
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
        <ManagementCessionSheet
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
