import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { bytea, geographyPoint } from '../types';
import { isIn, isObject, standardColumns, textArrayWithin, tstz } from './_columns';
import { categories, countries, locations } from './listings';
import { users } from './users';

// Module: search (docs/schema.md, section 9).

export const NOTIFY_FREQUENCIES = ['off', 'instant', 'daily'] as const;
export const NOTIFY_CHANNELS = ['email', 'telegram', 'push'] as const;

export const savedSearches = pgTable(
  'saved_searches',
  {
    ...standardColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name'),
    /** The canonical SearchFilters object, validated by the search module's Zod schema */
    filters: jsonb('filters').notNull(),
    /** SHA-256 of the canonical JSON */
    filtersHash: bytea('filters_hash').notNull(),
    // Copied from filters when written, used for matching
    countryCode: text('country_code').references(() => countries.code),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'restrict' }),
    locationId: uuid('location_id').references(() => locations.id),
    point: geographyPoint('point'),
    radiusM: integer('radius_m'),
    keywordNormalized: text('keyword_normalized'),
    notifyFrequency: text('notify_frequency', { enum: NOTIFY_FREQUENCIES })
      .notNull()
      .default('instant'),
    notifyChannels: text('notify_channels', { enum: NOTIFY_CHANNELS })
      .array()
      .notNull()
      .default(sql`'{telegram}'::text[]`),
    lastNotifiedAt: tstz('last_notified_at'),
  },
  (t) => [
    check('saved_searches_name_check', sql`char_length(${t.name}) <= 60`),
    check('saved_searches_filters_check', isObject(t.filters)),
    check('saved_searches_radius_m_check', sql`${t.radiusM} BETWEEN 1000 AND 500000`),
    check('saved_searches_point_radius_check', sql`(${t.point} IS NULL) = (${t.radiusM} IS NULL)`),
    check('saved_searches_notify_frequency_check', isIn(t.notifyFrequency, NOTIFY_FREQUENCIES)),
    check('saved_searches_notify_channels_check', textArrayWithin(t.notifyChannels, NOTIFY_CHANNELS)),
    uniqueIndex('saved_searches_user_id_filters_hash_key').on(t.userId, t.filtersHash),
    index('saved_searches_matching_idx')
      .on(t.countryCode, t.categoryId)
      .where(sql`notify_frequency <> 'off'`),
  ],
);
