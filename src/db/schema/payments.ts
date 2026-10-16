import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  PATTERNS,
  insertOnlyColumns,
  isIn,
  isObject,
  jsonObject,
  matches,
  standardColumns,
  tstz,
} from './_columns';
import { ENTITLEMENT_TYPES } from './_values';
import { categories, currencies, listings } from './listings';
import { organizations } from './organizations';
import { users } from './users';

// Module: payments, all filled from Stripe (docs/schema.md, section 12).
// "Money and entitlements change only through payment-provider webhooks" is enforced by grants
// (migration 0003): the app role can't write payments, subscriptions or entitlements.

export const PRODUCT_KINDS = ['one_time', 'subscription'] as const;
export const APPLIES_TO = ['listing', 'user', 'organization'] as const;

export const products = pgTable(
  'products',
  {
    ...standardColumns(),
    code: text('code').notNull().unique('products_code_key'),
    nameFa: text('name_fa').notNull(),
    descriptionFa: text('description_fa').notNull(),
    kind: text('kind', { enum: PRODUCT_KINDS }).notNull(),
    entitlementType: text('entitlement_type', { enum: ENTITLEMENT_TYPES }).notNull(),
    appliesTo: text('applies_to', { enum: APPLIES_TO }).notNull(),
    durationDays: smallint('duration_days'),
    bumpCount: smallint('bump_count'),
    /** Pro plan limits, validated by Zod, copied onto the entitlement */
    features: jsonObject('features'),
    /** Only valid in this category's subtree */
    categoryId: uuid('category_id').references(() => categories.id),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: smallint('sort_order').notNull().default(0),
  },
  (t) => [
    check('products_code_check', matches(t.code, PATTERNS.slug)),
    check('products_kind_check', isIn(t.kind, PRODUCT_KINDS)),
    check('products_entitlement_type_check', isIn(t.entitlementType, ENTITLEMENT_TYPES)),
    check('products_applies_to_check', isIn(t.appliesTo, APPLIES_TO)),
    check('products_features_check', isObject(t.features)),
  ],
);

export const PRICE_INTERVALS = ['month', 'year'] as const;

// "Exactly one active price per product, currency and interval" is a partial UNIQUE NULLS NOT
// DISTINCT index in migration 0002: drizzle-kit's index builder has no NULLS NOT DISTINCT.
/** Prices are never edited: a new price is a new row and the old one is set inactive. */
export const productPrices = pgTable(
  'product_prices',
  {
    ...insertOnlyColumns(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    currency: text('currency')
      .notNull()
      .references(() => currencies.code),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    /** Set for subscriptions only */
    interval: text('interval', { enum: PRICE_INTERVALS }),
    provider: text('provider').notNull().default('stripe'),
    /** Stripe price_… */
    providerPriceId: text('provider_price_id').notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [
    check('product_prices_amount_minor_check', sql`${t.amountMinor} > 0`),
    check('product_prices_interval_check', isIn(t.interval, PRICE_INTERVALS)),
    uniqueIndex('product_prices_provider_price_id_key').on(t.provider, t.providerPriceId),
  ],
);

/** The Stripe customer for a user or a business */
export const billingCustomers = pgTable(
  'billing_customers',
  {
    ...insertOnlyColumns(),
    provider: text('provider').notNull(),
    providerCustomerId: text('provider_customer_id').notNull(),
    userId: uuid('user_id').references(() => users.id),
    organizationId: uuid('organization_id').references(() => organizations.id),
  },
  (t) => [
    check('billing_customers_payer_check', sql`num_nonnulls(${t.userId}, ${t.organizationId}) = 1`),
    uniqueIndex('billing_customers_provider_customer_id_key').on(t.provider, t.providerCustomerId),
    uniqueIndex('billing_customers_provider_user_id_key').on(t.provider, t.userId),
    uniqueIndex('billing_customers_provider_organization_id_key').on(t.provider, t.organizationId),
  ],
);

export const ORDER_STATUSES = [
  'pending',
  'paid',
  'failed',
  'expired',
  'refunded',
  'partially_refunded',
] as const;

/** One checkout for a one-time product. The app may insert it (status pending) and nothing more. */
export const orders = pgTable(
  'orders',
  {
    ...standardColumns(),
    buyerUserId: uuid('buyer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'restrict',
    }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    productPriceId: uuid('product_price_id')
      .notNull()
      .references(() => productPrices.id, { onDelete: 'restrict' }),
    listingId: uuid('listing_id').references(() => listings.id, { onDelete: 'restrict' }),
    currency: text('currency')
      .notNull()
      .references(() => currencies.code),
    subtotalMinor: bigint('subtotal_minor', { mode: 'number' }).notNull(),
    discountMinor: bigint('discount_minor', { mode: 'number' }).notNull(),
    taxMinor: bigint('tax_minor', { mode: 'number' }).notNull(),
    totalMinor: bigint('total_minor', { mode: 'number' }).notNull(),
    status: text('status', { enum: ORDER_STATUSES }).notNull().default('pending'),
    provider: text('provider').notNull().default('stripe'),
    /** Stripe Checkout Session id */
    providerCheckoutId: text('provider_checkout_id').unique('orders_provider_checkout_id_key'),
    providerInvoiceId: text('provider_invoice_id'),
    paidAt: tstz('paid_at'),
  },
  (t) => [
    check('orders_subtotal_minor_check', sql`${t.subtotalMinor} >= 0`),
    check('orders_discount_minor_check', sql`${t.discountMinor} >= 0`),
    check('orders_tax_minor_check', sql`${t.taxMinor} >= 0`),
    check('orders_total_minor_check', sql`${t.totalMinor} >= 0`),
    check(
      'orders_total_check',
      sql`${t.totalMinor} = ${t.subtotalMinor} - ${t.discountMinor} + ${t.taxMinor}`,
    ),
    check('orders_status_check', isIn(t.status, ORDER_STATUSES)),
    check('orders_paid_check', sql`${t.status} <> 'paid' OR ${t.paidAt} IS NOT NULL`),
    index('orders_buyer_user_id_created_at_idx').on(t.buyerUserId, t.createdAt.desc().nullsFirst()),
    index('orders_organization_id_created_at_idx')
      .on(t.organizationId, t.createdAt.desc().nullsFirst())
      .where(sql`organization_id IS NOT NULL`),
    index('orders_listing_id_idx').on(t.listingId).where(sql`listing_id IS NOT NULL`),
  ],
);

export const SUBSCRIPTION_STATUSES = [
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused',
] as const;

/** Mirror of the Stripe subscription */
export const subscriptions = pgTable(
  'subscriptions',
  {
    ...standardColumns(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'restrict',
    }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'restrict' }),
    /** Changes on upgrade or downgrade */
    productPriceId: uuid('product_price_id')
      .notNull()
      .references(() => productPrices.id, { onDelete: 'restrict' }),
    provider: text('provider').notNull().default('stripe'),
    providerSubscriptionId: text('provider_subscription_id')
      .notNull()
      .unique('subscriptions_provider_subscription_id_key'),
    status: text('status', { enum: SUBSCRIPTION_STATUSES }).notNull(),
    currentPeriodStart: tstz('current_period_start').notNull(),
    currentPeriodEnd: tstz('current_period_end').notNull(),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    trialEndsAt: tstz('trial_ends_at'),
    canceledAt: tstz('canceled_at'),
    endedAt: tstz('ended_at'),
  },
  (t) => [
    check(
      'subscriptions_subscriber_check',
      sql`num_nonnulls(${t.organizationId}, ${t.userId}) = 1`,
    ),
    check('subscriptions_status_check', isIn(t.status, SUBSCRIPTION_STATUSES)),
    index('subscriptions_organization_id_idx')
      .on(t.organizationId)
      .where(sql`organization_id IS NOT NULL`),
    index('subscriptions_user_id_idx').on(t.userId).where(sql`user_id IS NOT NULL`),
  ],
);

export const PAYMENT_KINDS = ['charge', 'refund'] as const;
export const PAYMENT_STATUSES = ['pending', 'succeeded', 'failed'] as const;

/** Each money movement reported by the provider. A refund is its own row. */
export const payments = pgTable(
  'payments',
  {
    ...standardColumns(),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'restrict' }),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id, {
      onDelete: 'restrict',
    }),
    kind: text('kind', { enum: PAYMENT_KINDS }).notNull(),
    status: text('status', { enum: PAYMENT_STATUSES }).notNull(),
    /** The direction comes from kind */
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: text('currency')
      .notNull()
      .references(() => currencies.code),
    /** Provider fee, for accounting */
    feeMinor: bigint('fee_minor', { mode: 'number' }),
    provider: text('provider').notNull().default('stripe'),
    /** pi_… for charges, re_… for refunds */
    providerPaymentId: text('provider_payment_id').notNull(),
    providerInvoiceId: text('provider_invoice_id'),
    failureCode: text('failure_code'),
    /** When the provider says it happened */
    occurredAt: tstz('occurred_at').notNull(),
  },
  (t) => [
    check('payments_source_check', sql`num_nonnulls(${t.orderId}, ${t.subscriptionId}) = 1`),
    check('payments_kind_check', isIn(t.kind, PAYMENT_KINDS)),
    check('payments_status_check', isIn(t.status, PAYMENT_STATUSES)),
    check('payments_amount_minor_check', sql`${t.amountMinor} > 0`),
    check('payments_fee_minor_check', sql`${t.feeMinor} >= 0`),
    uniqueIndex('payments_provider_payment_id_key').on(t.provider, t.providerPaymentId),
    index('payments_order_id_idx').on(t.orderId).where(sql`order_id IS NOT NULL`),
    index('payments_subscription_id_occurred_at_idx')
      .on(t.subscriptionId, t.occurredAt.desc().nullsFirst())
      .where(sql`subscription_id IS NOT NULL`),
  ],
);

/** What someone has paid for. Featured and Pro are always computed from here. */
export const entitlements = pgTable(
  'entitlements',
  {
    ...insertOnlyColumns(),
    type: text('type', { enum: ENTITLEMENT_TYPES }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'restrict' }),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'restrict',
    }),
    listingId: uuid('listing_id').references(() => listings.id, { onDelete: 'restrict' }),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'restrict' }),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id, {
      onDelete: 'restrict',
    }),
    /** For scheduled bumps, when to apply */
    startsAt: tstz('starts_at').notNull(),
    /** A bump is a moment, not a period */
    endsAt: tstz('ends_at'),
    /** Bumps only: when the worker moved listings.ranked_at */
    appliedAt: tstz('applied_at'),
    /** Copied from the product, so limits stay as bought */
    features: jsonObject('features'),
    revokedAt: tstz('revoked_at'),
    revokeReason: text('revoke_reason'),
  },
  (t) => [
    check('entitlements_type_check', isIn(t.type, ENTITLEMENT_TYPES)),
    check('entitlements_holder_check', sql`num_nonnulls(${t.userId}, ${t.organizationId}) = 1`),
    check('entitlements_source_check', sql`num_nonnulls(${t.orderId}, ${t.subscriptionId}) = 1`),
    check('entitlements_listing_check', sql`(${t.type} = 'pro_plan') = (${t.listingId} IS NULL)`),
    check('entitlements_bump_check', sql`(${t.type} = 'bump') = (${t.endsAt} IS NULL)`),
    check('entitlements_period_check', sql`${t.endsAt} IS NULL OR ${t.endsAt} > ${t.startsAt}`),
    check('entitlements_features_check', isObject(t.features)),
    index('entitlements_listing_idx')
      .on(t.listingId, t.type, t.endsAt)
      .where(sql`listing_id IS NOT NULL AND revoked_at IS NULL`),
    index('entitlements_paid_slots_idx')
      .on(t.type, t.endsAt)
      .where(sql`type IN ('featured', 'top_of_category', 'homepage') AND revoked_at IS NULL`),
    index('entitlements_organization_idx')
      .on(t.organizationId, t.type, t.endsAt)
      .where(sql`organization_id IS NOT NULL AND revoked_at IS NULL`),
    index('entitlements_user_idx')
      .on(t.userId, t.type, t.endsAt)
      .where(sql`user_id IS NOT NULL AND revoked_at IS NULL`),
    index('entitlements_due_bumps_idx')
      .on(t.startsAt)
      .where(sql`type = 'bump' AND applied_at IS NULL AND revoked_at IS NULL`),
    index('entitlements_order_id_idx').on(t.orderId).where(sql`order_id IS NOT NULL`),
    index('entitlements_subscription_id_idx')
      .on(t.subscriptionId)
      .where(sql`subscription_id IS NOT NULL`),
  ],
);

/** Raw incoming webhooks, each processed exactly once by the worker */
export const webhookEvents = pgTable(
  'webhook_events',
  {
    /** created_at = received */
    ...insertOnlyColumns(),
    provider: text('provider').notNull(),
    /** evt_… */
    providerEventId: text('provider_event_id').notNull(),
    type: text('type').notNull(),
    /** The signature-checked body */
    payload: jsonb('payload').notNull(),
    processedAt: tstz('processed_at'),
    attempts: smallint('attempts').notNull().default(0),
    lastError: text('last_error'),
  },
  (t) => [
    check('webhook_events_payload_check', isObject(t.payload)),
    uniqueIndex('webhook_events_provider_event_id_key').on(t.provider, t.providerEventId),
    index('webhook_events_unprocessed_idx').on(t.createdAt).where(sql`processed_at IS NULL`),
  ],
);

