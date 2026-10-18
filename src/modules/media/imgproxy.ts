import { createHmac } from 'node:crypto';

// Signed imgproxy URLs (docs/setup.md, "Photos and imgproxy"). imgproxy reads masters from R2 with
// IMGPROXY_BASE_URL set to the bucket, so a URL names only the storage key, never the bucket.
// Only these sizes exist: the signature covers the processing options, so nobody can ask the
// server for other sizes. The URL ends in .avif or .webp, so Cloudflare caches it by extension.

export const IMAGE_SIZES = {
  /** Square thumbnail for "my listings" and the photo editor */
  thumb: 'rs:fill:160:160:1/g:ce',
  /** Listing card and photo strip */
  card: 'rs:fill:480:360:1/g:ce',
  /** Event card: posters are upright (4:5) */
  poster: 'rs:fill:480:600:1/g:ce',
  /** Listing page */
  full: 'rs:fit:1280:1280:0',
} as const;
export type ImageSize = keyof typeof IMAGE_SIZES;
export type ImageFormat = 'avif' | 'webp';

export type ImgproxyConfig = { baseUrl: string; key: string; salt: string };

export function imgproxyUrl(config: ImgproxyConfig, storageKey: string, size: ImageSize, format: ImageFormat): string {
  const path = `/${IMAGE_SIZES[size]}/q:${format === 'avif' ? 60 : 75}/${Buffer.from(storageKey).toString('base64url')}.${format}`;
  const signature = createHmac('sha256', Buffer.from(config.key, 'hex'))
    .update(Buffer.from(config.salt, 'hex'))
    .update(path)
    .digest('base64url');
  return `${config.baseUrl.replace(/\/$/, '')}/${signature}${path}`;
}
