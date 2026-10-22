import { beforeAll, describe, expect, it } from 'vitest';
import { normalizePersian } from '../src/lib/normalize-persian';
import { cachedCatalog, type Catalog } from '../src/modules/listings/catalog';
import { browseQuery, filterContext, parseBrowseParams } from '../src/modules/search/filters';
import { categoryCounts, MAX_ROWS, nameMatches, suggestions, type SuggestScope } from '../src/modules/search/suggest';
import { syncListings } from '../src/modules/search/sync';
import { workerDb } from './accounts';
import { category, db, makeListing, makeUser, type Tx } from './db';
import { meili, testIndex } from './meili';

// Suggestions while typing (approved Oct 22, 2026): the keyword in all listings, the categories
// that have matches (counted by Meilisearch), categories by name, makes and models by name.

let catalog: Catalog;
const id = (slug: string) => catalog.bySlug.get(slug)!.id;
const germany: SuggestScope = { country: { code: 'DE', slug: 'germany', nameFa: 'آلمان', minorUnit: 2 }, city: null };

beforeAll(async () => {
  catalog = await cachedCatalog(db);
});

const kinds = (rows: { kind: string }[]) => rows.map((r) => r.kind);

describe('the rows', () => {
  it('nothing below two characters', () => {
    expect(suggestions(catalog, germany, 'ب', null)).toEqual([]);
    expect(suggestions(catalog, germany, ' ‌ ', null)).toEqual([]);
  });

  it('first the keyword everywhere, then the categories with matches, most first, with counts', () => {
    const rows = suggestions(catalog, germany, 'آيفون ۱۳', new Map([[id('phone-accessories'), 2], [id('mobile-phones'), 7], ['not-a-category', 9]]));
    expect(rows[0]).toEqual({ kind: 'search', q: 'آيفون ۱۳', where: null, href: `/germany?q=${encodeURIComponent('آيفون ۱۳')}` });
    expect(rows.slice(1, 3)).toEqual([
      { kind: 'in', q: 'آيفون ۱۳', where: 'گوشی موبایل', count: 7, href: `/germany/mobile-phones?q=${encodeURIComponent('آيفون ۱۳')}` },
      expect.objectContaining({ kind: 'in', count: 2, href: expect.stringMatching(/^\/germany\/phone-accessories\?q=/) }),
    ]);
  });

  it('categories by name, synonyms and spacing included', () => {
    const car = suggestions(catalog, germany, 'ماشين', null).find((r) => r.kind === 'category');
    expect(car).toEqual({ kind: 'category', label: 'خودرو', parent: 'وسایل نقلیه', href: '/germany/cars' });
    for (const typed of ['لپتاپ', 'لپ تاپ', 'لپ‌تا']) {
      expect(suggestions(catalog, germany, typed, null), typed).toContainEqual(expect.objectContaining({ kind: 'category', href: '/germany/laptops' }));
    }
    expect(suggestions(catalog, germany, 'مبلمان', null)).toContainEqual(expect.objectContaining({ kind: 'category', href: '/germany/living-room' }));
  });

  it('makes and models by name, as filtered category pages in their canonical address', () => {
    const benz = suggestions(catalog, germany, 'بنز', null).filter((r) => r.kind === 'field');
    expect(benz[0]).toEqual({ kind: 'field', label: 'مرسدس بنز', where: 'خودرو', href: '/germany/cars?brand=mercedes_benz' });
    const p206 = suggestions(catalog, germany, '۲۰۶', null).find((r) => r.kind === 'field')!;
    expect(p206).toEqual({ kind: 'field', label: 'پژو 206', where: 'خودرو', href: '/germany/cars?brand=peugeot&model=peugeot-206' });
    // Every field row is exactly the address the page itself would write
    for (const r of [...benz, p206]) {
      const [path, query] = r.href.split('?');
      const ctx = filterContext(catalog, catalog.bySlug.get(path!.split('/')[2]!)!, 2);
      const { state, refused } = parseBrowseParams(Object.fromEntries(new URLSearchParams(query)), ctx);
      expect(refused).toEqual([]);
      expect(browseQuery(state, 2)).toBe(`?${query}`);
    }
    // Latin makes in Latin letters too
    expect(suggestions(catalog, germany, 'samsu', null).some((r) => r.kind === 'field' && r.href.includes('brand=samsung'))).toBe(true);
  });

  it('makes in the categories with the most matches come first', () => {
    const counts = new Map([[id('tablets'), 5], [id('mobile-phones'), 1]]);
    const fields = suggestions(catalog, germany, 'سامسونگ', counts).filter((r) => r.kind === 'field');
    expect(fields[0]).toMatchObject({ href: expect.stringMatching(/^\/germany\/tablets\?brand=samsung/) });
  });

  it('at most eight rows; without Meilisearch the category and field rows still come', () => {
    const many = new Map(['mobile-phones', 'tablets', 'laptops', 'cars', 'phone-accessories', 'cameras'].map((s, i) => [id(s), 10 - i] as [string, number]));
    const rows = suggestions(catalog, germany, 'سامسونگ', many);
    expect(rows.length).toBeLessThanOrEqual(MAX_ROWS);
    expect(kinds(rows).filter((k) => k === 'in')).toHaveLength(4);
    const down = suggestions(catalog, germany, 'بنز', null);
    expect(kinds(down)).toContain('field');
    expect(kinds(down)).not.toContain('in');
  });

  it('in a city, the keyword row and the category rows stay in that city', () => {
    const berlin: SuggestScope = { ...germany, city: { id: 'x', slug: 'berlin', nameFa: 'برلین' } };
    const rows = suggestions(catalog, berlin, 'ماشین', new Map([[id('cars'), 3]]));
    expect(rows[0]).toMatchObject({ kind: 'search', where: 'برلین', href: `/germany/berlin?q=${encodeURIComponent('ماشین')}` });
    expect(rows[1]).toMatchObject({ kind: 'in', href: `/germany/berlin/cars?q=${encodeURIComponent('ماشین')}` });
    expect(rows.find((r) => r.kind === 'category')).toMatchObject({ href: '/germany/berlin/cars' });
  });

  it('matches a name or one of its words from the start, normalized', () => {
    expect(nameMatches('قطعات و لوازم خودرو', 'لوازم خو')).toBe(true);
    expect(nameMatches('مرسدس بنز', 'بنز')).toBe(true);
    expect(nameMatches('ب‌ام‌و', 'بام')).toBe(true);
    expect(nameMatches('مرسدس بنز', 'رسدس')).toBe(false);
    expect(nameMatches('سری ۳', 'سری 3')).toBe(true);
  });
});

describe('counts from Meilisearch', () => {
  it('per category, counts only, in the scope asked', async () => {
    const index = await testIndex('suggest');
    const tx = db as unknown as Tx;
    const u = await makeUser(tx);
    const word = `هانوفر${normalizePersian('ک')}`;
    const cars = await category(tx, 'cars');
    const a = await makeListing(tx, u.id, { title: `ماشین ${word}`, titleNormalized: normalizePersian(`ماشین ${word}`), categoryId: cars.id, attributes: { brand: 'bmw' } });
    const b = await makeListing(tx, u.id, { title: `ماشین ${word} دو`, titleNormalized: normalizePersian(`ماشین ${word} دو`), categoryId: cars.id, attributes: { brand: 'bmw' } });
    const c = await makeListing(tx, u.id, { title: `گوشی ${word}`, titleNormalized: normalizePersian(`گوشی ${word}`) });
    const r = await syncListings(workerDb, meili, index, catalog, [a.id, b.id, c.id]);
    for (const t of r.tasks) await meili.wait(t);
    // A word still being typed matches as a prefix
    const counts = await categoryCounts(meili, index, germany, word.slice(0, -1));
    expect(Object.fromEntries(counts)).toEqual({ [cars.id]: 2, [c.categoryId!]: 1 });
    expect((await categoryCounts(meili, index, { ...germany, country: { ...germany.country, code: 'AT' } }, word)).size).toBe(0);
  });
});
