import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { bytea, geographyPoint } from '../types';
import { PATTERNS, createdAt, isIn, matches, standardColumns, tstz, updatedAt } from './_columns';
import { ORGANIZATION_ROLES } from './_values';
import { countries, locations } from './listings';
import { users } from './users';

// Module: organizations, the Pro businesses (docs/schema.md, section 7).
// Whether a business is Pro is not a column: it is an active pro_plan entitlement.

export const VERIFICATION_STATUSES = ['unverified', 'pending', 'verified', 'rejected'] as const;
export const ORGANIZATION_STATUSES = ['active', 'suspended', 'deleted'] as const;

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
    /** Exact: a shop's address is public, unlike a private seller's */
    point: geographyPoint('point'),
    phoneE164: text('phone_e164'),
    email: text('email'),
    website: text('website'),
    description: text('description').notNull().default(''),
    descriptionNormalized: text('description_normalized').notNull().default(''),
    logoKey: text('logo_key'),
    coverKey: text('cover_key'),
    verificationStatus: text('verification_status', { enum: VERIFICATION_STATUSES })
      .notNull()
      .default('unverified'),
    verifiedAt: tstz('verified_at'),
    verifiedByUserId: uuid('verified_by_user_id').references(() => users.id),
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
