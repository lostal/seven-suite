"use server";

import { buildCalendarAction } from "@/lib/actions/calendar-actions";

export const getOfficeCalendarMonthData = buildCalendarAction("office");
