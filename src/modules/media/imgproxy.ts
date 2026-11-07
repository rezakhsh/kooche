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
  /**
   * The listing page's main photo on phones: its 4:3 frame (object-cover, centred) at 800 px wide,
   * enough for a phone's screen; `full` made the phone LCP 3.2 s (docs/research/seo.md, section 5)
   */
  phone: 'rs:fill:800:600:0/g:ce',
  /**
   * An event's cover for Google's event results, which ask for 16:9, 4:3 and 1:1 images. Enlarged
   * when the poster is smaller, so the shape is always exact and at least 1200 px wide. Only the
   * event page's JSON-LD names them, so imgproxy renders them when a search engine asks.
   */
  crop16x9: 'rs:fill:1200:675:1/g:ce',
  crop4x3: 'rs:fill:1200:900:1/g:ce',
  crop1x1: 'rs:fill:1200:1200:1/g:ce',
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
