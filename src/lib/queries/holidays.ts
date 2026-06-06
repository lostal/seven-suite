import { db } from "@/lib/db";
import {
  holidays,
  holidayCalendars,
  entityHolidayCalendars,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export type HolidayRow = {
  id: string;
  date: string;
  name: string;
  isOptional: boolean;
};

/**
 * Versión por lotes: consulta una sola vez para varios años.
 * Evita el problema N+1 cuando un rango de fechas cruza años.
 */
export async function getHolidayDatesSetForYears(
  entityId: string,
  years: number[]
): Promise<Set<string>> {
  if (years.length === 0) return new Set();

  const rows = await db
    .select({
      date: holidays.date,
      isOptional: holidays.isOptional,
    })
    .from(holidays)
    .innerJoin(
      holidayCalendars,
      and(
        eq(holidays.calendarId, holidayCalendars.id),
        inArray(holidayCalendars.year, years),
        eq(holidayCalendars.isActive, true)
      )
    )
    .innerJoin(
      entityHolidayCalendars,
      and(
        eq(entityHolidayCalendars.calendarId, holidayCalendars.id),
        eq(entityHolidayCalendars.entityId, entityId)
      )
    );

  return new Set(rows.filter((h) => !h.isOptional).map((h) => h.date));
}
