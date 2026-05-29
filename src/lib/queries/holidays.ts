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
 * Devuelve los festivos de un año para una entidad,
 * combinando todos los calendarios asignados a esa sede.
 */
export async function getHolidaysForEntity(
  entityId: string,
  year: number
): Promise<HolidayRow[]> {
  const rows = await db
    .select({
      id: holidays.id,
      date: holidays.date,
      name: holidays.name,
      isOptional: holidays.isOptional,
    })
    .from(holidays)
    .innerJoin(
      holidayCalendars,
      and(
        eq(holidays.calendarId, holidayCalendars.id),
        eq(holidayCalendars.year, year),
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

  return rows;
}

/**
 * Devuelve un Set de fechas "yyyy-MM-dd" de festivos no opcionales
 * para uso rápido en cálculos de días laborables.
 */
export async function getHolidayDatesSet(
  entityId: string,
  year: number
): Promise<Set<string>> {
  const rows = await getHolidaysForEntity(entityId, year);
  return new Set(rows.filter((h) => !h.isOptional).map((h) => h.date));
}

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
