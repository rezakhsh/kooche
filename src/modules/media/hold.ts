import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db/drizzle';
import { listingImages, listings } from '../../db/schema';
import { IMAGE_SIZES, imgproxyUrl, type ImageFormat, type ImageSize, type ImgproxyConfig } from './imgproxy';
import { MAX_UPLOAD_BYTES } from './limits';
import type { ObjectStorage } from './storage';

// Photos of a listing nobody may see (taken down, deleted) are moved where no published address
// reaches them, and back when it is live again (Check B, Oct 31, 2026: the terms promise to
// "remove or disable access without delay", but image addresses never change and Cloudflare keeps
// copies for a year). The old addresses then find nothing; staff and the seller still see the
// photos through new signed addresses of the `held/` key. The caller purges the old addresses
// from Cloudflare afterwards (moving first, so a refetch finds nothing). Deleted listings'
// masters stay held until the 12-month purge (src/modules/listings/purge.ts).

export const HELD_PREFIX = 'held/';
const HIDDEN_STATUSES = new Set(['rejected', 'deleted']);

/**
 * Moves the listing's photos in or out of `held/` to match its status. Returns the keys whose
 * public addresses changed (the old ones, to purge). Safe to run again after a failure: the copy
 * comes first, and the key no longer in use is deleted every time.
 */
export async function syncPhotoVisibility(db: Db, storage: ObjectStorage, listingId: string): Promise<string[]> {
  const [listing] = await db.select({ status: listings.status }).from(listings).where(eq(listings.id, listingId));
  if (!listing) return [];
  const hide = HIDDEN_STATUSES.has(listing.status);
  const images = await db
    .select({ id: listingImages.id, key: listingImages.storageKey })
    .from(listingImages)
    .where(and(eq(listingImages.listingId, listingId), eq(listingImages.status, 'ready')));
  const changed: string[] = [];
  for (const image of images) {
    const held = image.key.startsWith(HELD_PREFIX);
    const shown = held ? image.key.slice(HELD_PREFIX.length) : image.key;
    // The usual case: a live listing whose photos were never held
    if (!hide && !held) continue;
    const target = hide ? `${HELD_PREFIX}${shown}` : shown;
    if (image.key !== target) {
      const body = await storage.get(image.key, MAX_UPLOAD_BYTES);
      if (body) await storage.put(target, body, 'image/webp');
      await db.update(listingImages).set({ storageKey: target }).where(eq(listingImages.id, image.id));
      changed.push(image.key);
    }
    // The copy no longer in use, also when an earlier run stopped after the update
    await storage.delete(hide ? shown : `${HELD_PREFIX}${shown}`);
    if (hide && image.key === target) changed.push(shown);
  }
  return changed;
}

/** Every public address of one photo: each size in each format */
export function imageUrlsOf(config: ImgproxyConfig, storageKey: string): string[] {
  const formats: ImageFormat[] = ['avif', 'webp'];
  return (Object.keys(IMAGE_SIZES) as ImageSize[]).flatMap((size) => formats.map((f) => imgproxyUrl(config, storageKey, size, f)));
}
