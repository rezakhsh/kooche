import { randomUUID } from 'node:crypto';
import { and, asc, count, eq, gt, ne, sql } from 'drizzle-orm';
import type { Db, Queryable } from '../../db/drizzle';
import { listingImages, listings, outboxEvents } from '../../db/schema';
import { cachedCatalog } from '../listings/catalog';
import { LISTING_OUTBOX, recordChange } from '../listings/events';
import { maxImages } from '../listings/listings';
import { manageableBy } from '../organizations/limits';
import { canPostListing, loadActor, type Denied } from '../users/permissions';
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES } from './limits';
import type { ObjectStorage, PresignedPut } from './storage';

// Listing photos, the web side (docs/schema.md, listing_images). The browser uploads the original
// straight to R2 through a presigned PUT; the app never carries image bytes. The worker then
// re-encodes it (./process.ts). Only the owner of the listing can add, move or remove its photos:
// every query finds the listing by id and owner together.

export { ACCEPTED_TYPES, MAX_UPLOAD_BYTES } from './limits';
const UPLOAD_URL_SECONDS = 300;

export const IMAGE_OUTBOX = {
  uploaded: 'listing_image.uploaded',
  deleted: 'listing_image.deleted',
} as const;

/** Listings whose photos can change */
const EDITABLE = ['draft', 'active', 'paused', 'expired', 'rejected'] as const;

type Refusal = Denied | 'not_found' | 'not_allowed' | 'too_many' | 'bad_type' | 'too_large';

async function lockOwnListing(tx: Queryable, userId: string, listingId: string) {
  const [row] = await tx
    .select()
    .from(listings)
    .where(and(eq(listings.id, listingId), manageableBy(userId), ne(listings.status, 'deleted')))
    .for('update');
  return row && (EDITABLE as readonly string[]).includes(row.status) ? row : null;
}

/** The image row with its listing, if the user may manage the listing; the listing row is locked */
async function lockOwnImage(tx: Queryable, userId: string, imageId: string) {
  const [image] = await tx.select().from(listingImages).where(eq(listingImages.id, imageId));
  if (!image) return null;
  const listing = await lockOwnListing(tx, userId, image.listingId);
  return listing ? { image, listing } : null;
}

/**
 * Reserves a photo slot and returns a presigned upload URL valid for 5 minutes. The listing row
 * is locked, so two uploads at once can't both take the last slot.
 */
export async function requestUpload(
  db: Db,
  storage: ObjectStorage,
  opts: { userId: string; listingId: string; contentType: string; size: number },
): Promise<{ ok: true; imageId: string; upload: PresignedPut } | { ok: false; reason: Refusal }> {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(opts.contentType)) return { ok: false, reason: 'bad_type' };
  if (!Number.isSafeInteger(opts.size) || opts.size <= 0 || opts.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: 'too_large' };
  }
  const catalog = await cachedCatalog(db);
  const reserved = await db.transaction(async (tx) => {
    const allowed = canPostListing(await loadActor(tx, opts.userId));
    if (!allowed.ok) return allowed;
    const listing = await lockOwnListing(tx, opts.userId, opts.listingId);
    if (!listing) return { ok: false as const, reason: 'not_found' as const };

    const [{ n, last }] = (await tx
      .select({ n: count(), last: sql<number | null>`max(${listingImages.position})` })
      .from(listingImages)
      .where(eq(listingImages.listingId, listing.id))) as [{ n: number; last: number | null }];
    const limit = maxImages(listing.categoryId ? catalog.byId.get(listing.categoryId) : undefined);
    if (n >= limit) return { ok: false as const, reason: 'too_many' as const };

    const key = `uploads/${listing.id}/${randomUUID()}`;
    const [image] = await tx
      .insert(listingImages)
      .values({
        listingId: listing.id,
        uploaderUserId: opts.userId,
        position: (last ?? -1) + 1,
        storageKey: key,
      })
      .returning({ id: listingImages.id });
    return { ok: true as const, imageId: image!.id, key };
  });
  if (!reserved.ok) return reserved;

  const upload = await storage.presignPut(reserved.key, {
    contentType: opts.contentType,
    contentLength: opts.size,
    expiresSeconds: UPLOAD_URL_SECONDS,
  });
  return { ok: true, imageId: reserved.imageId, upload };
}

/** The browser finished its upload: hand the photo to the worker */
export async function confirmUpload(
  db: Db,
  opts: { userId: string; imageId: string },
): Promise<{ ok: true } | { ok: false; reason: 'not_found' }> {
  return db.transaction(async (tx) => {
    const own = await lockOwnImage(tx, opts.userId, opts.imageId);
    if (!own || own.image.status !== 'pending_upload') return { ok: false, reason: 'not_found' };
    await tx.update(listingImages).set({ status: 'processing' }).where(eq(listingImages.id, own.image.id));
    await tx.insert(outboxEvents).values({
      eventType: IMAGE_OUTBOX.uploaded,
      aggregateType: 'listing_image',
      aggregateId: own.image.id,
      payload: { listingId: own.listing.id },
    });
    return { ok: true };
  });
}

/**
 * Removes a photo. The file is deleted from R2 by the worker through the outbox; the row goes at
 * once and the photos after it move up. On a listing that is out, this is an edit.
 */
export async function removeImage(
  db: Db,
  opts: { userId: string; imageId: string },
): Promise<{ ok: true } | { ok: false; reason: 'not_found' }> {
  return db.transaction(async (tx) => {
    const own = await lockOwnImage(tx, opts.userId, opts.imageId);
    if (!own) return { ok: false, reason: 'not_found' };
    const { image, listing } = own;
    await tx.delete(listingImages).where(eq(listingImages.id, image.id));
    await tx.execute(sql`SET CONSTRAINTS listing_images_listing_id_position_key DEFERRED`);
    await tx
      .update(listingImages)
      .set({ position: sql`${listingImages.position} - 1` })
      .where(and(eq(listingImages.listingId, listing.id), gt(listingImages.position, image.position)));
    await tx.insert(outboxEvents).values({
      eventType: IMAGE_OUTBOX.deleted,
      aggregateType: 'listing_image',
      aggregateId: image.id,
      // The row is gone, so the key travels with the event (like erase_user's avatar key)
      payload: { listingId: listing.id, storageKey: image.storageKey },
    });
    if (listing.status !== 'draft' && image.status === 'ready') {
      await imagesEdited(tx, listing, { removed: image.id }, 'user', opts.userId);
    }
    return { ok: true };
  });
}

/** Moves a photo one place earlier or later, or to the front (the cover) */
export async function moveImage(
  db: Db,
  opts: { userId: string; imageId: string; to: 'first' | 'earlier' | 'later' },
): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'not_allowed' }> {
  return db.transaction(async (tx) => {
    const own = await lockOwnImage(tx, opts.userId, opts.imageId);
    if (!own) return { ok: false, reason: 'not_found' };
    const { image, listing } = own;
    const order = await tx
      .select({ id: listingImages.id, position: listingImages.position })
      .from(listingImages)
      .where(eq(listingImages.listingId, listing.id))
      .orderBy(asc(listingImages.position));
    const ids = order.map((r) => r.id);
    const from = ids.indexOf(image.id);
    const target = opts.to === 'first' ? 0 : opts.to === 'earlier' ? from - 1 : from + 1;
    if (target < 0 || target >= ids.length || target === from) return { ok: false, reason: 'not_allowed' };
    ids.splice(from, 1);
    ids.splice(target, 0, image.id);

    await tx.execute(sql`SET CONSTRAINTS listing_images_listing_id_position_key DEFERRED`);
    for (const [position, id] of ids.entries()) {
      if (order[position]?.id !== id) {
        await tx.update(listingImages).set({ position }).where(eq(listingImages.id, id));
      }
    }
    if (listing.status !== 'draft') await imagesEdited(tx, listing, { reordered: true }, 'user', opts.userId);
    return { ok: true };
  });
}

/**
 * Photos are content: on a listing that is out, a photo added (by the worker, once processed),
 * removed or moved is an edit with a new revision, and the post-checks run again.
 */
export async function imagesEdited(
  tx: Queryable,
  listing: { id: string; status: (typeof listings.$inferSelect)['status']; revision: number },
  data: Record<string, unknown>,
  actorType: 'user' | 'system',
  actorUserId: string | null,
): Promise<void> {
  const revision = listing.revision + 1;
  await tx.update(listings).set({ revision }).where(eq(listings.id, listing.id));
  await recordChange(tx, {
    listingId: listing.id,
    event: 'edited',
    outbox: LISTING_OUTBOX.updated,
    actorType,
    actorUserId,
    from: listing.status,
    to: listing.status,
    revision,
    data: { images: data },
  });
}
