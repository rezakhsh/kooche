import { z } from 'zod';
import { EVENT_LANGUAGES } from '../../db/schema/events';
import { seasonByKey, type ActiveSeason } from './seasons';
import { addDays, localParts, parseLocalDate, zonedToUtc, type LocalDate } from './time';
import { whenWindow, type EventFilter } from './queries';

// The events list's address (wave 1, mockups final/events and events-filters), read the same way
// by the page and by the filter sheet's live count (/api/events/count). Every filter is a plain
// query parameter, so each view has its own address and works without JavaScript:
// when=today|tomorrow|weekend|week|month, day=2026-10-29 (the day strip, or the sheet's date as
// day.day/day.month/day.year), type=<slug> (repeatable), free=1, price=cheap, online=1 or
// attendance=in_person|online, lang=fa (repeatable), family=1, adults=1, stepfree=1, range=near
// (a city's page: up to NEAR_KM), season=yalda, after=<cursor>.

export const NEAR_KM = 100;
/** «تا ۲۰ €»: free, or a ticket up to 20 in the country's currency */
export const CHEAP_MAJOR = 20;

export type EventsQuery = Record<string, string | string[] | undefined>;
export const QUICK_WHEN = ['today', 'tomorrow', 'weekend', 'week', 'month'] as const;
export type QuickWhen = (typeof QUICK_WHEN)[number];

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

const cursor = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z_[0-9a-f-]{36}$/)
  .transform((s) => {
    const [at, id] = s.split('_');
    return { startsAt: new Date(at!), id: id! };
  });

export type EventsState = {
  /** Words from the header's box: titles, venues, organisers */
  q: string | null;
  when: QuickWhen | null;
  /** A single day, "2026-10-29" */
  day: string | null;
  types: string[];
  free: boolean;
  cheap: boolean;
  attendance: 'in_person' | 'online' | null;
  languages: string[];
  family: boolean;
  adults: boolean;
  stepFree: boolean;
  near: boolean;
  season: ActiveSeason | null;
  after: { startsAt: Date; id: string } | null;
};

/** The day the sheet's date field or the day strip asks for */
function dayOf(q: EventsQuery): LocalDate | null {
  const typed = one(q.day);
  if (typed) return parseLocalDate(typed);
  // The sheet's date field counts only with «انتخاب تاریخ…» chosen (it is sent either way)
  if (one(q.when) !== 'date') return null;
  const [d, m, y] = [one(q['day.day']), one(q['day.month']), one(q['day.year'])];
  return d && m && y ? parseLocalDate(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`) : null;
}

const iso = (d: LocalDate) => `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;

export function readEventsQuery(q: EventsQuery, now: Date, timeZone: string): EventsState {
  const when = QUICK_WHEN.find((w) => w === one(q.when)) ?? null;
  const day = dayOf(q);
  const attendance = one(q.online) === '1' ? 'online' : one(q.attendance) === 'online' ? 'online' : one(q.attendance) === 'in_person' ? 'in_person' : null;
  const after = cursor.safeParse(one(q.after));
  const words = one(q.q).trim().replace(/\s+/g, ' ').slice(0, 100);
  return {
    q: words || null,
    when: day ? null : when,
    day: day ? iso(day) : null,
    types: many(q.type).filter((t) => /^[a-z0-9-]{1,60}$/.test(t)).slice(0, 10),
    free: one(q.free) === '1' || one(q.price) === 'free',
    cheap: one(q.price) === 'cheap',
    attendance,
    languages: many(q.lang).filter((l) => (EVENT_LANGUAGES as readonly string[]).includes(l)),
    family: one(q.family) === '1',
    adults: one(q.adults) === '1',
    stepFree: one(q.stepfree) === '1',
    near: one(q.range) === 'near',
    season: one(q.season) ? seasonByKey(one(q.season), now, timeZone) : null,
    after: after.success ? after.data : null,
  };
}

/** The time window of the state: a day, a quick choice, or from now on */
export function stateWindow(s: EventsState, now: Date, timeZone: string): { from: Date; to: Date | null } {
  if (s.day) {
    const d = parseLocalDate(s.day)!;
    const start = zonedToUtc({ ...d, h: 0, mi: 0 }, timeZone);
    return { from: start > now ? start : now, to: zonedToUtc({ ...addDays(d, 1), h: 0, mi: 0 }, timeZone) };
  }
  if (s.when === 'tomorrow') {
    const p = localParts(now, timeZone);
    const tomorrow = addDays({ y: p.y, m: p.m, d: p.d }, 1);
    return { from: zonedToUtc({ ...tomorrow, h: 0, mi: 0 }, timeZone), to: zonedToUtc({ ...addDays(tomorrow, 1), h: 0, mi: 0 }, timeZone) };
  }
  return whenWindow(s.when ?? 'all', now, timeZone);
}

/** The state as a query filter; type slugs become ids with `typeIds` */
export function stateFilter(
  s: EventsState,
  ctx: { countryCode: string; locationId: string | null; typeIds: (slug: string) => string | null; cheapMinor: number; now: Date; timeZone: string },
): EventFilter {
  return {
    countryCode: ctx.countryCode,
    locationId: ctx.locationId,
    withinKm: ctx.locationId && s.near ? NEAR_KM : null,
    categoryIds: s.types.map(ctx.typeIds).filter((x): x is string => !!x),
    ...stateWindow(s, ctx.now, ctx.timeZone),
    online: s.attendance === 'online',
    inPerson: s.attendance === 'in_person',
    free: s.free,
    maxPriceMinor: s.cheap ? ctx.cheapMinor : null,
    languages: s.languages,
    text: s.q,
    family: s.family,
    adults: s.adults,
    stepFree: s.stepFree,
    season: s.season,
    after: s.after,
  };
}

/** The state back as query parameters (paging left out), for links that change one thing */
export function stateQuery(s: EventsState, patch: Partial<Omit<EventsState, 'season' | 'after'>> & { season?: string | null } = {}): URLSearchParams {
  // (q, the header's words, is kept like every other filter)
  const v = { ...s, ...patch };
  const q = new URLSearchParams();
  if (v.q) q.set('q', v.q);
  if (v.day) q.set('day', v.day);
  else if (v.when) q.set('when', v.when);
  for (const t of v.types) q.append('type', t);
  if (v.free) q.set('free', '1');
  else if (v.cheap) q.set('price', 'cheap');
  if (v.attendance === 'online') q.set('online', '1');
  else if (v.attendance) q.set('attendance', v.attendance);
  for (const l of v.languages) q.append('lang', l);
  if (v.family) q.set('family', '1');
  if (v.adults) q.set('adults', '1');
  if (v.stepFree) q.set('stepfree', '1');
  if (v.near) q.set('range', 'near');
  const season = patch.season !== undefined ? patch.season : s.season?.key;
  if (season) q.set('season', season);
  return q;
}

/** Whether any filter is on (a filtered view isn't indexed) */
export function isFiltered(s: EventsState): boolean {
  return stateQuery(s).toString() !== '' || !!s.after;
}
