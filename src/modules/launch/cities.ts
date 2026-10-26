import { eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Queryable } from '../../db/drizzle';
import { locations } from '../../db/schema';
import type { Point } from '../../db/types';
import { distanceMeters } from '../../lib/geo';

// City launch (round 12, docs/wave0-plan.md, item 1): listings other than events are published
// only in open cities, and within the open city's radius (the Berlin area: Berlin and Potsdam
// within 40 km of Berlin's centre). Events and business pages are allowed everywhere in an active
// country. A city that launches together with another (Potsdam → Berlin) takes that city's
// centre and radius.

export type ListingArea = 'open' | 'city_not_open' | 'outside_area';

const anchor = alias(locations, 'anchor');

/** Whether a listing at this city and point may be published */
export async function listingArea(db: Queryable, locationId: string, point: Point): Promise<ListingArea> {
  const [row] = await db
    .select({
      status: locations.launchStatus,
      center: anchor.center,
      radiusKm: anchor.launchRadiusKm,
    })
    .from(locations)
    .innerJoin(anchor, eq(anchor.id, sql`coalesce(${locations.launchWithId}, ${locations.id})`))
    .where(eq(locations.id, locationId));
  if (!row || row.status !== 'open') return 'city_not_open';
  if (row.radiusKm !== null && distanceMeters(point, row.center) > row.radiusKm * 1000) return 'outside_area';
  return 'open';
}
