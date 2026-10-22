import { sql } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { normalizePersian } from '../src/lib/normalize-persian';
import { hit } from '../src/lib/rate-limit';
import { cachedCatalog, isEventCategory, subtreeIds, type Catalog } from '../src/modules/listings/catalog';
import { countListings, type SearchFilters } from '../src/modules/search/browse';
import { browseQuery, filterContext, parseBrowseParams } from '../src/modules/search/filters';
import { keywordSearch } from '../src/modules/search/keyword';
import { Meili } from '../src/modules/search/meili';
import { phraseCounts, phraseRecords, phraseScope, rebuildPhrases, type PhraseDocument } from '../src/modules/search/phrases';
import { findSuggestions, MAX_ROWS, nameMatches, SUGGEST_LIMIT, suggestParams, suggestions, type Found, type PhraseHit, type Suggestion, type SuggestScope } from '../src/modules/search/suggest';
import { syncListings } from '../src/modules/search/sync';
import { category, location, makeListing, makeUser, rollback, type Tx } from './db';
import { indexName, meili, testIndex } from './meili';

// Suggestions while typing (approved Oct 22, 2026), like Divar: phrases (categories, makes,
// makes + models) from their own index with live counts, a category typed first narrows them, then
// the keyword in the categories with matching listings; from the category tree when Meilisearch
// can't answer.

let catalog: Catalog;
const id = (slug: string) => catalog.bySlug.get(slug)!.id;
const germany: SuggestScope = { country: { code: 'DE', slug: 'germany', nameFa: 'آلمان', minorUnit: 2 }, city: null };

beforeAll(async () => {
  catalog = await cachedCatalog((await import('./db')).db);
});

const kinds = (rows: { kind: string }[]) => rows.map((r) => r.kind);
const hrefs = (rows: Suggestion[]) => rows.map((r) => r.href);
const enc = encodeURIComponent;

// ---------------------------------------------------------------------------
// Phrase records
// ---------------------------------------------------------------------------

describe('phrase records', () => {
  const row = (over: Partial<{ country: string; location: string | null; category: string; brand: string | null; model: string | null; n: number }>) => ({
    country: 'DE',
    location: null,
    category: id('cars'),
    brand: null,
    model: null,
    n: 1,
    ...over,
  });
  const find = (docs: PhraseDocument[], scope: string, kind: string, categoryId: string, value?: string) =>
    docs.find((d) => d.scope === scope && d.kind === kind && d.category_id === categoryId && (value === undefined || d.model === value || (kind === 'make' && d.brand === value)));

  it('every category level, makes and models, counted per country and city', () => {
    const berlin = randomUUID();
    const docs = phraseRecords(catalog, [
      row({ location: berlin, brand: 'peugeot', model: 'peugeot-206', n: 3 }),
      row({ location: null, brand: 'peugeot', model: 'peugeot-207', n: 1 }),
      row({ location: berlin, brand: 'bmw', model: null, n: 2 }),
      row({ category: id('mobile-phones'), brand: 'samsung', n: 4 }),
    ]);
    const vehicles = catalog.byId.get(id('cars'))!.parentId!;
    expect(find(docs, 'DE', 'category', id('cars'))).toMatchObject({ label: 'خودرو', count: 6, phrase: normalizePersian('خودرو'), latin: 'cars' });
    expect(find(docs, 'DE', 'category', vehicles)).toMatchObject({ count: 6 });
    expect(find(docs, 'DE', 'make', id('cars'), 'peugeot')).toMatchObject({ label: 'پژو', count: 4, brand: 'peugeot', model: null, latin: 'peugeot' });
    expect(find(docs, 'DE', 'model', id('cars'), 'peugeot-206')).toMatchObject({ label: 'پژو 206', count: 3, latin: 'peugeot peugeot 206' });
    expect(find(docs, 'DE', 'make', id('mobile-phones'), 'samsung')).toMatchObject({ count: 4, label: 'سامسونگ' });
    // The city's own set
    const inBerlin = phraseScope('DE', berlin);
    expect(find(docs, inBerlin, 'category', id('cars'))).toMatchObject({ count: 5 });
    expect(find(docs, inBerlin, 'model', id('cars'), 'peugeot-206')).toMatchObject({ count: 3 });
    expect(find(docs, inBerlin, 'model', id('cars'), 'peugeot-207')).toBeUndefined();
    // The category path is searchable with every record
    expect(find(docs, 'DE', 'model', id('cars'), 'peugeot-206')!.category_text).toContain(normalizePersian('خودرو'));
  });

  it('never «سایر», a model of another make, an unknown value, an event or a category that is gone', () => {
    const event = [...catalog.byId.values()].find((c) => isEventCategory(catalog, c.id) && c.childIds.length === 0)!;
    const docs = phraseRecords(catalog, [
      row({ brand: 'other', n: 2 }),
      row({ brand: 'peugeot', model: 'peugeot-other-model' }),
      row({ brand: 'peugeot', model: 'bmw-x5' }),
      row({ brand: 'no-such-make' }),
      row({ category: event.id }),
      row({ category: randomUUID() }),
    ]);
    expect(docs.filter((d) => d.kind !== 'category')).toEqual([
      expect.objectContaining({ kind: 'make', brand: 'peugeot', count: 2 }),
    ]);
    expect(docs.some((d) => d.category_id === event.id)).toBe(false);
    // Stable ids and order: the same counts give the same records
    expect(phraseRecords(catalog, [row({ brand: 'peugeot' })])).toEqual(phraseRecords(catalog, [row({ brand: 'peugeot' })]));
  });

  it('counts exactly what the page the phrase opens counts', async () => {
    await rollback(async (tx) => {
      const u = await makeUser(tx);
      const cars = await category(tx, 'cars');
      const hamburg = await location(tx, 'hamburg');
      const car = (brand: string, model: string, over = {}) => makeListing(tx, u.id, { categoryId: cars.id, attributes: { brand, model }, ...over });
      await car('peugeot', 'peugeot-206');
      await car('peugeot', 'peugeot-206', { locationId: hamburg.id, point: hamburg.center });
      await car('peugeot', 'peugeot-207');
      await car('peugeot', 'peugeot-206', { status: 'paused' });
      const docs = phraseRecords(catalog, await phraseCounts(tx));
      const page = (attributes: SearchFilters['attributes'], locationId: string | null = null) =>
        countListings(tx, { countryCode: 'DE', keyword: null, categoryIds: subtreeIds(catalog, cars.id), locationId, postalCode: null, around: null, price: null, shipping: false, attributes, sort: 'newest' });
      const brand = { key: 'brand', type: 'select' as const, values: ['peugeot'] };
      const model = { key: 'model', type: 'select' as const, values: ['peugeot-206'] };
      expect(find(docs, 'DE', 'make', cars.id, 'peugeot')!.count).toBe(await page([brand]));
      expect(find(docs, 'DE', 'model', cars.id, 'peugeot-206')!.count).toBe(await page([brand, model]));
      expect(find(docs, phraseScope('DE', hamburg.id), 'model', cars.id, 'peugeot-206')!.count).toBe(await page([brand, model], hamburg.id));
      expect(find(docs, 'DE', 'category', cars.id)!.count).toBe(await page([]));
    });
  });
});

// ---------------------------------------------------------------------------
// The rows (no Meilisearch needed)
// ---------------------------------------------------------------------------

describe('the rows', () => {
  const hit = (over: Partial<PhraseHit>): PhraseHit => ({ kind: 'make', category_id: id('cars'), brand: 'peugeot', model: null, label: 'پژو', count: 5, _matchesPosition: { phrase: [] }, ...over });
  const found = (phrases: PhraseHit[], counts: [string, number][] = []): Found => ({ phrases, counts: new Map(counts) });

  it('nothing below two characters', () => {
    expect(suggestions(catalog, germany, 'ب', null)).toEqual([]);
    expect(suggestions(catalog, germany, ' ‌ ', null)).toEqual([]);
    expect(suggestions(catalog, germany, 'ب', found([hit({})]))).toEqual([]);
  });

  it('the search as typed first, then phrases with their category and count, then the keyword in other categories', () => {
    const rows = suggestions(
      catalog,
      germany,
      ' پژو ',
      found(
        [hit({}), hit({ kind: 'model', model: 'peugeot-206', label: 'پژو 206', count: 3 }), hit({ kind: 'category', category_id: id('cars'), brand: null, label: 'خودرو', count: 9 })],
        [[id('cars'), 4], [id('phone-accessories'), 2], ['not-a-category', 9]],
      ),
    );
    expect(rows).toEqual([
      { kind: 'search', q: 'پژو', where: null, href: `/germany?q=${enc('پژو')}` },
      { kind: 'field', label: 'پژو', where: 'خودرو', count: 5, href: '/germany/cars?brand=peugeot' },
      { kind: 'field', label: 'پژو 206', where: 'خودرو', count: 3, href: '/germany/cars?brand=peugeot&model=peugeot-206' },
      { kind: 'category', label: 'خودرو', parent: 'وسایل نقلیه', count: 9, href: '/germany/cars' },
      // خودرو already has rows of its own
      { kind: 'in', q: 'پژو', where: catalog.byId.get(id('phone-accessories'))!.nameFa, count: 2, href: `/germany/phone-accessories?q=${enc('پژو')}` },
    ]);
  });

  it('no keyword row under a category that already has a row', () => {
    const vehicles = catalog.byId.get(id('cars'))!.parentId!;
    const rows = suggestions(catalog, germany, 'وسایل', found([hit({ kind: 'category', category_id: vehicles, brand: null, label: 'وسایل نقلیه' })], [[id('cars'), 3], [id('mobile-phones'), 1]]));
    expect(hrefs(rows)).toEqual([`/germany?q=${enc('وسایل')}`, '/germany/vehicles', `/germany/mobile-phones?q=${enc('وسایل')}`]);
  });

  it('a phrase found only through its category name is left out', () => {
    const rows = suggestions(catalog, germany, 'خودرو', found([hit({ _matchesPosition: { category_text: [] } }), hit({ kind: 'category', brand: null, label: 'خودرو', _matchesPosition: { phrase: [] } })]));
    expect(kinds(rows)).toEqual(['search', 'category']);
    // The Latin key counts as the phrase
    expect(kinds(suggestions(catalog, germany, 'peugeot', found([hit({ _matchesPosition: { latin: [] } })])))).toEqual(['search', 'field']);
  });

  it('phrases whose category or option is gone are left out', () => {
    const rows = suggestions(catalog, germany, 'پژو', found([hit({ category_id: randomUUID() }), hit({ brand: 'no-such-make' }), hit({ kind: 'model', model: 'no-such-model' })]));
    expect(kinds(rows)).toEqual(['search']);
  });

  it('at most seven rows', () => {
    const many = Array.from({ length: 10 }, (_, i) => hit({ kind: 'model', model: ['peugeot-107', 'peugeot-206', 'peugeot-207', 'peugeot-208', 'peugeot-307', 'peugeot-308', 'peugeot-508', 'peugeot-2008'][i % 8], count: 10 - i }));
    const rows = suggestions(catalog, germany, 'پژو', found(many, [[id('mobile-phones'), 3]]));
    expect(rows).toHaveLength(MAX_ROWS);
    expect(new Set(hrefs(rows)).size).toBe(rows.length);
  });

  it('in a city, every row stays in that city', () => {
    const berlin: SuggestScope = { ...germany, city: { id: randomUUID(), slug: 'berlin', nameFa: 'برلین' } };
    const rows = suggestions(catalog, berlin, 'پژو', found([hit({})], [[id('mobile-phones'), 1]]));
    expect(rows[0]).toMatchObject({ kind: 'search', where: 'برلین', href: `/germany/berlin?q=${enc('پژو')}` });
    expect(hrefs(rows).slice(1)).toEqual(['/germany/berlin/cars?brand=peugeot', `/germany/berlin/mobile-phones?q=${enc('پژو')}`]);
  });

  it('the keyword as the keyword page reads it (trimmed, at most ten words)', () => {
    const typed = Array.from({ length: 12 }, (_, i) => `واژه${i}`).join('  ');
    const q = suggestions(catalog, germany, typed, null)[0] as Suggestion & { kind: 'search' };
    expect(q.q.split(' ')).toHaveLength(10);
  });

  it('every field row is exactly the address the page itself would write', () => {
    const rows = suggestions(catalog, germany, 'پژو', found([hit({}), hit({ kind: 'model', model: 'peugeot-206', label: 'پژو 206' })])).filter((r) => r.kind === 'field');
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      const [path, query] = r.href.split('?');
      const ctx = filterContext(catalog, catalog.bySlug.get(path!.split('/')[2]!)!, 2);
      const { state, refused } = parseBrowseParams(Object.fromEntries(new URLSearchParams(query)), ctx);
      expect(refused).toEqual([]);
      expect(browseQuery(state, 2)).toBe(`?${query}`);
    }
  });

  describe('without Meilisearch, from the category tree, without counts', () => {
    it('categories by name, synonyms, Arabic letters and spacing included', () => {
      const car = suggestions(catalog, germany, 'ماشين', null).find((r) => r.kind === 'category');
      expect(car).toEqual({ kind: 'category', label: 'خودرو', parent: 'وسایل نقلیه', count: null, href: '/germany/cars' });
      for (const typed of ['لپتاپ', 'لپ تاپ', 'لپ‌تا']) {
        expect(suggestions(catalog, germany, typed, null), typed).toContainEqual(expect.objectContaining({ kind: 'category', href: '/germany/laptops' }));
      }
    });

    it('makes before models, Persian digits and Latin keys too', () => {
      const benz = suggestions(catalog, germany, 'بنز', null).filter((r) => r.kind === 'field');
      expect(benz[0]).toEqual({ kind: 'field', label: 'مرسدس بنز', where: 'خودرو', count: null, href: '/germany/cars?brand=mercedes_benz' });
      expect(suggestions(catalog, germany, '۲۰۶', null).find((r) => r.kind === 'field')).toMatchObject({ label: 'پژو 206', href: '/germany/cars?brand=peugeot&model=peugeot-206' });
      expect(suggestions(catalog, germany, 'samsu', null).some((r) => r.kind === 'field' && r.href.includes('brand=samsung'))).toBe(true);
      expect(kinds(suggestions(catalog, germany, 'بنز', null))).not.toContain('in');
    });

    it('matches a name or one of its words from the start, normalized', () => {
      expect(nameMatches('قطعات و لوازم خودرو', 'لوازم خو')).toBe(true);
      expect(nameMatches('مرسدس بنز', 'بنز')).toBe(true);
      expect(nameMatches('ب‌ام‌و', 'بام')).toBe(true);
      expect(nameMatches('مرسدس بنز', 'رسدس')).toBe(false);
      expect(nameMatches('سری ۳', 'سری 3')).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Against Meilisearch: the phrase index and the listings
// ---------------------------------------------------------------------------

describe('with Meilisearch', () => {
  /**
   * Runs fn with a phrase index built from exactly these listings (every other active listing is
   * paused inside the transaction) and a listings index holding them.
   */
  async function withListings(fn: (ctx: { tx: Tx; ask: (q: string, scope?: SuggestScope) => Promise<Suggestion[]>; indexes: { listings: string; suggestions: string }; hamburg: { id: string } }) => Promise<void>) {
    await rollback(async (tx) => {
      await tx.execute(sql`UPDATE listings SET status = 'paused' WHERE status = 'active'`);
      const u = await makeUser(tx);
      const cars = await category(tx, 'cars');
      const phones = await category(tx, 'mobile-phones');
      const hamburg = await location(tx, 'hamburg');
      const car = (brand: string, model: string, title: string, over = {}) =>
        makeListing(tx, u.id, { categoryId: cars.id, attributes: { brand, model }, title, titleNormalized: normalizePersian(title), ...over });
      const made = [
        await car('peugeot', 'peugeot-206', 'پژو ۲۰۶ تمیز'),
        await car('peugeot', 'peugeot-206', 'پژو ۲۰۶ تیپ ۵'),
        await car('peugeot', 'peugeot-206', 'پژو ۲۰۶ سفید'),
        await car('peugeot', 'peugeot-207', 'پژو ۲۰۷', { locationId: hamburg.id, point: hamburg.center }),
        await car('volkswagen', 'vw-golf', 'گلف هفت'),
        await car('kia', 'kia-rio', 'کیا ریو'),
        await makeListing(tx, u.id, { categoryId: phones.id, attributes: { brand: 'samsung' }, title: 'گوشی سامسونگ با قاب پژو', titleNormalized: normalizePersian('گوشی سامسونگ با قاب پژو') }),
      ];
      const indexes = { listings: await testIndex(`sg_l_${randomUUID().slice(0, 6)}`), suggestions: indexName(`sg_p_${randomUUID().slice(0, 6)}`) };
      const r = await syncListings(tx, meili, indexes.listings, catalog, made.map((l) => l.id));
      for (const t of r.tasks) await meili.wait(t);
      await rebuildPhrases(tx, meili, indexes.suggestions, catalog);
      const ask = async (q: string, scope = germany) => suggestions(catalog, scope, q, await findSuggestions(meili, indexes, scope, q));
      await fn({ tx, ask, indexes, hamburg });
    });
  }

  it('completes a make with its models, most listings first, each with its category and count', async () => {
    await withListings(async ({ ask }) => {
      const rows = await ask('پژو');
      expect(rows.slice(0, 4)).toEqual([
        expect.objectContaining({ kind: 'search', q: 'پژو' }),
        { kind: 'field', label: 'پژو', where: 'خودرو', count: 4, href: '/germany/cars?brand=peugeot' },
        { kind: 'field', label: 'پژو 206', where: 'خودرو', count: 3, href: '/germany/cars?brand=peugeot&model=peugeot-206' },
        { kind: 'field', label: 'پژو 207', where: 'خودرو', count: 1, href: '/germany/cars?brand=peugeot&model=peugeot-207' },
      ]);
      // A model without listings is never suggested
      expect(hrefs(rows).some((h) => h.includes('peugeot-208'))).toBe(false);
      // The phone that mentions پژو: the keyword in its category, not a phrase
      expect(rows.at(-1)).toMatchObject({ kind: 'in', where: 'گوشی موبایل', count: 1 });
    });
  });

  it('a number being typed completes the model, in Persian or Latin digits', async () => {
    await withListings(async ({ ask }) => {
      for (const typed of ['پژو ۲', 'پژو 2', 'پژو ۲۰']) {
        const fields = (await ask(typed)).filter((r) => r.kind === 'field');
        expect(fields.map((r) => r.label), typed).toEqual(['پژو 206', 'پژو 207']);
      }
      expect((await ask('peugeot 20')).filter((r) => r.kind === 'field').map((r) => r.label)).toEqual(['پژو 206', 'پژو 207']);
    });
  });

  it('a category typed first lists categories; going on narrows to its phrases', async () => {
    await withListings(async ({ ask }) => {
      const cat = await ask('خودرو');
      expect(cat.filter((r) => r.kind !== 'in' && r.kind !== 'search').map((r) => r.kind)).toEqual(['category']);
      expect(cat[1]).toMatchObject({ kind: 'category', label: 'خودرو', count: 6, href: '/germany/cars' });
      const narrowed = await ask('خودرو پژو');
      expect(narrowed.filter((r) => r.kind === 'field').map((r) => r.label)).toEqual(['پژو', 'پژو 206', 'پژو 207']);
      // Synonyms of the category's name work the same way, Arabic letters too
      expect((await ask('ماشين پژو')).filter((r) => r.kind === 'field').map((r) => r.label)).toEqual(['پژو', 'پژو 206', 'پژو 207']);
      expect((await ask('ماشين'))[1]).toMatchObject({ kind: 'category', label: 'خودرو' });
    });
  });

  it('Arabic ي and ك, ZWNJ and spacing', async () => {
    await withListings(async ({ ask }) => {
      expect((await ask('كيا'))[1]).toMatchObject({ kind: 'field', label: 'کیا', count: 1 });
      for (const typed of ['فولکس واگن', 'فولکس‌واگن', 'فولکسواگن', 'فولکس']) {
        expect((await ask(typed))[1], typed).toMatchObject({ kind: 'field', label: 'فولکس‌واگن', href: '/germany/cars?brand=volkswagen' });
      }
      expect((await ask('فولکس‌واگن گلف'))[1]).toMatchObject({ kind: 'field', href: '/germany/cars?brand=volkswagen&model=vw-golf' });
    });
  });

  it('in a city, only its own phrases and counts', async () => {
    await withListings(async ({ ask, hamburg }) => {
      const scope: SuggestScope = { ...germany, city: { id: hamburg.id, slug: 'hamburg', nameFa: 'هامبورگ' } };
      const rows = await ask('پژو', scope);
      expect(rows.filter((r) => r.kind === 'field')).toEqual([
        { kind: 'field', label: 'پژو', where: 'خودرو', count: 1, href: '/germany/hamburg/cars?brand=peugeot' },
        { kind: 'field', label: 'پژو 207', where: 'خودرو', count: 1, href: '/germany/hamburg/cars?brand=peugeot&model=peugeot-207' },
      ]);
      expect(rows.some((r) => r.kind === 'in')).toBe(false);
    });
  });

  it('free text: the keyword in each category with the count its page shows', async () => {
    await withListings(async ({ tx: _tx, ask, indexes }) => {
      const rows = await ask('پژو ۲۰۶ تیپ');
      expect(kinds(rows)).toEqual(['search', 'in']);
      const inCars = rows[1] as Suggestion & { kind: 'in' };
      expect(inCars).toMatchObject({ where: 'خودرو', count: 1, href: `/germany/cars?q=${enc('پژو ۲۰۶ تیپ')}` });
      // The page the row opens: the same keyword, the same filter
      const page = await keywordSearch(meili, indexes.listings, { countryCode: 'DE', keyword: inCars.q, categoryIds: subtreeIds(catalog, id('cars')), locationId: null, postalCode: null, around: null, price: null, shipping: false, attributes: [], sort: 'relevance' }, null);
      expect(page.total).toBe(inCars.count);
    });
  });

  it('a rebuild that would change nothing is skipped; a change rebuilds', async () => {
    await withListings(async ({ tx, indexes }) => {
      expect(await rebuildPhrases(tx, meili, indexes.suggestions, catalog)).toBeNull();
      const u = await makeUser(tx);
      await makeListing(tx, u.id, { categoryId: id('cars'), attributes: { brand: 'peugeot', model: 'peugeot-208' } });
      expect(await rebuildPhrases(tx, meili, indexes.suggestions, catalog)).toBeGreaterThan(0);
      const rows = suggestions(catalog, germany, 'پژو ۲۰۸', await findSuggestions(meili, indexes, germany, 'پژو ۲۰۸'));
      expect(rows[1]).toMatchObject({ label: 'پژو 208', count: 1 });
      // Deleted behind the worker's back: built again even though the records are the same
      await meili.wait(await meili.deleteIndex(indexes.suggestions));
      expect(await rebuildPhrases(tx, meili, indexes.suggestions, catalog)).toBeGreaterThan(0);
      expect(await meili.indexStats(`${indexes.suggestions}_new`)).toBeNull();
    });
  });

  it('when Meilisearch or the phrase index is missing, the lookup fails and the rows come from the tree', async () => {
    const down = new Meili({ url: 'http://127.0.0.1:9', key: 'x' });
    await expect(findSuggestions(down, { listings: 'listings', suggestions: 'suggestions' }, germany, 'پژو')).rejects.toThrow(/unreachable/);
    const listings = await testIndex('sg_missing');
    await expect(findSuggestions(meili, { listings, suggestions: indexName('sg_never_built') }, germany, 'پژو')).rejects.toThrow();
    const rows = suggestions(catalog, germany, 'پژو', null);
    expect(rows[1]).toMatchObject({ kind: 'field', label: 'پژو', count: null });
  });
});

// ---------------------------------------------------------------------------
// The API's limits
// ---------------------------------------------------------------------------

describe('the API', () => {
  const redis = new Redis(process.env.TEST_REDIS_URL!, { maxRetriesPerRequest: 1 });
  afterAll(() => redis.quit());

  it('takes only a country slug, a city slug and up to 200 characters', () => {
    expect(suggestParams.safeParse({ country: 'germany', q: 'پژو' }).success).toBe(true);
    expect(suggestParams.safeParse({ country: 'germany', city: 'berlin', q: '' }).success).toBe(true);
    expect(suggestParams.safeParse({ country: 'Germany', q: 'x' }).success).toBe(false);
    expect(suggestParams.safeParse({ country: 'germany', city: 'ber lin', q: 'x' }).success).toBe(false);
    expect(suggestParams.safeParse({ country: 'germany', q: 'x'.repeat(201) }).success).toBe(false);
    expect(suggestParams.safeParse({ country: 'germany' }).success).toBe(false);
  });

  it('120 a minute per IP, apart from the full searches', async () => {
    const ip = `198.51.100.${Math.floor(Math.random() * 250)}-${randomUUID()}`;
    for (let i = 0; i < SUGGEST_LIMIT.max; i++) expect((await hit(redis, [[SUGGEST_LIMIT, ip]])).ok).toBe(true);
    expect((await hit(redis, [[SUGGEST_LIMIT, ip]])).ok).toBe(false);
    expect(SUGGEST_LIMIT).toMatchObject({ max: 120, windowSeconds: 60 });
    expect(SUGGEST_LIMIT.name).not.toBe('search:ip');
  });
});
