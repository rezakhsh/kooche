import type { ImgproxyConfig } from './imgproxy';
import { s3Storage, type ObjectStorage } from './storage';

// Storage and imgproxy settings from the environment (src/lib/env.ts), shared by web and worker.

type S3Env = {
  S3_ENDPOINT?: string;
  S3_REGION: string;
  S3_BUCKET_MEDIA?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
};

/** R2 storage, or null when it isn't configured (development without photos) */
export function storageFromEnv(e: S3Env): ObjectStorage | null {
  if (!e.S3_ENDPOINT || !e.S3_BUCKET_MEDIA || !e.S3_ACCESS_KEY_ID || !e.S3_SECRET_ACCESS_KEY) return null;
  return s3Storage({
    endpoint: e.S3_ENDPOINT,
    region: e.S3_REGION,
    bucket: e.S3_BUCKET_MEDIA,
    accessKeyId: e.S3_ACCESS_KEY_ID,
    secretAccessKey: e.S3_SECRET_ACCESS_KEY,
  });
}

export function imgproxyFromEnv(e: { IMAGE_URL?: string; IMGPROXY_KEY?: string; IMGPROXY_SALT?: string }): ImgproxyConfig | null {
  if (!e.IMAGE_URL || !e.IMGPROXY_KEY || !e.IMGPROXY_SALT) return null;
  return { baseUrl: e.IMAGE_URL, key: e.IMGPROXY_KEY, salt: e.IMGPROXY_SALT };
}
