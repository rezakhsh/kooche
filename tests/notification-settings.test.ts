import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { sendMessage, type Sent } from '../src/modules/chat/conversations';
import { decideNotice, type NoticeJob } from '../src/modules/notifications/chat-notice';
import {
  noticeChannels,
  noticeSwitches,
  parsePrefs,
  quietDelay,
  saveNotificationPrefs,
  setChatNotices,
} from '../src/modules/users/notification-prefs';
import { appDb, redis, workerDb } from './accounts';
import { db, makeListing, type Tx } from './db';
import { user } from './listings-fixtures';

// Notification settings (wave 1, mockup final/notifications): a Telegram and an email switch per
// kind, quiet hours and bundling (bundling: tests/search-alerts.test.ts).

const DAY = 86_400_000;
const NOON = new Date('2026-11-10T11:00:00Z');
const all = (telegram: boolean, email: boolean) => ({ chat: { telegram, email }, reply: { telegram, email }, searches: { telegram, email } });

describe('the switches', () => {
  it('event reminders follow the usual defaults; the weekly events message waits to be asked for (part 6)', () => {
    expect(noticeSwitches({}, 'reminders', true)).toEqual({ telegram: true, email: false });
    expect(noticeSwitches({}, 'events', true)).toEqual({ telegram: false, email: false });
    expect(noticeSwitches({ chat: false }, 'reminders', false)).toEqual({ telegram: true, email: true });
    expect(noticeChannels({ channels: { events: { email: true } } }, 'events', true)).toEqual(['email']);
  });

  it('keep the old behaviour by default: Telegram when the bot reaches the person, else email', () => {
    expect(noticeSwitches({}, 'chat', true)).toEqual({ telegram: true, email: false });
    expect(noticeSwitches({}, 'chat', false)).toEqual({ telegram: true, email: true });
    expect(noticeChannels({}, 'chat', true)).toEqual(['telegram']);
    expect(noticeChannels({}, 'searches', false)).toEqual(['email']);
    // The older booleans still turn kinds off
    expect(noticeChannels({ chat: false }, 'reply', true)).toEqual([]);
    expect(noticeChannels({ savedSearches: false }, 'chat', true)).toEqual(['telegram']);
    // Stored switches win
    expect(noticeChannels({ channels: { chat: { telegram: true, email: true } } }, 'chat', true)).toEqual(['telegram', 'email']);
    expect(noticeChannels({ channels: { chat: { telegram: true, email: false } } }, 'chat', false)).toEqual([]);
  });

  it('quiet hours run from 22 to 8 in the person’s time', () => {
    const at = (iso: string) => quietDelay(new Date(iso), 'Europe/Berlin');
    expect(at('2026-11-10T11:00:00Z')).toBe(0); // 12:00
    expect(at('2026-11-10T20:59:00Z')).toBe(0); // 21:59
    expect(at('2026-11-10T21:00:00Z')).toBe(10 * 3_600_000); // 22:00
    expect(at('2026-11-10T22:30:00Z')).toBe(8.5 * 3_600_000); // 23:30
    expect(at('2026-11-11T06:00:00Z')).toBe(3_600_000); // 07:00
    expect(quietDelay(new Date('2026-11-10T11:00:00Z'), 'America/Toronto')).toBe(2 * 3_600_000); // 06:00 in Toronto
  });

  it('are saved all at once, replacing the older booleans', async () => {
    const u = await user();
    await setChatNotices(appDb, u.id, false);
    await saveNotificationPrefs(appDb, u.id, { channels: all(true, false), quiet: true, bundle: true });
    const [row] = await db.select({ prefs: schema.users.notificationPrefs }).from(schema.users).where(eq(schema.users.id, u.id));
    expect(parsePrefs(row!.prefs)).toEqual({ channels: all(true, false), quiet: true, bundle: true });
    await setChatNotices(appDb, u.id, false);
    const [off] = await db.select({ prefs: schema.users.notificationPrefs }).from(schema.users).where(eq(schema.users.id, u.id));
    expect(noticeChannels(off!.prefs, 'chat', true)).toEqual([]);
    expect(noticeChannels(off!.prefs, 'searches', true)).toEqual(['telegram']);
  });
});

describe('chat notices follow them', () => {
  async function chat() {
    const seller = await user({ name: 'فروشنده' });
    const buyer = await user({ name: 'مریم', createdAt: new Date(Date.now() - 30 * DAY) });
    const listing = await makeListing(db as unknown as Tx, seller.id, { title: 'کتاب‌خانه' });
    const send = async (body = 'سلام') => {
      const r = await sendMessage(appDb, redis, { userId: buyer.id, target: { listingToken: listing.publicToken }, body });
      if (!r.ok) throw new Error(r.reason);
      return r;
    };
    return { seller, send };
  }
  const jobOf = (s: Sent): NoticeJob => ({ conversationId: s.conversationId, messageId: s.message.id, recipientId: s.recipientId });

  it('the first message about a listing is a reply, the rest chat, each with its own switches', async () => {
    const c = await chat();
    await saveNotificationPrefs(appDb, c.seller.id, {
      channels: { chat: { telegram: false, email: true }, reply: { telegram: false, email: false }, searches: { telegram: true, email: true } },
      quiet: false,
      bundle: false,
    });
    expect(await decideNotice(workerDb, redis, jobOf(await c.send()), { now: NOON })).toEqual({ skip: 'turned_off' });
    expect(await decideNotice(workerDb, redis, jobOf(await c.send('هنوز هست؟')), { now: NOON })).toEqual({ channels: ['email'] });
  });

  it('go to both channels when both are on, each with its own debounce', async () => {
    const c = await chat();
    await db.update(schema.users).set({ telegramUserId: 900_000_000 + Math.floor(Math.random() * 1_000_000) }).where(eq(schema.users.id, c.seller.id));
    await saveNotificationPrefs(appDb, c.seller.id, { channels: all(true, true), quiet: false, bundle: false });
    expect(await decideNotice(workerDb, redis, jobOf(await c.send()), { now: NOON })).toEqual({ channels: ['telegram', 'email'] });
    expect(await decideNotice(workerDb, redis, jobOf(await c.send('دوباره')), { now: NOON })).toEqual({ skip: 'debounced' });
  });

  it('wait for the morning during quiet hours, in the person’s own time zone', async () => {
    const c = await chat();
    await saveNotificationPrefs(appDb, c.seller.id, { channels: all(true, true), quiet: true, bundle: false });
    const night = new Date('2026-11-10T22:00:00Z'); // 23:00 in Berlin
    expect(await decideNotice(workerDb, redis, jobOf(await c.send()), { now: night })).toEqual({ later: 9 * 3_600_000 });
    // A saved place in Toronto: 17:00 there, so it goes now
    const [toronto] = await db.select({ id: schema.locations.id }).from(schema.locations).where(eq(schema.locations.slug, 'toronto'));
    await db.update(schema.users).set({ homeLocationId: toronto!.id }).where(eq(schema.users.id, c.seller.id));
    expect(await decideNotice(workerDb, redis, jobOf(await c.send('صبح')), { now: night })).toEqual({ channels: ['email'] });
  });
});
