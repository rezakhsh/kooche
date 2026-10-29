import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { bytea } from '../types';
import { insertOnlyColumns, isIn, tstz } from './_columns';
import { categories, countries, locations } from './listings';
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
