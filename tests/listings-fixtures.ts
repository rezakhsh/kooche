import { and, eq } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import { normalizePersian } from '../src/lib/normalize-persian';
import { db, publicToken } from './db';

// Committed fixtures for the posting tests. The listing functions run their own transactions as
// classifieds_app or classifieds_worker, so these rows are real (and unique per test).

export async function user(opts: { verified?: boolean; name?: string } = {}) {
  const token = publicToken();
  const name = opts.name ?? 'فروشنده آزمایشی';
  const [u] = await db
    .insert(schema.users)
    .values({
      publicToken: token,
      email: `seller-${token}@example.test`,
      displayName: name,
      displayNameNormalized: normalizePersian(name),
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
