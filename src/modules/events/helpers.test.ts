import { describe, expect, it } from 'vitest';
import { cardDate, formatEventWhen, formatJalaliDate } from './format';
import { buildIcs } from './ics';
import { eventInputSchema, prepareEventFields, type EventInput } from './input';
import { checkLink } from './links';
import { whenWindow } from './queries';
import { localParts, parseLocalDate, parseLocalTime, repeatDays, zonedToUtc } from './time';

// Event times, dates and links without the database. Decided Oct 18, 2026: local times at the
// venue, stored in UTC; repeating events keep their local time; at most 26 dates; links https
// only and no shorteners.

const BERLIN = 'Europe/Berlin';
const NOW = new Date('2026-10-18T10:00:00Z');

function fields(over: Partial<EventInput> = {}) {
  return eventInputSchema.parse({
    startDate: '2026-12-19',
    startTime: '20:00',
    endTime: '23:30',
    venueName: 'Bürgerhaus Stollwerck',
    streetAddress: 'Dreikönigenstraße 23',
    ...over,
  });
}

const publish = (over: Partial<EventInput> = {}, goingOut = true, now = NOW) =>
  prepareEventFields(fields(over), { timeZone: BERLIN, mode: 'publish', goingOut, now });

describe('local times', () => {
  it('reads a wall-clock time in the venue zone, winter and summer', () => {
    expect(zonedToUtc({ y: 2026, m: 12, d: 19, h: 20, mi: 0 }, BERLIN).toISOString()).toBe('2026-12-19T19:00:00.000Z');
    expect(zonedToUtc({ y: 2026, m: 7, d: 4, h: 20, mi: 0 }, BERLIN).toISOString()).toBe('2026-07-04T18:00:00.000Z');
    expect(zonedToUtc({ y: 2026, m: 12, d: 19, h: 20, mi: 0 }, 'Europe/London').toISOString()).toBe('2026-12-19T20:00:00.000Z');
  });

  it('moves a time in the skipped hour forward and takes the first of a doubled hour', () => {
    // 29 March 2026: 02:00 → 03:00 in Berlin
    expect(zonedToUtc({ y: 2026, m: 3, d: 29, h: 2, mi: 30 }, BERLIN).toISOString()).toBe('2026-03-29T01:30:00.000Z');
    // 25 October 2026: 03:00 → 02:00, 02:30 happens twice
    expect(zonedToUtc({ y: 2026, m: 10, d: 25, h: 2, mi: 30 }, BERLIN).toISOString()).toBe('2026-10-25T00:30:00.000Z');
    expect(localParts(new Date('2026-10-25T00:30:00Z'), BERLIN)).toMatchObject({ h: 2, mi: 30 });
  });

  it('parses dates and times, Persian digits too, and refuses days that do not exist', () => {
    expect(parseLocalDate('۲۰۲۶-۱۲-۱۹')).toEqual({ y: 2026, m: 12, d: 19 });
    expect(parseLocalDate('2026-02-30')).toBeNull();
    expect(parseLocalTime('۲۰:۳۰')).toEqual({ h: 20, mi: 30 });
    expect(parseLocalTime('24:00')).toBeNull();
  });
});

describe('repeating dates', () => {
  it('weekly keeps the local time across the change to winter time', () => {
    const r = publish({ startDate: '2026-10-21', startTime: '19:00', endTime: '21:00', repeat: 'weekly', repeatUntil: '2026-11-04' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dates.map((d) => d.startsAt.toISOString())).toEqual([
      '2026-10-21T17:00:00.000Z',
      '2026-10-28T18:00:00.000Z',
      '2026-11-04T18:00:00.000Z',
    ]);
    expect(r.values).toMatchObject({ repeat: 'weekly', repeatUntil: '2026-11-04' });
  });

  it('monthly skips months without that day', () => {
    expect(repeatDays({ y: 2027, m: 1, d: 31 }, 'monthly', { y: 2027, m: 5, d: 31 })).toEqual([
      { y: 2027, m: 1, d: 31 },
      { y: 2027, m: 3, d: 31 },
      { y: 2027, m: 5, d: 31 },
    ]);
  });

  it('at most 26 dates, and the end of the series after its start', () => {
    expect(publish({ startDate: '2026-11-02', repeat: 'weekly', repeatUntil: '2027-04-26' })).toMatchObject({ ok: true });
    expect(publish({ startDate: '2026-11-02', repeat: 'weekly', repeatUntil: '2027-05-03' })).toEqual({
      ok: false,
      errors: { repeatUntil: 'too_many_dates' },
    });
    expect(publish({ startDate: '2026-11-02', repeat: 'weekly', repeatUntil: '2026-11-01' })).toEqual({
      ok: false,
      errors: { repeatUntil: 'before_start' },
    });
    expect(publish({ repeat: 'monthly', repeatUntil: '' })).toEqual({ ok: false, errors: { repeatUntil: 'required' } });
  });
});

describe('date rules', () => {
  it('an end time before the start means the next morning', () => {
    const r = publish({ startTime: '22:00', endTime: '03:00' });
    expect(r.ok && r.dates[0]!.endsAt.toISOString()).toBe('2026-12-20T02:00:00.000Z');
  });

  it('an end before the start, or more than 14 days later, is refused', () => {
    expect(publish({ endDate: '2026-12-18' })).toEqual({ ok: false, errors: { endTime: 'before_start' } });
    expect(publish({ endDate: '2027-01-05' })).toEqual({ ok: false, errors: { endTime: 'before_start' } });
    expect(publish({ endDate: '2026-12-21' })).toMatchObject({ ok: true });
  });

  it('a new event starts ahead, at most a year ahead', () => {
    expect(publish({ startDate: '2026-10-17' })).toEqual({ ok: false, errors: { startDate: 'in_past' } });
    expect(publish({ startDate: '2027-11-01' })).toEqual({ ok: false, errors: { startDate: 'too_late' } });
  });

  it('a live event may be edited while one of its dates has not ended', () => {
    const started = { startDate: '2026-10-18', startTime: '09:00', endTime: '18:00' };
    expect(publish(started, true)).toEqual({ ok: false, errors: { startDate: 'in_past' } });
    expect(publish(started, false)).toMatchObject({ ok: true });
    expect(publish({ ...started, endTime: '10:30' }, false, new Date('2026-10-18T09:00:00Z'))).toEqual({
      ok: false,
      errors: { startDate: 'in_past' },
    });
  });

  it('a draft keeps whatever is complete and needs nothing', () => {
    const r = prepareEventFields(eventInputSchema.parse({ startDate: '2026-12-19' }), { timeZone: BERLIN, mode: 'draft', goingOut: false, now: NOW });
    expect(r).toMatchObject({ ok: true, dates: [] });
    expect(publish({ startTime: '', endTime: '' })).toEqual({ ok: false, errors: { startTime: 'required', endTime: 'required' } });
  });
});

describe('where and who', () => {
  it('in person needs a venue; online needs a link, which only signed-in visitors see', () => {
    expect(publish({ venueName: '' })).toEqual({ ok: false, errors: { venueName: 'required' } });
    expect(publish({ attendance: 'online', venueName: '' })).toEqual({ ok: false, errors: { onlineUrl: 'required' } });
    const r = publish({ attendance: 'online', onlineUrl: 'zoom.us/j/123456' });
    expect(r.ok && r.values).toMatchObject({ onlineUrl: 'https://zoom.us/j/123456', venueName: null, streetAddress: null });
  });

  it('age limits from 1 to 21, languages in a fixed order', () => {
    expect(publish({ minAge: '۱۸', languages: ['en', 'fa'] })).toMatchObject({ ok: true, values: { minAge: 18, languages: ['fa', 'en'] } });
    expect(publish({ minAge: '30' })).toEqual({ ok: false, errors: { minAge: 'invalid' } });
  });
});

describe('links', () => {
  it('https only, no passwords, no IP addresses, no shorteners', () => {
    expect(checkLink('www.eventim.de/event/yalda')).toEqual({ ok: true, url: 'https://www.eventim.de/event/yalda' });
    expect(checkLink('http://example.com/tickets')).toEqual({ ok: false, error: 'invalid' });
    expect(checkLink('https://user:pass@example.com/')).toEqual({ ok: false, error: 'invalid' });
    expect(checkLink('https://192.168.0.1/tickets')).toEqual({ ok: false, error: 'invalid' });
    expect(checkLink('javascript:alert(1)')).toEqual({ ok: false, error: 'invalid' });
    expect(checkLink('https://bit.ly/3abc')).toEqual({ ok: false, error: 'short_link' });
    expect(checkLink('https://go.tinyurl.com/x')).toEqual({ ok: false, error: 'short_link' });
    expect(publish({ ticketUrl: 'https://cutt.ly/yalda' })).toEqual({ ok: false, errors: { ticketUrl: 'short_link' } });
  });
});

describe('when filters', () => {
  // Wednesday 21 October 2026, 10:00 in Berlin
  const wed = new Date('2026-10-21T08:00:00Z');
  it('this week ends on Sunday night, the weekend starts on Friday', () => {
    expect(whenWindow('week', wed, BERLIN)).toEqual({ from: wed, to: new Date('2026-10-25T23:00:00Z') });
    expect(whenWindow('weekend', wed, BERLIN)).toEqual({ from: new Date('2026-10-22T22:00:00Z'), to: new Date('2026-10-25T23:00:00Z') });
    expect(whenWindow('today', wed, BERLIN).to).toEqual(new Date('2026-10-21T22:00:00Z'));
    expect(whenWindow('month', wed, BERLIN).to).toEqual(new Date('2026-10-31T23:00:00Z'));
    const saturday = new Date('2026-10-24T12:00:00Z');
    expect(whenWindow('weekend', saturday, BERLIN).from).toEqual(saturday);
  });
});

describe('calendar file', () => {
  it('one entry per date in UTC, escaped and folded', () => {
    const ics = buildIcs({
      token: 'abcdefghjk',
      title: 'شب یلدا، با موسیقی; زنده',
      description: 'برنامه\nشام و موسیقی'.repeat(20),
      url: 'https://staging.peydoo.com/e/x/abcdefghjk',
      location: 'Bürgerhaus, Köln',
      cancelled: false,
      dates: [
        { startsAt: new Date('2026-12-19T19:00:00Z'), endsAt: new Date('2026-12-19T22:30:00Z') },
        { startsAt: new Date('2026-12-26T19:00:00Z'), endsAt: new Date('2026-12-26T22:30:00Z') },
      ],
      updatedAt: new Date('2026-10-18T10:00:00Z'),
      sequence: 3,
      host: 'staging.peydoo.com',
    });
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('DTSTART:20261219T190000Z');
    // Only the ASCII comma and semicolon are escaped; the Persian comma is plain text
    expect(ics).toContain('SUMMARY:شب یلدا، با موسیقی\\; زنده');
    expect(ics).toContain('LOCATION:Bürgerhaus\\, Köln');
    expect(ics).toContain('SEQUENCE:3');
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});

describe('how dates read', () => {
  it('Gregorian (miladi) in Persian with the weekday, Jalali only as the second line', () => {
    const start = new Date('2026-12-19T19:00:00Z');
    expect(formatEventWhen(start, new Date('2026-12-20T01:00:00Z'), BERLIN)).toBe('شنبه ۱۹ دسامبر ۲۰۲۶، ۲۰:۰۰ تا ۰۲:۰۰');
    expect(formatEventWhen(start, new Date('2026-12-21T17:00:00Z'), BERLIN)).toBe('شنبه ۱۹ دسامبر ۲۰۲۶، ۲۰:۰۰ تا دوشنبه ۲۱ دسامبر ۲۰۲۶، ۱۸:۰۰');
    expect(cardDate(start, BERLIN)).toEqual({ day: '۱۹ دسامبر', weekday: 'شنبه', time: '۲۰:۰۰' });
    expect(formatJalaliDate(start, BERLIN)).toBe('شنبه ۲۸ آذر ۱۴۰۵');
  });
});
