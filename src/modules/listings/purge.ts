import { sql } from 'drizzle-orm';
import type { Db } from '../../db/drizzle';
import type { ObjectStorage } from '../media/storage';

// Deleted listings are purged 12 months after `deleted_at` (docs/schema.md, section 14; privacy
// policy section 9), with their photos, events, favorites, history and chats. purge_deleted_listing()
// (migration 0041, Check B) keeps one that is still evidence (a report, an order, an entitlement, a
// decision under 2 years or tied to a report, sanction or appeal, a reported message) and otherwise
// removes it with its decisions past their 2 years. Before, a chat or a decision kept it for good.
// Run daily by the worker as classifieds_worker. Built after the code check of Oct 30, 2026.

export const DELETED_LISTING_KEEP_MONTHS = 12;
const BATCH = 100;
const MAX_BATCHES = 20;

export async function purgeDeletedListings(db: Db, storage: ObjectStorage | null, now: Date = new Date()): Promise<{ purged: number; photos: number }> {
  let purged = 0;
  let photos = 0;
  const skipped = new Set<string>();
  for (let i = 0; i < MAX_BATCHES; i++) {
    const due = await db.execute<{ id: string }>(sql`
      SELECT l.id FROM listings l
      WHERE l.status = 'deleted'
        AND l.deleted_at < ${now.toISOString()}::timestamptz - make_interval(months => ${DELETED_LISTING_KEEP_MONTHS})
        ${skipped.size ? sql`AND l.id NOT IN (${sql.join([...skipped].map((id) => sql`${id}::uuid`), sql`, `)})` : sql``}
      ORDER BY l.deleted_at
      LIMIT ${BATCH}`);
    for (const { id } of due) {
      const [row] = await db.execute<{ keys: string[] | null }>(sql`SELECT purge_deleted_listing(${id}::uuid) AS keys`);
      // Still evidence: it stays, and isn't asked about again in this run
      if (!row?.keys) {
        skipped.add(id);
        continue;
      }
      purged++;
      // The files after the rows: a failed delete leaves a stray file, never a row without its photo
      if (storage) for (const key of row.keys) await storage.delete(key);
      photos += row.keys.length;
    }
    if (due.length < BATCH) break;
  }
  return { purged, photos };
}
