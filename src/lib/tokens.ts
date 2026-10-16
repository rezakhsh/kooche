import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

// Random tokens and hashes (docs/schema.md, section 2). Always from the cryptographic generator.

const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz';

/** 10 characters of lowercase Crockford base32 (50 bits): public URLs like /u/{token} */
export function publicToken(): string {
  return Array.from({ length: 10 }, () => CROCKFORD[randomInt(32)]).join('');
}

/**
 * A one-time link token, base64url without padding. 24 bytes = 32 characters, so it fits the
 * 64-character limit of Telegram's /start parameter ([A-Za-z0-9_-] only).
 */
export function linkToken(): string {
  return randomBytes(24).toString('base64url');
}

export function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/** A numeric code of the given length, leading zeros allowed */
export function numericCode(length = 6): string {
  return Array.from({ length }, () => randomInt(10)).join('');
}

export function hmacSha256(secret: string, value: string): Buffer {
  return createHmac('sha256', secret).update(value).digest();
}

export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}
