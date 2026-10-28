import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { normalizePersian } from '../src/lib/normalize-persian';
import { expireStaleOrders, ownOrder, ownOrders } from '../src/modules/payments/orders';
import { featuredEventIds, featuredListingIds, listingPromotions } from '../src/modules/payments/plans';
import { featuredForPage, FEATURED_ON_PAGE, type SearchFilters } from '../src/modules/search/browse';
import { startListingCheckout } from '../src/modules/payments/checkout';
import { applyWebhookEvent } from '../src/modules/payments/apply';
import { appDb, workerDb } from './accounts';
import { db, makeListing, type Tx } from './db';
import { categoryBySlug, city, user } from './listings-fixtures';
import { event, FakeGateway, orderRow, paidSession, seedCatalog, sellerWithListing, storeEvent } from './payments-fixtures';

// What paid visibility shows (roadmap step 6): the featured strip and badges on browse and event
// pages, and the buyer's own orders. Featured is computed from entitlements at query time.

const DAY = 86_400_000;
const owner = db as unknown as Tx;
const APP_URL = 'https://app.example.test';

beforeAll(async () => {
  await seedCatalog();
});

/** A featured entitlement written as the worker would, from a paid order */
async function feature(listingId: string, userId: string, from = new Date(Date.now() - DAY), to = new Date(Date.now() + 6 * DAY), productCode = 'featured-7d') {
  const gateway = new FakeGateway();
  const r = await startListingCheckout(appDb, gateway, { userId, listingId, productCode, waiver: true, appUrl: APP_URL });
  if (!r.ok) throw new Error(r.reason);
  const order = await orderRow(r.orderId!);
  await applyWebhookEvent(workerDb, gateway, await storeEvent(event('checkout.session.completed', paidSession(order, gateway.checkouts[0]!.id))));
  // Move the period where the test wants it (as the owner; the worker can't rewrite entitlements)
  await db.update(schema.entitlements).set({ startsAt: from, endsAt: to }).where(eq(schema.entitlements.orderId, order.id));
  return order;
}

function filters(over: Partial<SearchFilters>): SearchFilters {
  return { countryCode: 'DE', categoryIds: null, locationId: null, postalCode: null, around: null, price: null, shipping: false, attributes: [], keyword: null, sort: 'newest', ...over };
}

describe('featured listings on browse pages', () => {
  it('shows running featured listings matching the page, never expired, revoked or closed ones', async () => {
    const [cars, hamburg] = await Promise.all([categoryBySlug('cars'), city('hamburg')]);
    const seller = await user();
    const car = await makeListing(owner, seller.id, { categoryId: cars.id, title: 'خودرو ویژه', titleNormalized: normalizePersian('خودرو ویژه'), locationId: hamburg.id, point: hamburg.center });
    const phone = await makeListing(owner, seller.id, { locationId: hamburg.id, point: hamburg.center });
    const expired = await makeListing(owner, seller.id, { categoryId: cars.id, locationId: hamburg.id, point: hamburg.center });
    const paused = await makeListing(owner, seller.id, { categoryId: cars.id, locationId: hamburg.id, point: hamburg.center });
    await feature(car.id, seller.id);
    await feature(phone.id, seller.id);
    await feature(expired.id, seller.id, new Date(Date.now() - 9 * DAY), new Date(Date.now() - DAY));
    await feature(paused.id, seller.id);
    await db.update(schema.listings).set({ status: 'paused' }).where(eq(schema.listings.id, paused.id));

    const strip = await featuredForPage(db, filters({ categoryIds: [cars.id], locationId: hamburg.id }));
    expect(strip.map((l) => l.id)).toEqual([car.id]);
    const cityStrip = (await featuredForPage(db, filters({ locationId: hamburg.id }))).map((l) => l.id);
    expect(cityStrip).toEqual(expect.arrayContaining([car.id, phone.id]));
    expect(cityStrip).not.toContain(expired.id);
    expect(cityStrip).not.toContain(paused.id);
    expect(cityStrip.length).toBeLessThanOrEqual(FEATURED_ON_PAGE);
    // Another country never shows them
    expect(await featuredForPage(db, filters({ countryCode: 'AT', locationId: hamburg.id }))).toEqual([]);

    const badges = await featuredListingIds(db, [car.id, phone.id, expired.id]);
    expect([...badges].sort()).toEqual([car.id, phone.id].sort());
    expect((await listingPromotions(db, car.id)).featuredUntil).not.toBeNull();
  });

  it('a refunded featured listing loses its place at once', async () => {
    const { seller, listing } = await sellerWithListing();
    const order = await feature(listing.id, seller.id);
    expect((await featuredListingIds(db, [listing.id])).has(listing.id)).toBe(true);
    await db.update(schema.entitlements).set({ revokedAt: new Date(), revokeReason: 'refund' }).where(eq(schema.entitlements.orderId, order.id));
    expect((await featuredListingIds(db, [listing.id])).has(listing.id)).toBe(false);
  });
});

describe('featured events', () => {
  it('lists live events with a running featured entitlement in the country and city', async () => {
    const [berlin, munich, concerts] = await Promise.all([city('berlin'), city('muenchen'), categoryBySlug('event-concerts')]);
    const seller = await user();
    const mk = async (loc: typeof berlin) => {
      const l = await makeListing(owner, seller.id, { categoryId: concerts.id, priceType: 'free', priceMinor: null, currency: null, locationId: loc.id, point: loc.center });
      await db.insert(schema.eventDetails).values({ listingId: l.id, timeZone: 'Europe/Berlin', venueName: 'سالن', venueNameNormalized: normalizePersian('سالن') });
      await db.insert(schema.eventDates).values({ listingId: l.id, countryCode: 'DE', locationId: loc.id, startsAt: new Date(Date.now() + 5 * DAY), endsAt: new Date(Date.now() + 5 * DAY + 3_600_000) });
      return l;
    };
    const inBerlin = await mk(berlin);
    const inMunich = await mk(munich);
    const plain = await mk(berlin);
    const soon = new Date(Date.now() + 5 * DAY);
    await feature(inBerlin.id, seller.id, new Date(Date.now() - DAY), soon, 'featured-event');
    await feature(inMunich.id, seller.id, new Date(Date.now() - DAY), soon, 'featured-event');
    const all = await featuredEventIds(db, 'DE', null);
    expect(all).toEqual(expect.arrayContaining([inBerlin.id, inMunich.id]));
    expect(all).not.toContain(plain.id);
    expect(await featuredEventIds(db, 'DE', berlin.id)).toContain(inBerlin.id);
    expect(await featuredEventIds(db, 'DE', berlin.id)).not.toContain(inMunich.id);
    expect(await featuredEventIds(db, 'AT', null)).not.toContain(inBerlin.id);
  });
});

describe('my orders', () => {
  it('shows a buyer only their own orders; unfinished checkouts only while Stripe’s page is open', async () => {
    const gateway = new FakeGateway();
    const { seller, listing } = await sellerWithListing();
    const other = await user();
    const r = await startListingCheckout(appDb, gateway, { userId: seller.id, listingId: listing.id, productCode: 'bump-1', waiver: true, appUrl: APP_URL });
    const orderId = r.ok ? r.orderId! : '';
    expect(await ownOrder(appDb, other.id, orderId)).toBeNull();
    expect(await ownOrder(appDb, seller.id, 'not-a-uuid')).toBeNull();
    expect(await ownOrder(appDb, seller.id, orderId)).toMatchObject({ status: 'pending', productCode: 'bump-1', listingId: listing.id });
    // An hour for «ادامهٔ پرداخت» (wave 1), then left out
    expect((await ownOrders(appDb, seller.id)).map((o) => [o.id, o.status])).toEqual([[orderId, 'pending']]);
    await db.update(schema.orders).set({ createdAt: new Date(Date.now() - 2 * 3_600_000) }).where(eq(schema.orders.id, orderId));
    expect(await ownOrders(appDb, seller.id)).toEqual([]);
    const order = await orderRow(orderId);
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('checkout.session.completed', paidSession(order, gateway.checkouts[0]!.id))));
    expect((await ownOrders(appDb, seller.id)).map((o) => o.id)).toEqual([orderId]);
    expect(await ownOrders(appDb, other.id)).toEqual([]);
  });

  it('the worker closes checkouts left open for two days', async () => {
    const gateway = new FakeGateway();
    const { seller, listing } = await sellerWithListing();
    const r = await startListingCheckout(appDb, gateway, { userId: seller.id, listingId: listing.id, productCode: 'bump-1', waiver: true, appUrl: APP_URL });
    const orderId = r.ok ? r.orderId! : '';
    await db.update(schema.orders).set({ createdAt: new Date(Date.now() - 3 * DAY) }).where(eq(schema.orders.id, orderId));
    expect(await expireStaleOrders(workerDb)).toBeGreaterThanOrEqual(1);
    expect((await orderRow(orderId)).status).toBe('expired');
  });
});
