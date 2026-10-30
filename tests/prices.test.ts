import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import type { Db } from '../src/db/drizzle';
import { can } from '../src/modules/admin/access';
import type { StaffContext } from '../src/modules/admin/audit';
import { products as seeds } from '../seed/products';
import { withCurrentPrices } from '../src/modules/payments/catalog-sync';
import { activePrice, startListingCheckout } from '../src/modules/payments/checkout';
import { checkoutParams } from '../src/modules/payments/gateway';
import { bigChange, changePrice, parseEuros, priceList, proMonthlyText } from '../src/modules/payments/prices';
import { appDb } from './accounts';
import { db, expectError, INSUFFICIENT_PRIVILEGE, makeUser, rollback, setRole, type Tx } from './db';
import { FakeGateway, seedCatalog, sellerWithListing, stripePriceId } from './payments-fixtures';

// Wave 2 part 7 (owner Oct 30, 2026): every price in euros with Stripe's Adaptive Pricing, and
// admin › prices changing a product's price for new buyers only.

beforeAll(async () => {
  await seedCatalog();
});

const APP_URL = 'https://app.example.test';

/** Admin's change inside a rolled-back transaction, as classifieds_app (other tests use the prices) */
async function asAdmin(fn: (tx: Tx, ctx: StaffContext) => Promise<void>) {
  await rollback(async (tx) => {
    const staff = await makeUser(tx, { staffRole: 'admin' });
    await setRole(tx, 'classifieds_app');
    await fn(tx, { userId: staff.id, role: 'admin', sessionId: randomUUID(), ip: null, userAgent: null });
  });
}

describe('one price in euros', () => {
  it('a listing priced in pounds is bumped in euros', async () => {
    const gateway = new FakeGateway();
    const { seller, listing } = await sellerWithListing({ currency: 'GBP' });
    const r = await startListingCheckout(appDb, gateway, { userId: seller.id, listingId: listing.id, productCode: 'bump-1', waiver: true, appUrl: APP_URL });
    expect(r.ok).toBe(true);
    expect(gateway.checkouts[0]!.priceId).toBe(stripePriceId('bump-1'));
    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, (r as { orderId: string }).orderId));
    expect(order!.currency).toBe('EUR');
  });

  it('Checkout offers the buyer’s own money (Adaptive Pricing), for purchases and subscriptions', () => {
    const base = { customerId: 'cus_1', priceId: 'price_1', clientReferenceId: 'x', metadata: {}, successUrl: 'https://a.test/s', cancelUrl: 'https://a.test/c' };
    expect(checkoutParams({ ...base, mode: 'payment' }).adaptive_pricing).toEqual({ enabled: true });
    expect(checkoutParams({ ...base, mode: 'subscription' }).adaptive_pricing).toEqual({ enabled: true });
  });
});

describe('admin › prices', () => {
  it('reads amounts as admin types them', () => {
    expect(['۲٫۴۹', '2,49', '2.49', '۲۹', '29 €', ' 1000 '].map(parseEuros)).toEqual([249, 249, 249, 2900, 2900, 100000]);
    expect(['', 'abc', '2.499', '-3', '12345'].map(parseEuros)).toEqual([null, null, null, null, null]);
    expect([bigChange(2400, 2900), bigChange(2400, 3700), bigChange(2400, 1100)]).toEqual([false, true, true]);
  });

  it('is for admins only', () => {
    expect(can('admin', 'prices.manage')).toBe(true);
    expect(can('moderator', 'prices.manage')).toBe(false);
  });

  it('changes a price for new buyers: a new provider price, the old one archived, audit_log, the texts', async () => {
    await asAdmin(async (tx, ctx) => {
      const gateway = new FakeGateway();
      const before = await activePrice(tx, 'bump-1', 'EUR');
      const r = await changePrice(tx as unknown as Db, gateway, ctx, { code: 'bump-1', interval: null, amountMinor: 249 });
      expect(r).toEqual({ ok: true, fromMinor: 199, toMinor: 249, changed: true });
      const after = await activePrice(tx, 'bump-1', 'EUR');
      expect(Number(after!.price.amountMinor)).toBe(249);
      expect(after!.price.providerPriceId).toBe('price_peydoo_bump_1_eur_once_249');
      expect(gateway.archived).toEqual([before!.price.providerPriceId]);
      // The old row stays for the orders that point at it
      const [old] = await tx.select().from(schema.productPrices).where(eq(schema.productPrices.id, before!.price.id));
      expect(old).toMatchObject({ isActive: false, amountMinor: 199 });
      const [audit] = await tx.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, 'product.price_changed'), eq(schema.auditLog.actorUserId, ctx.userId)));
      expect(audit!.data).toMatchObject({ code: 'bump-1', interval: null, from: 199, to: 249 });
      // Going back reuses the old row and provider price instead of a second one
      expect(await changePrice(tx as unknown as Db, gateway, ctx, { code: 'bump-1', interval: null, amountMinor: 199 })).toMatchObject({ ok: true, changed: true });
      expect((await activePrice(tx, 'bump-1', 'EUR'))!.price.id).toBe(before!.price.id);
    });
  });

  it('a plan’s monthly price becomes the one the Customer Portal offers; Pro’s texts follow', async () => {
    await asAdmin(async (tx, ctx) => {
      const gateway = new FakeGateway();
      expect(await proMonthlyText(tx)).toContain('۲۴');
      expect(await changePrice(tx as unknown as Db, gateway, ctx, { code: 'pro', interval: 'month', amountMinor: 2900 })).toMatchObject({ ok: true, toMinor: 2900 });
      const pro = gateway.portal.find((p) => p.productId === 'peydoo_pro');
      expect(pro!.priceIds).toEqual(['price_peydoo_pro_eur_month_2900']);
      expect(gateway.portal.find((p) => p.productId === 'peydoo_pro_plus')!.priceIds).toEqual([stripePriceId('pro-plus', 'month')]);
      expect(await proMonthlyText(tx)).toContain('۲۹');
      // The yearly price is its own
      expect(Number((await activePrice(tx, 'pro', 'EUR', 'year'))!.price.amountMinor)).toBe(24000);
    });
  });

  it('refuses typos: out of range, a big change without «مطمئنم», an unknown slot, payments off', async () => {
    await asAdmin(async (tx, ctx) => {
      const gateway = new FakeGateway();
      const change = (amountMinor: number, more: object = {}) => changePrice(tx as unknown as Db, gateway, ctx, { code: 'pro', interval: 'month', amountMinor, ...more });
      expect(await change(10)).toEqual({ ok: false, reason: 'out_of_range' });
      expect(await change(24.5)).toEqual({ ok: false, reason: 'out_of_range' });
      expect(await change(9900)).toEqual({ ok: false, reason: 'confirm_big' });
      expect(await change(9900, { confirmedBig: true })).toMatchObject({ ok: true, toMinor: 9900 });
      expect(await changePrice(tx as unknown as Db, gateway, ctx, { code: 'bump-1', interval: 'month', amountMinor: 300 })).toEqual({ ok: false, reason: 'not_found' });
      expect(await changePrice(tx as unknown as Db, null, ctx, { code: 'bump-1', interval: null, amountMinor: 300 })).toEqual({ ok: false, reason: 'payments_off' });
    });
  });

  it('the same amount again changes nothing (and repeats the Customer Portal step)', async () => {
    await asAdmin(async (tx, ctx) => {
      const gateway = new FakeGateway();
      const rows = (await priceList(tx)).length;
      expect(await changePrice(tx as unknown as Db, gateway, ctx, { code: 'pro-plus', interval: 'month', amountMinor: 5900 })).toEqual({ ok: true, fromMinor: 5900, toMinor: 5900, changed: false });
      expect(gateway.archived).toEqual([]);
      expect(gateway.portal).toHaveLength(2);
      expect((await priceList(tx)).length).toBe(rows);
    });
  });

  it('only through set_product_price(): the app can’t write prices itself', async () => {
    await rollback(async (tx) => {
      await setRole(tx, 'classifieds_app');
      const [p] = await tx.select().from(schema.products).limit(1);
      await expectError(tx.insert(schema.productPrices).values({ productId: p!.id, currency: 'EUR', amountMinor: 1, provider: 'stripe', providerPriceId: 'price_x' }), INSUFFICIENT_PRIVILEGE);
    });
    await rollback(async (tx) => {
      await setRole(tx, 'classifieds_worker');
      const [p] = await tx.select().from(schema.products).limit(1);
      await expectError(tx.execute(sql`SELECT set_product_price(${p!.id}::uuid, 'EUR', NULL, 100, 'stripe', 'price_y')`), INSUFFICIENT_PRIVILEGE);
    });
  });

  it('the setup script keeps prices changed in admin', () => {
    const kept = withCurrentPrices(seeds, [{ code: 'pro', currency: 'EUR', interval: 'month', amountMinor: 2900 }]);
    expect(kept.find((p) => p.code === 'pro')!.prices).toEqual([
      { currency: 'EUR', amountMinor: 2900, interval: 'month' },
      { currency: 'EUR', amountMinor: 24000, interval: 'year' },
    ]);
    expect(kept.find((p) => p.code === 'bump-1')!.prices[0]!.amountMinor).toBe(199);
  });
});
