// Event times (decided Oct 18, 2026): the organizer types the local date and time at the venue,
// which is read in the time zone of the event's city and stored in UTC. A repeating event is a
// list of dates on the same local time, so a weekly class stays at 19:00 across the change to
// summer time. Plain Intl, no date library.

export type LocalDate = { y: number; m: number; d: number };
export type LocalTime = { h: number; mi: number };
export type LocalDateTime = LocalDate & LocalTime;

export type Repeat = 'none' | 'weekly' | 'monthly';

/** At most this many dates per event */
export const MAX_DATES = 26;
/** One date may last this long (a festival weekend) */
export const MAX_DURATION_MS = 14 * 86_400_000;

const DIGITS: Record<string, string> = Object.fromEntries(
  [...'۰۱۲۳۴۵۶۷۸۹', ...'٠١٢٣٤٥٦٧٨٩'].map((c, i) => [c, String(i % 10)]),
);
const latin = (s: string) => s.replace(/[۰-۹٠-٩]/g, (c) => DIGITS[c]!).trim();

/** "2026-12-19" (what <input type="date"> sends), Persian digits too; null if not a real day */
export function parseLocalDate(s: string): LocalDate | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(latin(s));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

/** "19:30" or "19.30", Persian digits too */
export function parseLocalTime(s: string): LocalTime | null {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(latin(s));
  if (!m) return null;
  const [h, mi] = [Number(m[1]), Number(m[2])];
  return h <= 23 && mi <= 59 ? { h, mi } : null;
}

export function formatLocalDate({ y, m, d }: LocalDate): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function formatLocalTime({ h, mi }: LocalTime): string {
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

/** Days from 1970-01-01, so local dates can be compared and added */
export function dayNumber({ y, m, d }: LocalDate): number {
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const t = new Date(Date.UTC(date.y, date.m - 1, date.d + days));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    partsFormatters.set(timeZone, f);
  }
  return f;
}

/** The wall-clock date and time of an instant in a time zone */
export function localParts(date: Date, timeZone: string): LocalDateTime & { s: number } {
  const p = Object.fromEntries(partsFormatter(timeZone).formatToParts(date).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour) % 24, mi: Number(p.minute), s: Number(p.second) };
}

function offsetMs(instant: number, timeZone: string): number {
  const p = localParts(new Date(instant), timeZone);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(instant / 1000) * 1000;
}

/**
 * The instant a wall-clock time has in a time zone. A time that doesn't exist (the hour skipped
 * when summer time starts) moves forward by that hour; a time that exists twice (when it ends)
 * takes the first one.
 */
export function zonedToUtc(local: LocalDateTime, timeZone: string): Date {
  const wall = Date.UTC(local.y, local.m - 1, local.d, local.h, local.mi);
  // The offsets a day before and after cover both sides of a change of clocks
  const before = offsetMs(wall - 86_400_000, timeZone);
  const after = offsetMs(wall + 86_400_000, timeZone);
  // The larger offset gives the earlier instant, so an hour that exists twice gives its first one
  for (const offset of [Math.max(before, after), Math.min(before, after)]) {
    const p = localParts(new Date(wall - offset), timeZone);
    if (Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) === wall) return new Date(wall - offset);
  }
  // In the skipped hour: the old offset, which lands the same distance after the change
  return new Date(wall - Math.min(before, after));
}

/** Whether Intl knows the zone (the city's `timezone` comes from GeoNames) */
export function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The local start days of an event: the first day, then every week or every month on the same
 * day until `until` (inclusive), at most MAX_DATES + 1 (one more, so the caller can tell the
 * series is too long). A month without that day (the 31st) is skipped.
 */
export function repeatDays(first: LocalDate, repeat: Repeat, until: LocalDate | null): LocalDate[] {
  if (repeat === 'none' || !until) return [first];
  const last = dayNumber(until);
  const days: LocalDate[] = [];
  for (let i = 0; days.length <= MAX_DATES; i++) {
    let day: LocalDate;
    if (repeat === 'weekly') day = addDays(first, 7 * i);
    else {
      const t = new Date(Date.UTC(first.y, first.m - 1 + i, 1));
      day = { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: first.d };
      if (!parseLocalDate(formatLocalDate(day))) {
        if (dayNumber({ ...day, d: 1 }) > last) break;
        continue;
      }
    }
    if (dayNumber(day) > last) break;
    days.push(day);
  }
  return days;
}
