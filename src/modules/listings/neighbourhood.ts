import { sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { listings } from '../../db/schema';

// A listing's neighbourhood (wave 1): the Persian name of its city's neighbourhood that covers its
// point (seed/neighbourhoods/), looked up when shown, never stored. Only for a point placed by
// postal code or area: a listing placed by city sits on the city's centre, which says nothing
// about where it is.

/** Select column: «ودینگ», or null (no point, a city-only place, or a city without neighbourhoods) */
export const listingNeighbourhood = sql<string | null>`(
  SELECT n.name_fa FROM neighbourhoods n
  WHERE ${listings.locationPrecision} IN ('postal_code', 'area')
    AND n.location_id = ${listings.locationId}
    AND n.is_active
    AND ST_Covers(n.boundary, ${listings.point})
  ORDER BY n.key
  LIMIT 1)`;

/**
 * Where the user lives, for the account's profile card («ودینگ، برلین») and the header's place
 * chip: the saved place's city and, for a saved postal code, the neighbourhood covering its centre.
 */
export async function homeArea(db: Queryable, userId: string): Promise<{ city: string; citySlug: string; countryCode: string; neighbourhood: string | null } | null> {
  const [r] = await db.execute<{ city: string; slug: string; country_code: string; neighbourhood: string | null }>(sql`
    SELECT l.name_fa AS city, l.slug, l.country_code,
      (SELECT n.name_fa FROM neighbourhoods n
       WHERE n.location_id = l.id AND n.is_active AND ST_Covers(n.boundary, pp.center)
       ORDER BY n.key LIMIT 1) AS neighbourhood
    FROM users u
    LEFT JOIN postal_places pp ON pp.is_active AND pp.postal_code = u.home_postal_code AND pp.place_name = u.home_place_name
      AND pp.country_code = (SELECT country_code FROM locations WHERE id = u.home_location_id)
    JOIN locations l ON l.id = coalesce(pp.location_id, u.home_location_id) AND l.is_active
    WHERE u.id = ${userId}
    LIMIT 1
  `);
  return r ? { city: r.city, citySlug: r.slug, countryCode: r.country_code, neighbourhood: r.neighbourhood } : null;
}
