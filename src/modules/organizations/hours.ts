import type { OpeningHours } from '../../db/schema/organizations';
import { localParts } from '../events/time';

// Opening hours (wave 1, migration 0026): one range a day from the form, stored as up to two
// ranges by ISO weekday, read in the business's city's time zone. A range may end at "24:00", or
// before it starts (a bar open 18:00–02:00): then it runs past midnight into the next day.

export const WEEKDAYS = ['1', '2', '3', '4', '5', '6', '7'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** The hours from the form's fields hours.<day>.open / .from / .to; null when no day is open */
export function hoursFromForm(get: (name: string) => string): { ok: true; hours: OpeningHours | null } | { ok: false; day: Weekday } {
  const hours: OpeningHours = {};
  for (const d of WEEKDAYS) {
    if (get(`hours.${d}.open`) !== 'on') continue;
    const from = get(`hours.${d}.from`);
    const to = get(`hours.${d}.to`);
    if (!TIME.test(from) || !TIME.test(to) || from === to || from === '24:00') return { ok: false, day: d };
    hours[d] = [[from, to]];
  }
  return { ok: true, hours: Object.keys(hours).length ? hours : null };
}

/** Whether stored hours are well formed (the column is jsonb; never trust it blindly) */
export function validHours(h: unknown): h is OpeningHours {
  if (!h || typeof h !== 'object' || Array.isArray(h)) return false;
  return Object.entries(h).every(
    ([d, ranges]) =>
      (WEEKDAYS as readonly string[]).includes(d) &&
      Array.isArray(ranges) &&
      ranges.length >= 1 &&
      ranges.length <= 2 &&
      ranges.every((r) => Array.isArray(r) && r.length === 2 && TIME.test(r[0]) && TIME.test(r[1]) && r[0] !== r[1]),
  );
}

export type OpenState = { open: true; until: string } | { open: false; next: { day: Weekday; at: string; today: boolean } | null };

/** Open now and until when, or when it opens next (within a week) */
export function openState(hours: OpeningHours, timeZone: string, now: Date): OpenState {
  const p = localParts(now, timeZone);
  const today = (((new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay() + 6) % 7) + 1) as number;
  const nowMin = p.h * 60 + p.mi;
  const day = (offset: number) => String(((today - 1 + offset + 7) % 7) + 1) as Weekday;
  // Yesterday's range past midnight
  for (const [from, to] of hours[day(-1)] ?? []) {
    if (minutes(to) < minutes(from) && nowMin < minutes(to)) return { open: true, until: to };
  }
  for (const [from, to] of hours[day(0)] ?? []) {
    const start = minutes(from);
    const end = minutes(to) <= start ? minutes(to) + 1440 : minutes(to);
    if (nowMin >= start && nowMin < end) return { open: true, until: to === '24:00' ? '00:00' : to };
  }
  for (let offset = 0; offset < 7; offset++) {
    const d = day(offset);
    const starts = (hours[d] ?? []).map(([from]) => from).filter((from) => offset > 0 || minutes(from) > nowMin);
    if (starts.length) return { open: false, next: { day: d, at: starts.sort()[0]!, today: offset === 0 } };
  }
  return { open: false, next: null };
}

/** schema.org openingHoursSpecification for the page's JSON-LD */
export function hoursJsonLd(hours: OpeningHours) {
  const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return WEEKDAYS.flatMap((d) =>
    (hours[d] ?? []).map(([opens, closes]) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: `https://schema.org/${names[Number(d) - 1]}`, opens, closes: closes === '24:00' ? '23:59' : closes })),
  );
}
