import { eq, sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { cachedCatalog, type Catalog } from '../src/modules/listings/catalog';
import { activeCountries } from '../src/modules/listings/queries';
import {
  deleteSavedSearch,
  isSaved,
  listSavedSearches,
  resolveTarget,
  saveSearch,
  SAVED_SEARCHES_PER_USER,
  searchByUnsubscribeToken,
  searchFiltersOf,
  unsubscribeByToken,
  updateSavedSearch,
} from '../src/modules/search/saved';
import { appDb } from './accounts';
import { db, expectError, INSUFFICIENT_PRIVILEGE, rollback, setRole } from './db';
import { user } from './listings-fixtures';

// Saved searches (approved Oct 22, 2026): only a browse page's exact canonical address can be
// saved, each user sees and changes only their own, at most 20, never "near me". Run as
// classifieds_app, like the web app.

let catalog: Catalog;
beforeAll(async () => {
  catalog = await cachedCatalog(appDb);
});

async function target(path: string, query = '') {
  const t = await resolveTarget(appDb, catalog, path, query);
  if (!t) throw new Error(`not a page: ${path}${query}`);
  return t;
}

async function saved(userId: string) {
  return db.select().from(schema.savedSearches).where(eq(schema.savedSearches.userId, userId));
}

describe('what can be saved', () => {
  it('a browse page by its canonical address, read the way the page reads it', async () => {
    const t = await target('/germany/berlin/cars', `?q=${encodeURIComponent('پژو ۲۰۶')}&price=..5000&brand=bmw`);
    expect(t.country.code).toBe('DE');
    expect(t.city?.slug).toBe('berlin');
    expect(t.category?.slug).toBe('cars');
    expect(t.state).toMatchObject({ q: 'پژو ۲۰۶', sort: 'relevance', price: { min: null, max: 500_000 } });
    expect((await target('/germany')).category).toBeNull();
    expect((await target('/germany/cars', '?sort=price_asc')).state.sort).toBe('price_asc');
  });

  it('anything else is refused: unknown places, events, other parameters, a non-canonical order', async () => {
    const no = (path: string, query = '') => resolveTarget(appDb, catalog, path, query);
    expect(await no('/narnia')).toBeNull();
    expect(await no('/germany/atlantis')).toBeNull();
    expect(await no('/germany/cars/berlin')).toBeNull();
    expect(await no('/germany/event-celebrations')).toBeNull();
    expect(await no('/germany/a/b/c')).toBeNull();
    expect(await no('/germany/cars', '?brand=bmw&price=..5000')).toBeNull(); // not the canonical order
    expect(await no('/germany/cars', '?evil=1')).toBeNull();
    expect(await no('/germany/cars', '?after=abcdefghij')).not.toBeNull(); // a cursor is fine, it isn't kept
    expect(await no('/germany/berlin', '?postal=10115')).toBeNull(); // a postal code moves to the country page
    expect(await no('/germany', 'q=x')).toBeNull();
  });
});

describe('saving', () => {
  it('saves once per search, whatever the sort; a postal radius keeps the area centre', async () => {
    const u = await user();
    const a = await saveSearch(appDb, u.id, await target('/germany/cars', '?q=bmw&postal=10115&r=25'));
    expect(a).toMatchObject({ ok: true, created: true });
    const again = await saveSearch(appDb, u.id, await target('/germany/cars', '?q=bmw&sort=newest&postal=10115&r=25'));
    expect(again).toEqual({ ok: true, id: a.ok && a.id, created: false });
    const [row] = await saved(u.id);
    expect(row).toMatchObject({
      name: 'bmw · خودرو · 10115 (۲۵ km)',
      countryCode: 'DE',
      categoryId: catalog.bySlug.get('cars')!.id,
      locationId: null,
      radiusM: 25_000,
      keywordNormalized: 'bmw',
      notifyFrequency: 'instant',
    });
    expect(row!.point).not.toBeNull();
    expect(row!.unsubscribeToken).toMatch(/^[0-9a-f]{32}$/);
    expect(await isSaved(appDb, u.id, await target('/germany/cars', '?q=bmw&postal=10115&r=25'))).toBe(true);
    expect(await isSaved(appDb, u.id, await target('/germany/cars', '?q=audi'))).toBe(false);
    // Read back as page filters: the stored centre and radius, the category with its children
    const f = searchFiltersOf(catalog, await activeCountries(appDb), { filters: row!.filters, point: { lat: 52.53, lng: 13.38 }, radiusM: row!.radiusM });
    expect(f).toMatchObject({ keyword: 'bmw', around: { radiusM: 25_000 }, postalCode: null, countryCode: 'DE' });
    expect(f!.categoryIds).toContain(catalog.bySlug.get('cars')!.id);
  });

  it('"near me" is never saved, and the limit is 20 per user', async () => {
    const u = await user();
    const t = await target('/germany/cars');
    expect(await saveSearch(appDb, u.id, { ...t, state: { ...t.state, near: { token: 'x'.repeat(30), radiusKm: 10 } } })).toEqual({ ok: false, reason: 'near_not_saveable' });
    for (let i = 0; i < SAVED_SEARCHES_PER_USER; i++) {
      expect(await saveSearch(appDb, u.id, await target('/germany/cars', `?q=w${i}`))).toMatchObject({ ok: true, created: true });
    }
    expect(await saveSearch(appDb, u.id, await target('/germany/cars', '?q=one-more'))).toEqual({ ok: false, reason: 'limit' });
    // One saved before still answers "already saved"
    expect(await saveSearch(appDb, u.id, await target('/germany/cars', '?q=w3'))).toMatchObject({ ok: true, created: false });
    expect(await saved(u.id)).toHaveLength(SAVED_SEARCHES_PER_USER);
  });

  it('a deactivated account cannot save', async () => {
    const u = await user();
    await db.update(schema.users).set({ status: 'deactivated' }).where(eq(schema.users.id, u.id));
    expect(await saveSearch(appDb, u.id, await target('/germany/cars'))).toEqual({ ok: false, reason: 'account_disabled' });
  });
});

describe('only your own', () => {
  it('another user can neither see, rename, change nor delete a saved search', async () => {
    const owner = await user();
    const other = await user();
    const r = await saveSearch(appDb, owner.id, await target('/germany/berlin', '?q=sofa'));
    if (!r.ok) throw new Error('not saved');
    expect(await listSavedSearches(appDb, catalog, other.id)).toEqual([]);
    expect(await updateSavedSearch(appDb, other.id, r.id, { name: 'ربوده' })).toBe(false);
    expect(await updateSavedSearch(appDb, other.id, r.id, { frequency: 'off' })).toBe(false);
    expect(await deleteSavedSearch(appDb, other.id, r.id)).toBe(false);
    expect(await updateSavedSearch(appDb, other.id, 'not-a-uuid', { name: 'x' })).toBe(false);
    const [row] = await saved(owner.id);
    expect(row).toMatchObject({ name: 'sofa · برلین', notifyFrequency: 'instant' });

    const mine = await listSavedSearches(appDb, catalog, owner.id);
    expect(mine).toEqual([expect.objectContaining({ id: r.id, name: 'sofa · برلین', href: '/germany/berlin?q=sofa', frequency: 'instant' })]);
    expect(await updateSavedSearch(appDb, owner.id, r.id, { name: '  مبل   ارزان ' })).toBe(true);
    expect(await updateSavedSearch(appDb, owner.id, r.id, { frequency: 'daily' })).toBe(true);
    expect((await saved(owner.id))[0]).toMatchObject({ name: 'مبل ارزان', notifyFrequency: 'daily' });
    await expect(updateSavedSearch(appDb, owner.id, r.id, { name: 'x'.repeat(61) })).rejects.toThrow();
    expect(await deleteSavedSearch(appDb, owner.id, r.id)).toBe(true);
    expect(await saved(owner.id)).toEqual([]);
  });

  it('the app may read matches but never write them (only the worker does)', async () => {
    await rollback(async (tx) => {
      await setRole(tx, 'classifieds_app');
      await tx.execute(sql`SELECT count(*) FROM saved_search_hits`);
      await expectError(
        tx.execute(sql`INSERT INTO saved_search_hits (saved_search_id, listing_id) VALUES (uuidv7(), uuidv7())`),
        INSUFFICIENT_PRIVILEGE,
      );
    });
  });
});

describe('turning an alert off from its email', () => {
  it('works with the search’s own token only, and changes nothing else', async () => {
    const u = await user();
    const a = await saveSearch(appDb, u.id, await target('/germany/cars', '?q=golf'));
    const b = await saveSearch(appDb, u.id, await target('/germany/cars', '?q=polo'));
    if (!a.ok || !b.ok) throw new Error('not saved');
    const rows = await saved(u.id);
    const tokenA = rows.find((r) => r.id === a.id)!.unsubscribeToken;
    expect(await searchByUnsubscribeToken(appDb, tokenA)).toEqual({ id: a.id, name: 'golf · خودرو' });
    expect(await unsubscribeByToken(appDb, 'f'.repeat(32))).toBeNull();
    expect(await unsubscribeByToken(appDb, `${tokenA}' OR 1=1`)).toBeNull();
    expect(await unsubscribeByToken(appDb, a.id)).toBeNull();
    expect(await unsubscribeByToken(appDb, tokenA)).toEqual({ name: 'golf · خودرو' });
    const after = await saved(u.id);
    expect(after.find((r) => r.id === a.id)!.notifyFrequency).toBe('off');
    expect(after.find((r) => r.id === b.id)!.notifyFrequency).toBe('instant');
  });
});
