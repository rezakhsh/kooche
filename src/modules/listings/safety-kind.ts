// Which safety advice a listing gets (wave 1): the rent-scam warning on room and flat pages
// (src/app/[country]/_browse/browse-page.tsx) and the safety box on the listing page, by its place
// in the category tree (slugs from seed/categories.ts).

export type SafetyKind = 'rent' | 'vehicle' | 'tickets' | 'jobs' | 'pets' | 'general';

/** Rooms and flats to rent, and the real-estate root above them */
export const RENT_SLUGS = new Set(['real-estate', 'apartments-rent', 'houses-rent', 'shared-rooms', 'short-term-rent']);

/** A room is let for one monthly rent (owner, Nov 3, 2026), per week or month in GB and AU */
export const PLAIN_RENT_SLUGS = new Set(['shared-rooms']);

/**
 * A short let has one all-in price per night, week or month, its `rent_period` (field audit, owner,
 * Nov 5, 2026: it read «اجارهٔ سرد ماهانه» next to a nightly unit)
 */
export const PERIOD_RENT_SLUGS = new Set(['short-term-rent']);

/**
 * How a flat's or house's rent reads (field audit item 6, approved by the owner on Nov 5, 2026):
 * - cold: the cold rent, extra costs on top (DE: Kaltmiete + Nebenkosten);
 * - gross: the whole rent, the extra costs a part of it (AT Bruttomiete, FR charges comprises);
 * - net: the base rent, service charges on top (NL kale huur, IT canone);
 * - weekly: one rent a week (AU);
 * - plain: one rent a month (everywhere else; a WG room's everywhere but GB and AU);
 * - period: per night, week or month as the poster chooses (short lets; WG rooms in GB and AU).
 */
export type RentKind = 'cold' | 'gross' | 'net' | 'weekly' | 'plain' | 'period';

/** Countries whose flats and houses aren't let for one plain monthly rent */
export const RENT_STYLE: Readonly<Record<string, 'cold' | 'gross' | 'net' | 'weekly'>> = {
  DE: 'cold',
  AT: 'gross',
  FR: 'gross',
  NL: 'net',
  IT: 'net',
  AU: 'weekly',
};

/** Countries where a WG room is let per week or per month, as the poster chooses (SpareRoom, Flatmates.com.au) */
export const ROOM_PERIOD_COUNTRIES: ReadonlySet<string> = new Set(['GB', 'AU']);

/** The units of a short let's price (`rent_period`'s values) */
export const RENT_PERIODS = ['night', 'week', 'month'] as const;
export type RentPeriod = (typeof RENT_PERIODS)[number];

export const rentPeriodOf = (attributes: Record<string, unknown> | null | undefined): RentPeriod | null => {
  const p = attributes?.rent_period;
  return typeof p === 'string' && (RENT_PERIODS as readonly string[]).includes(p) ? (p as RentPeriod) : null;
};

/**
 * How a category's price reads in a country (`RentKind`), or null when it isn't a rent. `path`:
 * root first. `country`: the listing's or page's; null reads as Germany's, where the site began.
 */
export function rentKind(path: { slug: string }[], country: string | null): RentKind | null {
  if (!path.some((c) => RENT_SLUGS.has(c.slug) && c.slug !== 'real-estate')) return null;
  if (path.some((c) => PERIOD_RENT_SLUGS.has(c.slug))) return 'period';
  const code = country ?? 'DE';
  if (path.some((c) => PLAIN_RENT_SLUGS.has(c.slug))) return ROOM_PERIOD_COUNTRIES.has(code) ? 'period' : 'plain';
  return RENT_STYLE[code] ?? 'plain';
}

/** Top categories whose things aren't sent by post: no «ارسال پستی» in their form or filters */
export const NOT_SHIPPED = new Set(['real-estate', 'services', 'jobs', 'lessons-courses', 'community']);

/**
 * Categories below a shipped top category that aren't sent by post either (field audit, Nov 5,
 * 2026): live animals (post companies refuse them, and "we ship the puppy" is a known scam), pet
 * care (a service) and boats. Fish & aquariums keep it: tanks and equipment are sold there.
 */
export const NOT_SHIPPED_LEAVES = new Set(['dogs', 'cats', 'birds', 'small-animals', 'pet-care', 'boats']);

/** Whether «ارسال پستی» is offered in a category (`path`: root first; an empty path, all categories, is) */
export function shippable(path: { slug: string }[]): boolean {
  if (path[0] && NOT_SHIPPED.has(path[0].slug)) return false;
  return !path.some((c) => NOT_SHIPPED_LEAVES.has(c.slug));
}

/**
 * Categories (and everything under them) without «معاوضه» as a price (field audit, Nov 5, 2026):
 * services, lessons, pet care and rideshare are paid or free, and animals aren't traded
 */
export const NO_EXCHANGE = new Set(['services', 'lessons-courses', 'pet-care', 'rideshare', 'dogs', 'cats']);

/** Whether «معاوضه» is a price kind in a category (`path`: root first) */
export const exchangeAllowed = (path: { slug: string }[]): boolean => !path.some((c) => NO_EXCHANGE.has(c.slug));

/** `path`: the category and its ancestors, root first */
export function safetyKind(path: { slug: string }[]): SafetyKind {
  const slugs = path.map((c) => c.slug);
  if (slugs.some((s) => RENT_SLUGS.has(s) && s !== 'real-estate')) return 'rent';
  if (slugs.includes('tickets')) return 'tickets';
  if (slugs[0] === 'vehicles') return 'vehicle';
  if (slugs[0] === 'jobs') return 'jobs';
  if (slugs[0] === 'pets') return 'pets';
  return 'general';
}
