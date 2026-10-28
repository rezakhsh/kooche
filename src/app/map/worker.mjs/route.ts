import { readFile } from 'node:fs/promises';
import path from 'node:path';
import pkg from 'maplibre-gl/package.json';

// /map/worker.mjs?v={version}: MapLibre's background worker for the street map, from our own
// address. The page's CSP allows workers from 'self' only (src/proxy.ts), and the worker can't be
// bundled with the page's code, so it is served as the package ships it. Kept for a year when the
// address names the installed version.

export const dynamic = 'force-dynamic';

const FILE = path.join(process.cwd(), 'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs');
let cached: Promise<Buffer> | undefined;

export async function GET(request: Request) {
  cached ??= readFile(FILE);
  cached.catch(() => (cached = undefined));
  const current = new URL(request.url).searchParams.get('v') === pkg.version;
  return new Response(new Uint8Array(await cached), {
    headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': current ? 'public, max-age=31536000, immutable' : 'public, max-age=300' },
  });
}
