import { sql } from 'drizzle-orm';
import { appDb } from '../../../../db/drizzle';

// /map/place-area/{postal place id}: the area of a postal place's code as GeoJSON, for the forms'
// map while a place is being picked (the value of a postal suggestion is "p:{id}",
// src/modules/listings/places.ts). Pages get their area with the HTML. Reference data, the same
// for everyone: kept a day. 404 when the postal code has no area (the map draws a circle).

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DAY = { 'Cache-Control': 'public, max-age=86400' };

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response(null, { status: 404 });
  const [r] = await appDb().execute<{ geojson: string }>(sql`
    SELECT ST_AsGeoJSON(a.boundary, 5) AS geojson
    FROM postal_places p JOIN postal_areas a ON a.country_code = p.country_code AND a.postal_code = p.postal_code
    WHERE p.id = ${id} AND p.is_active`);
  return r ? new Response(r.geojson, { headers: { 'Content-Type': 'application/json', ...DAY } }) : new Response(null, { status: 404, headers: DAY });
}
