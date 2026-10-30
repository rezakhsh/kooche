import { sql } from 'drizzle-orm';
import type { Db } from '../../db/drizzle';
import type { ObjectStorage } from '../media/storage';

// Deleted listings are purged 12 months after `deleted_at` (docs/schema.md, section 14; privacy
// policy section 9), with their photos, events, favorites and history (ON DELETE CASCADE). One
// still referenced by a report, a moderation decision (also about one of its photos), an order,
// an entitlement or a chat stays until that goes (RESTRICT keeps the evidence). Run daily by the
// worker as classifieds_worker (it may delete listings; the cascades run as the table owner).
// Built after the code check of Oct 30, 2026: the promise had no job behind it.

export const DELETED_LISTING_KEEP_MONTHS = 12;
const BATCH = 100;
const MAX_BATCHES = 20;
const FOREIGN_KEY_VIOLATION = '23503';

export async function purgeDeletedListings(db: Db, storage: ObjectStorage | null, now: Date = new Date()): Promise<{ purged: number; photos: number }> {
  let purged = 0;
  let photos = 0;
  const skipped = new Set<string>();
  for (let i = 0; i < MAX_BATCHES; i++) {
    const due = await db.execute<{ id: string }>(sql`
      SELECT l.id FROM listings l
      WHERE l.status = 'deleted'
        AND l.deleted_at < ${now.toISOString()}::timestamptz - make_interval(months => ${DELETED_LISTING_KEEP_MONTHS})
        AND NOT EXISTS (SELECT 1 FROM reports r WHERE r.listing_id = l.id)
        AND NOT EXISTS (SELECT 1 FROM moderation_decisions d WHERE d.listing_id = l.id)
        AND NOT EXISTS (SELECT 1 FROM moderation_decisions d JOIN listing_images im ON im.id = d.listing_image_id WHERE im.listing_id = l.id)
        AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.listing_id = l.id)
        AND NOT EXISTS (SELECT 1 FROM entitlements e WHERE e.listing_id = l.id)
        AND NOT EXISTS (SELECT 1 FROM conversations c WHERE c.listing_id = l.id)
        ${skipped.size ? sql`AND l.id NOT IN (${sql.join([...skipped].map((id) => sql`${id}::uuid`), sql`, `)})` : sql``}
      ORDER BY l.deleted_at
      LIMIT ${BATCH}`);
    for (const { id } of due) {
      try {
        const keys = await db.transaction(async (tx) => {
          const images = await tx.execute<{ storage_key: string }>(sql`SELECT storage_key FROM listing_images WHERE listing_id = ${id}::uuid`);
          const gone = await tx.execute(sql`DELETE FROM listings WHERE id = ${id}::uuid AND status = 'deleted' RETURNING 1`);
          return gone.length ? images.map((r) => r.storage_key) : null;
        });
        if (!keys) continue;
        purged++;
        // The files after the rows: a failed delete leaves a stray file, never a row without its photo
        if (storage) for (const key of keys) await storage.delete(key);
        photos += keys.length;
      } catch (e) {
        // Something else still points at it (a reference this list doesn't know): it stays
        if ((e as { code?: string }).code !== FOREIGN_KEY_VIOLATION && (e as { cause?: { code?: string } }).cause?.code !== FOREIGN_KEY_VIOLATION) throw e;
        skipped.add(id);
      }
    }
    if (due.length < BATCH) break;
  }
  return { purged, photos };
}
