import { normalizePersian } from '../../lib/normalize-persian';
import { addDays, dayNumber, localParts, zonedToUtc, type LocalDate } from './time';

// Seasons of the events list (wave 1, mockup final/events): the weeks before Yalda or Nowruz get a
// strip at the top, «فصل یلدا»; its events carry the season's tag. The days are found in the Jalali
// calendar (30 Azar, the last Wednesday before Nowruz, 1 and 13 Farvardin), shown in the
// Gregorian one with the Jalali day beside it (the one place Jalali means something). An event
// belongs to a season when one of its dates falls near the day and its title names it.

export type SeasonKey = 'yalda' | 'chaharshanbe' | 'nowruz' | 'sizdah';

type Season = {
  key: SeasonKey;
  /** The day in a Gregorian year */
  day: (year: number) => LocalDate;
  /** Words in a title that make an event part of it (normalized) */
  words: string[];
  /** Days around the day an event may fall on */
  before: number;
  after: number;
};

const persian = new Intl.DateTimeFormat('en-u-ca-persian', { timeZone: 'UTC', month: 'numeric', day: 'numeric' });

/** The Gregorian day in `year` that is `day` of Jalali month `month`, searched in a small range */
function jalaliDay(year: number, month: number, day: number, gMonth: number, from: number, to: number): LocalDate {
  for (let d = from; d <= to; d++) {
    const parts = persian.formatToParts(new Date(Date.UTC(year, gMonth - 1, d, 12)));
    if (Number(parts.find((p) => p.type === 'month')?.value) === month && Number(parts.find((p) => p.type === 'day')?.value) === day) {
      return { y: year, m: gMonth, d };
    }
  }
  throw new Error(`no Jalali ${month}/${day} in ${year}-${gMonth}`);
}

const nowruz = (year: number) => jalaliDay(year, 1, 1, 3, 19, 22);

const SEASONS: Season[] = [
  // Yalda night is the evening of 30 Azar
  { key: 'yalda', day: (y) => jalaliDay(y, 9, 30, 12, 19, 23), words: ['یلدا'], before: 14, after: 2 },
  {
    key: 'chaharshanbe',
    // The Tuesday evening before the last Wednesday of the year
    day: (y) => {
      const n = nowruz(y);
      let d = addDays(n, -1);
      while ((dayNumber(d) + 3) % 7 !== 2) d = addDays(d, -1);
      return addDays(d, -1);
    },
    words: ['چهارشنبه سوری', 'چهارشنبه‌سوری', 'چهارشنبهسوری'],
    before: 7,
    after: 1,
  },
  { key: 'nowruz', day: nowruz, words: ['نوروز', 'نوروزی', 'سال نو'], before: 14, after: 12 },
  { key: 'sizdah', day: (y) => addDays(nowruz(y), 12), words: ['سیزده', 'سیزده‌بدر', 'سیزده بدر'], before: 2, after: 2 },
];

/** How long before its day a season's strip shows */
const LEAD_DAYS = 60;

export type ActiveSeason = {
  key: SeasonKey;
  /** The day itself, noon UTC (for formatting) */
  day: Date;
  /** Events in it: dates from `from` to `to` whose title has one of `words` */
  from: Date;
  to: Date;
  words: string[];
};

function active(season: Season, year: number, timeZone: string): ActiveSeason {
  const day = season.day(year);
  return {
    key: season.key,
    day: new Date(Date.UTC(day.y, day.m - 1, day.d, 12)),
    from: zonedToUtc({ ...addDays(day, -season.before), h: 0, mi: 0 }, timeZone),
    to: zonedToUtc({ ...addDays(day, season.after + 1), h: 0, mi: 0 }, timeZone),
    words: season.words.map(normalizePersian),
  };
}

/** The season whose strip shows now: the next day within LEAD_DAYS, until the day after it */
export function currentSeason(now: Date, timeZone: string): ActiveSeason | null {
  const p = localParts(now, timeZone);
  const today = dayNumber({ y: p.y, m: p.m, d: p.d });
  let best: { s: Season; year: number; at: number } | null = null;
  for (const s of SEASONS) {
    for (const year of [p.y, p.y + 1]) {
      const at = dayNumber(s.day(year));
      if (at + 1 >= today && at - today <= LEAD_DAYS && (!best || at < best.at)) best = { s, year, at };
    }
  }
  return best ? active(best.s, best.year, timeZone) : null;
}

/** A season by its key, the next one from now (for ?season=) */
export function seasonByKey(key: string, now: Date, timeZone: string): ActiveSeason | null {
  const s = SEASONS.find((x) => x.key === key);
  if (!s) return null;
  const p = localParts(now, timeZone);
  const today = dayNumber({ y: p.y, m: p.m, d: p.d });
  const year = dayNumber(s.day(p.y)) + s.after >= today ? p.y : p.y + 1;
  return active(s, year, timeZone);
}

/** Whether an event (its title and next date) belongs to the season */
export function inSeason(season: ActiveSeason, title: string, startsAt: Date): boolean {
  if (startsAt < season.from || startsAt >= season.to) return false;
  const text = normalizePersian(title).replace(/‌/g, ' ');
  return season.words.some((w) => text.includes(w.replace(/‌/g, ' ')));
}
