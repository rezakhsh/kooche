import { z } from 'zod';
import { EVENT_ATTENDANCE, EVENT_LANGUAGES, EVENT_REPEATS, EVENT_SCHEDULE_STATUSES, EVENT_SEATING, type EventPerformer } from '../../db/schema/events';
import { normalizePersian } from '../../lib/normalize-persian';
import type { FieldErrors } from '../listings/listings';
import { checkLink } from './links';
import {
  MAX_DATES,
  MAX_DURATION_MS,
  addDays,
  dayNumber,
  formatLocalDate,
  parseLocalDate,
  parseLocalTime,
  repeatDays,
  zonedToUtc,
} from './time';

// The event's own fields (decided Oct 18, 2026), checked on the server. The listing part (title,
// description, price, place, photos) is checked by the listings module; these errors join its.

export type Attendance = (typeof EVENT_ATTENDANCE)[number];
export type EventLanguage = (typeof EVENT_LANGUAGES)[number];
export type ScheduleStatus = (typeof EVENT_SCHEDULE_STATUSES)[number];

/** Price types an event may have: free, a ticket price ("from"), or paid at the door / varies */
export const EVENT_PRICE_TYPES = ['free', 'fixed', 'on_request'] as const;

/** How far ahead an event may be announced */
export const MAX_AHEAD_DAYS = 365;
const DAY_MS = 86_400_000;

const MAX_VENUE = 100;
const MAX_ADDRESS = 120;
const MAX_ORGANIZER = 80;
const MAX_REFUND = 80;
export const MAX_PERFORMERS = 8;
const MAX_PERFORMER = 60;
const MAX_ROLE = 40;
/** Without an end time, a date lasts this long (the page shows only its start) */
export const OPEN_END_MS = 3 * 3_600_000;

/** A yes / no / not said answer as the form sends it */
const triState = z.enum(['', 'yes', 'no']).default('');

/** What the event form sends besides the listing fields (src/app/events/actions.ts) */
export const eventInputSchema = z.object({
  /** Local date and time at the venue, as <input type="date"> and <input type="time"> send them */
  startDate: z.string().max(20).default(''),
  startTime: z.string().max(10).default(''),
  /** Empty: the same day, or the next day when the end time is before the start (a party until 3) */
  endDate: z.string().max(20).default(''),
  endTime: z.string().max(10).default(''),
  repeat: z.enum(EVENT_REPEATS).default('none'),
  repeatUntil: z.string().max(20).default(''),
  attendance: z.enum(EVENT_ATTENDANCE).default('in_person'),
  venueName: z.string().max(500).default(''),
  streetAddress: z.string().max(500).default(''),
  onlineUrl: z.string().max(2000).default(''),
  ticketUrl: z.string().max(2000).default(''),
  organizerName: z.string().max(500).default(''),
  languages: z.array(z.enum(EVENT_LANGUAGES)).max(EVENT_LANGUAGES.length).default([]),
  /** '' for all ages */
  minAge: z.string().max(5).default(''),
  scheduleStatus: z.enum(EVENT_SCHEDULE_STATUSES).default('scheduled'),
  // Wave 1 (mockup final/event): the page's facts and who is on stage
  seating: z.enum(['', ...EVENT_SEATING]).default(''),
  stepFree: triState,
  doorSales: triState,
  refundNote: z.string().max(500).default(''),
  performers: z.array(z.object({ name: z.string().max(500), role: z.string().max(500) })).max(20).default([]),
});
export type EventInput = z.infer<typeof eventInputSchema>;

export type EventDetailsValues = {
  attendance: Attendance;
  venueName: string | null;
  venueNameNormalized: string | null;
  streetAddress: string | null;
  onlineUrl: string | null;
  ticketUrl: string | null;
  organizerName: string | null;
  organizerNameNormalized: string | null;
  languages: EventLanguage[];
  minAge: number | null;
  timeZone: string;
  repeat: (typeof EVENT_REPEATS)[number];
  repeatUntil: string | null;
  scheduleStatus: ScheduleStatus;
  seating: (typeof EVENT_SEATING)[number] | null;
  stepFree: boolean | null;
  doorSales: boolean | null;
  refundNote: string | null;
  performers: EventPerformer[];
  openEnd: boolean;
};

export type EventDate = { startsAt: Date; endsAt: Date };

const clean = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim();

/**
 * Checks the event fields and turns the local times into UTC dates. `publish` applies every rule;
 * `draft` only the formats, and keeps the dates only when they are complete. `goingOut` (first
 * publication or a resubmission) needs the first date to be ahead; an edit of a live event needs
 * at least one date that hasn't ended.
 */
export function prepareEventFields(
  input: EventInput,
  opts: { timeZone: string; mode: 'draft' | 'publish'; goingOut: boolean; now: Date },
): { ok: true; values: EventDetailsValues; dates: EventDate[] } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const publish = opts.mode === 'publish';
  const { timeZone, now } = opts;

  // Dates
  const startDate = input.startDate.trim() ? parseLocalDate(input.startDate) : null;
  const startTime = input.startTime.trim() ? parseLocalTime(input.startTime) : null;
  const endDateIn = input.endDate.trim() ? parseLocalDate(input.endDate) : null;
  const endTime = input.endTime.trim() ? parseLocalTime(input.endTime) : null;
  const until = input.repeat !== 'none' && input.repeatUntil.trim() ? parseLocalDate(input.repeatUntil) : null;
  if (input.startDate.trim() && !startDate) errors.startDate = 'invalid';
  else if (!startDate && publish) errors.startDate = 'required';
  if (input.startTime.trim() && !startTime) errors.startTime = 'invalid';
  else if (!startTime && publish) errors.startTime = 'required';
  if (input.endDate.trim() && !endDateIn) errors.endDate = 'invalid';
  if (input.endTime.trim() && !endTime) errors.endTime = 'invalid';
  // No end time: an open end (OPEN_END_MS), unless the event runs over several days
  const openEnd = !input.endTime.trim();
  if (openEnd && endDateIn && publish) errors.endTime = 'required';
  if (input.repeat !== 'none') {
    if (input.repeatUntil.trim() && !until) errors.repeatUntil = 'invalid';
    else if (!until && publish) errors.repeatUntil = 'required';
  }

  let dates: EventDate[] = [];
  if (startDate && startTime && (endTime || (openEnd && !endDateIn)) && !errors.endDate && !errors.endTime && (input.repeat === 'none' || until)) {
    // The end day as typed, else the start day (or the next one when the end is earlier)
    const endDate = endTime
      ? (endDateIn ?? (endTime.h * 60 + endTime.mi <= startTime.h * 60 + startTime.mi ? addDays(startDate, 1) : startDate))
      : startDate;
    const spanDays = dayNumber(endDate) - dayNumber(startDate);
    const firstStart = zonedToUtc({ ...startDate, ...startTime }, timeZone);
    const firstEnd = endTime ? zonedToUtc({ ...endDate, ...endTime }, timeZone) : new Date(firstStart.getTime() + OPEN_END_MS);
    if (firstEnd <= firstStart || firstEnd.getTime() - firstStart.getTime() > MAX_DURATION_MS) {
      errors.endTime = 'before_start';
    } else if (until && dayNumber(until) < dayNumber(startDate)) {
      errors.repeatUntil = 'before_start';
    } else if (until && dayNumber(until) - dayNumber(startDate) > MAX_AHEAD_DAYS) {
      errors.repeatUntil = 'too_late';
    } else {
      const days = repeatDays(startDate, input.repeat, until);
      if (days.length > MAX_DATES) errors.repeatUntil = 'too_many_dates';
      else {
        dates = days.map((day) => {
          const startsAt = zonedToUtc({ ...day, ...startTime }, timeZone);
          return { startsAt, endsAt: endTime ? zonedToUtc({ ...addDays(day, spanDays), ...endTime }, timeZone) : new Date(startsAt.getTime() + OPEN_END_MS) };
        });
        // Clocks changing inside one date can make it an hour shorter or longer, never reversed
        dates = dates.filter((d) => d.endsAt > d.startsAt);
        if (publish) {
          if (firstStart.getTime() > now.getTime() + MAX_AHEAD_DAYS * DAY_MS) errors.startDate = 'too_late';
          else if (opts.goingOut && firstStart <= now) errors.startDate = 'in_past';
          else if (!dates.some((d) => d.endsAt > now)) errors.startDate = 'in_past';
        }
      }
    }
  }

  // Where
  const venueName = clean(input.venueName);
  const streetAddress = clean(input.streetAddress);
  const inPerson = input.attendance !== 'online';
  const online = input.attendance !== 'in_person';
  if (venueName.length > MAX_VENUE) errors.venueName = 'too_long';
  else if (publish && inPerson && venueName.length < 2) errors.venueName = venueName ? 'too_short' : 'required';
  if (streetAddress.length > MAX_ADDRESS) errors.streetAddress = 'too_long';

  let onlineUrl: string | null = null;
  if (input.onlineUrl.trim()) {
    const r = checkLink(input.onlineUrl);
    if (r.ok) onlineUrl = r.url;
    else errors.onlineUrl = r.error;
  } else if (publish && online) errors.onlineUrl = 'required';

  let ticketUrl: string | null = null;
  if (input.ticketUrl.trim()) {
    const r = checkLink(input.ticketUrl);
    if (r.ok) ticketUrl = r.url;
    else errors.ticketUrl = r.error;
  }

  const organizerName = clean(input.organizerName);
  if (organizerName.length > MAX_ORGANIZER) errors.organizerName = 'too_long';

  let minAge: number | null = null;
  const age = input.minAge.trim().replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)));
  if (age) {
    if (!/^\d{1,2}$/.test(age) || Number(age) < 1 || Number(age) > 21) errors.minAge = 'invalid';
    else minAge = Number(age);
  }

  const refundNote = clean(input.refundNote);
  if (refundNote.length > MAX_REFUND) errors.refundNote = 'too_long';
  const performers: EventPerformer[] = [];
  for (const p of input.performers) {
    const name = clean(p.name);
    const role = clean(p.role);
    if (!name && !role) continue;
    if (!name) errors.performers = 'required';
    else if (name.length > MAX_PERFORMER || role.length > MAX_ROLE) errors.performers = 'too_long';
    else performers.push(role ? { name, role } : { name });
  }
  if (performers.length > MAX_PERFORMERS) errors.performers = 'too_many';
  const tri = (v: '' | 'yes' | 'no') => (v === '' ? null : v === 'yes');

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    values: {
      attendance: input.attendance,
      // An online event has no venue; whatever was typed before switching is dropped
      venueName: inPerson && venueName ? venueName : null,
      venueNameNormalized: inPerson && venueName ? normalizePersian(venueName) : null,
      streetAddress: inPerson && streetAddress ? streetAddress : null,
      onlineUrl: online ? onlineUrl : null,
      ticketUrl,
      organizerName: organizerName || null,
      organizerNameNormalized: organizerName ? normalizePersian(organizerName) : null,
      languages: [...new Set(input.languages)].sort((a, b) => EVENT_LANGUAGES.indexOf(a) - EVENT_LANGUAGES.indexOf(b)),
      minAge,
      timeZone,
      repeat: until ? input.repeat : 'none',
      repeatUntil: until ? formatLocalDate(until) : null,
      scheduleStatus: input.scheduleStatus,
      seating: input.seating || null,
      stepFree: tri(input.stepFree),
      doorSales: tri(input.doorSales),
      refundNote: refundNote || null,
      performers,
      openEnd: openEnd && !endDateIn,
    },
    dates,
  };
}
