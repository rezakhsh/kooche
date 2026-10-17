import type { Point } from '../db/types';
import { OUTLINES } from '../modules/listings/outline-data';

// The map on listing pages and in the posting form: the country's states as a simple drawing and
// a dot with a soft circle where the listing is (decided Oct 17, 2026: no map tiles, no outside
// service). The point is never exact (docs/schema.md, section 8), and at this scale the dot
// shows the region, not a street. Plain SVG, so it works on the server and in the browser.

export function projectOnOutline(countryCode: string, { lng, lat }: Point): { x: number; y: number } | null {
  const o = OUTLINES[countryCode];
  if (!o) return null;
  const { minLng, maxLat, k, scale } = o.projection;
  return { x: (lng - minLng) * k * scale, y: (maxLat - lat) * scale };
}

export function OutlineMap({ countryCode, point, label }: { countryCode: string; point: Point; label: string }) {
  const o = OUTLINES[countryCode];
  const at = projectOnOutline(countryCode, point);
  if (!o || !at) return null;
  return (
    <svg viewBox={`-6 -6 ${o.width + 12} ${o.height + 12}`} role="img" aria-label={label} className="h-auto w-full max-w-60">
      {o.states.map((d, i) => (
        <path key={i} d={d} className="fill-neutral-100 stroke-neutral-300" strokeWidth={1.5} strokeLinejoin="round" />
      ))}
      <circle cx={at.x} cy={at.y} r={18} className="fill-emerald-600/20" />
      <circle cx={at.x} cy={at.y} r={6} className="fill-emerald-700 stroke-white" strokeWidth={2.5} />
    </svg>
  );
}
