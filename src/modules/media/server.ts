import { webEnv } from '../../lib/env';
import { imgproxyFromEnv, storageFromEnv } from './config';
import { imgproxyUrl, type ImageFormat, type ImageSize } from './imgproxy';
import type { ObjectStorage } from './storage';

// The Next.js side of the media module. Server code only.

const globalForMedia = globalThis as typeof globalThis & { storage?: ObjectStorage | null };

export function storage(): ObjectStorage | null {
  if (globalForMedia.storage === undefined) globalForMedia.storage = storageFromEnv(webEnv());
  return globalForMedia.storage;
}

export type ImageSources = { avif: string; webp: string } | null;

/** Signed AVIF and WebP URLs of a stored master, or null without imgproxy (development) */
export function imageSources(storageKey: string, size: ImageSize): ImageSources {
  const config = imgproxyFromEnv(webEnv());
  if (!config) return null;
  return {
    avif: imgproxyUrl(config, storageKey, size, 'avif'),
    webp: imgproxyUrl(config, storageKey, size, 'webp'),
  };
}

export function imageUrl(storageKey: string, size: ImageSize, format: ImageFormat): string | null {
  const config = imgproxyFromEnv(webEnv());
  return config ? imgproxyUrl(config, storageKey, size, format) : null;
}
