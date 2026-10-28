// Finds the map pin of events and businesses saved before pins came from the street address
// (docs/setup.md, "The street map"; Oct 28, 2026): in-person events that haven't ended and active
// businesses with a street address and no pin. One lookup a second; a match farther than 15 km
// from the postal code is left out. Run once per environment with the web's environment
// (GEOCODER_URL, DATABASE_URL and the rest); `--dry` only prints what it would set.
//
//   npx tsx scripts/find-venue-pins.ts [--dry]

import postgres from 'postgres';
import { webEnv } from '../src/lib/env';
import { geocodeAddress } from '../src/modules/maps/geocode';
import { pinNear } from '../src/modules/maps/pin';

const dry = process.argv.includes('--dry');
const env = webEnv();
if (!env.GEOCODER_URL) throw new Error('GEOCODER_URL is not set');
const sql = postgres(env.DATABASE_URL, { max: 1, onnotice: () => {} });

type Row = { id: string; street: string; place: string; country: string; lng: number; lat: number };

async function fill(kind: string, rows: Row[], save: (id: string, lng: number, lat: number) => Promise<unknown>) {
  let found = 0;
  for (const r of rows) {
    const pin = await geocodeAddress({ street: r.street, place: r.place, countryCode: r.country });
    const near = !!pin && pinNear(pin, { lng: r.lng, lat: r.lat });
    console.log(`${kind} ${r.id}: ${pin ? `${pin.lat},${pin.lng}${near ? '' : ' (too far, left out)'}` : 'not found'}`);
    if (pin && near) {
      found++;
      if (!dry) await save(r.id, pin.lng, pin.lat);
    }
  }
  console.log(`${kind}: ${found} of ${rows.length} pinned${dry ? ' (dry run)' : ''}`);
}

try {
  const events = await sql<Row[]>`
    SELECT d.listing_id AS id, d.street_address AS street, concat_ws(' ', l.postal_code, l.place_name) AS place, l.country_code AS country,
      ST_X(l.point::geometry) AS lng, ST_Y(l.point::geometry) AS lat
    FROM event_details d JOIN listings l ON l.id = d.listing_id
    WHERE d.venue_pin IS NULL AND d.street_address IS NOT NULL AND d.attendance <> 'online'
      AND l.status IN ('active', 'draft', 'pending_review') AND l.point IS NOT NULL AND l.country_code IS NOT NULL
      AND (l.expires_at IS NULL OR l.expires_at > now())
    ORDER BY l.created_at`;
  await fill('event', events, (id, lng, lat) => sql`UPDATE event_details SET venue_pin = ST_GeogFromText(${`SRID=4326;POINT(${lng} ${lat})`}) WHERE listing_id = ${id} AND venue_pin IS NULL`);

  const shops = await sql<Row[]>`
    SELECT id, address_line1 AS street, concat_ws(' ', postal_code, place_name) AS place, country_code AS country,
      ST_X(point::geometry) AS lng, ST_Y(point::geometry) AS lat
    FROM organizations
    WHERE pin IS NULL AND address_line1 IS NOT NULL AND status = 'active' AND point IS NOT NULL
    ORDER BY created_at`;
  await fill('business', shops, (id, lng, lat) => sql`UPDATE organizations SET pin = ST_GeogFromText(${`SRID=4326;POINT(${lng} ${lat})`}) WHERE id = ${id} AND pin IS NULL`);
} finally {
  await sql.end();
}
