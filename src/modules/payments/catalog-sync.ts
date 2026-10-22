import { and, eq, isNull, ne } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { productPrices, products } from '../../db/schema';
import type { ProductPriceSeed, ProductSeed } from '../../../seed/products';

// Writes `products` and `product_prices` from seed/products.ts and the provider's price ids
// (scripts/stripe-setup.ts), as classifieds_owner: reference data, which the app and the worker
// only read. Prices are never edited (docs/schema.md, section 12): a price whose amount or provider
// id changed becomes a new row, and the old one is set inactive, so orders keep pointing at what
// was charged.

/** The key a price is found by, at Stripe (lookup_key) and here */
export function priceKey(code: string, p: ProductPriceSeed): string {
  return `peydoo_${code}_${p.currency.toLowerCase()}_${p.interval ?? 'once'}_${p.amountMinor}`.replace(/-/g, '_');
}

export type SyncResult = { products: number; pricesAdded: number; pricesRetired: number };

export async function syncCatalog(
  db: Queryable,
  seeds: readonly ProductSeed[],
  providerPriceIds: ReadonlyMap<string, string>,
  provider = 'stripe',
): Promise<SyncResult> {
  let pricesAdded = 0;
  let pricesRetired = 0;
  for (const seed of seeds) {
    const values = {
      nameFa: seed.nameFa,
      descriptionFa: seed.descriptionFa,
      kind: seed.kind,
      entitlementType: seed.entitlementType,
      appliesTo: seed.appliesTo,
      durationDays: seed.durationDays,
      bumpCount: seed.bumpCount,
      features: seed.features,
      sortOrder: seed.sortOrder,
      isActive: true,
    };
    const [product] = await db
      .insert(products)
      .values({ code: seed.code, ...values })
      .onConflictDoUpdate({ target: products.code, set: values })
      .returning({ id: products.id });

    for (const price of seed.prices) {
      const providerPriceId = providerPriceIds.get(priceKey(seed.code, price));
      if (!providerPriceId) throw new Error(`no provider price for ${priceKey(seed.code, price)}`);
      const sameSlot = and(
        eq(productPrices.productId, product!.id),
        eq(productPrices.currency, price.currency),
        price.interval ? eq(productPrices.interval, price.interval) : isNull(productPrices.interval),
        eq(productPrices.isActive, true),
      );
      const [current] = await db.select().from(productPrices).where(sameSlot);
      if (current && current.providerPriceId === providerPriceId && current.amountMinor === price.amountMinor) continue;
      const retired = await db
        .update(productPrices)
        .set({ isActive: false })
        .where(and(sameSlot, ne(productPrices.providerPriceId, providerPriceId)))
        .returning({ id: productPrices.id });
      pricesRetired += retired.length;
      await db.insert(productPrices).values({
        productId: product!.id,
        currency: price.currency,
        amountMinor: price.amountMinor,
        interval: price.interval,
        provider,
        providerPriceId,
      });
      pricesAdded += 1;
    }
  }
  return { products: seeds.length, pricesAdded, pricesRetired };
}
