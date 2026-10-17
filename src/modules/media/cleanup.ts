import { sql } from 'drizzle-orm';
import type { Db } from '../../db/drizzle';
import type { ObjectStorage } from './storage';

// Photo slots whose upload never finished (the browser closed, the upload failed) are removed
// after 24 hours (docs/schema.md, listing_images_abandoned_idx), together with any original that
// did arrive. An R2 lifecycle rule on uploads/ deletes stray originals after 1 day as well.

const BATCH = 200;
const MAX_BATCHES = 50;

export async function cleanupAbandonedUploads(db: Db, storage: ObjectStorage, now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 86_400_000).toISOString();
  let total = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const removed = await db.transaction(async (tx) => {
      const rows = await tx.execute<{ id: string; listing_id: string; storage_key: string }>(sql`
        DELETE FROM listing_images
        WHERE id IN (
          SELECT id FROM listing_images
          WHERE status IN ('pending_upload', 'processing') AND created_at < ${cutoff}::timestamptz
          ORDER BY created_at LIMIT ${BATCH}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, listing_id, storage_key
      `);
      if (rows.length) {
        // Close the gaps the removed photos left
        await tx.execute(sql`SET CONSTRAINTS listing_images_listing_id_position_key DEFERRED`);
        await tx.execute(sql`
          UPDATE listing_images i SET position = r.pos
          FROM (
            SELECT id, (row_number() OVER (PARTITION BY listing_id ORDER BY position) - 1)::smallint AS pos
            FROM listing_images WHERE listing_id IN ${sql`(${sql.join([...new Set(rows.map((r) => r.listing_id))].map((id) => sql`${id}::uuid`), sql`, `)})`}
          ) r
          WHERE i.id = r.id AND i.position <> r.pos
        `);
      }
      return rows;
    });
    for (const r of removed) await storage.delete(r.storage_key);
    total += removed.length;
    if (removed.length < BATCH) break;
  }
  return total;
}
