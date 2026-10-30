import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { bytea } from '../types';
import { insertOnlyColumns, isIn, tstz } from './_columns';
import { categories, countries, listings, locations } from './listings';
import { users } from './users';

// Module: launch (round 12, wave 0; migration 0019). People waiting for a city to open
// (src/modules/launch/waitlist.ts). Double opt-in: a row counts once confirmed. Unconfirmed rows
// are deleted after 30 days; leaving the list deletes the row. No account, IP or name is kept.

export const WAITLIST_ROLES = ['looking', 'private', 'business'] as const;

export const cityWaitlist = pgTable(
  'city_waitlist',
  {
    ...insertOnlyColumns(),
    /** The city page the person signed up on (counted with its launch group, e.g. Bonn with Cologne) */
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id),
    email: text('email').notNull(),
    role: text('role', { enum: WAITLIST_ROLES }).notNull(),
    /** SHA-256 of the token in the confirmation email; the token itself is never stored */
    confirmTokenHash: bytea('confirm_token_hash').notNull().unique('city_waitlist_confirm_token_hash_key'),
    confirmedAt: tstz('confirmed_at'),
    /** In the leave link of the owner's opening email (a random token, never the row id) */
    leaveToken: text('leave_token').notNull().unique('city_waitlist_leave_token_key'),
  },
  (t) => [
    check('city_waitlist_email_check', sql`${t.email} = lower(${t.email}) AND char_length(${t.email}) BETWEEN 3 AND 254`),
    check('city_waitlist_role_check', isIn(t.role, WAITLIST_ROLES)),
    check('city_waitlist_leave_token_check', sql`${t.leaveToken} ~ '^[A-Za-z0-9_-]{32}$'`),
    unique('city_waitlist_location_id_email_key').on(t.locationId, t.email),
    index('city_waitlist_confirmed_idx').on(t.locationId, t.confirmedAt),
  ],
);

/**
 * Emergency pause (wave 2 part 2, migration 0030; src/modules/launch/pauses.ts): no new listings
 * in a category (and its subcategories) in a country or one city until `until`, for example rooms
 * in Hamburg after a scam wave. What is already live stays. Set and lifted by the owner in admin.
 */
export const categoryPauses = pgTable(
  'category_pauses',
  {
    ...insertOnlyColumns(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    countryCode: text('country_code')
      .notNull()
      .references(() => countries.code),
    /** A city, or null for the whole country */
    locationId: uuid('location_id').references(() => locations.id),
    reason: text('reason').notNull(),
    until: tstz('until').notNull(),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    liftedAt: tstz('lifted_at'),
    liftedByUserId: uuid('lifted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [
    check('category_pauses_reason_check', sql`char_length(${t.reason}) BETWEEN 3 AND 500`),
    index('category_pauses_country_code_idx').on(t.countryCode, t.until).where(sql`${t.liftedAt} IS NULL`),
  ],
);

/**
 * The waitlist reward (wave 2 part 9, owner Oct 30, 2026; migration 0036;
 * src/modules/launch/rewards.ts): when the owner opens a city, the first confirmed signups of it
 * and the cities launching with it (rewardPlaces(), one per email) get one free bump, usable from
 * day 3 to day 60 on one of their listings by the account with that email. Not an entitlement:
 * those come only from payments. Using it marks it (the app); the bump job applies it (the worker).
 * Leaving the waitlist deletes it.
 */
export const waitlistRewards = pgTable(
  'waitlist_rewards',
  {
    ...insertOnlyColumns(),
    waitlistId: uuid('waitlist_id')
      .notNull()
      .unique('waitlist_rewards_waitlist_id_key')
      .references(() => cityWaitlist.id, { onDelete: 'cascade' }),
    /** The city that opened (the anchor of its launch group) */
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id),
    availableFrom: tstz('available_from').notNull(),
    endsAt: tstz('ends_at').notNull(),
    /** The "your free bump is ready" email went out */
    notifiedAt: tstz('notified_at'),
    usedAt: tstz('used_at'),
    userId: uuid('user_id').references(() => users.id),
    /** Cleared when the listing is purged (the worker deletes deleted listings) */
    listingId: uuid('listing_id').references(() => listings.id, { onDelete: 'set null' }),
    /** The bump job moved the listing up */
    appliedAt: tstz('applied_at'),
  },
  (t) => [
    check('waitlist_rewards_window_check', sql`${t.endsAt} > ${t.availableFrom}`),
    check('waitlist_rewards_used_check', sql`(${t.usedAt} IS NULL) = (${t.userId} IS NULL) AND (${t.usedAt} IS NOT NULL OR ${t.listingId} IS NULL)`),
    check('waitlist_rewards_applied_check', sql`${t.appliedAt} IS NULL OR ${t.usedAt} IS NOT NULL`),
    index('waitlist_rewards_due_idx').on(t.usedAt).where(sql`${t.usedAt} IS NOT NULL AND ${t.appliedAt} IS NULL`),
    index('waitlist_rewards_notify_idx').on(t.availableFrom).where(sql`${t.notifiedAt} IS NULL`),
  ],
);
