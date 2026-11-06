// Which addresses are browse pages (src/proxy.ts renders them as if the page's own country were
// chosen). Shared with the browser, which needs the same answer to draw the header
// (src/components/header-place.ts). No server-only imports here.

/** First path segments of our own pages; anything else with one to three segments is a browse page */
export const NOT_BROWSE = new Set([
  ...['account', 'api', 'chat', 'e', 'events', 'favorites', 'health', 'login', 'my', 'new', 'u', 'v', 'sitemaps'],
  // Legal and help pages (Oct 21, 2026)
  ...['contact', 'help', 'impressum', 'privacy', 'safety', 'terms'],
  // Turning off a saved-search alert from its email (Oct 22, 2026)
  'alerts',
  // Business pages, creating a business, the Pro page (Oct 22, 2026)
  ...['b', 'business', 'pro'],
  // Reporting content; the admin page's internal route (Oct 23, 2026)
  ...['report', 'admin'],
  // City waitlist: confirming and leaving (wave 0)
  'waitlist',
]);
/** The country slug of a browse page (/germany, /germany/berlin/cars …), else null */
export function browseCountry(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 1 || segments.length > 3 || NOT_BROWSE.has(segments[0]!) || !/^[a-z][a-z-]{1,40}$/.test(segments[0]!)) return null;
  return segments[0]!;
}
