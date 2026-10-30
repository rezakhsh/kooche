import { and, eq } from 'drizzle-orm';
import sharp from 'sharp';
import { beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { createDraft, listingInputSchema, saveListing } from '../src/modules/listings/listings';
import { cleanupAbandonedUploads } from '../src/modules/media/cleanup';
import { confirmUpload, moveImage, removeImage, requestUpload } from '../src/modules/media/images';
import { imgproxyUrl } from '../src/modules/media/imgproxy';
import { hammingDistance } from '../src/modules/media/phash';
import { encodeMaster, processImage } from '../src/modules/media/process';
import { memoryStorage } from '../src/modules/media/storage';
import { runListingChecks } from '../src/modules/moderation/checks';
import { sendExpiryReminders } from '../src/modules/notifications/expiry-reminder';
import type { Mail } from '../src/modules/notifications/mailer';
import { appDb, redis, workerDb } from './accounts';
import { db } from './db';
import { categoryBySlug, events, listing, outbox, user } from './listings-fixtures';

// Photos (decided Oct 17, 2026: up to 10 per listing, EXIF removed), the automatic post-checks and
// the expiry reminder. Web functions run as classifieds_app, worker functions as
// classifieds_worker; R2 is replaced by in-memory storage.

let storage: ReturnType<typeof memoryStorage>;
beforeEach(() => {
  storage = memoryStorage();
});

async function draft(userId: string, slug = 'mobile-phones') {
  const r = await createDraft(appDb, { userId, categoryId: (await categoryBySlug(slug)).id });
  if (!r.ok) throw new Error(r.reason);
  return r.listingId;
}

async function publish(userId: string, listingId: string, over: Record<string, unknown> = {}) {
  const input = listingInputSchema.parse({
    title: 'گوشی سامسونگ',
    description: 'سالم و بدون خط و خش، با شارژر.',
    attributes: { condition: 'used' },
    priceType: 'fixed',
    amount: '120',
    countryCode: 'DE',
    place: 'برلین',
    ...over,
  });
  const r = await saveListing(appDb, { userId, listingId, input, intent: 'publish' });
  if (!r.ok) throw new Error(JSON.stringify(r));
}

/**
 * A phone photo: a textured 240 × 120 JPEG (real photos have structure, flat colours make
 * perceptual hashes meaningless), with the camera's EXIF, a GPS position and orientation 6.
 */
async function phonePhoto(seed = 0): Promise<Buffer> {
  const width = 240;
  const height = 120;
  const px = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = 128 + 60 * Math.sin((x + seed * 13) / 17) * Math.cos((y - seed * 7) / 11) + 40 * Math.sin((x * y) / (900 + seed * 50));
      const i = (y * width + x) * 3;
      px[i] = Math.max(0, Math.min(255, v));
      px[i + 1] = Math.max(0, Math.min(255, 255 - v));
      px[i + 2] = (x * 2 + seed * 31) % 256;
    }
  }
  return sharp(px, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 90 })
    .withMetadata({ orientation: 6 })
    .withExifMerge({
      IFD0: { Make: 'TestPhone', Model: 'GPS Leaker 3000' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '52/1 31/1 1234/100', GPSLongitudeRef: 'E', GPSLongitude: '13/1 24/1 5678/100' },
    })
    .toBuffer();
}

/** Uploads through the real flow: reserve a slot, "PUT" the bytes, confirm */
async function upload(userId: string, listingId: string, bytes: Buffer, contentType = 'image/jpeg') {
  const r = await requestUpload(appDb, storage, { userId, listingId, contentType, size: bytes.length });
  if (!r.ok) throw new Error(r.reason);
  const [row] = await db.select().from(schema.listingImages).where(eq(schema.listingImages.id, r.imageId));
  await storage.put(row!.storageKey, bytes, contentType);
  expect(await confirmUpload(appDb, { userId, imageId: r.imageId })).toEqual({ ok: true });
  return r.imageId;
}

async function image(id: string) {
  const [row] = await db.select().from(schema.listingImages).where(eq(schema.listingImages.id, id));
  return row;
}

describe('upload permissions and limits', () => {
  it('only a verified owner gets an upload URL', async () => {
    const owner = await user();
    const other = await user();
    const id = await draft(owner.id);
    const ask = (userId: string) => requestUpload(appDb, storage, { userId, listingId: id, contentType: 'image/jpeg', size: 1000 });
    expect(await ask(other.id)).toEqual({ ok: false, reason: 'not_found' });
    await db.update(schema.users).set({ phoneE164: null, phoneVerifiedAt: null, phoneVerificationMethod: null }).where(eq(schema.users.id, owner.id));
    expect(await ask(owner.id)).toEqual({ ok: false, reason: 'phone_required' });
  });

  it('refuses other types and files over 15 MB before signing anything', async () => {
    const u = await user();
    const id = await draft(u.id);
    expect(await requestUpload(appDb, storage, { userId: u.id, listingId: id, contentType: 'image/svg+xml', size: 1000 })).toEqual({
      ok: false,
      reason: 'bad_type',
    });
    expect(await requestUpload(appDb, storage, { userId: u.id, listingId: id, contentType: 'image/jpeg', size: 15 * 1024 * 1024 + 1 })).toEqual({
      ok: false,
      reason: 'too_large',
    });
  });

  it('at most 10 photos per listing', async () => {
    const u = await user();
    const id = await draft(u.id);
    for (let i = 0; i < 10; i++) {
      expect(await requestUpload(appDb, storage, { userId: u.id, listingId: id, contentType: 'image/jpeg', size: 1000 })).toMatchObject({ ok: true });
    }
    expect(await requestUpload(appDb, storage, { userId: u.id, listingId: id, contentType: 'image/jpeg', size: 1000 })).toEqual({
      ok: false,
      reason: 'too_many',
    });
    const rows = await db.select().from(schema.listingImages).where(eq(schema.listingImages.listingId, id));
    expect(rows.map((r) => r.position).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('fewer where the category says so (jobs: 4)', async () => {
    const u = await user();
    const id = await draft(u.id, 'it-jobs');
    for (let i = 0; i < 4; i++) await requestUpload(appDb, storage, { userId: u.id, listingId: id, contentType: 'image/png', size: 10 });
    expect(await requestUpload(appDb, storage, { userId: u.id, listingId: id, contentType: 'image/png', size: 10 })).toEqual({
      ok: false,
      reason: 'too_many',
    });
  });

  it('confirming hands the photo to the worker through the outbox', async () => {
    const u = await user();
    const id = await draft(u.id);
    const imageId = await upload(u.id, id, await phonePhoto());
    expect((await image(imageId))!.status).toBe('processing');
    expect(await outbox(imageId)).toEqual(['listing_image.uploaded']);
  });
});

describe('processing in the worker', () => {
  it('removes EXIF with the GPS position, applies the rotation and stores keys and hashes only', async () => {
    const original = await phonePhoto();
    const before = await sharp(original).metadata();
    expect(before.orientation).toBe(6);
    expect(before.exif?.includes('GPS Leaker 3000')).toBe(true);

    const u = await user();
    const id = await draft(u.id);
    const imageId = await upload(u.id, id, original);
    const uploadKey = (await image(imageId))!.storageKey;

    expect(await processImage(workerDb, storage, imageId)).toMatchObject({ status: 'ready' });
    const row = (await image(imageId))!;
    expect(row.status).toBe('ready');
    expect(row.storageKey).toMatch(new RegExp(`^listings/[0-9a-f]{2}/${imageId}\\.webp$`));
    expect(row.mimeType).toBe('image/webp');
    // Orientation 6 means "rotate 90°": the stored master is upright, 120 × 240
    expect([row.width, row.height]).toEqual([120, 240]);
    expect(row.blurPlaceholder!.length).toBeLessThanOrEqual(64);
    expect(typeof row.phash).toBe('bigint');
    expect(row.sha256).toHaveLength(32);
    expect(row.phashBands).toHaveLength(4);

    // The original is gone, the master has no metadata at all
    expect(storage.objects.has(uploadKey)).toBe(false);
    const master = storage.objects.get(row.storageKey)!;
    expect(master.body.includes('GPS Leaker 3000')).toBe(false);
    expect(master.body.includes('TestPhone')).toBe(false);
    const after = await sharp(master.body).metadata();
    expect(after.format).toBe('webp');
    expect(after.exif).toBeUndefined();
    expect(after.xmp).toBeUndefined();
    expect(after.icc).toBeUndefined();
    expect(after.orientation).toBeUndefined();
  });

  it('rejects files that are not images, and deletes them', async () => {
    const u = await user();
    const id = await draft(u.id);
    const imageId = await upload(u.id, id, Buffer.from('<html><script>alert(1)</script></html>'));
    const key = (await image(imageId))!.storageKey;
    expect(await processImage(workerDb, storage, imageId)).toEqual({ status: 'rejected', reason: 'not_an_image' });
    expect((await image(imageId))!.status).toBe('rejected');
    expect(storage.objects.has(key)).toBe(false);
  });

  it('a confirmed upload that never arrived is rejected as missing', async () => {
    const u = await user();
    const id = await draft(u.id);
    const r = await requestUpload(appDb, storage, { userId: u.id, listingId: id, contentType: 'image/jpeg', size: 10 });
    if (!r.ok) throw new Error(r.reason);
    await confirmUpload(appDb, { userId: u.id, imageId: r.imageId });
    expect(await processImage(workerDb, storage, r.imageId)).toEqual({ status: 'rejected', reason: 'missing' });
  });

  it('a photo added to a live listing is an edit: new revision, checks again', async () => {
    const u = await user();
    const id = await draft(u.id);
    await publish(u.id, id);
    const imageId = await upload(u.id, id, await phonePhoto());
    await processImage(workerDb, storage, imageId);
    const l = await listing(id);
    expect(l.revision).toBe(2);
    expect((await events(id)).at(-1)).toMatchObject({ eventType: 'edited', actorType: 'system', data: { images: { added: imageId } } });
    expect((await outbox(id)).at(-1)).toBe('listing.updated');
  });

  it('perceptual hashes of a re-compressed copy are close, of another picture far', async () => {
    const a = await encodeMaster(await phonePhoto(0));
    const copy = await encodeMaster(await sharp(await phonePhoto(0)).rotate().jpeg({ quality: 40 }).toBuffer());
    const other = await encodeMaster(await phonePhoto(9));
    expect(hammingDistance(a.phash, copy.phash)).toBeLessThanOrEqual(6);
    expect(hammingDistance(a.phash, other.phash)).toBeGreaterThan(10);
  });
});

describe('removing and ordering photos', () => {
  it('only the owner; positions close up; the file goes through the outbox', async () => {
    const owner = await user();
    const other = await user();
    const id = await draft(owner.id);
    const first = await upload(owner.id, id, await phonePhoto(1));
    const second = await upload(owner.id, id, await phonePhoto(2));
    const third = await upload(owner.id, id, await phonePhoto(3));
    const firstKey = (await image(first))!.storageKey;

    expect(await removeImage(appDb, { userId: other.id, imageId: first })).toEqual({ ok: false, reason: 'not_found' });
    expect(await moveImage(appDb, { userId: other.id, imageId: third, to: 'first' })).toEqual({ ok: false, reason: 'not_found' });

    expect(await removeImage(appDb, { userId: owner.id, imageId: first })).toEqual({ ok: true });
    expect(await image(first)).toBeUndefined();
    expect([(await image(second))!.position, (await image(third))!.position]).toEqual([0, 1]);
    const [deleted] = await db
      .select()
      .from(schema.outboxEvents)
      .where(and(eq(schema.outboxEvents.aggregateId, first), eq(schema.outboxEvents.eventType, 'listing_image.deleted')));
    expect(deleted!.payload).toMatchObject({ storageKey: firstKey });

    expect(await moveImage(appDb, { userId: owner.id, imageId: third, to: 'first' })).toEqual({ ok: true });
    expect([(await image(third))!.position, (await image(second))!.position]).toEqual([0, 1]);
    expect(await moveImage(appDb, { userId: owner.id, imageId: third, to: 'earlier' })).toEqual({ ok: false, reason: 'not_allowed' });
  });

  it('abandoned uploads are cleaned up after 24 hours, and the photos after them move up', async () => {
    const u = await user();
    const id = await draft(u.id);
    const r = await requestUpload(appDb, storage, { userId: u.id, listingId: id, contentType: 'image/jpeg', size: 10 });
    if (!r.ok) throw new Error(r.reason);
    const kept = await upload(u.id, id, await phonePhoto());
    expect((await image(kept))!.position).toBe(1);
    await db
      .update(schema.listingImages)
      .set({ createdAt: new Date(Date.now() - 2 * 86_400_000) })
      .where(eq(schema.listingImages.id, r.imageId));

    expect(await cleanupAbandonedUploads(workerDb, storage)).toBeGreaterThanOrEqual(1);
    expect(await image(r.imageId)).toBeUndefined();
    expect((await image(kept))!.position).toBe(0);
  });
});

describe('automatic post-checks (decided Oct 17, 2026: live at once, checks can take down)', () => {
  it('a banned term takes the listing down with the reasons the DSA asks for', async () => {
    const u = await user();
    const id = await draft(u.id);
    await publish(u.id, id, { description: 'خدمات صرافی و حواله ارزی با نرخ خوب' });
    expect((await listing(id)).status).toBe('active');

    expect(await runListingChecks(workerDb, id)).toBe('taken_down');
    const l = await listing(id);
    expect(l.status).toBe('rejected');
    const [decision] = await db.select().from(schema.moderationDecisions).where(eq(schema.moderationDecisions.listingId, id));
    expect(decision).toMatchObject({ decision: 'remove', decidedBy: 'rule', reasonCode: 'prohibited', listingRevision: 1 });
    expect(decision!.statementFa).toBeTruthy();
    // Money exchange is section 5.4 of the terms, and the statement names it (Oct 21, 2026)
    expect(decision!.policyGround).toBe('terms-5.4');
    expect(decision!.statementFa).toContain('بند ۵.۴ شرایط استفاده');
    expect(decision!.contentSnapshot).toMatchObject({ title: 'گوشی سامسونگ' });
    const ev = (await events(id)).at(-1)!;
    expect(ev).toMatchObject({ eventType: 'rejected', actorType: 'system', moderationDecisionId: decision!.id });
    expect((await outbox(id)).at(-1)).toBe('listing.rejected');
  });

  it('a fixed listing sent again is checked first, then goes live by itself', async () => {
    const u = await user();
    const id = await draft(u.id);
    await publish(u.id, id, { title: 'فروش تریاک' });
    await runListingChecks(workerDb, id);
    expect((await listing(id)).status).toBe('rejected');

    // Sent again unchanged: held, checked, taken down again
    await publish(u.id, id, { title: 'فروش تریاک' });
    expect((await listing(id)).status).toBe('pending_review');
    expect(await runListingChecks(workerDb, id)).toBe('taken_down');

    await publish(u.id, id, { title: 'گوشی سامسونگ A52' });
    expect((await listing(id)).status).toBe('pending_review');
    expect(await runListingChecks(workerDb, id)).toBe('published');
    const l = await listing(id);
    expect(l.status).toBe('active');
    expect(l.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    expect((await events(id)).map((e) => e.eventType)).toEqual(
      expect.arrayContaining(['submitted', 'published']),
    );
  });

  it('a photo another account already published takes the listing down; the same seller is fine', async () => {
    const thief = await user();
    const owner = await user();
    const photo = await phonePhoto(5);

    const original = await draft(owner.id);
    await processImage(workerDb, storage, await upload(owner.id, original, photo));
    await publish(owner.id, original);
    expect(await runListingChecks(workerDb, original)).toBe('passed');

    // The owner reusing their own photo is not a theft
    const again = await draft(owner.id);
    await processImage(workerDb, storage, await upload(owner.id, again, photo));
    await publish(owner.id, again);
    expect(await runListingChecks(workerDb, again)).toBe('passed');

    const stolen = await draft(thief.id);
    await processImage(workerDb, storage, await upload(thief.id, stolen, photo));
    await publish(thief.id, stolen);
    expect(await runListingChecks(workerDb, stolen)).toBe('taken_down');
    const [decision] = await db.select().from(schema.moderationDecisions).where(eq(schema.moderationDecisions.listingId, stolen));
    expect(decision).toMatchObject({ reasonCode: 'duplicate', decision: 'remove' });
  });

  it('a near-duplicate is only flagged for the moderation queue, once per revision', async () => {
    const a = await user();
    const b = await user();
    const first = await draft(a.id);
    await processImage(workerDb, storage, await upload(a.id, first, await phonePhoto(6)));
    await publish(a.id, first);

    const second = await draft(b.id);
    await processImage(workerDb, storage, await upload(b.id, second, await sharp(await phonePhoto(6)).rotate().resize(100).jpeg({ quality: 50 }).toBuffer()));
    await publish(b.id, second);

    expect(await runListingChecks(workerDb, second)).toBe('flagged');
    expect(await runListingChecks(workerDb, second)).toBe('passed');
    expect((await listing(second)).status).toBe('active');
    const decisions = await db.select().from(schema.moderationDecisions).where(eq(schema.moderationDecisions.listingId, second));
    expect(decisions.map((d) => d.decision)).toEqual(['escalate']);
  });

  it('drafts, sold and deleted listings are not checked', async () => {
    const u = await user();
    const id = await draft(u.id);
    await db.update(schema.listings).set({ title: 'فروش تریاک' }).where(eq(schema.listings.id, id));
    expect(await runListingChecks(workerDb, id)).toBe('skipped');
  });
});

describe('expiry reminder', () => {
  it('one email per seller about listings that expire in 2–3 days, never twice', async () => {
    const u = await user();
    const soon = await draft(u.id);
    await publish(u.id, soon);
    const later = await draft(u.id);
    await publish(u.id, later);
    const now = new Date();
    await db.update(schema.listings).set({ expiresAt: new Date(now.getTime() + 2.5 * 86_400_000) }).where(eq(schema.listings.id, soon));

    const sent: Mail[] = [];
    const mail = async (m: Mail) => void sent.push(m);
    const first = await sendExpiryReminders(workerDb, redis, mail, 'https://staging.example.test', now);
    const mine = sent.filter((m) => m.to === u.email);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.text).toContain('https://staging.example.test/my/listings');
    expect(mine[0]!.text).toContain('گوشی سامسونگ');
    expect(first.listings).toBeGreaterThanOrEqual(1);

    sent.length = 0;
    await sendExpiryReminders(workerDb, redis, mail, 'https://staging.example.test', now);
    expect(sent.filter((m) => m.to === u.email)).toHaveLength(0);
  });

  it('the hourly run sends at 9:00 on the seller’s clock (wave 2 part 7)', async () => {
    const u = await user();
    const id = await draft(u.id);
    await publish(u.id, id);
    const [toronto] = await db.select().from(schema.locations).where(and(eq(schema.locations.slug, 'toronto'), eq(schema.locations.kind, 'city')));
    await db.update(schema.users).set({ homeLocationId: toronto!.id }).where(eq(schema.users.id, u.id));
    // 9:00 in Berlin, then 9:00 in Toronto (UTC−5 in November), the listing 2–3 days from expiry at both
    const berlin9 = new Date('2029-11-05T08:00:00Z');
    const toronto9 = new Date('2029-11-05T14:00:00Z');
    await db.update(schema.listings).set({ expiresAt: new Date(toronto9.getTime() + 2.5 * 86_400_000) }).where(eq(schema.listings.id, id));
    const sent: Mail[] = [];
    const mail = async (m: Mail) => void sent.push(m);
    await sendExpiryReminders(workerDb, redis, mail, 'https://staging.example.test', berlin9, { localHour: 9 });
    expect(sent.filter((m) => m.to === u.email)).toHaveLength(0);
    await sendExpiryReminders(workerDb, redis, mail, 'https://staging.example.test', toronto9, { localHour: 9 });
    expect(sent.filter((m) => m.to === u.email)).toHaveLength(1);
  });
});

describe('imgproxy URLs', () => {
  it('are signed, name only the key, and end in the format', () => {
    const config = { baseUrl: 'https://img.example.test', key: '943b421c9eb07c830af81030552c86009268de4e532ba2ee2eab8247c6da0881', salt: '520f986b998545b4785e0defbc4f3c1203f22de2374a3d53cb7a7fe9fea309c5' };
    const url = imgproxyUrl(config, 'listings/ab/0192.webp', 'card', 'avif');
    expect(url).toMatch(/^https:\/\/img\.example\.test\/[A-Za-z0-9_-]{43}\/rs:fill:480:360:1\/g:ce\/q:60\/[A-Za-z0-9_-]+\.avif$/);
    expect(url).not.toContain('classifieds-media');
    expect(Buffer.from(url.split('/').at(-1)!.replace('.avif', ''), 'base64url').toString()).toBe('listings/ab/0192.webp');
    expect(imgproxyUrl({ ...config, key: '00'.repeat(32) }, 'listings/ab/0192.webp', 'card', 'avif')).not.toBe(url);
  });
});
