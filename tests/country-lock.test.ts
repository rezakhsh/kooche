import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cachedCatalog } from '../src/modules/listings/catalog';
import { createDraft, listingInputSchema, saveListing, type ListingInput } from '../src/modules/listings/listings';
import { postingCountry } from '../src/modules/listings/posting-country';
import { browseListings, categoryCounts } from '../src/modules/search/browse';
import { appDb } from './accounts';
import { categoryBySlug, listing, user, openEverywhereForTests } from './listings-fixtures';

// The country is fixed when posting (decided Oct 17, 2026): the posting form shows it as text,
// the save action decides it on the server, and saveListing() refuses any other country for a
// listing that has one. Also the country page's category filter (approved the same day).

async function input(over: Partial<ListingInput> = {}): Promise<ListingInput> {
  return listingInputSchema.parse({
    title: 'دوچرخه شهری ۲۸ اینچ',
    description: 'سالم، با چراغ و قفل. فقط تحویل حضوری.',
    attributes: { condition: 'used' },
    priceType: 'fixed',
    amount: '120',
    countryCode: 'DE',
    place: '12045',
    ...over,
  });
}

async function draft(userId: string, slug = 'bicycles') {
  const r = await createDraft(appDb, { userId, categoryId: (await categoryBySlug(slug)).id });
  if (!r.ok) throw new Error(r.reason);
  return r.listingId;
}


// Since wave 0 only the Berlin area is open and Austria is closed; this file is about other rules
let closeAgain: () => Promise<void>;
beforeAll(async () => {
  closeAgain = await openEverywhereForTests();
});
afterAll(async () => {
  await closeAgain();
});

describe('which country a listing is posted in', () => {
  const open = ['DE', 'AT'];
  it('a listing keeps its own country, whatever the visitor chose since', () => {
    expect(postingCountry({ listingCountry: 'DE', chosen: 'AT', saved: 'AT', open })).toBe('DE');
  });
  it('a new listing takes the chosen country before the saved place’s', () => {
    expect(postingCountry({ listingCountry: null, chosen: 'AT', saved: 'DE', open })).toBe('AT');
    expect(postingCountry({ listingCountry: null, chosen: null, saved: 'DE', open })).toBe('DE');
  });
  it('a closed country is never taken; without any, the seller must choose first', () => {
    expect(postingCountry({ listingCountry: null, chosen: 'TR', saved: 'AT', open })).toBe('AT');
    expect(postingCountry({ listingCountry: null, chosen: 'TR', saved: null, open })).toBeNull();
    expect(postingCountry({ listingCountry: null, chosen: null, saved: null, open })).toBeNull();
  });
  it('with one open country and nothing chosen, that one (wave 1)', () => {
    expect(postingCountry({ listingCountry: null, chosen: null, saved: null, open: ['DE'] })).toBe('DE');
    expect(postingCountry({ listingCountry: null, chosen: 'TR', saved: null, open: ['DE'] })).toBe('DE');
  });
});

describe('the server refuses another country', () => {
  it('a live listing in Germany cannot be moved to Austria', async () => {
    const u = await user();
    const id = await draft(u.id);
    expect(await saveListing(appDb, { userId: u.id, listingId: id, input: await input(), intent: 'publish' })).toMatchObject({ ok: true });
    const before = await listing(id);

    const moved = await saveListing(appDb, { userId: u.id, listingId: id, input: await input({ countryCode: 'AT', place: '8010' }), intent: 'save' });
    expect(moved).toMatchObject({ ok: false, reason: 'invalid', errors: { countryCode: 'locked' } });
    // Lower case or not, it is still another country
    const lower = await saveListing(appDb, { userId: u.id, listingId: id, input: await input({ countryCode: 'at', place: '8010' }), intent: 'save' });
    expect(lower).toMatchObject({ ok: false, errors: { countryCode: 'locked' } });

    const after = await listing(id);
    expect(after).toMatchObject({ countryCode: 'DE', currency: 'EUR', postalCode: '12045', revision: before.revision });
  });

  it('a saved draft keeps its country too; a save without a country keeps it', async () => {
    const u = await user();
    const id = await draft(u.id);
    expect(await saveListing(appDb, { userId: u.id, listingId: id, input: await input({ countryCode: 'AT', place: '8010' }), intent: 'save' })).toMatchObject({ ok: true });
    expect(await saveListing(appDb, { userId: u.id, listingId: id, input: await input(), intent: 'publish' })).toMatchObject({
      ok: false,
      errors: { countryCode: 'locked' },
    });
    expect(await saveListing(appDb, { userId: u.id, listingId: id, input: await input({ countryCode: '', place: '8010' }), intent: 'publish' })).toMatchObject({ ok: true });
    expect(await listing(id)).toMatchObject({ countryCode: 'AT', status: 'active', postalCode: '8010' });
  });

  it('a draft without a country yet takes the one it is given', async () => {
    const u = await user();
    const id = await draft(u.id);
    expect((await listing(id)).countryCode).toBeNull();
    expect(await saveListing(appDb, { userId: u.id, listingId: id, input: await input({ countryCode: 'AT', place: '8010' }), intent: 'publish' })).toMatchObject({ ok: true });
    expect((await listing(id)).countryCode).toBe('AT');
  });
});

describe('the country page by category', () => {
  it('a category shows its own listings and those of every category below it, with counts up the tree', async () => {
    const u = await user();
    const bike = await draft(u.id, 'bicycles');
    await saveListing(appDb, { userId: u.id, listingId: bike, input: await input({ place: '8010', countryCode: 'AT' }), intent: 'publish' });
    const phone = await draft(u.id, 'mobile-phones');
    const phoneInput = await input({
      countryCode: 'AT',
      place: '8010',
      title: 'گوشی سامسونگ گلکسی',
      attributes: { condition: 'used', brand: 'samsung', storage_gb: 128 },
    });
    expect(await saveListing(appDb, { userId: u.id, listingId: phone, input: phoneInput, intent: 'publish' })).toMatchObject({ ok: true });

    const catalog = await cachedCatalog(appDb);
    const electronics = catalog.bySlug.get('electronics')!;
    const below = (id: string): string[] => [id, ...catalog.byId.get(id)!.childIds.flatMap(below)];
    const page = await browseListings(
      appDb,
      { countryCode: 'AT', keyword: null, categoryIds: below(electronics.id), locationId: null, postalCode: null, around: null, price: null, shipping: false, attributes: [], sort: 'newest' },
      null,
    );
    const ids = page.items.map((l) => l.id);
    expect(ids).toContain(phone);
    expect(ids).not.toContain(bike);
    expect(page.items.find((l) => l.id === phone)).toMatchObject({ kind: 'offer', photoCount: 0 });

    const counts = await categoryCounts(appDb, 'AT');
    expect(counts.get((await categoryBySlug('mobile-phones')).id)).toBeGreaterThanOrEqual(1);
    expect(counts.get(electronics.id)).toBeUndefined(); // only leaves; the page adds them up
  });
});
