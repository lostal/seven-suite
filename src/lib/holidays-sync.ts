/**
 * Sync de festivos desde OpenHolidays API
 *
 * Descarga los festivos de cada comunidad autónoma con sede activa
 * (sin duplicar llamadas para CCAA repetidas) y los persiste en
 * holiday_calendars + holidays + entity_holiday_calendars.
 *
 * API: https://openholidaysapi.org/PublicHolidays
 *   Parámetros: countryIsoCode=ES, subdivisionCode=ES-MD, validFrom=2025-01-01, validTo=2025-12-31
 */

import { db } from "@/lib/db";
import { AUTONOMOUS_COMMUNITIES } from "@/lib/constants";
import {
  entities,
  holidayCalendars,
  holidays,
  entityHolidayCalendars,
} from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

type OpenHolidayEntry = {
  startDate: string;
  endDate: string;
  name: { language: string; text: string }[];
  nationwide: boolean;
};

async function fetchOpenHolidays(
  subdivisionCode: string,
  year: number
): Promise<OpenHolidayEntry[]> {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const url =
    `https://openholidaysapi.org/PublicHolidays` +
    `?countryIsoCode=ES&subdivisionCode=${subdivisionCode}&validFrom=${from}&validTo=${to}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `OpenHolidays API error ${res.status} for ${subdivisionCode} ${year}`
    );
  }

  return res.json() as Promise<OpenHolidayEntry[]>;
}

function getHolidayName(entry: OpenHolidayEntry): string {
  const es = entry.name.find((n) => n.language === "ES");
  return es?.text ?? entry.name[0]?.text ?? "Festivo";
}

function getCCaaName(code: string): string {
  return AUTONOMOUS_COMMUNITIES.find((c) => c.code === code)?.name ?? code;
}

type CcaaError = { ccaa: string; error: string };

export type SyncHolidaysResult = {
  ccaaCount: number;
  totalHolidays: number;
  errors: CcaaError[];
};

/**
 * Sincroniza los festivos para todas las CCAA con sedes activas.
 *
 * Itera por CCAA única (no por entidad) para evitar llamadas API
 * redundantes. Al terminar desactiva los calendarios heredados del
 * seed (region = null) para que no contaminen los resultados.
 */
export async function syncAllHolidays(): Promise<SyncHolidaysResult> {
  // Desactivar calendarios de seed (region = null) que estén activos
  await db
    .update(holidayCalendars)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(eq(holidayCalendars.isActive, true), isNull(holidayCalendars.region))
    );

  // Obtener CCAA distintas de sedes activas
  const activeEntities = await db
    .select({ autonomousCommunity: entities.autonomousCommunity })
    .from(entities)
    .where(eq(entities.isActive, true));

  const distinctCcaa = [
    ...new Set(
      activeEntities
        .map((e) => e.autonomousCommunity)
        .filter((c): c is string => !!c)
    ),
  ];

  const currentYear = new Date().getFullYear();
  let totalHolidays = 0;
  const errors: CcaaError[] = [];

  for (const cc of distinctCcaa) {
    try {
      for (const year of [currentYear, currentYear + 1]) {
        const entries = await fetchOpenHolidays(cc, year);

        const calendarName = `Festivos ${getCCaaName(cc)} ${year}`;
        const existing = await db
          .select({ id: holidayCalendars.id })
          .from(holidayCalendars)
          .where(
            and(
              eq(holidayCalendars.region, cc),
              eq(holidayCalendars.year, year)
            )
          )
          .limit(1);

        let calendarId: string;
        if (existing[0]) {
          calendarId = existing[0].id;
          await db
            .update(holidayCalendars)
            .set({ isActive: true, updatedAt: new Date() })
            .where(eq(holidayCalendars.id, calendarId));
        } else {
          const [inserted] = await db
            .insert(holidayCalendars)
            .values({
              name: calendarName,
              country: "ES",
              region: cc,
              year,
              isActive: true,
            })
            .returning({ id: holidayCalendars.id });
          if (!inserted) continue;
          calendarId = inserted.id;
        }

        for (const entry of entries) {
          await db
            .insert(holidays)
            .values({
              calendarId,
              date: entry.startDate,
              name: getHolidayName(entry),
              isOptional: false,
            })
            .onConflictDoUpdate({
              target: [holidays.calendarId, holidays.date],
              set: { name: getHolidayName(entry) },
            });
        }

        totalHolidays += entries.length;

        // Vincular todas las sedes con esta CCAA al calendario
        const ccaaEntities = await db
          .select({ id: entities.id })
          .from(entities)
          .where(
            and(
              eq(entities.isActive, true),
              eq(entities.autonomousCommunity, cc)
            )
          );

        for (const entity of ccaaEntities) {
          await db
            .insert(entityHolidayCalendars)
            .values({ entityId: entity.id, calendarId })
            .onConflictDoNothing();
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ ccaa: cc, error: msg });
    }
  }

  return {
    ccaaCount: distinctCcaa.length - errors.length,
    totalHolidays,
    errors,
  };
}
