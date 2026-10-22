import { describe, expect, it } from 'vitest';
import { countView, flushViews } from '../src/modules/listings/views';
import { redis, workerDb } from './accounts';
import { listing } from './listings-fixtures';
import { sellerWithListing } from './payments-fixtures';

// Listing views for the business stats (roadmap step 6): counted in Valkey, once per visitor per
// half hour, no bots, written to listings.view_count by the worker.

const BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1';

describe('listing views', () => {
  it('counts a visitor once per half hour, skips bots, and the worker adds them up', async () => {
    const { listing: l } = await sellerWithListing();
    const other = (await sellerWithListing()).listing;
    expect(await countView(redis, { listingId: l.id, ip: '203.0.113.7', userAgent: BROWSER })).toBe(true);
    expect(await countView(redis, { listingId: l.id, ip: '203.0.113.7', userAgent: BROWSER })).toBe(false);
    expect(await countView(redis, { listingId: l.id, ip: '203.0.113.8', userAgent: BROWSER })).toBe(true);
    expect(await countView(redis, { listingId: l.id, ip: '203.0.113.9', userAgent: 'Googlebot/2.1' })).toBe(false);
    expect(await countView(redis, { listingId: l.id, ip: '203.0.113.9', userAgent: null })).toBe(false);
    expect(await countView(redis, { listingId: other.id, ip: '203.0.113.7', userAgent: BROWSER })).toBe(true);
    expect(await flushViews(redis, workerDb)).toBe(2);
    expect((await listing(l.id)).viewCount).toBe(2);
    expect((await listing(other.id)).viewCount).toBe(1);
    // Nothing left to add
    expect(await flushViews(redis, workerDb)).toBe(0);
    expect((await listing(l.id)).viewCount).toBe(2);
    expect(await redis.ttl(`views:pending`)).toBe(-2);
  });
});
