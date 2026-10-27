import { sql } from 'drizzle-orm';
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
