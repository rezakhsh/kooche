import { readFile } from 'node:fs/promises';
import path from 'node:path';

// /map/sprites/4/light.json|png (and @2x): the street map's icons (train stations, road numbers),
// Protomaps' v4 sprite sheet from basemaps-assets, drawn from Mapzen's MIT-licensed icons
// (src/modules/maps/sprites/LICENSE.md). The version is in the address, so the files are kept a year.

export const dynamic = 'force-dynamic';

const DIR = path.join(process.cwd(), 'src/modules/maps/sprites');
const FILES: Record<string, string> = { 'light.json': 'application/json', 'light@2x.json': 'application/json', 'light.png': 'image/png', 'light@2x.png': 'image/png' };

export async function GET(_: Request, { params }: { params: Promise<{ v: string; file: string }> }) {
  const { v, file } = await params;
  const type = FILES[file];
  if (v !== '4' || !type) return new Response(null, { status: 404 });
  const data = await readFile(path.join(DIR, file));
  return new Response(new Uint8Array(data), { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable' } });
}
