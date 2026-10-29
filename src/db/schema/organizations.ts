import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { bytea, geographyPoint } from '../types';
import { PATTERNS, createdAt, insertOnlyColumns, isIn, matches, standardColumns, textArrayWithin, tstz, updatedAt } from './_columns';
import { ORGANIZATION_ROLES } from './_values';
import { countries, locations } from './listings';
import { users } from './users';

// Module: organizations, the Pro businesses (docs/schema.md, section 7).
// Whether a business is Pro is not a column: it is an active pro_plan entitlement.

export const VERIFICATION_STATUSES = ['unverified', 'pending', 'verified', 'rejected'] as const;
export const ORGANIZATION_STATUSES = ['active', 'suspended', 'deleted'] as const;
/** «چه کاری می‌کنید؟» on the new-business form (wave 1, mockup final/business-new) */
export const BUSINESS_TYPES = ['translation', 'repairs', 'beauty', 'education', 'real_estate', 'auto', 'food', 'legal_finance', 'health', 'moving', 'shop', 'other'] as const;
/** The languages a business serves in, in this order on its page */
export const BUSINESS_LANGUAGES = ['fa', 'de', 'en', 'tr', 'ar', 'fr', 'other'] as const;
/**
 * Opening hours by ISO weekday ("1" Monday … "7" Sunday), at most two ranges a day as "HH:MM",
 * in the business's city's time zone; a day that isn't there is closed.
 */
export type OpeningHours = Partial<Record<'1' | '2' | '3' | '4' | '5' | '6' | '7', [string, string][]>>;

export const organizations = pgTable(
  'organizations',
  {
    ...standardColumns(),
    slug: text('slug').notNull().unique('organizations_slug_key'),
    name: text('name').notNull(),
    nameNormalized: text('name_normalized').notNull(),
    legalName: text('legal_name'),
    vatId: text('vat_id'),
    registrationNumber: text('registration_number'),
    /** Legal form as registered (GmbH, UG, Einzelunternehmen…), for the Impressum (migration 0014) */
    legalForm: text('legal_form'),
    /** Who represents the business (Geschäftsführer, owner), for the Impressum */
    representativeName: text('representative_name'),
    /** Register court of the registration number (Amtsgericht Charlottenburg…) */
    registerCourt: text('register_court'),
    /** Anything else the Impressum must say (chamber, supervisory authority, professional rules) */
    imprintExtra: text('imprint_extra'),
    countryCode: text('country_code')
      .notNull()
      .references(() => countries.code),
    locationId: uuid('location_id'),
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    postalCode: text('postal_code'),
    /** The town of the postal code ("Berlin", "Wien"), for the address and the Impressum (migration 0014) */
    placeName: text('place_name'),
    /** The postal code's centre; the exact spot is `pin` */
    point: geographyPoint('point'),
    /** The shop's exact spot, tapped on the street map by the business (migration 0027; optional). Public like the address. */
    pin: geographyPoint('pin'),
    phoneE164: text('phone_e164'),
    email: text('email'),
    website: text('website'),
    description: text('description').notNull().default(''),
    descriptionNormalized: text('description_normalized').notNull().default(''),
    /** Wave 1 (migration 0026): what the business does, one line under its name, languages, hours */
    businessType: text('business_type', { enum: BUSINESS_TYPES }),
    tagline: text('tagline'),
    languages: text('languages', { enum: BUSINESS_LANGUAGES })
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    servesOnline: boolean('serves_online').notNull().default(false),
    /** Handles without @ (instagram.com/<handle>, t.me/<handle>) */
    instagram: text('instagram'),
    telegram: text('telegram'),
    openingHours: jsonb('opening_hours').$type<OpeningHours>(),
    logoKey: text('logo_key'),
    coverKey: text('cover_key'),
    verificationStatus: text('verification_status', { enum: VERIFICATION_STATUSES })
      .notNull()
      .default('unverified'),
    verifiedAt: tstz('verified_at'),
    verifiedByUserId: uuid('verified_by_user_id').references(() => users.id),
    /**
     * Founding business (round 12, migration 0020): the owner's offer in admin. It allows one
     * 6-month Pro trial without a card (src/modules/payments/founding.ts) and shows the
     * «بنیان‌گذار» badge until a year after the business page was created.
     */
    foundingOfferedAt: tstz('founding_offered_at'),
    foundingOfferedByUserId: uuid('founding_offered_by_user_id').references(() => users.id),
    status: text('status', { enum: ORGANIZATION_STATUSES }).notNull().default('active'),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    deletedAt: tstz('deleted_at'),
  },
  (t) => [
    check('organizations_slug_check', matches(t.slug, PATTERNS.slug)),
    check('organizations_name_check', sql`char_length(${t.name}) BETWEEN 2 AND 80`),
    check('organizations_phone_e164_check', matches(t.phoneE164, PATTERNS.phone)),
    check('organizations_website_check', matches(t.website, '^https://')),
    check('organizations_description_check', sql`char_length(${t.description}) <= 5000`),
    check('organizations_legal_form_check', sql`char_length(${t.legalForm}) BETWEEN 1 AND 80`),
    check('organizations_representative_name_check', sql`char_length(${t.representativeName}) BETWEEN 2 AND 120`),
    check('organizations_register_court_check', sql`char_length(${t.registerCourt}) BETWEEN 2 AND 120`),
    check('organizations_imprint_extra_check', sql`char_length(${t.imprintExtra}) BETWEEN 1 AND 2000`),
    check('organizations_business_type_check', isIn(t.businessType, BUSINESS_TYPES)),
    check('organizations_tagline_check', sql`char_length(${t.tagline}) BETWEEN 2 AND 100`),
    check('organizations_languages_check', textArrayWithin(t.languages, BUSINESS_LANGUAGES)),
    check('organizations_instagram_check', matches(t.instagram, '^[A-Za-z0-9._]{1,30}$')),
    check('organizations_telegram_check', matches(t.telegram, '^[A-Za-z][A-Za-z0-9_]{4,31}$')),
    check('organizations_opening_hours_check', sql`jsonb_typeof(${t.openingHours}) = 'object'`),
    check(
      'organizations_verification_status_check',
      isIn(t.verificationStatus, VERIFICATION_STATUSES),
    ),
    check('organizations_status_check', isIn(t.status, ORGANIZATION_STATUSES)),
    check(
      'organizations_deleted_check',
      sql`(${t.status} = 'deleted') = (${t.deletedAt} IS NOT NULL)`,
    ),
    foreignKey({
      name: 'organizations_location_fkey',
      columns: [t.locationId, t.countryCode],
      foreignColumns: [locations.id, locations.countryCode],
    }),
    // One account per VAT ID, so a business can't open a second account for the free quota again
    uniqueIndex('organizations_country_code_vat_id_key')
      .on(t.countryCode, t.vatId)
      .where(sql`vat_id IS NOT NULL`),
    index('organizations_verification_queue_idx')
      .on(t.createdAt)
      .where(sql`verification_status = 'pending'`),
  ],
);

/** "At least one owner" is enforced in the app, which locks the organization row first. */
export const organizationMembers = pgTable(
  'organization_members',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ORGANIZATION_ROLES }).notNull(),
    invitedByUserId: uuid('invited_by_user_id').references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ name: 'organization_members_pkey', columns: [t.organizationId, t.userId] }),
    check('organization_members_role_check', isIn(t.role, ORGANIZATION_ROLES)),
    index('organization_members_user_id_idx').on(t.userId),
  ],
);

/**
 * People following a business (wave 1, migration 0024): its new events reach them, at most two
 * messages a day (src/modules/events/follows.ts). Deleted with the account (erase_user).
 */
export const organizationFollows = pgTable(
  'organization_follows',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ name: 'organization_follows_pkey', columns: [t.organizationId, t.userId] }),
    index('organization_follows_user_id_idx').on(t.userId),
  ],
);

export const organizationInvitations = pgTable(
  'organization_invitations',
  {
    ...standardColumns(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email'),
    phoneE164: text('phone_e164'),
    role: text('role', { enum: ORGANIZATION_ROLES }).notNull(),
    tokenHash: bytea('token_hash').notNull().unique('organization_invitations_token_hash_key'),
    invitedByUserId: uuid('invited_by_user_id')
      .notNull()
      .references(() => users.id),
    expiresAt: tstz('expires_at').notNull(),
    acceptedAt: tstz('accepted_at'),
    acceptedByUserId: uuid('accepted_by_user_id').references(() => users.id),
    revokedAt: tstz('revoked_at'),
  },
  (t) => [
    check('organization_invitations_contact_check', sql`num_nonnulls(${t.email}, ${t.phoneE164}) = 1`),
    check('organization_invitations_phone_e164_check', matches(t.phoneE164, PATTERNS.phone)),
    check('organization_invitations_role_check', isIn(t.role, ORGANIZATION_ROLES)),
    index('organization_invitations_pending_idx')
      .on(t.organizationId)
      .where(sql`accepted_at IS NULL AND revoked_at IS NULL`),
  ],
);

/**
 * «احتمالاً کسب‌وکار» (wave 2 part 4, round 9): a private account that looks commercial, found by
 * the worker's daily check (src/modules/organizations/suspicions.ts). Staff ask (14 days to open a
 * business page), dismiss, or after the deadline restrict private offers in `root_slugs`. Opening a
 * business closes it by itself. Reasons are codes and counts only, never the listings' text.
 */
export const SUSPICION_STATUSES = ['open', 'asked', 'restricted', 'dismissed', 'switched'] as const;
export type SuspicionReason = { code: 'many_listings' | 'similar_titles' | 'business_words' | 'company_name'; n?: number };

export const businessSuspicions = pgTable(
  'business_suspicions',
  {
    ...insertOnlyColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reasons: jsonb('reasons').$type<SuspicionReason[]>().notNull(),
    /** Top categories of the private offers concerned; a restriction applies to these */
    rootSlugs: text('root_slugs').array().notNull(),
    status: text('status', { enum: SUSPICION_STATUSES }).notNull().default('open'),
    askedAt: tstz('asked_at'),
    deadlineAt: tstz('deadline_at'),
    decidedAt: tstz('decided_at'),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [
    check('business_suspicions_status_check', isIn(t.status, SUSPICION_STATUSES)),
    // One case per person while it is open, asked or restricted
    uniqueIndex('business_suspicions_live_key').on(t.userId).where(sql`status IN ('open', 'asked', 'restricted')`),
  ],
);
