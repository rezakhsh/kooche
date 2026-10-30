import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  inet,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { bytea } from '../types';
import {
  PATTERNS,
  createdAt,
  insertOnlyColumns,
  isIn,
  isObject,
  jsonObject,
  matches,
  standardColumns,
  tstz,
} from './_columns';
import { PHONE_VERIFICATION_METHODS } from './_values';

export const SIGNUP_ANSWERS = ['friend', 'instagram', 'telegram', 'google', 'shop', 'event', 'other', 'skipped'] as const;
import { locations } from './listings';

// Module: users, authentication and phone verification (docs/schema.md, section 6).
// users, sessions, auth_accounts, verifications and two_factors follow Better Auth's core model
// with snake_case columns. Better Auth's admin and organization plugins are not used.

export const STAFF_ROLES = ['moderator', 'admin'] as const;
export const USER_STATUSES = ['active', 'deactivated', 'deleted'] as const;
/**
 * Test accounts (wave 2 part 1, src/modules/users/test-accounts.ts): `country` is one of the
 * seeded per-country accounts (fixed sign-in code on staging, its email and Telegram go to the
 * owner's inbox); `personal` is a real person's own account kept for testing (normal sign-in, own
 * email and Telegram). Their content is shown only to staff and other test accounts.
 */
export const TEST_ACCOUNT_KINDS = ['country', 'personal'] as const;

export const users = pgTable(
  'users',
  {
    ...standardColumns(),
    publicToken: text('public_token').notNull().unique('users_public_token_key'),
    email: text('email').notNull().unique('users_email_key'),
    emailVerified: boolean('email_verified').notNull().default(false),
    displayName: text('display_name').notNull(),
    displayNameNormalized: text('display_name_normalized').notNull(),
    avatarKey: text('avatar_key'),
    /** Only verified numbers live here. Pending ones are in phone_verifications. */
    phoneE164: text('phone_e164').unique('users_phone_e164_key'),
    phoneVerifiedAt: tstz('phone_verified_at'),
    phoneVerificationMethod: text('phone_verification_method', {
      enum: PHONE_VERIFICATION_METHODS,
    }),
    telegramUserId: bigint('telegram_user_id', { mode: 'number' }).unique(
      'users_telegram_user_id_key',
    ),
    staffRole: text('staff_role', { enum: STAFF_ROLES }),
    /** Set only by scripts/test-accounts.ts as classifieds_owner; null for real people */
    testAccount: text('test_account', { enum: TEST_ACCOUNT_KINDS }),
    twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
    trustScore: smallint('trust_score').notNull().default(50),
    homeLocationId: uuid('home_location_id').references(() => locations.id),
    // The seller's saved place, pre-filled in every new listing (migration 0008): postal code,
    // place name and district as on a listing. Never a street or a GPS position.
    homePostalCode: text('home_postal_code'),
    homePlaceName: text('home_place_name'),
    homeDistrict: text('home_district'),
    notificationPrefs: jsonObject('notification_prefs'),
    status: text('status', { enum: USER_STATUSES }).notNull().default('active'),
    lastSeenAt: tstz('last_seen_at'),
    deletedAt: tstz('deleted_at'),
    /**
     * Where the person came from when they signed up (src/modules/stats/visits.ts, migration
     * 0038): `direct`, a search engine or social site, another site, or `ref:<code>` (one of the
     * owner's links). Worked out on the server, without cookies; null before Oct 30, 2026.
     */
    signupSource: text('signup_source'),
    /** «از کجا با پیدو آشنا شدید؟», answered once on the account page, or `skipped` */
    signupAnswer: text('signup_answer', { enum: SIGNUP_ANSWERS }),
  },
  (t) => [
    check('users_public_token_check', matches(t.publicToken, PATTERNS.publicToken)),
    check('users_email_check', sql`${t.email} = lower(${t.email})`),
    check('users_display_name_check', sql`char_length(${t.displayName}) BETWEEN 1 AND 50`),
    check('users_phone_e164_check', matches(t.phoneE164, PATTERNS.phone)),
    check(
      'users_phone_verification_method_check',
      isIn(t.phoneVerificationMethod, PHONE_VERIFICATION_METHODS),
    ),
    check('users_staff_role_check', isIn(t.staffRole, STAFF_ROLES)),
    check('users_test_account_check', isIn(t.testAccount, TEST_ACCOUNT_KINDS)),
    // The few test accounts, for the "is the owner a test account" checks on public queries
    index('users_test_account_idx').on(t.id).where(sql`${t.testAccount} IS NOT NULL`),
    check('users_home_postal_code_check', matches(t.homePostalCode, PATTERNS.postalCode)),
    check('users_home_place_name_check', sql`char_length(${t.homePlaceName}) BETWEEN 1 AND 100`),
    check('users_home_district_check', sql`char_length(${t.homeDistrict}) BETWEEN 1 AND 60`),
    check('users_trust_score_check', sql`${t.trustScore} BETWEEN 0 AND 100`),
    check('users_notification_prefs_check', isObject(t.notificationPrefs)),
    check('users_status_check', isIn(t.status, USER_STATUSES)),
    check('users_signup_source_check', matches(t.signupSource, '^(ref:)?[a-z0-9.-]{1,40}$')),
    check('users_signup_answer_check', isIn(t.signupAnswer, SIGNUP_ANSWERS)),
    // A number is never stored without its verification time and method
    check(
      'users_phone_check',
      sql`num_nonnulls(${t.phoneE164}, ${t.phoneVerifiedAt}, ${t.phoneVerificationMethod}) IN (0, 3)`,
    ),
    check('users_deleted_check', sql`(${t.status} = 'deleted') = (${t.deletedAt} IS NOT NULL)`),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    ...standardColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique('sessions_token_key'),
    expiresAt: tstz('expires_at').notNull(),
    /** text: Better Auth writes whatever the request gives it */
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    /**
     * Staff only: when this session last passed the TOTP check for the admin page (migration
     * 0015). Valid for a few hours and only for this session (src/modules/admin/access.ts).
     */
    staffVerifiedAt: tstz('staff_verified_at'),
    /**
     * Sign in as a user (wave 2 part 1, src/modules/admin/acting.ts): the admin who opened this
     * session for the user, why, and since when changes are allowed (null: read only).
     */
    openedByUserId: uuid('opened_by_user_id').references(() => users.id, { onDelete: 'cascade' }),
    openedReason: text('opened_reason'),
    writableAt: tstz('writable_at'),
  },
  (t) => [
    index('sessions_user_id_idx').on(t.userId),
    index('sessions_expires_at_idx').on(t.expiresAt),
    check('sessions_opened_check', sql`${t.openedByUserId} IS NOT NULL OR (${t.openedReason} IS NULL AND ${t.writableAt} IS NULL)`),
  ],
);

/** Better Auth `account`: Google, Apple. OAuth-token encryption is on in Better Auth. */
export const authAccounts = pgTable(
  'auth_accounts',
  {
    ...standardColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerId: text('provider_id').notNull(),
    /** The provider's user id */
    accountId: text('account_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: tstz('access_token_expires_at'),
    refreshTokenExpiresAt: tstz('refresh_token_expires_at'),
    scope: text('scope'),
    /** Always null: there are no passwords */
    password: text('password'),
  },
  (t) => [
    uniqueIndex('auth_accounts_provider_id_account_id_key').on(t.providerId, t.accountId),
    index('auth_accounts_user_id_idx').on(t.userId),
  ],
);

/** Better Auth `verification`: email login codes */
export const verifications = pgTable(
  'verifications',
  {
    ...standardColumns(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: tstz('expires_at').notNull(),
  },
  (t) => [
    index('verifications_identifier_idx').on(t.identifier),
    index('verifications_expires_at_idx').on(t.expiresAt),
  ],
);

/** Better Auth two-factor plugin, required for staff. Both secrets are encrypted by Better Auth. */
export const twoFactors = pgTable('two_factors', {
  ...standardColumns(),
  userId: uuid('user_id')
    .notNull()
    .unique('two_factors_user_id_key')
    .references(() => users.id, { onDelete: 'cascade' }),
  secret: text('secret').notNull(),
  backupCodes: text('backup_codes').notNull(),
  // The plugin's own fields (migration 0015): false until the first code from the app is accepted
  verified: boolean('verified').notNull().default(true),
  failedVerificationCount: integer('failed_verification_count').notNull().default(0),
  lockedUntil: tstz('locked_until'),
});

export const PHONE_VERIFICATION_STATUSES = ['pending', 'verified', 'failed', 'expired'] as const;

/** Every attempt to verify a phone number. No updated_at: status changes are rare and timestamped. */
export const phoneVerifications = pgTable(
  'phone_verifications',
  {
    ...insertOnlyColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    method: text('method', { enum: PHONE_VERIFICATION_METHODS }).notNull(),
    status: text('status', { enum: PHONE_VERIFICATION_STATUSES }).notNull().default('pending'),
    phoneE164: text('phone_e164'),
    /**
     * Telegram: SHA-256 of the random token in the t.me/<bot>?start=<token> link; Telegram login:
     * SHA-256 of the OpenID Connect `state`
     */
    linkTokenHash: bytea('link_token_hash').unique('phone_verifications_link_token_hash_key'),
    /** Accepted only when contact.user_id equals the sender's from.id (setup.md, decision 5) */
    telegramUserId: bigint('telegram_user_id', { mode: 'number' }),
    /** SMS: HMAC-SHA256 of the code with a server secret. The code itself is never stored. */
    codeHash: bytea('code_hash'),
    attempts: smallint('attempts').notNull().default(0),
    smsProvider: text('sms_provider'),
    providerMessageId: text('provider_message_id'),
    /**
     * foreign_contact, phone_in_use, telegram_in_use, too_many_attempts, undeliverable,
     * country_not_allowed (a country outside seed/countries.ts, e.g. +98), no_country (+888)
     */
    failureReason: text('failure_reason'),
    /**
     * The country of the number, for verified and refused attempts (migration 0016). A refused
     * number itself is never stored, only its country: the per-country refusal counts for the
     * SMS switch-on rule (docs/wave0-plan.md).
     */
    numberCountry: text('number_country'),
    ipAddress: inet('ip_address'),
    expiresAt: tstz('expires_at').notNull(),
    verifiedAt: tstz('verified_at'),
  },
  (t) => [
    check('phone_verifications_method_check', isIn(t.method, PHONE_VERIFICATION_METHODS)),
    check('phone_verifications_status_check', isIn(t.status, PHONE_VERIFICATION_STATUSES)),
    check('phone_verifications_phone_e164_check', matches(t.phoneE164, PATTERNS.phone)),
    check('phone_verifications_number_country_check', matches(t.numberCountry, '^[A-Z]{2}$')),
    check('phone_verifications_attempts_check', sql`${t.attempts} BETWEEN 0 AND 10`),
    check(
      'phone_verifications_sms_check',
      sql`${t.method} <> 'sms' OR (${t.phoneE164} IS NOT NULL AND ${t.codeHash} IS NOT NULL)`,
    ),
    // The bot's t.me link token, or Telegram login's state: only their hashes are stored
    check(
      'phone_verifications_telegram_check',
      sql`${t.method} NOT IN ('telegram', 'telegram_oidc') OR ${t.linkTokenHash} IS NOT NULL`,
    ),
    check(
      'phone_verifications_verified_check',
      sql`${t.status} <> 'verified' OR (${t.verifiedAt} IS NOT NULL AND ${t.phoneE164} IS NOT NULL)`,
    ),
    check(
      'phone_verifications_telegram_verified_check',
      sql`${t.method} <> 'telegram' OR ${t.status} <> 'verified' OR ${t.telegramUserId} IS NOT NULL`,
    ),
    index('phone_verifications_user_id_created_at_idx').on(t.userId, t.createdAt.desc().nullsFirst()),
    index('phone_verifications_sms_phone_idx')
      .on(t.phoneE164, t.createdAt.desc().nullsFirst())
      .where(sql`method = 'sms'`),
  ],
);

export const userBlocks = pgTable(
  'user_blocks',
  {
    blockerUserId: uuid('blocker_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedUserId: uuid('blocked_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ name: 'user_blocks_pkey', columns: [t.blockerUserId, t.blockedUserId] }),
    check('user_blocks_self_check', sql`${t.blockerUserId} <> ${t.blockedUserId}`),
    index('user_blocks_blocked_user_id_idx').on(t.blockedUserId),
  ],
);
