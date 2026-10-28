import { sql } from 'drizzle-orm';
import { appDb } from '../../../../db/drizzle';

// /map/neighbourhoods/{city id}: a city's districts for the street map (docs/setup.md, "The street
// map"): their names as written locally ("Wedding", "Prenzlauer Berg") at a point inside each, and
// their borders simplified to ~30 m, as two GeoJSON collections. OpenStreetMap only names Berlin's
// districts close up; these are readable from the whole city down. Reference data: kept a day.

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DAY = { 'Cache-Control': 'public, max-age=86400' };

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response(null, { status: 404 });
  const [r] = await appDb().execute<{ labels: unknown; lines: unknown }>(sql`
    SELECT
      json_build_object('type', 'FeatureCollection', 'features', coalesce(json_agg(json_build_object(
        'type', 'Feature',
        'properties', json_build_object('name', name_local, 'km2', round((ST_Area(boundary) / 1e6)::numeric, 1)),
        'geometry', ST_AsGeoJSON(ST_PointOnSurface(boundary::geometry), 5)::json)), '[]')) AS labels,
      json_build_object('type', 'FeatureCollection', 'features', coalesce(json_agg(json_build_object(
        'type', 'Feature',
        'properties', json_build_object(),
        'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(ST_Boundary(boundary::geometry), 0.0003), 5)::json)), '[]')) AS lines
    FROM neighbourhoods WHERE location_id = ${id} AND is_active`);
  return Response.json(r ?? { labels: null, lines: null }, { headers: DAY });
}
