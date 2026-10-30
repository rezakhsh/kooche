import { and, eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { normalizePersian } from '../src/lib/normalize-persian';
import { writeWeeklyDigests } from '../src/modules/events/digest';
import { cityZones } from '../src/modules/events/notices';
import { isLocalHour, MONDAY } from '../src/modules/notifications/local-hour';
import { category, location, makeListing, makeUser, rollback, type Tx } from './db';

// Timed messages on each place's own clock (wave 2 part 7): the jobs run hourly and send where it
// is their hour now. November 2029: Berlin is UTC+1, Toronto UTC−5.

const MONDAY_BERLIN_8 = new Date('2029-11-05T07:00:00Z');
const MONDAY_TORONTO_8 = new Date('2029-11-05T13:00:00Z');

describe('the local hour', () => {
  it('is the hour on that clock, and Monday only when asked', () => {
    expect(isLocalHour(MONDAY_BERLIN_8, 'Europe/Berlin', 8, MONDAY)).toBe(true);
    expect(isLocalHour(MONDAY_BERLIN_8, 'America/Toronto', 8, MONDAY)).toBe(false);
    expect(isLocalHour(MONDAY_TORONTO_8, 'America/Toronto', 8, MONDAY)).toBe(true);
    // Sunday evening in Los Angeles is Monday in Berlin
    expect(isLocalHour(new Date('2029-11-05T02:00:00Z'), 'America/Los_Angeles', 18, MONDAY)).toBe(false);
    expect(isLocalHour(new Date('2029-11-05T02:00:00Z'), 'America/Los_Angeles', 18)).toBe(true);
    // Half-hour zones meet the hourly run at :30
    expect(isLocalHour(new Date('2029-11-05T03:00:00Z'), 'Asia/Kolkata', 8)).toBe(true);
  });

  it('knows each city’s clock', async () => {
    await rollback(async (tx) => {
      const [berlin, toronto] = await Promise.all([location(tx, 'berlin'), location(tx, 'toronto')]);
      expect(await cityZones(tx, [berlin.id, toronto.id])).toEqual(new Map([[berlin.id, 'Europe/Berlin'], [toronto.id, 'America/Toronto']]));
    });
  });
});

async function event(tx: Tx, userId: string, city: string, country: 'DE' | 'CA', startsAt: Date) {
  const loc = await location(tx, city);
  const title = 'شب شعر آزمایشی';
  const l = await makeListing(tx, userId, {
    categoryId: (await category(tx, 'event-readings')).id,
    title,
    titleNormalized: normalizePersian(title),
    priceType: 'free',
    priceMinor: null,
    currency: null,
    countryCode: country,
    locationId: loc.id,
    point: loc.center,
  });
  await tx.insert(schema.eventDetails).values({ listingId: l.id, timeZone: loc.timezone });
  await tx.insert(schema.eventDates).values({ listingId: l.id, countryCode: country, locationId: loc.id, startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000) });
  return l.id;
}

describe('the weekly digest', () => {
  it('goes out Monday 8:00 on each country’s clock, once a week', async () => {
    await rollback(async (tx) => {
      await tx.update(schema.countries).set({ isActive: true, mode: 'open' }).where(eq(schema.countries.code, 'CA'));
      const u = await makeUser(tx);
      const de = await event(tx, u.id, 'berlin', 'DE', new Date('2029-11-07T18:00:00Z'));
      const ca = await event(tx, u.id, 'toronto', 'CA', new Date('2029-11-07T23:00:00Z'));
      const digests = async () =>
        (await tx.select().from(schema.outboxEvents).where(and(eq(schema.outboxEvents.eventType, 'event_digest.weekly'), sql`${schema.outboxEvents.payload} ->> 'from' LIKE '2029-11-%'`)))
          .map((r) => r.payload as { country: string; listingIds: string[] });

      expect(await writeWeeklyDigests(tx, MONDAY_BERLIN_8, { localHour: 8 })).toBe(1);
      expect((await digests()).map((d) => d.country)).toEqual(['DE']);
      expect((await digests())[0]!.listingIds).toContain(de);
      // The run an hour later, or the same run again, adds nothing for Germany
      expect(await writeWeeklyDigests(tx, MONDAY_BERLIN_8, { localHour: 8 })).toBe(0);
      expect(await writeWeeklyDigests(tx, new Date(MONDAY_BERLIN_8.getTime() + 3_600_000), { localHour: 8 })).toBe(0);
      // Canada's comes at 8:00 in Toronto
      expect(await writeWeeklyDigests(tx, MONDAY_TORONTO_8, { localHour: 8 })).toBe(1);
      const canada = (await digests()).find((d) => d.country === 'CA');
      expect(canada!.listingIds).toEqual([ca]);
    });
  });
});
