// What search engines read on the listing, event and business pages (docs/research/seo.md,
// section 5): which listings are schema.org Products, the breadcrumb trail as JSON-LD, and when a
// listing or event that ended stops answering. Pure functions, so tests need no page or database.

/**
 * Top categories of things bought and sold (slugs from seed/categories.ts). Only their offers get
 * Product markup: Google's product results are for goods with a price, and a flat, a job, a
 * service, a lesson, a pet or a community post marked up as a Product is structured data that
 * doesn't match the page, which Google may ignore or answer with a manual action. Pets stay out
 * too: live animals aren't goods for Google's product results, and the category holds pet care.
 */
export const GOODS_ROOTS: ReadonlySet<string> = new Set([
  'vehicles',
  'electronics',
  'home-garden',
  'fashion-beauty',
  'kids-baby',
  'leisure-hobbies',
  'business-equipment',
]);

/**
 * Whether a listing's page carries schema.org Product with an Offer: a goods category (`path`:
 * root first) and an offer. A «خریدارم» ad (`kind` 'wanted') offers nothing for sale.
 */
export function isProductListing(path: readonly { slug: string }[], kind: string): boolean {
  return kind === 'offer' && !!path[0] && GOODS_ROOTS.has(path[0].slug);
}

/**
 * Days a sold or expired listing, or an event after its last date, keeps its page (with noindex,
 * so shared links still work) before the address answers 404 and the not-found page points to
 * similar listings instead. Google treats 404 and 410 alike (both drop the address from the
 * index), and a Next.js page can't answer 410, so 404.
 */
export const GONE_AFTER_DAYS = 30;
const DAY_MS = 86_400_000;

/**
 * Since when a listing is over: sold or expired since its last status change (`statusChangedAt`,
 * set by every status change: src/modules/listings/listings.ts and the expiry job). Paused never
 * counts: the seller may resume it.
 */
export function listingGoneSince(listing: { status: string; statusChangedAt: Date }): Date | null {
  return listing.status === 'sold' || listing.status === 'expired' ? listing.statusChangedAt : null;
}

/** Since when an event is over: the end of its last date (null without dates) */
export function eventGoneSince(dates: readonly { endsAt: Date }[]): Date | null {
  return dates.reduce<Date | null>((last, d) => (!last || d.endsAt > last ? d.endsAt : last), null);
}

/** Whether something over since `since` is past GONE_AFTER_DAYS at `now` */
export function goneForGood(since: Date | null, now: Date): boolean {
  return !!since && now.getTime() - since.getTime() > GONE_AFTER_DAYS * DAY_MS;
}

/** One step of a breadcrumb trail; the page itself, last, has no address */
export type Crumb = { name: string; path?: string };

/**
 * schema.org BreadcrumbList with absolute addresses (`appUrl`: webEnv().APP_URL). Google's guide
 * lets the last item, the page itself, go without `item`.
 */
export function breadcrumbJsonLd(appUrl: string, crumbs: readonly Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      ...(c.path ? { item: `${appUrl}${c.path}` } : {}),
    })),
  };
}

/**
 * JSON-LD objects as the text of one <script type="application/ld+json">: a single object as
 * itself, several as an array (Google reads both). `<` escaped, so text from a listing can't close
 * the script element.
 */
export function jsonLdText(items: readonly object[]): string {
  return JSON.stringify(items.length === 1 ? items[0] : items).replace(/</g, '\\u003c');
}
