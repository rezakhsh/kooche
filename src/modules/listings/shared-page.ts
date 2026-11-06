// Listing and event pages that Cloudflare keeps one copy of for every signed-out visitor
// (docs/research/smooth-loading.md, 3.2; docs/setup.md, "Browsing and favorites"). Pure, so the
// proxy, the server and the browser (the header's HeaderSync) share it.

/** The listing's or event's address token in /v/{title}/{token} or /e/{title}/{token}; not their sub-pages (calendar file) */
const PAGE = /^\/(v|e)\/[^/]+\/([0-9a-hjkmnp-tv-z]{10})$/;

export function listingPageToken(pathname: string): { kind: 'listing' | 'event'; token: string } | null {
  const m = PAGE.exec(pathname);
  return m ? { kind: m[1] === 'e' ? 'event' : 'listing', token: m[2]! } : null;
}

/**
 * Set by src/proxy.ts only (it drops the visitor's own) on a listing or event page that is sent as
 * Cloudflare's shared copy: its value is the page's token. The root layout then draws the header
 * for the page's own country instead of the visitor's remembered country or connection
 * (src/components/header-place-data.ts), so the copy is the same for everyone.
 */
export const SHARED_PAGE_HEADER = 'x-shared-page';
