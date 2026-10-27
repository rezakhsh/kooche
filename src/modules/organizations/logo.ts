import { createHash, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import type { Db, Queryable } from '../../db/drizzle';
import { organizations, outboxEvents } from '../../db/schema';
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES } from '../media/limits';
import { ObjectTooLargeError, type ObjectStorage, type PresignedPut } from '../media/storage';

// A business's logo (wave 1, mockup final/business-new). Like a listing photo, the browser uploads
// the original straight to R2 through a presigned PUT, under uploads/ (deleted after a day if never
// used, docs/setup.md); the business form sends the key back, and the worker re-encodes it into a
// square 512 px WebP without metadata, sets logo_key and deletes the original and the old logo.
// The form may run before the business exists (step 1), so the key carries the user, not the
// business: only the user who asked for the upload can use it.

export const LOGO_OUTBOX = { uploaded: 'organization.logo_uploaded', deleted: 'organization.logo_deleted' } as const;
const UPLOAD_URL_SECONDS = 300;
const LOGO_EDGE = 512;
const MAX_PIXELS = 40_000_000;

const keyPattern = (userId: string) => new RegExp(`^uploads/logos/${userId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`);

/** A one-time upload URL for a logo, valid for 5 minutes */
export async function requestLogoUpload(
  storage: ObjectStorage,
  opts: { userId: string; contentType: string; size: number },
): Promise<{ ok: true; key: string; upload: PresignedPut } | { ok: false; reason: 'bad_type' | 'too_large' }> {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(opts.contentType)) return { ok: false, reason: 'bad_type' };
  if (!Number.isSafeInteger(opts.size) || opts.size <= 0 || opts.size > MAX_UPLOAD_BYTES) return { ok: false, reason: 'too_large' };
  const key = `uploads/logos/${opts.userId}/${randomUUID()}`;
  const upload = await storage.presignPut(key, { contentType: opts.contentType, contentLength: opts.size, expiresSeconds: UPLOAD_URL_SECONDS });
  return { ok: true, key, upload };
}

/** Whether the form's logo key is an upload this user asked for */
export function ownLogoUpload(userId: string, key: string): boolean {
  return keyPattern(userId).test(key);
}

/** Inside the business's create or edit transaction: the worker makes the logo from the upload */
export async function queueLogo(tx: Queryable, organizationId: string, uploadKey: string): Promise<void> {
  await tx.insert(outboxEvents).values({ eventType: LOGO_OUTBOX.uploaded, aggregateType: 'organization', aggregateId: organizationId, payload: { uploadKey } });
}

/** Inside the edit transaction: the logo goes now, its file through the worker */
export async function removeLogo(tx: Queryable, org: { id: string; logoKey: string | null }): Promise<void> {
  if (!org.logoKey) return;
  await tx.update(organizations).set({ logoKey: null }).where(eq(organizations.id, org.id));
  await tx.insert(outboxEvents).values({ eventType: LOGO_OUTBOX.deleted, aggregateType: 'organization', aggregateId: org.id, payload: { storageKey: org.logoKey } });
}

/** The stored logo, square and centred, without metadata. Throws when the bytes aren't an image. */
export async function encodeLogo(input: Buffer): Promise<Buffer> {
  const meta = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).metadata();
  if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) throw new Error(`not an image: ${meta.format ?? 'unknown'}`);
  return sharp(input, { limitInputPixels: MAX_PIXELS, failOn: 'error' })
    .rotate()
    .resize({ width: LOGO_EDGE, height: LOGO_EDGE, fit: 'cover', position: 'centre', withoutEnlargement: false })
    .flatten({ background: '#ffffff' })
    .webp({ quality: 88, effort: 4 })
    .toBuffer();
}

export type LogoOutcome = { status: 'ready'; key: string } | { status: 'rejected'; reason: 'not_an_image' | 'too_large' | 'missing' } | { status: 'skipped' };

/** Worker: makes the logo from an upload. Storage and database errors throw, so the job retries. */
export async function processLogo(db: Db, storage: ObjectStorage, organizationId: string, uploadKey: string): Promise<LogoOutcome> {
  if (!uploadKey.startsWith('uploads/logos/')) return { status: 'skipped' };
  let original: Buffer | null;
  try {
    original = await storage.get(uploadKey, MAX_UPLOAD_BYTES);
  } catch (e) {
    if (!(e instanceof ObjectTooLargeError)) throw e;
    await storage.delete(uploadKey);
    return { status: 'rejected', reason: 'too_large' };
  }
  if (!original) return { status: 'rejected', reason: 'missing' };
  let logo: Buffer;
  try {
    logo = await encodeLogo(original);
  } catch {
    await storage.delete(uploadKey);
    return { status: 'rejected', reason: 'not_an_image' };
  }
  const sha = createHash('sha256').update(logo).digest('hex');
  const key = `logos/${sha.slice(0, 2)}/${organizationId}-${sha.slice(0, 12)}.webp`;
  await storage.put(key, logo, 'image/webp');
  const old = await db.transaction(async (tx) => {
    const [org] = await tx.select({ logoKey: organizations.logoKey, status: organizations.status }).from(organizations).where(eq(organizations.id, organizationId)).for('update');
    if (!org || org.status === 'deleted') return undefined;
    await tx.update(organizations).set({ logoKey: key }).where(eq(organizations.id, organizationId));
    return org.logoKey;
  });
  await storage.delete(uploadKey);
  if (old === undefined) {
    await storage.delete(key);
    return { status: 'skipped' };
  }
  if (old && old !== key) await storage.delete(old);
  return { status: 'ready', key };
}
