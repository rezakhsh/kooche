import { normalizePersian } from '../../lib/normalize-persian';

// The title part of /v/{persian-title}/{token}. It is not stored and not checked (docs/schema.md,
// listings.public_token): the token alone finds the listing, and the page's canonical link
// carries the current title.

const MAX_LENGTH = 60;

export function titleSlug(title: string): string {
  const slug = normalizePersian(title)
    .toLowerCase()
    // ZWNJ inside words, spaces and punctuation all become one hyphen
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_LENGTH)
    .replace(/-+$/, '');
  return slug || 'آگهی';
}

export function listingPath(title: string, token: string): string {
  return `/v/${encodeURIComponent(titleSlug(title))}/${token}`;
}
