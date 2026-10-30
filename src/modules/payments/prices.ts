import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';
import type { Db, Queryable } from '../../db/drizzle';
import { productPrices, products } from '../../db/schema';
import { normalizePersian } from '../../lib/normalize-persian';
import { products as seedProducts } from '../../../seed/products';
import { staffAudit, type StaffContext } from '../admin/audit';
import { formatPrice } from '../listings/price';
import { priceKey, stripeProductId } from './catalog-sync';
import { activePrice, PAYMENT_CURRENCY } from './checkout';
import type { PaymentGateway } from './gateway';

// Admin › prices (wave 2 part 7, owner Oct 30, 2026; docs/setup.md, "Payments"). Every price is
// one euro amount (./checkout.ts, PAYMENT_CURRENCY). Admin types a new amount; the provider gets
// a price for it (found again by its lookup key, so going back to an old amount reuses that
// price), the database switches to it through set_product_price() (migration 0035), audit_log
// keeps who changed what, and the old provider price is archived. Subscriptions already running
// keep the price they started with: only new buyers pay the new one (Stripe's default; raising a
// running subscription needs the subscriber's agreement). A monthly plan price also becomes the
// one the Customer Portal offers when switching between Pro and Pro Plus.

/** €0.50 to €1,000: a typo guard, not a business rule */
export const PRICE_MIN_MINOR = 50;
export const PRICE_MAX_MINOR = 100_000;

export type PriceRow = {
  productId: string;
  code: string;
  nameFa: string;
  kind: 'one_time' | 'subscription';
  interval: 'month' | 'year' | null;
  amountMinor: number;
  providerPriceId: string;
};

/** Every active product's euro prices, in the products' order (monthly before yearly) */
export async function priceList(db: Queryable): Promise<PriceRow[]> {
  const rows = await db
    .select({ productId: products.id, code: products.code, nameFa: products.nameFa, kind: products.kind, interval: productPrices.interval, amountMinor: productPrices.amountMinor, providerPriceId: productPrices.providerPriceId })
    .from(products)
    .innerJoin(productPrices, and(eq(productPrices.productId, products.id), eq(productPrices.isActive, true), eq(productPrices.currency, PAYMENT_CURRENCY)))
    .where(eq(products.isActive, true))
    .orderBy(asc(products.sortOrder), sql`${productPrices.interval} NULLS FIRST`);
  return rows.map((r) => ({ ...r, amountMinor: Number(r.amountMinor) }));
}

/** «۲٫۴۹», «2,49» or «29 €» → 249, 249, 2900 cents; null when it isn't an amount */
export function parseEuros(raw: string): number | null {
  const s = normalizePersian(raw).replace(/[٫,]/g, '.').replace(/\s|€/g, '');
  return /^\d{1,4}(\.\d{1,2})?$/.test(s) ? Math.round(Number(s) * 100) : null;
}

/** More than half up or down: admin confirms it twice */
export function bigChange(fromMinor: number, toMinor: number): boolean {
  return Math.abs(toMinor - fromMinor) * 2 > fromMinor;
}

export type PriceChange = { code: string; interval: 'month' | 'year' | null; amountMinor: number };
export type PriceChangeResult =
  | { ok: true; fromMinor: number; toMinor: number; changed: boolean }
  | { ok: false; reason: 'payments_off' | 'not_found' | 'out_of_range' | 'confirm_big' };

/**
 * Admin: the product's price in this interval becomes `amountMinor`. `confirmedBig`: the second
 * confirmation a big change needs. The same amount again changes nothing but repeats the provider
 * steps (the Customer Portal), so a change that failed half-way can be finished.
 */
export async function changePrice(db: Db, gateway: PaymentGateway | null, ctx: StaffContext, input: PriceChange & { confirmedBig?: boolean }): Promise<PriceChangeResult> {
  if (!gateway) return { ok: false, reason: 'payments_off' };
  if (!Number.isInteger(input.amountMinor) || input.amountMinor < PRICE_MIN_MINOR || input.amountMinor > PRICE_MAX_MINOR) return { ok: false, reason: 'out_of_range' };
  const slot = (await priceList(db)).find((r) => r.code === input.code && r.interval === input.interval);
  if (!slot) return { ok: false, reason: 'not_found' };
  if (bigChange(slot.amountMinor, input.amountMinor) && !input.confirmedBig) return { ok: false, reason: 'confirm_big' };

  const changed = slot.amountMinor !== input.amountMinor;
  const providerPriceId = await gateway.ensurePrice({
    productId: stripeProductId(slot.code),
    currency: PAYMENT_CURRENCY,
    amountMinor: input.amountMinor,
    interval: slot.interval,
    lookupKey: priceKey(slot.code, { currency: PAYMENT_CURRENCY, amountMinor: input.amountMinor, interval: slot.interval }),
    metadata: { code: slot.code },
  });
  if (changed || providerPriceId !== slot.providerPriceId) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_product_price(${slot.productId}::uuid, ${PAYMENT_CURRENCY}, ${slot.interval}, ${input.amountMinor}, 'stripe', ${providerPriceId})`);
      await staffAudit(tx, ctx, 'product.price_changed', { type: 'product', id: slot.productId }, { code: slot.code, interval: slot.interval, from: slot.amountMinor, to: input.amountMinor, providerPriceId });
    });
  }
  // The Customer Portal offers the plans' monthly prices of now (scripts/stripe-setup.ts made it)
  if (slot.kind === 'subscription') {
    const plans = (await priceList(db)).filter((r) => r.kind === 'subscription' && r.interval === 'month');
    await gateway.setPortalPlans(plans.map((p) => ({ productId: stripeProductId(p.code), priceIds: [p.providerPriceId] })));
  }
  // Every earlier price of this slot is retired at the provider, also one a change that failed
  // half-way or a change at the same moment left active (code check, Oct 30, 2026)
  const earlier = await db
    .selectDistinct({ id: productPrices.providerPriceId })
    .from(productPrices)
    .where(and(eq(productPrices.productId, slot.productId), eq(productPrices.currency, PAYMENT_CURRENCY), slot.interval ? eq(productPrices.interval, slot.interval) : isNull(productPrices.interval), eq(productPrices.provider, 'stripe'), ne(productPrices.providerPriceId, providerPriceId)));
  for (const p of earlier) if (p.id) await gateway.archivePrice(p.id);
  return { ok: true, fromMinor: slot.amountMinor, toMinor: input.amountMinor, changed };
}

/** «۲۴ €»: Pro's monthly price now, for the texts that name it (the seed's before Stripe is set up) */
export async function proMonthlyText(db: Queryable): Promise<string> {
  const found = await activePrice(db, 'pro', PAYMENT_CURRENCY, 'month');
  const minor = found ? Number(found.price.amountMinor) : (seedProducts.find((p) => p.code === 'pro')?.prices.find((p) => p.interval === 'month')?.amountMinor ?? 0);
  return formatPrice(minor, PAYMENT_CURRENCY, 2);
}

/** «۲۴ €»: an amount in euros as the texts write it */
export const euros = (minor: number) => formatPrice(minor, PAYMENT_CURRENCY, 2);
