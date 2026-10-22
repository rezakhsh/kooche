// Sets up one Stripe account (test mode on staging, live at launch) for Peydoo and writes the
// matching rows into the database (docs/setup.md, "Payments"). Safe to run again: everything is
// found by a fixed id or lookup key first.
//
//  1. Products and prices from seed/products.ts (product id `peydoo_<code>`, price lookup key from
//     priceKey()); then `products` and `product_prices` as classifieds_owner (syncCatalog()).
//  2. The launch coupon (100% off for 6 months, Pro and Pro Plus only).
//  3. The Customer Portal's default configuration: invoices, payment method, address, cancel at
//     period end, switching between Pro and Pro Plus (monthly prices only, see planPrices).
//  4. The webhook endpoint at APP_URL/api/stripe/webhook with the events the worker applies. Its
//     signing secret is shown by Stripe only when the endpoint is created: it is written straight
//     into the secrets file as STRIPE_WEBHOOK_SECRET, never printed. `--rotate-webhook` deletes
//     and recreates the endpoint (a new secret); `--no-webhook` skips it (local runs use the
//     Stripe CLI's own secret).
//
//   STRIPE_SECRET_KEY=… MIGRATION_DATABASE_URL=… APP_URL=https://staging.peydoo.com \
//     npx tsx scripts/stripe-setup.ts --secrets-file /root/.secrets/stripe.env [--rotate-webhook | --no-webhook]

import { drizzle } from 'drizzle-orm/postgres-js';
import { readFile, writeFile } from 'node:fs/promises';
import postgres from 'postgres';
import Stripe from 'stripe';
import * as schema from '../src/db/schema';
import { isLiveStripeKey } from '../src/lib/env';
import { priceKey, syncCatalog } from '../src/modules/payments/catalog-sync';
import { INVOICE_FOOTER, STRIPE_API_VERSION } from '../src/modules/payments/gateway';
import { HANDLED_EVENTS } from '../src/modules/payments/stripe-objects';
import { launchCoupon, products } from '../seed/products';

const key = process.env.STRIPE_SECRET_KEY;
const dbUrl = process.env.MIGRATION_DATABASE_URL;
const appUrl = process.env.APP_URL?.replace(/\/$/, '');
if (!key || !dbUrl || !appUrl) throw new Error('STRIPE_SECRET_KEY, MIGRATION_DATABASE_URL and APP_URL are required');
if (isLiveStripeKey(key) && process.env.PAYMENTS_LIVE !== 'on') throw new Error('a live key needs PAYMENTS_LIVE=on');
const args = process.argv.slice(2);
const secretsFile = args.includes('--secrets-file') ? args[args.indexOf('--secrets-file') + 1] : undefined;
const skipWebhook = args.includes('--no-webhook');
const rotate = args.includes('--rotate-webhook');
if (!skipWebhook && !secretsFile) throw new Error('--secrets-file is required (or --no-webhook)');

const stripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
const mode = isLiveStripeKey(key) ? 'live' : 'test';
console.log(`stripe-setup: ${mode} mode, ${appUrl}`);

// 1. Products and prices
const priceIds = new Map<string, string>();
// The Customer Portal switches only between monthly prices: a switch to yearly during the launch
// coupon's 6 free months would make a whole year free. Yearly plans are taken through Checkout.
const planPrices: Array<{ product: string; prices: string[] }> = [];
for (const seed of products) {
  const productId = `peydoo_${seed.code.replace(/-/g, '_')}`;
  const fields = { name: `Peydoo ${seed.nameFa}`, description: seed.descriptionFa, metadata: { code: seed.code } };
  try {
    await stripe.products.update(productId, { ...fields, active: true });
  } catch (e) {
    if ((e as { code?: string }).code !== 'resource_missing') throw e;
    await stripe.products.create({ id: productId, ...fields });
  }
  const ids: string[] = [];
  const monthly: string[] = [];
  for (const p of seed.prices) {
    const lookupKey = priceKey(seed.code, p);
    const found = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
    let price = found.data[0];
    if (!price) {
      price = await stripe.prices.create({
        product: productId,
        currency: p.currency.toLowerCase(),
        unit_amount: p.amountMinor,
        lookup_key: lookupKey,
        ...(p.interval ? { recurring: { interval: p.interval } } : {}),
        metadata: { code: seed.code },
      });
      console.log(`  price ${lookupKey}: created`);
    }
    priceIds.set(lookupKey, price.id);
    ids.push(price.id);
    if (p.interval === 'month') monthly.push(price.id);
  }
  if (seed.kind === 'subscription') planPrices.push({ product: productId, prices: monthly });
}

const sql = postgres(dbUrl, { max: 1, onnotice: () => {} });
try {
  const result = await drizzle(sql, { schema }).transaction((tx) => syncCatalog(tx, products, priceIds));
  console.log(`  database: ${result.products} products, ${result.pricesAdded} prices added, ${result.pricesRetired} retired`);
} finally {
  await sql.end();
}

// 2. Launch coupon
try {
  await stripe.coupons.retrieve(launchCoupon.id);
  console.log(`  coupon ${launchCoupon.id}: exists`);
} catch (e) {
  if ((e as { code?: string }).code !== 'resource_missing') throw e;
  await stripe.coupons.create({
    id: launchCoupon.id,
    name: launchCoupon.name,
    percent_off: launchCoupon.percentOff,
    duration: 'repeating',
    duration_in_months: launchCoupon.durationInMonths,
    applies_to: { products: planPrices.map((p) => p.product) },
  });
  console.log(`  coupon ${launchCoupon.id}: created`);
}

// 3. Customer Portal (the default configuration, so portal sessions need no configuration id)
const portal = {
  business_profile: { privacy_policy_url: `${appUrl}/privacy`, terms_of_service_url: `${appUrl}/terms` },
  features: {
    customer_update: { enabled: true, allowed_updates: ['name', 'email', 'address'] },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: { enabled: true, mode: 'at_period_end' },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ['price'],
      proration_behavior: 'create_prorations',
      products: planPrices.map((p) => ({ product: p.product, prices: p.prices })),
    },
  },
} satisfies Stripe.BillingPortal.ConfigurationCreateParams;
const defaults = await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 });
if (defaults.data[0]) {
  await stripe.billingPortal.configurations.update(defaults.data[0].id, portal);
  console.log('  portal: default configuration updated');
} else {
  await stripe.billingPortal.configurations.create(portal);
  console.log('  portal: configuration created');
}

// 4. Webhook endpoint
if (!skipWebhook) {
  const url = `${appUrl}/api/stripe/webhook`;
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  let endpoint = endpoints.data.find((e) => e.url === url);
  if (endpoint && rotate) {
    await stripe.webhookEndpoints.del(endpoint.id);
    endpoint = undefined;
  }
  const events = [...HANDLED_EVENTS];
  if (endpoint) {
    await stripe.webhookEndpoints.update(endpoint.id, { enabled_events: events, disabled: false });
    console.log(`  webhook ${url}: updated (secret unchanged; --rotate-webhook for a new one)`);
  } else {
    const created = await stripe.webhookEndpoints.create({ url, enabled_events: events, api_version: STRIPE_API_VERSION, description: 'Peydoo payments' });
    if (!created.secret) throw new Error('Stripe returned no signing secret');
    const current = await readFile(secretsFile!, 'utf8').catch(() => '');
    const lines = current.split('\n').filter((l) => l && !l.startsWith('STRIPE_WEBHOOK_SECRET='));
    await writeFile(secretsFile!, [...lines, `STRIPE_WEBHOOK_SECRET=${created.secret}`, ''].join('\n'), { mode: 0o600 });
    console.log(`  webhook ${url}: created, signing secret written to ${secretsFile}`);
  }
}

console.log(`stripe-setup: done. Invoices carry the footer "${INVOICE_FOOTER}" from each customer.`);
