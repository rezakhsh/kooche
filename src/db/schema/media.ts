import { sql } from 'drizzle-orm';
import { bigint, check, index, integer, pgTable, smallint, text, uuid } from 'drizzle-orm/pg-core';
import { bytea } from '../types';
import { isIn, standardColumns, tstz } from './_columns';
import { listings } from './listings';
import { users } from './users';

// Module: media (docs/schema.md, section 8, listing_images).

export const LISTING_IMAGE_STATUSES = [
  'pending_upload',
  'processing',
  'ready',
  'rejected',
  'failed',
] as const;

// UNIQUE (listing_id, position) DEFERRABLE INITIALLY IMMEDIATE is in migration 0002:
// drizzle-kit can't declare a deferrable constraint. Reordering swaps positions in one
// transaction with SET CONSTRAINTS listing_images_listing_id_position_key DEFERRED.
export const listingImages = pgTable(
  'listing_images',
  {
    ...standardColumns(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    uploaderUserId: uuid('uploader_user_id')
      .notNull()
      .references(() => users.id),
    position: smallint('position').notNull(),
    storageKey: text('storage_key').notNull().unique('listing_images_storage_key_key'),
    status: text('status', { enum: LISTING_IMAGE_STATUSES }).notNull().default('pending_upload'),
    mimeType: text('mime_type'),
    width: integer('width'),
    height: integer('height'),
    byteSize: integer('byte_size'),
    blurPlaceholder: text('blur_placeholder'),
    phash: bigint('phash', { mode: 'bigint' }),
    // Four 16-bit bands of the pHash, each tagged with its position, for near-duplicate search.
    // STORED explicitly: PostgreSQL 18 defaults to VIRTUAL, and virtual columns can't be indexed.
    phashBands: integer('phash_bands')
      .array()
      .generatedAlwaysAs(
        sql`CASE WHEN phash IS NULL THEN NULL ELSE ARRAY[
          ((phash >> 48) & 65535)::int,
          ((phash >> 32) & 65535)::int + 65536,
          ((phash >> 16) & 65535)::int + 131072,
          ( phash        & 65535)::int + 196608 ]
        END`,
      ),
    sha256: bytea('sha256'),
    processedAt: tstz('processed_at'),
  },
  (t) => [
    check('listing_images_position_check', sql`${t.position} BETWEEN 0 AND 29`),
    check('listing_images_status_check', isIn(t.status, LISTING_IMAGE_STATUSES)),
    check('listing_images_width_check', sql`${t.width} > 0`),
    check('listing_images_height_check', sql`${t.height} > 0`),
    check(
      'listing_images_blur_placeholder_check',
      sql`char_length(${t.blurPlaceholder}) <= 64`,
    ),
    check(
      'listing_images_ready_check',
      sql`${t.status} <> 'ready' OR num_nonnulls(${t.mimeType}, ${t.width}, ${t.height}, ${t.byteSize},
        ${t.blurPlaceholder}, ${t.phash}, ${t.sha256}, ${t.processedAt}) = 8`,
    ),
    index('listing_images_phash_bands_idx')
      .using('gin', t.phashBands)
      .where(sql`status = 'ready'`),
    index('listing_images_sha256_idx').on(t.sha256).where(sql`status = 'ready'`),
    index('listing_images_abandoned_idx')
      .on(t.createdAt)
      .where(sql`status IN ('pending_upload', 'processing')`),
  ],
);
