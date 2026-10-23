import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES } from './limits';

// Shrinking photos in the browser before upload (roadmap step 10, Oct 23, 2026). A phone photo of
// 8–15 MB becomes a 2560 px WebP or JPEG of about 0.5–1.5 MB, so posting is faster on mobile
// data. This only saves upload time: the worker still re-encodes every photo and strips its
// metadata (./process.ts), and the server checks type and size as before.
//
// Any failure sends the original, exactly as before this step: an old browser, too little memory,
// a format the browser can't decode (HEIC outside Safari), a result that isn't smaller. The steps
// run in a Web Worker on an OffscreenCanvas where the browser has one (./shrink.worker.ts), else on
// the page with a <canvas> (./shrink-client.ts). No DOM or server imports here, so it runs in both
// and in tests.

/** Same as the worker's master (./process.ts) */
export const SHRINK_MAX_EDGE = 2560;
export const SHRINK_QUALITY = 0.85;
/** A photo this small and within 2560 px is sent as it is */
export const SHRINK_SMALL_BYTES = 1024 * 1024;
export const SHRINK_TIMEOUT_MS = 20_000;

const WEBP = 'image/webp';
const JPEG = 'image/jpeg';

export type Size = { width: number; height: number };

function accepted(type: string): boolean {
  return (ACCEPTED_TYPES as readonly string[]).includes(type);
}

/** Whether the server would take this file as it is */
export function uploadable(file: { type: string; size: number }): boolean {
  return accepted(file.type) && file.size > 0 && file.size <= MAX_UPLOAD_BYTES;
}

/**
 * 'keep' when the photo is already small, within 2560 px and of a type the server takes;
 * otherwise the size to draw it at: the long side at most 2560 px, never enlarged.
 */
export function shrinkDecision(photo: Size & { size: number; type: string }): 'keep' | Size {
  const { width, height } = photo;
  if (!(width > 0 && height > 0)) throw new Error('no size');
  const long = Math.max(width, height);
  if (long <= SHRINK_MAX_EDGE && photo.size <= SHRINK_SMALL_BYTES && accepted(photo.type)) return 'keep';
  const scale = Math.min(1, SHRINK_MAX_EDGE / long);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

let webpFails = false;

/**
 * Types to try, best first. Safari can't encode WebP and quietly returns a PNG instead, so the
 * caller checks the type it got. A PNG may be transparent, which JPEG would turn black, so a PNG
 * is only ever made WebP.
 */
export function encodeTypes(inputType: string, webpWorks = !webpFails): string[] {
  const types = webpWorks ? [WEBP, JPEG] : [JPEG];
  return inputType === 'image/png' ? types.filter((t) => t === WEBP) : types;
}

/** Decoding and drawing, on an OffscreenCanvas in the worker or a <canvas> on the page */
export type ImageOps<B> = {
  /** Decodes with the EXIF orientation applied */
  decode(file: Blob): Promise<Size & { bitmap: B }>;
  draw(bitmap: B, size: Size, type: string, quality: number): Promise<Blob>;
  close(bitmap: B): void;
};

/** The smaller photo, or null to send the original. Throws when decoding or drawing fails. */
export async function shrinkWith<B>(file: Blob, ops: ImageOps<B>): Promise<Blob | null> {
  const { bitmap, width, height } = await ops.decode(file);
  try {
    const target = shrinkDecision({ width, height, size: file.size, type: file.type });
    if (target === 'keep') return null;
    for (const type of encodeTypes(file.type)) {
      const blob = await ops.draw(bitmap, target, type, SHRINK_QUALITY);
      if (blob.type === type && blob.size > 0) return blob;
      if (type === WEBP) webpFails = true;
    }
    return null;
  } finally {
    ops.close(bitmap);
  }
}

/** Runs shrinkWith somewhere (worker or page); may throw or never answer */
export type ShrinkRunner = (file: File) => Promise<Blob | null>;

/**
 * The file to upload: the smaller photo, or the original whenever shrinking fails, takes longer
 * than 20 seconds or doesn't help. Never throws.
 */
export async function shrinkPhoto(file: File, run: ShrinkRunner, timeoutMs = SHRINK_TIMEOUT_MS): Promise<File> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    const blob = await Promise.race([run(file), timeout]);
    if (!blob || (blob.type !== WEBP && blob.type !== JPEG) || !uploadable(blob)) return file;
    // Not smaller: the original is better, unless the server wouldn't take it (HEIC, over 15 MB)
    if (blob.size >= file.size && uploadable(file)) return file;
    const ext = blob.type === WEBP ? 'webp' : 'jpg';
    return new File([blob], `${file.name.replace(/\.[^./]*$/, '') || 'photo'}.${ext}`, { type: blob.type });
  } catch {
    return file;
  } finally {
    clearTimeout(timer);
  }
}
