import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Queryable } from '../../db/drizzle';
import { users } from '../../db/schema';

// users.notification_prefs (jsonb, docs/schema.md section 6), validated here on every read and
// write. Since wave 1 (mockup final/notifications) each kind of notice has a Telegram and an email
// switch, and two general ones: quiet hours (nothing from 22 to 8 in the person's time; it goes
// out in the morning) and bundling (saved searches once a day in one message).
//
// Kinds: `chat` (a new message in a conversation), `reply` (the first message about one of your
// listings), `searches` (new listings for saved searches; each search also has its own frequency),
// `reminders` (a saved event the day before, a followed business's new event) and `events` (this
// week's events in the city, Monday mornings; part 6). Defaults keep the behaviour from before the
// switches: Telegram when the bot can reach the person, else email; the weekly events message is
// off until asked for («خبرم کن» on the events list). The older `chat` / `savedSearches` booleans
// still turn a kind off.

export const NOTICE_KINDS = ['chat', 'reply', 'searches', 'reminders', 'events'] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];
export type NoticeChannel = 'telegram' | 'email';

const pairSchema = z.object({ telegram: z.boolean().optional(), email: z.boolean().optional() });
const prefsSchema = z.object({
  chat: z.boolean().optional(),
  savedSearches: z.boolean().optional(),
  channels: z
    .object({
      chat: pairSchema.optional(),
      reply: pairSchema.optional(),
      searches: pairSchema.optional(),
      reminders: pairSchema.optional(),
      events: pairSchema.optional(),
    })
    .optional(),
  quiet: z.boolean().optional(),
  bundle: z.boolean().optional(),
  /** The city of the weekly events message; without it, the saved place's city */
  eventsCity: z.uuid().optional(),
});
export type NotificationPrefs = z.infer<typeof prefsSchema>;

/** Quiet hours for people without a saved place (the worker passes APP_TIME_ZONE) */
export const DEFAULT_TIME_ZONE = 'Europe/Berlin';

/** Quiet hours, in the person's local time: from 22:00 to 08:00 */
export const QUIET_FROM = 22;
export const QUIET_UNTIL = 8;

export function parsePrefs(value: unknown): NotificationPrefs {
  const parsed = prefsSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

/**
 * The switches of one kind as the settings page shows them. `telegramReady`: the account is
 * linked to the bot and the bot can reach it; email is on by default only when it can't.
 */
export function noticeSwitches(value: unknown, kind: NoticeKind, telegramReady: boolean): Record<NoticeChannel, boolean> {
  const p = parsePrefs(value);
  const stored = p.channels?.[kind] ?? {};
  if (kind === 'events') return { telegram: stored.telegram ?? false, email: stored.email ?? false };
  const legacyOff = kind === 'searches' ? p.savedSearches === false : kind === 'reminders' ? false : p.chat === false;
  if (legacyOff && !p.channels?.[kind]) return { telegram: false, email: false };
  return { telegram: stored.telegram ?? true, email: stored.email ?? !telegramReady };
}

/** Where a notice of this kind goes now: the switched-on channels that can deliver */
export function noticeChannels(value: unknown, kind: NoticeKind, telegramReady: boolean): NoticeChannel[] {
  const s = noticeSwitches(value, kind, telegramReady);
  const out: NoticeChannel[] = [];
  if (s.telegram && telegramReady) out.push('telegram');
  if (s.email) out.push('email');
  return out;
}

/** The city of the weekly events message, when one was chosen («خبرم کن» on a city's events) */
export function eventsCityOf(value: unknown): string | null {
  return parsePrefs(value).eventsCity ?? null;
}

/**
 * «خبرم کن» on the events list: the weekly message on, for this city, by Telegram when the bot
 * can reach the person, else by email. `off` stops it (both switches off).
 */
export async function setWeeklyEvents(db: Queryable, userId: string, change: { cityId: string | null; telegramReady: boolean } | 'off'): Promise<void> {
  const pair = change === 'off' ? { telegram: false, email: false } : { telegram: change.telegramReady, email: !change.telegramReady };
  const city = change !== 'off' && change.cityId ? sql` || jsonb_build_object('eventsCity', ${change.cityId}::text)` : sql``;
  await db
    .update(users)
    .set({
      notificationPrefs: sql`${users.notificationPrefs} || jsonb_build_object('channels', coalesce(${users.notificationPrefs} -> 'channels', '{}'::jsonb) || jsonb_build_object('events', ${JSON.stringify(pair)}::jsonb))${city}`,
    })
    .where(eq(users.id, userId));
}

export function quietHoursOn(value: unknown): boolean {
  return parsePrefs(value).quiet !== false;
}

export function bundleOn(value: unknown): boolean {
  return parsePrefs(value).bundle === true;
}

/** Whether any notice of the kind is switched on at all (the account page's summary) */
export function noticesOn(value: unknown, kind: NoticeKind): boolean {
  const s = noticeSwitches(value, kind, false);
  return s.telegram || s.email;
}

/** Hour and minute of `now` in a time zone */
function localTime(now: Date, timeZone: string): { h: number; m: number } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  return { h: Number(parts.find((x) => x.type === 'hour')?.value ?? 0), m: Number(parts.find((x) => x.type === 'minute')?.value ?? 0) };
}

/** During quiet hours, how long until they end (ms); 0 outside them */
export function quietDelay(now: Date, timeZone: string): number {
  const { h, m } = localTime(now, timeZone);
  if (h >= QUIET_UNTIL && h < QUIET_FROM) return 0;
  const minutes = h >= QUIET_FROM ? (24 - h + QUIET_UNTIL) * 60 - m : (QUIET_UNTIL - h) * 60 - m;
  return minutes * 60_000 - now.getSeconds() * 1_000 - now.getMilliseconds();
}

/** The whole settings form at once (every switch is sent, so absent means off) */
export async function saveNotificationPrefs(
  db: Queryable,
  userId: string,
  change: { channels: Partial<Record<NoticeKind, Record<NoticeChannel, boolean>>>; quiet: boolean; bundle: boolean },
): Promise<void> {
  // The older booleans go: the switches say it all now
  const value = prefsSchema.parse({ channels: change.channels, quiet: change.quiet, bundle: change.bundle });
  await db
    .update(users)
    .set({ notificationPrefs: sql`(${users.notificationPrefs} - 'chat' - 'savedSearches') || ${JSON.stringify(value)}::jsonb` })
    .where(eq(users.id, userId));
}

// The older switches, still used by the one-click "turn off" links in notices
export function chatNoticesOn(value: unknown): boolean {
  return noticesOn(value, 'chat');
}

export function savedSearchAlertsOn(value: unknown): boolean {
  return noticesOn(value, 'searches');
}

export async function setChatNotices(db: Queryable, userId: string, on: boolean): Promise<void> {
  await setKinds(db, userId, 'chat', ['chat', 'reply'], on);
}

export async function setSavedSearchAlerts(db: Queryable, userId: string, on: boolean): Promise<void> {
  await setKinds(db, userId, 'savedSearches', ['searches'], on);
}

/** Off: both switches of the kinds off; on: back to their defaults. Drops the older boolean. */
async function setKinds(db: Queryable, userId: string, legacy: 'chat' | 'savedSearches', kinds: NoticeKind[], on: boolean): Promise<void> {
  const channels = sql`coalesce(${users.notificationPrefs} -> 'channels', '{}'::jsonb)`;
  const next = on
    ? sql`${channels} - ${sql.join(kinds.map((k) => sql`${k}::text`), sql` - `)}`
    : sql`${channels} || ${JSON.stringify(Object.fromEntries(kinds.map((k) => [k, { telegram: false, email: false }])))}::jsonb`;
  await db
    .update(users)
    .set({ notificationPrefs: sql`(${users.notificationPrefs} - ${legacy}::text) || jsonb_build_object('channels', ${next})` })
    .where(eq(users.id, userId));
}
