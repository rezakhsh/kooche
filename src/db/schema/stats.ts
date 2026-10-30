import { sql } from 'drizzle-orm';
import { check, date, integer, pgTable, primaryKey, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, isIn, matches, tstz } from './_columns';
import { users } from './users';

// Visitor numbers (owner, Oct 30, 2026: our own counter instead of Google Analytics; docs/setup.md,
// "Visitor numbers"; src/modules/stats/visits.ts). Daily totals only: no visitor, IP or cookie is
// ever stored. The worker writes them from Valkey's counters every few minutes.

export const VISIT_DIMENSIONS = ['total', 'source', 'country', 'page', 'device'] as const;

/** One day's views and visitors of one key of one dimension (Berlin days) */
export const visitStats = pgTable(
  'visit_stats',
  {
    day: date('day').notNull(),
    dimension: text('dimension', { enum: VISIT_DIMENSIONS }).notNull(),
    key: text('key').notNull(),
    views: integer('views').notNull().default(0),
    visitors: integer('visitors').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.day, t.dimension, t.key] }),
    check('visit_stats_dimension_check', isIn(t.dimension, VISIT_DIMENSIONS)),
    check('visit_stats_key_check', sql`char_length(${t.key}) BETWEEN 1 AND 120`),
    check('visit_stats_counts_check', sql`${t.views} >= 0 AND ${t.visitors} >= 0`),
  ],
);

/** The owner's personal links and QR codes (`?ref=<code>`), one per contact or poster */
export const refCodes = pgTable(
  'ref_codes',
  {
    id: id(),
    createdAt: createdAt(),
    code: text('code').notNull(),
    /** Whom it is for, e.g. «Volek Events» or «پوستر بازارچه حافظ» */
    label: text('label').notNull(),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    archivedAt: tstz('archived_at'),
  },
  (t) => [
    uniqueIndex('ref_codes_code_key').on(t.code),
    check('ref_codes_code_check', matches(t.code, '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$')),
    check('ref_codes_label_check', sql`char_length(${t.label}) BETWEEN 1 AND 80`),
  ],
);
