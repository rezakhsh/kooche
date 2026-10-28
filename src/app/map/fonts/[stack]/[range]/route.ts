import { readFile } from 'node:fs/promises';
import path from 'node:path';

// /map/fonts/{font}/{range}.pbf: the letters the street map draws its labels with (Noto Sans from
// Protomaps' basemaps-assets, OFL, src/modules/maps/glyphs/OFL.txt), in 256-codepoint blocks.
// Only the blocks our countries need are in the repository (Latin, Greek, Cyrillic, Arabic with its
// presentation forms, punctuation). Any other block answers with an empty set of letters, so the
// map skips those characters without an error. The files never change: kept for a year.

export const dynamic = 'force-dynamic';

const DIR = path.join(process.cwd(), 'src/modules/maps/glyphs');
// Water names are set in italics by the Protomaps style; we draw them upright
const STACKS: Record<string, string> = { 'Noto Sans Regular': 'Noto Sans Regular', 'Noto Sans Medium': 'Noto Sans Medium', 'Noto Sans Italic': 'Noto Sans Regular' };
const HEADERS = { 'Content-Type': 'application/x-protobuf', 'Cache-Control': 'public, max-age=31536000, immutable' };

export async function GET(_: Request, { params }: { params: Promise<{ stack: string; range: string }> }) {
  const { stack, range } = await params;
  // A layer may name several fonts ("A,B"); the first one we have wins
  const font = decodeURIComponent(stack)
    .split(',')
    .map((s) => STACKS[s.trim()])
    .find(Boolean);
  const m = /^(\d{1,5})-(\d{1,5})\.pbf$/.exec(range);
  if (!font || !m || Number(m[1]) % 256 !== 0 || Number(m[2]) !== Number(m[1]) + 255 || Number(m[1]) > 65280) return new Response(null, { status: 404 });
  const data = await readFile(path.join(DIR, font, `${m[1]}-${m[2]}.pbf`)).catch(() => Buffer.alloc(0));
  return new Response(new Uint8Array(data), { headers: HEADERS });
}
