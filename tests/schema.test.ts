import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { listingImages, listings, productPrices, users } from '../src/db/schema';
import {
  CHECK_VIOLATION,
  FOREIGN_KEY_VIOLATION,
  UNIQUE_VIOLATION,
  db,
  expectError,
  location,
  makeListing,
  makeProduct,
  makeUser,
  rollback,
} from './db';

// Database-level guarantees that drizzle-kit can't check by itself (docs/schema.md).

describe('database', () => {
  it('uses the built-in C.UTF-8 locale provider (decision 3)', async () => {
    const rows = await db.execute(sql`
      SELECT datlocprovider AS provider, datlocale AS locale, pg_encoding_to_char(encoding) AS encoding
      FROM pg_database WHERE datname = current_database()`);
    expect(rows[0]).toEqual({ provider: 'b', locale: 'C.UTF-8', encoding: 'UTF8' });
  });

  it('can sort Persian alphabetically with COLLATE "fa-x-icu" for display', async () => {
    const rows = await db.execute(sql`
      SELECT string_agg(x, ' ' ORDER BY x COLLATE "fa-x-icu") AS fa,
             string_agg(x, ' ' ORDER BY x) AS c
      FROM unnest(ARRAY['ل', 'گ', 'ک']) AS x`);
    // Persian order is ک گ ل; code point order (C.UTF-8) puts ل first
    expect(rows[0]).toEqual({ fa: 'ک گ ل', c: 'ل ک گ' });
  });
});

describe('triggers', () => {
  it('exist for every table with updated_at', async () => {
    const rows = await db.execute(sql`
      SELECT c.table_name FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.column_name = 'updated_at'
        AND NOT EXISTS (
          SELECT 1 FROM pg_trigger t
          WHERE t.tgrelid = ('public.' || c.table_name)::regclass AND NOT t.tgisinternal
            AND t.tgfoid = 'set_updated_at'::regproc)`);
    expect(rows).toEqual([]);
  });

  it('move updated_at forward on every update', async () => {
    await rollback(async (tx) => {
      const user = await makeUser(tx, { updatedAt: new Date('2000-01-01T00:00:00Z') });
      const [after] = await tx
        .update(users)
        .set({ emailVerified: true })
        .where(eq(users.id, user.id))
        .returning({ updatedAt: users.updatedAt });
      expect(after!.updatedAt.getTime()).toBeGreaterThan(new Date('2001-01-01').getTime());
    });
  });
});

describe('listings', () => {
  it('round-trip a geography point through the custom type', async () => {
    await rollback(async (tx) => {
      const user = await makeUser(tx);
      const listing = await makeListing(tx, user.id, { point: { lng: 13.3889, lat: 52.517 } });
      const [row] = await tx.select({ point: listings.point }).from(listings).where(eq(listings.id, listing.id));
      expect(row!.point).toEqual({ lng: 13.3889, lat: 52.517 });
    });
  });

  it('allow incomplete drafts but not incomplete published listings (decision 9)', async () => {
    await rollback(async (tx) => {
      const user = await makeUser(tx);
      const draft = {
        status: 'draft' as const,
        categoryId: null,
        countryCode: null,
        locationId: null,
        point: null,
        locationPrecision: null,
        priceMinor: null,
        currency: null,
        publishedAt: null,
        rankedAt: null,
        expiresAt: null,
        title: '',
      };
      await makeListing(tx, user.id, draft);
      await expectError(
        tx.transaction(async (sp) => {
          await makeListing(sp, user.id, { ...draft, status: 'pending_review' });
        }),
        CHECK_VIOLATION,
      );
    });
  });

  it("can't claim one country while pointing at another country's city (decision 10)", async () => {
    await rollback(async (tx) => {
      const user = await makeUser(tx);
      await expectError(makeListing(tx, user.id, { countryCode: 'AT' }), FOREIGN_KEY_VIOLATION);
    });
  });

  it('require a price exactly for fixed and negotiable prices', async () => {
    await rollback(async (tx) => {
      const user = await makeUser(tx);
      await makeListing(tx, user.id, { priceType: 'free', priceMinor: null, currency: null });
      await expectError(
        tx.transaction(async (sp) => {
          await makeListing(sp, user.id, { priceType: 'fixed', priceMinor: null, currency: null });
        }),
        CHECK_VIOLATION,
      );
    });
  });

  it('are created with fillfactor 90', async () => {
    const rows = await db.execute(sql`SELECT reloptions FROM pg_class WHERE oid = 'listings'::regclass`);
    expect((rows[0] as { reloptions: string[] }).reloptions).toContain('fillfactor=90');
  });
});

describe('listing_images', () => {
  async function images(tx: Parameters<Parameters<typeof rollback>[0]>[0]) {
    const user = await makeUser(tx);
    const listing = await makeListing(tx, user.id);
    const insert = (position: number, phash?: bigint) =>
      tx
        .insert(listingImages)
        .values({
          listingId: listing.id,
          uploaderUserId: user.id,
          position,
          storageKey: `listings/test/${listing.id}-${position}.webp`,
          phash,
        })
        .returning();
    return { listing, insert };
  }

  it('store phash_bands as a STORED generated column', async () => {
    const rows = await db.execute(sql`
      SELECT attgenerated FROM pg_attribute
      WHERE attrelid = 'listing_images'::regclass AND attname = 'phash_bands'`);
    expect(rows[0]).toEqual({ attgenerated: 's' });

    await rollback(async (tx) => {
      const { insert } = await images(tx);
      const [image] = await insert(0, 0x0001_0002_0003_0004n);
      expect(image!.phashBands).toEqual([1, 2 + 65536, 3 + 131072, 4 + 196608]);
      const [negative] = await insert(1, -1n);
      expect(negative!.phashBands).toEqual([65535, 65535 + 65536, 65535 + 131072, 65535 + 196608]);
    });
  });

  it('can swap positions in one transaction with the deferred unique constraint', async () => {
    await rollback(async (tx) => {
      const { listing, insert } = await images(tx);
      const [a] = await insert(0);
      const [b] = await insert(1);
      const swap = async (t: typeof tx) => {
        await t.update(listingImages).set({ position: 1 }).where(eq(listingImages.id, a!.id));
        await t.update(listingImages).set({ position: 0 }).where(eq(listingImages.id, b!.id));
      };
      await expectError(tx.transaction(swap), UNIQUE_VIOLATION);
      await tx.transaction(async (sp) => {
        await sp.execute(sql`SET CONSTRAINTS listing_images_listing_id_position_key DEFERRED`);
        await swap(sp);
      });
      const order = await tx
        .select({ id: listingImages.id })
        .from(listingImages)
        .where(eq(listingImages.listingId, listing.id))
        .orderBy(listingImages.position);
      expect(order.map((r) => r.id)).toEqual([b!.id, a!.id]);
    });
  });
});

describe('product_prices', () => {
  it('allow one active price per product, currency and interval, null interval included', async () => {
    await rollback(async (tx) => {
      const { product, price } = await makeProduct(tx);
      expect(price.interval).toBeNull();
      await expectError(
        tx.insert(productPrices).values({
          productId: product.id,
          currency: 'EUR',
          amountMinor: 399,
          providerPriceId: 'price_second',
        }),
        UNIQUE_VIOLATION,
      );
    });
  });
});

describe('locations', () => {
  it("keep a city's region in the same country", async () => {
    await rollback(async (tx) => {
      const bayern = await location(tx, 'bayern', 'region');
      await expectError(
        tx.execute(sql`
          INSERT INTO locations (kind, country_code, parent_id, slug, name_fa, name_fa_normalized,
                                 name_local, center, timezone)
          VALUES ('city', 'AT', ${bayern.id}, 'salzburg', 'سالزبورگ', 'سالزبورگ', 'Salzburg',
                  'SRID=4326;POINT(13.04 47.8)', 'Europe/Vienna')`),
        FOREIGN_KEY_VIOLATION,
      );
    });
  });
});
