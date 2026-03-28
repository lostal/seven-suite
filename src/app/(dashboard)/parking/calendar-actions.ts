"use server";

import { buildCalendarAction } from "@/lib/actions/calendar-actions";

export const getCalendarMonthData = buildCalendarAction("parking");
