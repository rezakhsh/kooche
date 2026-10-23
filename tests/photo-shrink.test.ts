import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_BYTES } from '../src/modules/media/limits';
import {
  encodeTypes,
  shrinkDecision,
  shrinkPhoto,
  shrinkWith,
  SHRINK_SMALL_BYTES,
  type ImageOps,
  type Size,
} from '../src/modules/media/shrink';
import { contentSecurityPolicy } from '../src/proxy';

// Shrinking photos in the browser before upload (roadmap step 10, Oct 23, 2026): when to shrink,
// to what size and type, and that every failure sends the original. The canvas steps are faked
// here; headless Chromium checked the real ones (docs/progress.md).

const MB = 1024 * 1024;
const photo = (size: number, type = 'image/jpeg', name = 'IMG_0001.JPG') =>
  new File([new Uint8Array(size)], name, { type });

/** A stand-in for the canvas: records what it was asked to draw, returns blobs of the given sizes */
function fakeOps(size: Size, encoded: (type: string) => Blob | Error) {
  const drawn: { size: Size; type: string; quality: number }[] = [];
  let closed = 0;
  const ops: ImageOps<string> = {
    decode: async () => ({ bitmap: 'bitmap', ...size }),
    draw: async (_b, s, type, quality) => {
      drawn.push({ size: s, type, quality });
      const out = encoded(type);
      if (out instanceof Error) throw out;
      return out;
    },
    close: () => void closed++,
  };
  return { ops, drawn, closed: () => closed };
}

describe('when and how much to shrink', () => {
  it('keeps a small photo within 2560 px as it is', () => {
    expect(shrinkDecision({ width: 1600, height: 1200, size: 400_000, type: 'image/jpeg' })).toBe('keep');
    expect(shrinkDecision({ width: 2560, height: 2560, size: SHRINK_SMALL_BYTES, type: 'image/webp' })).toBe('keep');
  });

  it('scales a phone photo to 2560 px on the long side, keeping its shape', () => {
    expect(shrinkDecision({ width: 4032, height: 3024, size: 9 * MB, type: 'image/jpeg' })).toEqual({ width: 2560, height: 1920 });
    expect(shrinkDecision({ width: 3024, height: 4032, size: 9 * MB, type: 'image/jpeg' })).toEqual({ width: 1920, height: 2560 });
    expect(shrinkDecision({ width: 12000, height: 1000, size: 9 * MB, type: 'image/jpeg' })).toEqual({ width: 2560, height: 213 });
  });

  it('re-encodes a large file at its own size, never enlarging it', () => {
    expect(shrinkDecision({ width: 2000, height: 1500, size: 6 * MB, type: 'image/png' })).toEqual({ width: 2000, height: 1500 });
    expect(shrinkDecision({ width: 800, height: 600, size: 2 * MB, type: 'image/jpeg' })).toEqual({ width: 800, height: 600 });
  });

  it('re-encodes a small photo of a type the server refuses (HEIC decoded by Safari)', () => {
    expect(shrinkDecision({ width: 1200, height: 900, size: 300_000, type: 'image/heic' })).toEqual({ width: 1200, height: 900 });
  });

  it('a photo without a size is a failure', () => {
    expect(() => shrinkDecision({ width: 0, height: 0, size: 1, type: 'image/jpeg' })).toThrow();
  });

  it('WebP first, JPEG where the browser cannot encode WebP; a PNG never becomes JPEG', () => {
    expect(encodeTypes('image/jpeg', true)).toEqual(['image/webp', 'image/jpeg']);
    expect(encodeTypes('image/jpeg', false)).toEqual(['image/jpeg']);
    expect(encodeTypes('image/png', true)).toEqual(['image/webp']);
    expect(encodeTypes('image/png', false)).toEqual([]);
  });
});

describe('shrinking a photo', () => {
  it('draws a 12 MP photo at 2560 px as WebP at quality 0.85', async () => {
    const fake = fakeOps({ width: 4032, height: 3024 }, (type) => new Blob([new Uint8Array(900_000)], { type }));
    const blob = await shrinkWith(photo(9 * MB), fake.ops);
    expect(blob?.type).toBe('image/webp');
    expect(fake.drawn).toEqual([{ size: { width: 2560, height: 1920 }, type: 'image/webp', quality: 0.85 }]);
    expect(fake.closed()).toBe(1);
  });

  it('draws nothing for a photo that is already small', async () => {
    const fake = fakeOps({ width: 1280, height: 960 }, (type) => new Blob([new Uint8Array(10)], { type }));
    expect(await shrinkWith(photo(300_000), fake.ops)).toBeNull();
    expect(fake.drawn).toEqual([]);
    expect(fake.closed()).toBe(1);
  });

  it('frees the decoded photo when drawing fails', async () => {
    const fake = fakeOps({ width: 4032, height: 3024 }, () => new Error('out of memory'));
    await expect(shrinkWith(photo(9 * MB), fake.ops)).rejects.toThrow('out of memory');
    expect(fake.closed()).toBe(1);
  });
});

describe('every failure sends the original', () => {
  const original = photo(9 * MB);
  const webp = (size: number) => new Blob([new Uint8Array(size)], { type: 'image/webp' });

  it('the shrunk photo replaces the original, with the new type and size', async () => {
    const file = await shrinkPhoto(original, async () => webp(800_000));
    expect(file).not.toBe(original);
    expect(file.type).toBe('image/webp');
    expect(file.size).toBe(800_000);
    expect(file.name).toBe('IMG_0001.webp');
  });

  it('no shrinking needed, or nothing came back', async () => {
    expect(await shrinkPhoto(original, async () => null)).toBe(original);
  });

  it("the browser can't decode it (HEIC on Chrome), has no createImageBitmap, or runs out of memory", async () => {
    expect(await shrinkPhoto(original, async () => Promise.reject(new DOMException('The source image could not be decoded.', 'InvalidStateError')))).toBe(original);
    expect(await shrinkPhoto(original, async () => Promise.reject(new TypeError('createImageBitmap is not a function')))).toBe(original);
    expect(await shrinkPhoto(original, () => { throw new RangeError('Array buffer allocation failed'); })).toBe(original);
  });

  it('it takes too long (a stuck worker)', async () => {
    const started = Date.now();
    expect(await shrinkPhoto(original, () => new Promise(() => {}), 50)).toBe(original);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('the result is not smaller, empty, or of a type the server refuses', async () => {
    expect(await shrinkPhoto(original, async () => webp(9 * MB))).toBe(original);
    expect(await shrinkPhoto(original, async () => webp(0))).toBe(original);
    expect(await shrinkPhoto(original, async () => new Blob([new Uint8Array(500_000)], { type: 'image/png' }))).toBe(original);
    expect(await shrinkPhoto(original, async () => webp(MAX_UPLOAD_BYTES + 1))).toBe(original);
  });

  it('a bigger result still wins when the server would refuse the original', async () => {
    const heic = photo(400_000, 'image/heic', 'IMG_0002.HEIC');
    const file = await shrinkPhoto(heic, async () => webp(600_000));
    expect(file.type).toBe('image/webp');
    const huge = photo(MAX_UPLOAD_BYTES + 1);
    expect((await shrinkPhoto(huge, async () => webp(MAX_UPLOAD_BYTES))).size).toBe(MAX_UPLOAD_BYTES);
  });

  // Last: a failed WebP encode is remembered for the rest of the page's life
  it("Safari returns a PNG for WebP: the photo is made JPEG instead, and WebP isn't tried again", async () => {
    const safari = (type: string) => new Blob([new Uint8Array(type === 'image/jpeg' ? 700_000 : 5 * MB)], { type: type === 'image/webp' ? 'image/png' : type });
    const first = fakeOps({ width: 4032, height: 3024 }, safari);
    expect((await shrinkWith(photo(9 * MB), first.ops))?.type).toBe('image/jpeg');
    expect(first.drawn.map((d) => d.type)).toEqual(['image/webp', 'image/jpeg']);
    const second = fakeOps({ width: 4032, height: 3024 }, safari);
    expect((await shrinkWith(photo(9 * MB), second.ops))?.type).toBe('image/jpeg');
    expect(second.drawn.map((d) => d.type)).toEqual(['image/jpeg']);
    // A PNG can't become JPEG, so it goes as it is
    const png = fakeOps({ width: 3000, height: 2000 }, safari);
    expect(await shrinkWith(photo(6 * MB, 'image/png', 'shot.png'), png.ops)).toBeNull();
  });
});

describe('the CSP lets the photo worker in', () => {
  it("allows workers from our own origin only, not blob: or data:", () => {
    const csp = contentSecurityPolicy('bm9uY2U=', { IMAGE_URL: undefined, S3_ENDPOINT: undefined });
    expect(csp.split('; ')).toContain("worker-src 'self'");
  });
});
