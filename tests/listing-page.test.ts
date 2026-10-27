import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { replySpeed, sellerReplySpeed } from '../src/modules/chat/response-time';
import { otherActiveListings } from '../src/modules/listings/queries';
import { safetyKind } from '../src/modules/listings/safety-kind';
import { similarListings, SIMILAR_COUNT } from '../src/modules/search/browse';
import { appDb } from './accounts';
import { db, makeListing, makeUser, type Tx } from './db';
import { categoryBySlug, city } from './listings-fixtures';

// The listing page's new parts (wave 1, mockup final/listing): how fast the seller usually answers,
// their other listings, similar listings, and which safety box it shows

const owner = db as unknown as Tx;
const HOUR = 3_600_000;

/** A conversation on the seller's listing: the buyer asks, the seller answers after `after` ms (or never) */
async function asked(sellerId: string, listingId: string, after: number | null, now: Date) {
  const buyer = await makeUser(owner);
  const [c] = await db.insert(schema.conversations).values({ listingId, buyerUserId: buyer.id, sellerUserId: sellerId }).returning();
  const askedAt = new Date(now.getTime() - 10 * 24 * HOUR);
  await db.insert(schema.messages).values({ conversationId: c!.id, senderUserId: buyer.id, body: 'سلام، هنوز هست؟', createdAt: askedAt });
  if (after !== null) await db.insert(schema.messages).values({ conversationId: c!.id, senderUserId: sellerId, body: 'بله', createdAt: new Date(askedAt.getTime() + after) });
}

describe('how fast a seller usually answers', () => {
  it('needs three conversations and says nothing beyond two days', () => {
    expect(replySpeed(600, 2)).toBeNull();
    expect(replySpeed(600, 3)).toBe('hour');
    expect(replySpeed(5 * 3600, 3)).toBe('hours');
    expect(replySpeed(30 * 3600, 3)).toBe('days');
    expect(replySpeed(72 * 3600, 3)).toBeNull();
  });

  it('is the median first answer of the last 90 days; unanswered buyers count as slow', async () => {
    const now = new Date();
    const fast = await makeUser(owner);
    const l = await makeListing(owner, fast.id);
    for (const ms of [0.2 * HOUR, 0.5 * HOUR, 3 * HOUR]) await asked(fast.id, l.id, ms, now);
    expect(await sellerReplySpeed(appDb, fast.id, now)).toBe('hour');

    const silent = await makeUser(owner);
    const l2 = await makeListing(owner, silent.id);
    await asked(silent.id, l2.id, 0.1 * HOUR, now);
    await asked(silent.id, l2.id, null, now);
    await asked(silent.id, l2.id, null, now);
    expect(await sellerReplySpeed(appDb, silent.id, now)).toBeNull();
  });
});

describe('the seller’s other listings and similar listings', () => {
  it('counts the seller’s other active listings', async () => {
    const seller = await makeUser(owner);
    const a = await makeListing(owner, seller.id);
    await makeListing(owner, seller.id);
    await makeListing(owner, seller.id, { status: 'paused' });
    expect(await otherActiveListings(appDb, a)).toBe(1);
  });

  it('are the newest of the same category in the same city, never the listing itself', async () => {
    const seller = await makeUser(owner);
    const place = await city('bielefeld');
    const sofas = await categoryBySlug('living-room');
    const listings = [];
    for (let i = 0; i < SIMILAR_COUNT + 2; i++) listings.push(await makeListing(owner, seller.id, { categoryId: sofas.id, locationId: place.id, point: place.center }));
    const me = listings[0]!;
    const similar = await similarListings(appDb, me);
    expect(similar).toHaveLength(SIMILAR_COUNT);
    expect(similar.map((s) => s.id)).not.toContain(me.id);
    expect(await similarListings(appDb, { ...me, categoryId: null })).toEqual([]);
  });
});

describe('the safety box', () => {
  it('fits the category', () => {
    expect(safetyKind([{ slug: 'real-estate' }, { slug: 'shared-rooms' }])).toBe('rent');
    expect(safetyKind([{ slug: 'real-estate' }, { slug: 'apartments-sale' }])).toBe('general');
    expect(safetyKind([{ slug: 'vehicles' }, { slug: 'cars' }])).toBe('vehicle');
    expect(safetyKind([{ slug: 'leisure-hobbies' }, { slug: 'tickets' }])).toBe('tickets');
    expect(safetyKind([{ slug: 'jobs' }])).toBe('jobs');
    expect(safetyKind([])).toBe('general');
  });
});
