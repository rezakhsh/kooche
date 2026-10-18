import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { geographyPoint, ltree } from '../types';
import {
  PATTERNS,
  createdAt,
  id,
  isIn,
  isObject,
  jsonObject,
  matches,
  standardColumns,
  tstz,
} from './_columns';
import { LISTING_STATUSES } from './_values';
import { moderationDecisions } from './moderation';
import { organizations } from './organizations';
import { users } from './users';

// Module: listings, including reference data (docs/schema.md, sections 4, 5 and 8).

// ---------------------------------------------------------------------------
// Reference data: currencies, countries, locations
// ---------------------------------------------------------------------------

export const currencies = pgTable(
  'currencies',
  {
    code: text('code').primaryKey(),
    minorUnit: smallint('minor_unit').notNull(),
    nameFa: text('name_fa').notNull(),
    symbol: text('symbol').notNull(),
  },
  (t) => [
    check('currencies_code_check', matches(t.code, '^[A-Z]{3}$')),
    check('currencies_minor_unit_check', sql`${t.minorUnit} BETWEEN 0 AND 3`),
  ],
);

export const countries = pgTable(
  'countries',
  {
    code: text('code').primaryKey(),
    nameFa: text('name_fa').notNull(),
    nameLocal: text('name_local').notNull(),
    defaultCurrency: text('default_currency')
      .notNull()
      .references(() => currencies.code),
    phonePrefix: text('phone_prefix').notNull(),
    isActive: boolean('is_active').notNull().default(false),
    sortOrder: smallint('sort_order').notNull().default(0),
    // Latin name in web addresses: /germany, /austria (migration 0008). Filled by the seed; a
    // name, not the code, because two-letter codes clash with our own routes (/my is Malaysia).
    slug: text('slug').unique('countries_slug_key'),
  },
  (t) => [
    check('countries_code_check', matches(t.code, '^[A-Z]{2}$')),
    check('countries_slug_check', matches(t.slug, PATTERNS.slug)),
  ],
);

export const LOCATION_KINDS = ['region', 'city'] as const;

export const locations = pgTable(
  'locations',
  {
    ...standardColumns(),
    kind: text('kind', { enum: LOCATION_KINDS }).notNull(),
    countryCode: text('country_code')
      .notNull()
      .references(() => countries.code),
    parentId: uuid('parent_id'),
    slug: text('slug').notNull(),
    nameFa: text('name_fa').notNull(),
    nameFaNormalized: text('name_fa_normalized').notNull(),
    nameLocal: text('name_local').notNull(),
    center: geographyPoint('center').notNull(),
    timezone: text('timezone').notNull(),
    population: integer('population'),
    geonamesId: integer('geonames_id').unique('locations_geonames_id_key'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [
    check('locations_kind_check', isIn(t.kind, LOCATION_KINDS)),
    check('locations_slug_check', matches(t.slug, PATTERNS.slug)),
    // Regions are roots, cities always have a region. That the parent is a region is a seed check.
    check('locations_parent_check', sql`(${t.kind} = 'region') = (${t.parentId} IS NULL)`),
    // Target of the composite FKs that keep a location and its country consistent
    unique('locations_id_country_code_key').on(t.id, t.countryCode),
    foreignKey({
      name: 'locations_parent_fkey',
      columns: [t.parentId, t.countryCode],
      foreignColumns: [t.id, t.countryCode],
    }),
    uniqueIndex('locations_city_slug_key').on(t.slug).where(sql`${t.kind} = 'city'`),
    uniqueIndex('locations_region_slug_key')
      .on(t.countryCode, t.slug)
      .where(sql`${t.kind} = 'region'`),
    index('locations_parent_id_idx').on(t.parentId),
    index('locations_center_idx').using('gist', t.center),
  ],
);

/**
 * Postal codes and their places (GeoNames, migration 0008). The posting form searches them, and a
 * listing copies the postal code and place name it was given. `location_id` is the nearest seeded
 * city in the same country, worked out by the seed: the city a listing joins. Rows that leave the
 * source are set inactive, never deleted.
 */
export const postalPlaces = pgTable(
  'postal_places',
  {
    id: id(),
    countryCode: text('country_code')
      .notNull()
      .references(() => countries.code),
    postalCode: text('postal_code').notNull(),
    placeName: text('place_name').notNull(),
    /** Lowercase, umlauts written out (ä→ae, ß→ss), other accents removed: foldLatin() */
    placeSearch: text('place_search').notNull(),
    center: geographyPoint('center').notNull(),
    locationId: uuid('location_id'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [
    check('postal_places_postal_code_check', matches(t.postalCode, PATTERNS.postalCode)),
    check('postal_places_place_name_check', sql`char_length(${t.placeName}) BETWEEN 1 AND 100`),
    foreignKey({
      name: 'postal_places_location_fkey',
      columns: [t.locationId, t.countryCode],
      foreignColumns: [locations.id, locations.countryCode],
    }),
    unique('postal_places_country_code_postal_code_place_name_key').on(t.countryCode, t.postalCode, t.placeName),
    // Prefix search on the code ("120…") and on the place name ("muen…")
    index('postal_places_postal_code_idx').on(t.countryCode, t.postalCode.op('text_pattern_ops')),
    index('postal_places_place_search_idx').on(t.countryCode, t.placeSearch.op('text_pattern_ops')),
    // Nearest postal code to the seller's ~500 m point
    index('postal_places_center_idx').using('gist', t.center),
  ],
);

// ---------------------------------------------------------------------------
// Categories and attribute definitions
// ---------------------------------------------------------------------------

export const PRICE_MODES = ['required', 'optional', 'none'] as const;

export const categories = pgTable(
  'categories',
  {
    ...standardColumns(),
    parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, {
      onDelete: 'restrict',
    }),
    path: ltree('path').notNull().unique('categories_path_key'),
    slug: text('slug').notNull().unique('categories_slug_key'),
    nameFa: text('name_fa').notNull(),
    nameFaNormalized: text('name_fa_normalized').notNull(),
    descriptionFa: text('description_fa'),
    icon: text('icon'),
    allowsListings: boolean('allows_listings').notNull().default(false),
    priceMode: text('price_mode', { enum: PRICE_MODES }).notNull().default('required'),
    listingDurationDays: smallint('listing_duration_days').notNull().default(30),
    maxImages: smallint('max_images').notNull().default(12),
    requiresReview: boolean('requires_review').notNull().default(true),
    businessOnly: boolean('business_only').notNull().default(false),
    sortOrder: smallint('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [
    check('categories_slug_check', matches(t.slug, PATTERNS.slug)),
    check('categories_price_mode_check', isIn(t.priceMode, PRICE_MODES)),
    check(
      'categories_listing_duration_days_check',
      sql`${t.listingDurationDays} BETWEEN 1 AND 365`,
    ),
    check('categories_max_images_check', sql`${t.maxImages} BETWEEN 0 AND 30`),
    check('categories_root_check', sql`(${t.parentId} IS NULL) = (nlevel(${t.path}) = 1)`),
    index('categories_path_idx').using('gist', t.path),
    index('categories_parent_id_sort_order_idx').on(t.parentId, t.sortOrder),
  ],
);

export const ATTRIBUTE_TYPES = ['number', 'select', 'multi_select', 'boolean', 'text', 'date'] as const;

export const categoryAttributes = pgTable(
  'category_attributes',
  {
    ...standardColumns(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    key: text('key').notNull(),
    type: text('type', { enum: ATTRIBUTE_TYPES }).notNull(),
    labelFa: text('label_fa').notNull(),
    unitFa: text('unit_fa'),
    helpFa: text('help_fa'),
    validation: jsonObject('validation'),
    dependsOnAttributeId: uuid('depends_on_attribute_id'),
    isRequired: boolean('is_required').notNull().default(false),
    isFilterable: boolean('is_filterable').notNull().default(false),
    isSearchable: boolean('is_searchable').notNull().default(false),
    showOnCard: boolean('show_on_card').notNull().default(false),
    sortOrder: smallint('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [
    check('category_attributes_key_check', matches(t.key, PATTERNS.attributeKey)),
    check('category_attributes_type_check', isIn(t.type, ATTRIBUTE_TYPES)),
    check('category_attributes_validation_check', isObject(t.validation)),
    foreignKey({
      name: 'category_attributes_depends_on_attribute_id_fkey',
      columns: [t.dependsOnAttributeId],
      foreignColumns: [t.id],
    }),
    // Unique along each path is a seed check: the database can't see across the tree.
    unique('category_attributes_category_id_key_key').on(t.categoryId, t.key),
  ],
);

export const categoryAttributeOptions = pgTable(
  'category_attribute_options',
  {
    ...standardColumns(),
    attributeId: uuid('attribute_id').notNull(),
    value: text('value').notNull(),
    labelFa: text('label_fa').notNull(),
    parentOptionId: uuid('parent_option_id'),
    sortOrder: smallint('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [
    check('category_attribute_options_value_check', matches(t.value, PATTERNS.optionValue)),
    foreignKey({
      name: 'category_attribute_options_attribute_id_fkey',
      columns: [t.attributeId],
      foreignColumns: [categoryAttributes.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'category_attribute_options_parent_option_id_fkey',
      columns: [t.parentOptionId],
      foreignColumns: [t.id],
    }),
    uniqueIndex('category_attribute_options_attribute_id_value_key').on(t.attributeId, t.value),
    index('category_attribute_options_parent_sort_idx').on(
      t.attributeId,
      t.parentOptionId,
      t.sortOrder,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

export const LISTING_KINDS = ['offer', 'wanted'] as const;
export const PRICE_TYPES = ['fixed', 'negotiable', 'free', 'exchange', 'on_request'] as const;
/** city: the city centre; postal_code: the centre of the postal-code area; area: the seller's ~500 m cell */
export const LOCATION_PRECISIONS = ['city', 'postal_code', 'area'] as const;

const active = sql`status = 'active'`;

export const listings = pgTable(
  'listings',
  {
    ...standardColumns(),
    publicToken: text('public_token').notNull().unique('listings_public_token_key'),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'restrict',
    }),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'restrict' }),
    kind: text('kind', { enum: LISTING_KINDS }).notNull().default('offer'),
    title: text('title').notNull().default(''),
    titleNormalized: text('title_normalized').notNull().default(''),
    description: text('description').notNull().default(''),
    descriptionNormalized: text('description_normalized').notNull().default(''),
    attributes: jsonObject('attributes'),
    priceType: text('price_type', { enum: PRICE_TYPES }).notNull().default('fixed'),
    priceMinor: bigint('price_minor', { mode: 'number' }),
    currency: text('currency').references(() => currencies.code),
    countryCode: text('country_code').references(() => countries.code),
    locationId: uuid('location_id'),
    // Optional district or neighbourhood, free text typed by the seller (migration 0006). Never an
    // address: the page shows the city plus this name only.
    district: text('district'),
    districtNormalized: text('district_normalized'),
    // Postal code and place name copied from postal_places (migration 0008). Never a street.
    postalCode: text('postal_code'),
    placeName: text('place_name'),
    point: geographyPoint('point'),
    locationPrecision: text('location_precision', { enum: LOCATION_PRECISIONS }),
    shippingOffered: boolean('shipping_offered').notNull().default(false),
    allowPhoneContact: boolean('allow_phone_contact').notNull().default(false),
    status: text('status', { enum: LISTING_STATUSES }).notNull().default('draft'),
    statusChangedAt: tstz('status_changed_at').notNull().defaultNow(),
    publishedAt: tstz('published_at'),
    rankedAt: tstz('ranked_at'),
    expiresAt: tstz('expires_at'),
    revision: integer('revision').notNull().default(1),
    viewCount: bigint('view_count', { mode: 'number' }).notNull().default(0),
    deletedAt: tstz('deleted_at'),
  },
  (t) => [
    check('listings_public_token_check', matches(t.publicToken, PATTERNS.publicToken)),
    check('listings_kind_check', isIn(t.kind, LISTING_KINDS)),
    check('listings_title_check', sql`char_length(${t.title}) <= 90`),
    check('listings_description_check', sql`char_length(${t.description}) <= 5000`),
    check('listings_attributes_check', isObject(t.attributes)),
    check('listings_price_type_check', isIn(t.priceType, PRICE_TYPES)),
    check('listings_price_minor_check', sql`${t.priceMinor} >= 0`),
    check('listings_district_check', sql`char_length(${t.district}) BETWEEN 1 AND 60`),
    check(
      'listings_district_normalized_check',
      sql`(${t.district} IS NULL) = (${t.districtNormalized} IS NULL)`,
    ),
    check('listings_postal_code_check', matches(t.postalCode, PATTERNS.postalCode)),
    check('listings_place_name_check', sql`char_length(${t.placeName}) BETWEEN 1 AND 100`),
    check('listings_location_precision_check', isIn(t.locationPrecision, LOCATION_PRECISIONS)),
    check('listings_status_check', isIn(t.status, LISTING_STATUSES)),
    // What a listing that is or was out must have. A draft never published can be deleted as it
    // is, so `deleted` is exempt too (migration 0007).
    check(
      'listings_publishable_check',
      sql`${t.status} IN ('draft', 'deleted') OR (
        ${t.categoryId} IS NOT NULL AND ${t.countryCode} IS NOT NULL AND ${t.locationId} IS NOT NULL
        AND ${t.point} IS NOT NULL AND ${t.locationPrecision} IS NOT NULL
        AND char_length(${t.title}) >= 3)`,
    ),
    // Price and currency come together; fixed/negotiable need a price, the others have none
    check('listings_price_currency_check', sql`(${t.priceMinor} IS NULL) = (${t.currency} IS NULL)`),
    check(
      'listings_price_required_check',
      sql`${t.status} IN ('draft', 'deleted') OR (${t.priceType} IN ('fixed', 'negotiable')) = (${t.priceMinor} IS NOT NULL)`,
    ),
    // An active listing is fully dated
    check(
      'listings_active_dates_check',
      sql`${t.status} <> 'active' OR num_nonnulls(${t.publishedAt}, ${t.rankedAt}, ${t.expiresAt}) = 3`,
    ),
    check('listings_deleted_check', sql`(${t.status} = 'deleted') = (${t.deletedAt} IS NOT NULL)`),
    // A listing can never claim Germany while pointing at a Swedish city (decision 10)
    foreignKey({
      name: 'listings_location_fkey',
      columns: [t.locationId, t.countryCode],
      foreignColumns: [locations.id, locations.countryCode],
    }),
    // Browse indexes: partial on active, ending in id DESC for keyset pagination
    index('listings_country_category_ranked_idx')
      .on(t.countryCode, t.categoryId, t.rankedAt.desc().nullsFirst(), t.id.desc().nullsFirst())
      .where(active),
    // Country page: the newest listings of one country, all categories (migration 0008)
    index('listings_country_ranked_idx')
      .on(t.countryCode, t.rankedAt.desc().nullsFirst(), t.id.desc().nullsFirst())
      .where(active),
    index('listings_location_category_ranked_idx')
      .on(t.locationId, t.categoryId, t.rankedAt.desc().nullsFirst(), t.id.desc().nullsFirst())
      .where(active),
    index('listings_location_ranked_idx')
      .on(t.locationId, t.rankedAt.desc().nullsFirst(), t.id.desc().nullsFirst())
      .where(active),
    index('listings_point_idx').using('gist', t.point).where(active),
    // "This postal code only" on browse pages (migration 0012)
    index('listings_country_postal_idx')
      .on(t.countryCode, t.postalCode)
      .where(sql`status = 'active' AND postal_code IS NOT NULL`),
    index('listings_attributes_idx')
      .using('gin', t.attributes.op('jsonb_path_ops'))
      .where(active),
    index('listings_user_id_created_at_idx').on(t.userId, t.createdAt.desc().nullsFirst()),
    index('listings_organization_ranked_idx')
      .on(t.organizationId, t.rankedAt.desc().nullsFirst())
      .where(sql`status = 'active' AND organization_id IS NOT NULL`),
    index('listings_expires_at_idx').on(t.expiresAt).where(active),
    index('listings_review_queue_idx')
      .on(t.statusChangedAt)
      .where(sql`status = 'pending_review'`),
    index('listings_deleted_at_idx').on(t.deletedAt).where(sql`status = 'deleted'`),
  ],
);

export const LISTING_EVENT_TYPES = [
  'created',
  'submitted',
  'published',
  'edited',
  'paused',
  'resumed',
  'sold',
  'expired',
  'renewed',
  'bumped',
  'rejected',
  'restored',
  'deleted',
] as const;
export const LISTING_ACTOR_TYPES = ['user', 'staff', 'system', 'ai', 'payment'] as const;

/** Append-only, enforced by grants (migration 0003) */
export const listingEvents = pgTable(
  'listing_events',
  {
    id: id(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    eventType: text('event_type', { enum: LISTING_EVENT_TYPES }).notNull(),
    actorType: text('actor_type', { enum: LISTING_ACTOR_TYPES }).notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    fromStatus: text('from_status', { enum: LISTING_STATUSES }),
    toStatus: text('to_status', { enum: LISTING_STATUSES }),
    revision: integer('revision').notNull(),
    data: jsonObject('data'),
    moderationDecisionId: uuid('moderation_decision_id'),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: 'listing_events_moderation_decision_id_fkey',
      columns: [t.moderationDecisionId],
      foreignColumns: [moderationDecisions.id],
    }).onDelete('restrict'),
    check('listing_events_event_type_check', isIn(t.eventType, LISTING_EVENT_TYPES)),
    check('listing_events_actor_type_check', isIn(t.actorType, LISTING_ACTOR_TYPES)),
    check('listing_events_from_status_check', isIn(t.fromStatus, LISTING_STATUSES)),
    check('listing_events_to_status_check', isIn(t.toStatus, LISTING_STATUSES)),
    check('listing_events_data_check', isObject(t.data)),
    index('listing_events_listing_id_created_at_idx').on(t.listingId, t.createdAt),
  ],
);

export const favorites = pgTable(
  'favorites',
  {
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ name: 'favorites_pkey', columns: [t.listingId, t.userId] }),
    index('favorites_user_id_created_at_idx').on(t.userId, t.createdAt.desc().nullsFirst()),
  ],
);
