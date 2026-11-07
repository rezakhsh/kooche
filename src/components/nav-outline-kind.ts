// Which loading outline a tapped link shows while its page comes (docs/research/smooth-loading.md,
// style 4 approved Nov 5, 2026: the top line on every page, plus grey outlines on these kinds).
// Pure, so tests/nav-outline-kind.test.ts can check every route folder in src/app.

export type OutlineKind = 'listing' | 'browse' | 'list' | 'chat' | 'thread' | 'account' | 'posting';

/** Top-level folders of src/app that are not countries (a country is any other first segment) */
export const STATIC_ROUTES = new Set([
  'account', 'admin', 'alerts', 'api', 'b', 'business', 'chat', 'cities', 'contact', 'e', 'events', 'favorites',
  'fonts', 'health', 'help', 'impressum', 'login', 'map', 'my', 'new', 'privacy', 'pro', 'report', 'safety',
  'sitemaps', 'sitemap.xml', 'indexnow.txt', 'terms', 'u', 'v', 'waitlist',
]);

// Browse addresses whose page is not a list of listing cards: line only
const NOT_CARDS = new Set(['events', 'online', 'founding']);

/** The outline for a path, or null for the top line alone */
export function outlineFor(pathname: string): OutlineKind | null {
  const parts = pathname.split('/').filter(Boolean);
  const [first, second, third] = parts;
  if (!first) return null;
  if (first === 'v') return parts.length === 3 ? 'listing' : null;
  if (first === 'chat') return parts.length === 1 ? 'chat' : second !== 'new' && parts.length === 2 ? 'thread' : null;
  if (first === 'my') {
    if (parts.length === 2 && ['listings', 'favorites', 'searches', 'events', 'orders'].includes(second!)) return 'list';
    // A draft's steps (/my/listings/<id>), not its promotion page
    if (second === 'listings' && parts.length === 3) return 'posting';
    return null;
  }
  if (first === 'new') return parts.length <= 2 ? 'posting' : null;
  if (first === 'account') return parts.length === 1 || (parts.length === 2 && second === 'settings') ? 'account' : null;
  if (STATIC_ROUTES.has(first)) return null;
  // /{country}, /{country}/{city or category}, /{country}/{city}/{category}
  if (parts.length > 3) return null;
  if ((second && NOT_CARDS.has(second)) || (third && NOT_CARDS.has(third))) return null;
  return 'browse';
}
