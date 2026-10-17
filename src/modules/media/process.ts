import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import sharp from 'sharp';
import { rgbaToThumbHash } from 'thumbhash';
import type { Db } from '../../db/drizzle';
import { listingImages, listings } from '../../db/schema';
import { imagesEdited, MAX_UPLOAD_BYTES } from './images';
import { phash64 } from './phash';
import { ObjectTooLargeError, type ObjectStorage } from './storage';

// Worker: turns an uploaded original into the stored master (docs/architecture.md, "Images").
// Decoding proves the file is an image; re-encoding drops anything hidden in it; all metadata
// (EXIF with the phone's GPS position, XMP, IPTC, ICC) is stripped. imgproxy makes every size
// from the master, so no variants are stored.
//
// Memory: one image at a time (the media queue runs with concurrency 1), libvips' operation cache
// off, at most 40 megapixels decoded. A 40 MP photo needs ~160 MB while decoding.

sharp.cache(false);
sharp.concurrency(1);

const MAX_PIXELS = 40_000_000;
const MAX_EDGE = 2560;
const MASTER_QUALITY = 85;
const DECODABLE = new Set(['jpeg', 'png', 'webp']);

export type ProcessOutcome =
  | { status: 'ready'; key: string }
  | { status: 'rejected'; reason: 'not_an_image' | 'too_large' | 'missing' }
  | { status: 'skipped' };

/** Re-encodes and describes an image. Throws when the bytes aren't a decodable image. */
export async function encodeMaster(input: Buffer) {
  const meta = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).metadata();
  if (!meta.format || !DECODABLE.has(meta.format)) throw new NotAnImageError(meta.format ?? 'unknown');

  // rotate() applies the EXIF orientation before the metadata goes; sharp writes no metadata
  // unless asked to (no keepMetadata/withMetadata here), and converts to sRGB.
  const master = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: 'error' })
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: MASTER_QUALITY, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  const thumb = await sharp(master.data)
    .resize({ width: 100, height: 100, fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const blurPlaceholder = Buffer.from(rgbaToThumbHash(thumb.info.width, thumb.info.height, thumb.data)).toString(
    'base64',
  );

  const grey = await sharp(master.data).greyscale().resize(32, 32, { fit: 'fill' }).raw().toBuffer();

  return {
    data: master.data,
    width: master.info.width,
    height: master.info.height,
    blurPlaceholder,
    phash: phash64(grey),
    sha256: createHash('sha256').update(master.data).digest(),
  };
}

export class NotAnImageError extends Error {}

/** Storage key of a master: spread over 256 prefixes, named after the image row */
export function masterKey(imageId: string, sha256: Buffer): string {
  return `listings/${sha256.subarray(0, 1).toString('hex')}/${imageId}.webp`;
}

/**
 * Processes one uploaded photo. A file that isn't an image (or is too big) is rejected and its
 * original deleted. Storage or database errors are thrown, so BullMQ retries the job.
 */
export async function processImage(db: Db, storage: ObjectStorage, imageId: string): Promise<ProcessOutcome> {
  const [image] = await db.select().from(listingImages).where(eq(listingImages.id, imageId));
  if (!image || image.status !== 'processing') return { status: 'skipped' };

  const reject = async (reason: 'not_an_image' | 'too_large' | 'missing') => {
    await db
      .update(listingImages)
      .set({ status: 'rejected', processedAt: new Date() })
      .where(eq(listingImages.id, image.id));
    await storage.delete(image.storageKey);
    return { status: 'rejected' as const, reason };
  };

  let original: Buffer | null;
  try {
    original = await storage.get(image.storageKey, MAX_UPLOAD_BYTES);
  } catch (e) {
    if (e instanceof ObjectTooLargeError) return reject('too_large');
    throw e;
  }
  if (!original) return reject('missing');

  let master: Awaited<ReturnType<typeof encodeMaster>>;
  try {
    master = await encodeMaster(original);
  } catch {
    // Anything sharp can't decode, a format we don't take, or more than 40 megapixels
    return reject('not_an_image');
  }

  const key = masterKey(image.id, master.sha256);
  await storage.put(key, master.data, 'image/webp');

  const updated = await db.transaction(async (tx) => {
    const [listing] = await tx.select().from(listings).where(eq(listings.id, image.listingId)).for('update');
    const [row] = await tx
      .update(listingImages)
      .set({
        status: 'ready',
        storageKey: key,
        mimeType: 'image/webp',
        width: master.width,
        height: master.height,
        byteSize: master.data.length,
        blurPlaceholder: master.blurPlaceholder,
        phash: master.phash,
        sha256: master.sha256,
        processedAt: new Date(),
      })
      .where(and(eq(listingImages.id, image.id), eq(listingImages.status, 'processing')))
      .returning({ id: listingImages.id });
    // A new photo on a listing that is out is an edit: new revision, post-checks again
    if (row && listing && listing.status !== 'draft' && listing.status !== 'deleted') {
      await imagesEdited(tx, listing, { added: image.id }, 'system', null);
    }
    return !!row;
  });

  if (!updated) {
    // The seller removed the photo while it was being processed
    await storage.delete(key);
    await storage.delete(image.storageKey);
    return { status: 'skipped' };
  }
  await storage.delete(image.storageKey);
  return { status: 'ready', key };
}

/** Marks a photo failed after its last retry */
export async function markImageFailed(db: Db, imageId: string): Promise<void> {
  await db
    .update(listingImages)
    .set({ status: 'failed', processedAt: new Date() })
    .where(eq(listingImages.id, imageId));
}
