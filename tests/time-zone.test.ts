import { and, eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { sendMessage, type Sent } from '../src/modules/chat/conversations';
import { decideNotice, type NoticeJob } from '../src/modules/notifications/chat-notice';
import { quietDelay, saveNotificationPrefs } from '../src/modules/users/notification-prefs';
import { deviceTimeZone, personTimeZone, personZoneSql, saveDeviceTimeZone, zoneLabel, zonePlaceName } from '../src/modules/users/time-zone';
import { appDb, redis, workerDb } from './accounts';
import { db, makeListing, type Tx } from './db';
import { user } from './listings-fixtures';

// The receiver's clock from the device's time zone (owner, Nov 5, 2026): the order of the
// fallbacks, what is saved and what is ignored, quiet hours in Los Angeles against Berlin, and a
// held chat notice going out at 8:00 on the receiver's clock.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

async function city(slug: string) {
  const [c] = await db
    .select({ id: schema.locations.id })
    .from(schema.locations)
    .where(and(eq(schema.locations.slug, slug), eq(schema.locations.kind, 'city')));
  return c!.id;
}

async function zoneOf(userId: string): Promise<string | null> {
  const [r] = await db.execute<{ tz: string | null }>(sql`SELECT ${personZoneSql()} AS tz FROM users u WHERE u.id = ${userId}`);
  return r!.tz;
}

describe('the device’s zone', () => {
  it('keeps Area/Place zones Intl knows, in Intl’s spelling', () => {
    expect(deviceTimeZone('America/Los_Angeles')).toBe('America/Los_Angeles');
    expect(deviceTimeZone('asia/tehran')).toBe('Asia/Tehran');
    // ICU's own canonical name, which PostgreSQL knows too
    expect(deviceTimeZone('America/Argentina/Buenos_Aires')).toBe('America/Buenos_Aires');
  });

  it('ignores anything else: unknown, fixed offsets, too long, not a string', () => {
    for (const bad of ['Mars/Olympus_Mons', 'Europe/Berlinn', 'UTC', 'Etc/UTC', 'Etc/GMT+8', 'GMT', '', 'Europe/Berlin; DROP TABLE users', `Europe/${'a'.repeat(70)}`, 42, null, undefined, { tz: 'Europe/Berlin' }]) {
      expect(deviceTimeZone(bad)).toBeNull();
    }
  });

  it('comes first, then the saved place, then Berlin', () => {
    expect(personTimeZone({ device: 'America/Los_Angeles', place: 'America/Toronto' })).toBe('America/Los_Angeles');
    expect(personTimeZone({ device: null, place: 'America/Toronto' })).toBe('America/Toronto');
    expect(personTimeZone({})).toBe('Europe/Berlin');
    expect(personTimeZone({}, 'Europe/Vienna')).toBe('Europe/Vienna');
  });

  it('is saved only when valid and changed; the SQL follows the same order', async () => {
    const u = await user();
    expect(await zoneOf(u.id)).toBeNull();
    await db.update(schema.users).set({ homeLocationId: await city('toronto') }).where(eq(schema.users.id, u.id));
    expect(await zoneOf(u.id)).toBe('America/Toronto');

    expect(await saveDeviceTimeZone(appDb, u.id, 'America/Los_Angeles')).toBe(true);
    expect(await zoneOf(u.id)).toBe('America/Los_Angeles');
    // The same again writes nothing; a bad one is ignored and the saved zone stays
    expect(await saveDeviceTimeZone(appDb, u.id, 'America/Los_Angeles')).toBe(false);
    expect(await saveDeviceTimeZone(appDb, u.id, 'Mars/Olympus_Mons')).toBe(false);
    expect(await saveDeviceTimeZone(appDb, u.id, 'Etc/GMT+8')).toBe(false);
    expect(await zoneOf(u.id)).toBe('America/Los_Angeles');
    // A move: the new zone replaces it
    expect(await saveDeviceTimeZone(appDb, u.id, 'Europe/Berlin')).toBe(true);
    expect(await zoneOf(u.id)).toBe('Europe/Berlin');
  });

  it('the database refuses a zone of the wrong form', async () => {
    const u = await user();
    await expect(db.update(schema.users).set({ timeZone: 'Europe/Berlin; x' }).where(eq(schema.users.id, u.id))).rejects.toThrow();
    await expect(db.update(schema.users).set({ timeZone: 'UTC' }).where(eq(schema.users.id, u.id))).rejects.toThrow();
  });

  it('goes with the account when it is erased', async () => {
    const u = await user();
    await saveDeviceTimeZone(appDb, u.id, 'Australia/Sydney');
    await workerDb.execute(sql`SELECT erase_user(${u.id})`);
    const [row] = await db.select({ tz: schema.users.timeZone }).from(schema.users).where(eq(schema.users.id, u.id));
    expect(row!.tz).toBeNull();
  });

  it('is named in Persian on the settings page', async () => {
    expect(await zoneLabel(db, 'America/Los_Angeles')).toEqual({ text: 'لس‌آنجلس', latin: false });
    expect(await zoneLabel(db, 'Europe/Berlin')).toEqual({ text: 'برلین', latin: false });
    // Not one of our cities: ICU's name for the place
    expect(zonePlaceName('America/Denver')).toBe('دنور');
    expect((await zoneLabel(db, 'America/Denver')).latin).toBe(false);
  });
});

describe('quiet hours on the device’s clock', () => {
  it('Los Angeles and Berlin keep their own nights', () => {
    // 06:00 UTC on Nov 5, 2026: 07:00 in Berlin (quiet for an hour more), 22:00 the day before in Los Angeles (ten hours)
    expect(quietDelay(new Date('2026-11-05T06:00:00Z'), 'Europe/Berlin')).toBe(1 * HOUR);
    expect(quietDelay(new Date('2026-11-05T06:00:00Z'), 'America/Los_Angeles')).toBe(10 * HOUR);
    // 12:00 UTC: 13:00 in Berlin (not quiet), 04:00 in Los Angeles (four hours to 8:00)
    expect(quietDelay(new Date('2026-11-05T12:00:00Z'), 'Europe/Berlin')).toBe(0);
    expect(quietDelay(new Date('2026-11-05T12:00:00Z'), 'America/Los_Angeles')).toBe(4 * HOUR);
  });

  it('a chat notice held overnight goes out at 8:00 in the receiver’s zone, not Berlin’s', async () => {
    const seller = await user({ name: 'فروشنده' });
    const buyer = await user({ name: 'مریم', createdAt: new Date(Date.now() - 30 * DAY) });
    const listing = await makeListing(db as unknown as Tx, seller.id, { title: 'میز تحریر' });
    const send = async (body: string): Promise<NoticeJob> => {
      const r = await sendMessage(appDb, redis, { userId: buyer.id, target: { listingToken: listing.publicToken }, body });
      if (!r.ok) throw new Error(r.reason);
      const s: Sent = r;
      return { conversationId: s.conversationId, messageId: s.message.id, recipientId: s.recipientId };
    };
    const email = { telegram: false, email: true };
    await saveNotificationPrefs(appDb, seller.id, { channels: { chat: email, reply: email }, quiet: true, bundle: false });
    // Saved place Berlin, device in Los Angeles: the device's clock decides
    await db.update(schema.users).set({ homeLocationId: await city('berlin') }).where(eq(schema.users.id, seller.id));
    await saveDeviceTimeZone(appDb, seller.id, 'America/Los_Angeles');

    // 12:00 UTC is 13:00 in Berlin but 04:00 in Los Angeles: held for four hours
    const job = await send('سلام');
    expect(await decideNotice(workerDb, redis, job, { now: new Date('2026-11-05T12:00:00Z') })).toEqual({ later: 4 * HOUR });
    // One minute before 8:00 there: still held, for that minute
    expect(await decideNotice(workerDb, redis, job, { now: new Date('2026-11-05T15:59:00Z') })).toEqual({ later: 60_000 });
    // 16:00 UTC is 08:00 in Los Angeles: it goes
    expect(await decideNotice(workerDb, redis, job, { now: new Date('2026-11-05T16:00:00Z') })).toEqual({ channels: ['email'] });

    // Without the device's zone the saved place (Berlin) decides again: 23:00 there waits until 8:00
    await db.update(schema.users).set({ timeZone: null }).where(eq(schema.users.id, seller.id));
    const late = await send('هنوز هست؟');
    expect(await decideNotice(workerDb, redis, late, { now: new Date('2026-11-05T22:00:00Z') })).toEqual({ later: 9 * HOUR });
  });
});
