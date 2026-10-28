import { webEnv } from '../../../../../../../lib/env';
import { mapFile } from '../../../../../../../modules/maps/pmtiles';

// /map/tiles/{version}/{z}/{x}/{y}: one vector tile of the street map (docs/setup.md, "The street
// map"), copied out of the map file as stored (gzip). The version in the address changes with every
// new map file, so a tile never changes and Cloudflare and browsers keep it for a year. The version
// itself isn't checked: a page cached with the previous one still gets tiles. Outside the file's
// area (or zoom) there is no tile: 204, which the map draws as empty.

export const dynamic = 'force-dynamic';

const KEEP = 'public, max-age=31536000, immutable';
const INT = /^\d{1,8}$/;

export async function GET(_: Request, { params }: { params: Promise<{ v: string; z: string; x: string; y: string }> }) {
  const file = webEnv().MAP_TILES_FILE;
  const { z, x, y } = await params;
  if (!file || !INT.test(z) || !INT.test(x) || !INT.test(y)) return new Response(null, { status: 404 });
  const [zn, xn, yn] = [Number(z), Number(x), Number(y)];
  if (zn > 22 || xn >= 2 ** zn || yn >= 2 ** zn) return new Response(null, { status: 404 });
  const map = mapFile(file);
  let data: Buffer | null;
  let gzip: boolean;
  try {
    [data, { gzip }] = await Promise.all([map.tile(zn, xn, yn), map.info()]);
  } catch (e) {
    console.error('map tiles:', e instanceof Error ? e.message : e);
    return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!data) return new Response(null, { status: 204, headers: { 'Cache-Control': KEEP } });
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': 'application/vnd.mapbox-vector-tile',
      ...(gzip ? { 'Content-Encoding': 'gzip' } : {}),
      'Cache-Control': KEEP,
    },
  });
}
