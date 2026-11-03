// Which safety advice a listing gets (wave 1): the rent-scam warning on room and flat pages
// (src/app/[country]/_browse/browse-page.tsx) and the safety box on the listing page, by its place
// in the category tree (slugs from seed/categories.ts).

export type SafetyKind = 'rent' | 'vehicle' | 'tickets' | 'jobs' | 'pets' | 'general';

/** Rooms and flats to rent, and the real-estate root above them */
export const RENT_SLUGS = new Set(['real-estate', 'apartments-rent', 'houses-rent', 'shared-rooms', 'short-term-rent']);

/** A room is let for one monthly rent; flats and houses for the cold rent (owner, Nov 3, 2026) */
export const PLAIN_RENT_SLUGS = new Set(['shared-rooms']);

export type RentKind = 'cold' | 'plain';

/** How a category's price reads: the cold rent, the plain rent of a room, or not a rent (null). `path`: root first */
export function rentKind(path: { slug: string }[]): RentKind | null {
  if (!path.some((c) => RENT_SLUGS.has(c.slug) && c.slug !== 'real-estate')) return null;
  return path.some((c) => PLAIN_RENT_SLUGS.has(c.slug)) ? 'plain' : 'cold';
}

/** Top categories whose things aren't sent by post: no «ارسال پستی» in their form or filters */
export const NOT_SHIPPED = new Set(['real-estate', 'services', 'jobs', 'lessons-courses', 'community']);

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
