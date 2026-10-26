import { and, eq } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import { normalizePersian } from '../src/lib/normalize-persian';
import { db, publicToken } from './db';

// Committed fixtures for the posting tests. The listing functions run their own transactions as
// classifieds_app or classifieds_worker, so these rows are real (and unique per test).

/** `createdAt`: the account's age matters for the new-account limits (first 7 days) */
export async function user(opts: { verified?: boolean; name?: string; createdAt?: Date } = {}) {
  const token = publicToken();
  const name = opts.name ?? 'فروشنده آزمایشی';
  const [u] = await db
    .insert(schema.users)
    .values({
      publicToken: token,
      email: `seller-${token}@example.test`,
      displayName: name,
      displayNameNormalized: normalizePersian(name),
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
      ...(opts.verified === false
        ? {}
        : { phoneE164: `+4917${Math.floor(10_000_000 + Math.random() * 89_999_999)}`, phoneVerifiedAt: new Date(), phoneVerificationMethod: 'telegram' as const }),
    })
    .returning();
  return u!;
}

export async function categoryBySlug(slug: string) {
  const [c] = await db.select().from(schema.categories).where(eq(schema.categories.slug, slug));
  if (!c) throw new Error(`no category ${slug}`);
  return c;
}

export async function city(slug = 'berlin') {
  const [c] = await db
    .select()
    .from(schema.locations)
    .where(and(eq(schema.locations.slug, slug), eq(schema.locations.kind, 'city')));
  if (!c) throw new Error(`no city ${slug}`);
  return c;
}

export async function listing(id: string) {
  const [l] = await db.select().from(schema.listings).where(eq(schema.listings.id, id));
  return l!;
}

export async function events(listingId: string) {
  return db
    .select()
    .from(schema.listingEvents)
    .where(eq(schema.listingEvents.listingId, listingId))
    .orderBy(schema.listingEvents.createdAt, schema.listingEvents.id);
}

export async function outbox(aggregateId: string) {
  const rows = await db
    .select()
    .from(schema.outboxEvents)
    .where(eq(schema.outboxEvents.aggregateId, aggregateId))
    .orderBy(schema.outboxEvents.id);
  return rows.map((r) => r.eventType);
}

/**
 * Every city open with no radius, and Austria open, for tests about places, search and events
 * rather than the launch rules (since wave 0 only the Berlin area is open and Austria is closed;
 * tests/city-launch.test.ts tests those). Call in beforeAll; the returned function puts back the
 * exact earlier state (afterAll).
 */
export async function openEverywhereForTests(): Promise<() => Promise<void>> {
  const cities = await db
    .select({ id: schema.locations.id, launchStatus: schema.locations.launchStatus, launchRadiusKm: schema.locations.launchRadiusKm })
    .from(schema.locations)
    .where(eq(schema.locations.kind, 'city'));
  const [austria] = await db.select({ isActive: schema.countries.isActive }).from(schema.countries).where(eq(schema.countries.code, 'AT'));
  await db.update(schema.countries).set({ isActive: true }).where(eq(schema.countries.code, 'AT'));
  await db.update(schema.locations).set({ launchStatus: 'open', launchRadiusKm: null }).where(eq(schema.locations.kind, 'city'));
  return async () => {
    await db.update(schema.countries).set({ isActive: austria!.isActive }).where(eq(schema.countries.code, 'AT'));
    for (const c of cities) {
      await db.update(schema.locations).set({ launchStatus: c.launchStatus, launchRadiusKm: c.launchRadiusKm }).where(eq(schema.locations.id, c.id));
    }
  };
}
