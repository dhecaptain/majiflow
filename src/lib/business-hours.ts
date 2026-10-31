import type { Business, OperatingHours, Weekday, WeeklyOperatingHours } from "@/lib/types";

export const BUSINESS_TIME_ZONE = "Africa/Nairobi";

export type AvailabilityState = "open" | "closed" | "unknown";

export interface BusinessAvailability {
  state: AvailabilityState;
  hoursLabel: string;
}

const WEEKDAYS: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const weekdayByIntlName: Record<string, Weekday> = {
  Monday: "monday",
  Tuesday: "tuesday",
  Wednesday: "wednesday",
  Thursday: "thursday",
  Friday: "friday",
  Saturday: "saturday",
  Sunday: "sunday",
};

function timeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    weekday: weekdayByIntlName[values.weekday] as Weekday | undefined,
    minute: Number(values.hour) * 60 + Number(values.minute),
  };
}

function parseTime(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
}

function validWindow(value: OperatingHours | null | undefined): value is OperatingHours {
  if (!value || typeof value.open !== "string" || typeof value.close !== "string") return false;
  const open = parseTime(value.open);
  const close = parseTime(value.close);
  return open !== null && close !== null && open !== close;
}

function formatTime(value: string): string {
  const minutes = parseTime(value);
  if (minutes === null) return value;
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
  }).format(new Date(Date.UTC(2020, 0, 1, Math.floor(minutes / 60), minutes % 60)));
}

function previousWeekday(day: Weekday): Weekday {
  return WEEKDAYS[(WEEKDAYS.indexOf(day) + WEEKDAYS.length - 1) % WEEKDAYS.length];
}

function windowLabel(hours: OperatingHours): string {
  return `${formatTime(hours.open)}–${formatTime(hours.close)}${parseTime(hours.close)! <= parseTime(hours.open)! ? " (overnight)" : ""}`;
}

export interface WeeklyHoursRow {
  day: Weekday;
  /** "Mon", "Tue", ... for compact grids. */
  short: string;
  /** The published window, "Closed", or "Not published". */
  label: string;
}

const SHORT_DAY: Record<Weekday, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

/** The station's published hours as ready-to-render rows, Monday first. */
export { WEEKDAYS };

/**
 * Read untrusted weekly hours (a form or a database row). Valid windows and
 * explicit `null` (closed) days are kept; anything else is dropped. Returns
 * null when nothing valid is left.
 */
export function parseWeeklyHours(input: unknown): WeeklyOperatingHours | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const hours: WeeklyOperatingHours = {};
  for (const day of WEEKDAYS) {
    const value = raw[day];
    if (value === null) {
      hours[day] = null;
    } else if (value && typeof value === "object") {
      const window = value as Record<string, unknown>;
      const candidate = { open: String(window.open ?? ""), close: String(window.close ?? "") };
      if (validWindow(candidate)) hours[day] = candidate;
    }
  }
  return Object.keys(hours).length > 0 ? hours : null;
}

export function weeklyHoursGrid(hours: WeeklyOperatingHours | undefined): WeeklyHoursRow[] {
  return WEEKDAYS.map((day) => {
    const window = hours?.[day];
    if (window === null) return { day, short: SHORT_DAY[day], label: "Closed" };
    if (!validWindow(window)) return { day, short: SHORT_DAY[day], label: "Not published" };
    return { day, short: SHORT_DAY[day], label: windowLabel(window) };
  });
}

function lookupForMinute(hours: WeeklyOperatingHours | undefined, day: Weekday, minute: number) {
  const window = hours?.[day];
  if (!validWindow(window)) return { known: window === null, open: false };
  const open = parseTime(window.open)!;
  const close = parseTime(window.close)!;
  return {
    known: true,
    open: close > open ? minute >= open && minute < close : minute >= open || minute < close,
  };
}

/** Resolve hours against the station's local calendar and clock, not the customer's device zone. */
export function getBusinessAvailability(
  hours: WeeklyOperatingHours | undefined,
  now: Date = new Date()
): BusinessAvailability {
  const { weekday, minute } = timeParts(now);
  if (!weekday || !hours) return { state: "unknown", hoursLabel: "Hours unavailable" };

  const today = hours[weekday];
  const todayLookup = lookupForMinute(hours, weekday, minute);
  const previousDay = hours[previousWeekday(weekday)];
  if (validWindow(previousDay) && parseTime(previousDay.close)! < parseTime(previousDay.open)! && minute < parseTime(previousDay.close)!) {
    return { state: "open", hoursLabel: `Open overnight until ${formatTime(previousDay.close)}` };
  }

  if (todayLookup.open && validWindow(today)) {
    return { state: "open", hoursLabel: `Today ${windowLabel(today)}` };
  }
  if (today === undefined || (today !== null && !validWindow(today))) {
    return { state: "unknown", hoursLabel: "Hours unavailable" };
  }
  if (today === null) return { state: "closed", hoursLabel: "Closed today" };
  return { state: "closed", hoursLabel: `Today ${windowLabel(today)}` };
}

/**
 * After-hours ordering policy (interim, product to confirm): REJECT.
 * Orders outside a station's published schedule - including stations whose
 * hours are unknown - are refused with 422 and a human-readable reason, both
 * from this server-side gate and the pre-payment UI guards. No queue-for-later
 * path exists yet; adding one means changing this function plus the checkout
 * blockers, not inventing a parallel check. Overnight windows and the
 * Africa/Nairobi boundary handling above apply unchanged.
 */
export function getBusinessOrderBlockReason(business: Pick<Business, "openingHours">, now = new Date()): string | null {
  const availability = getBusinessAvailability(business.openingHours, now);
  if (availability.state === "closed") return "This station is closed right now. Please order during its operating hours.";
  if (availability.state === "unknown") return "This station’s hours are unavailable, so we can’t confirm it is open for orders.";
  return null;
}
