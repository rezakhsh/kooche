import { describe, expect, it } from 'vitest';
import { niceStep, typicalPrice } from '../src/modules/search/browse';
import { joinDateParts, parseBrowseParams, filterContext } from '../src/modules/search/filters';
import { countForForm } from '../src/modules/search/form-count';
import { cachedCatalog } from '../src/modules/listings/catalog';
import { appDb } from './accounts';
import { db, makeListing, makeUser, type Tx } from './db';
import { categoryBySlug, city } from './listings-fixtures';

// The filter sheet (wave 1, mockup final/filters): the live count on its button, the typical-price
// hint, and day / month / year date fields in the filters

const owner = db as unknown as Tx;
const SECRET = 'test-secret-test-secret-test-secret-0123';

async function rooms(citySlug: string, euros: number[]) {
  const place = await city(citySlug);
  const category = await categoryBySlug('shared-rooms');
  const seller = await makeUser(owner);
  for (const e of euros) {
    await makeListing(owner, seller.id, { categoryId: category.id, locationId: place.id, point: place.center, priceMinor: e * 100 });
  }
  return { place, category };
}

describe('the count on the filter button', () => {
  it('counts what the form would show, before it is sent', async () => {
    await rooms('augsburg', [400, 500, 600, 700, 800, 900, 1000, 1100]);
    const n = (raw: Record<string, string>, path = '/germany/augsburg/shared-rooms') => countForForm(appDb, path, raw, SECRET);
    expect(await n({})).toBe(8);
    expect(await n({ price_max: '700' })).toBe(4);
    expect(await n({ price_min: '650', price_max: '950' })).toBe(3);
    // The city select replaces the path's city; an empty one means the whole country
    expect(await n({ city: '' })).toBeGreaterThanOrEqual(8);
    expect(await n({ city: 'kassel' })).toBe(0);
  });

  it('answers nothing for an address that isn’t a browse page', async () => {
    expect(await countForForm(appDb, '/nowhere', {}, SECRET)).toBeNull();
    expect(await countForForm(appDb, '/germany/augsburg/no-such-category', {}, SECRET)).toBeNull();
    expect(await countForForm(appDb, 'germany', {}, SECRET)).toBeNull();
  });
});

describe('the typical price', () => {
  it('is the middle half of the prices, rounded outwards, from eight listings on', async () => {
    const { place, category } = await rooms('karlsruhe', [400, 500, 600, 700, 800, 900, 1000, 1100]);
    expect(await typicalPrice(appDb, { countryCode: 'DE', categoryIds: [category.id], locationId: place.id })).toEqual({ low: 50_000, high: 90_000 });
    const few = await rooms('mannheim', [450, 550]);
    expect(await typicalPrice(appDb, { countryCode: 'DE', categoryIds: [few.category.id], locationId: few.place.id })).toBeNull();
    expect(await typicalPrice(appDb, { countryCode: 'DE', categoryIds: null, locationId: place.id })).toBeNull();
  });

  it('rounds to steps that read well', () => {
    expect(niceStep(48_700, 'down')).toBe(48_000);
    expect(niceStep(74_200, 'up')).toBe(75_000);
    expect(niceStep(1_290_000, 'up')).toBe(1_300_000);
    expect(niceStep(2_350, 'down')).toBe(2_000);
  });
});

describe('date filters typed as day / month / year', () => {
  it('join into the filter’s ISO day, and stay invalid when a part is missing', async () => {
    expect(joinDateParts({ 'available_from_from.day': '1', 'available_from_from.month': '12', 'available_from_from.year': '2026', q: 'x' })).toEqual({
      available_from_from: '2026-12-01',
      q: 'x',
    });
    expect(joinDateParts({ 'a.day': '', 'a.month': '', 'a.year': '' })).toEqual({});
    expect(joinDateParts({ 'a.day': '', 'a.month': '3', 'a.year': '2027' })).toEqual({ a: '2027-3-' });
    const catalog = await cachedCatalog(appDb);
    const ctx = filterContext(catalog, catalog.byId.get((await categoryBySlug('shared-rooms')).id)!, 2);
    const { state } = parseBrowseParams({ 'available_from_from.day': '1', 'available_from_from.month': '12', 'available_from_from.year': '2026' }, ctx);
    expect(state.attributes).toEqual([expect.objectContaining({ key: 'available_from', type: 'date', from: '2026-12-01' })]);
  });
});
