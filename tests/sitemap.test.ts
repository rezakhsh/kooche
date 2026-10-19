import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';
import * as schema from '../src/db/schema';
import { browseCacheControl } from '../src/proxy';
import { buildSitemaps, readSitemap, writeSitemaps } from '../src/modules/search/sitemap';
import { workerDb } from './accounts';
import { category, db, expectError, INSUFFICIENT_PRIVILEGE, location, makeListing, makeUser, rollback, setRole } from './db';

// XML sitemaps (the plan's SEO section): only plain pages with listings, every active listing
// and event page, nothing filtered, nothing from closed countries; served only with
// SEARCH_INDEXING on.

let indexing: 'on' | 'off' = 'off';
vi.mock('../src/lib/env', () => ({ webEnv: () => ({ APP_URL: 'https://staging.example.test', SEARCH_INDEXING: indexing }) }));
vi.mock('../src/db/drizzle', async () => {
  const { appDb } = await import('./accounts');
  return { appDb: () => appDb };
});

const APP = 'https://staging.example.test';
const locs = (body: string) => [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);

describe('sitemaps', () => {
  it('list the plain pages that have listings, every active listing and event, and nothing else', async () => {
    await rollback(async (tx) => {
      const u = await makeUser(tx);
      const [rostock, kiel, cars, boats, concerts] = await Promise.all([
        location(tx, 'rostock'),
        location(tx, 'kiel'),
        category(tx, 'cars'),
        category(tx, 'boats'),
        category(tx, 'event-concerts'),
      ]);
      const car = await makeListing(tx, u.id, { categoryId: cars.id, locationId: rostock.id, point: rostock.center, title: 'BMW & Audi <test>' });
      const paused = await makeListing(tx, u.id, { categoryId: boats.id, locationId: rostock.id, point: rostock.center, status: 'paused' });
      const event = await makeListing(tx, u.id, { categoryId: concerts.id, locationId: kiel.id, point: kiel.center, title: 'کنسرت آزمایشی' });
      await tx.insert(schema.eventDetails).values({ listingId: event.id, timeZone: 'Europe/Berlin' });
      const start = new Date(Date.now() + 7 * 86_400_000);
      await tx.insert(schema.eventDates).values({ listingId: event.id, countryCode: 'DE', locationId: kiel.id, startsAt: start, endsAt: new Date(start.getTime() + 3 * 3_600_000) });
      await setRole(tx, 'classifieds_worker');

      const files = await buildSitemaps(tx, `${APP}/`);
      const byName = new Map(files.map((f) => [f.name, f]));
      expect(files[0]!.name).toBe('index');
      const index = locs(files[0]!.body);
      expect(index).toContain(`${APP}/sitemaps/germany.xml`);
      expect(index).toContain(`${APP}/sitemaps/germany-listings-1.xml`);
      expect(index.some((l) => l.includes('turkey'))).toBe(false); // a closed country
      expect(files[0]!.urlCount).toBe(files.length - 1);

      const pages = locs(byName.get('germany')!.body);
      for (const path of ['/germany', '/germany/cars', '/germany/vehicles', '/germany/rostock', '/germany/rostock/cars', '/germany/rostock/vehicles', '/germany/events', '/germany/kiel/events']) {
        expect(pages, path).toContain(`${APP}${path}`);
      }
      expect(pages).not.toContain(`${APP}/germany/rostock/boats`); // only a paused listing there
      expect(pages).not.toContain(`${APP}/germany/event-concerts`); // events have their own pages
      expect(pages.every((l) => !l.includes('?'))).toBe(true); // never a filtered or paged address
      expect(byName.get('germany')!.body).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}T/);

      const items = files.filter((f) => f.name.startsWith('germany-listings-')).flatMap((f) => locs(f.body));
      expect(items.some((l) => l.endsWith(`/${car.publicToken}`) && l.startsWith(`${APP}/v/`))).toBe(true);
      expect(items.some((l) => l.endsWith(`/${event.publicToken}`) && l.startsWith(`${APP}/e/`))).toBe(true);
      expect(items.some((l) => l.endsWith(`/${paused.publicToken}`))).toBe(false);
      // Titles are percent-encoded in the address, and the XML has no stray ampersand or bracket
      for (const f of files) {
        expect(f.body).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
        expect(f.body.replace(/<\/?[a-z?][^>]*>/gi, '')).not.toMatch(/[<>]/);
      }

      // Split at the limit, nothing lost
      const small = await buildSitemaps(tx, APP, { maxUrls: 1 });
      const parts = small.filter((f) => f.name.startsWith('germany-listings-'));
      expect(parts.length).toBeGreaterThan(1);
      expect(parts.every((f) => f.urlCount === 1)).toBe(true);
      expect(new Set(parts.flatMap((f) => locs(f.body)))).toEqual(new Set(items));
    });
  });

  it('the worker writes them, the app only reads them', async () => {
    await rollback(async (tx) => {
      await setRole(tx, 'classifieds_worker');
      await writeSitemaps(tx, [
        { name: 'index', body: '<sitemapindex/>', urlCount: 1 },
        { name: 'germany', body: '<urlset/>', urlCount: 0 },
      ]);
      await writeSitemaps(tx, [{ name: 'index', body: '<sitemapindex>2</sitemapindex>', urlCount: 0 }]);
      await setRole(tx, 'classifieds_app');
      expect(await readSitemap(tx, 'index')).toBe('<sitemapindex>2</sitemapindex>');
      expect(await readSitemap(tx, 'germany')).toBeNull(); // replaced files are removed
      expect(await readSitemap(tx, '../etc/passwd')).toBeNull();
      await expectError(tx.execute(sql`INSERT INTO sitemap_files (name, body, url_count) VALUES ('x', '', 0)`), INSUFFICIENT_PRIVILEGE);
    });
  });

  describe('served', () => {
    afterAll(async () => {
      await db.delete(schema.sitemapFiles);
    });

    it('only with SEARCH_INDEXING on', async () => {
      await writeSitemaps(workerDb, [{ name: 'index', body: '<sitemapindex/>', urlCount: 0 }, { name: 'germany', body: '<urlset/>', urlCount: 0 }]);
      const index = (await import('../src/app/sitemap.xml/route')).GET;
      const file = (await import('../src/app/sitemaps/[file]/route')).GET;
      const at = (name: string) => file(new Request(`${APP}/sitemaps/${name}`), { params: Promise.resolve({ file: name }) });

      indexing = 'off';
      expect((await index()).status).toBe(404);
      expect((await at('germany.xml')).status).toBe(404);

      indexing = 'on';
      const res = await index();
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/xml; charset=utf-8');
      expect(await res.text()).toBe('<sitemapindex/>');
      expect((await at('germany.xml')).status).toBe(200);
      expect((await at('index.xml')).status).toBe(404);
      expect((await at('austria.xml')).status).toBe(404);
      expect((await at('germany')).status).toBe(404);
      indexing = 'off';
    });
  });
});

describe('cache headers of browse pages', () => {
  const none = () => undefined;
  const q = (s = '') => new URLSearchParams(s);
  it('shared for 60 seconds only when nothing personal is in the request', () => {
    expect(browseCacheControl('/germany', q(), none)).toBe('public, max-age=0, s-maxage=60');
    expect(browseCacheControl('/germany/berlin/cars', q('brand=bmw&sort=price_asc'), none)).toBe('public, max-age=0, s-maxage=60');
    expect(browseCacheControl('/germany', q(), (n) => (n === 'country' ? 'germany' : undefined))).toBe('public, max-age=0, s-maxage=60');
    for (const cookie of ['__Secure-better-auth.session_token', 'better-auth.session_token', 'view']) {
      expect(browseCacheControl('/germany', q(), (n) => (n === cookie ? 'x' : undefined)), cookie).toBe('private, no-store');
    }
    // proxy() sets the country cookie to the page's own, so another country's cookie is shared too
    expect(browseCacheControl('/germany', q(), (n) => (n === 'country' ? 'austria' : undefined))).toBe('public, max-age=0, s-maxage=60');
    expect(browseCacheControl('/germany/cars', q('near=abc&r=10'), none)).toBe('private, no-store');
    expect(browseCacheControl('/germany/cars', q('postal=12045'), none)).toBe('private, no-store');
  });

  it('shares only GET and HEAD', () => {
    expect(browseCacheControl('/germany', q(), none, 'HEAD')).toBe('public, max-age=0, s-maxage=60');
    expect(browseCacheControl('/germany/cars', q(), none, 'POST')).toBe('private, no-store');
  });

  it('leaves other pages alone', () => {
    for (const p of ['/', '/my/favorites', '/account', '/v/x/abc', '/chat', '/login', '/sitemaps/germany.xml', '/icon.png', '/a/b/c/d']) {
      expect(browseCacheControl(p, q(), none), p).toBeNull();
    }
  });
});
