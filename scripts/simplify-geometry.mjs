// Douglas-Peucker for boundary rings, shared by scripts/import-neighbourhoods.mjs and
// scripts/import-postal-areas.mjs. Coordinates are [longitude, latitude] in degrees; the result is
// rounded to 5 decimals (about 1 m).

const round = (n) => Math.round(n * 1e5) / 1e5;

/** Distance from p to the segment a–b, in degrees (good enough at this scale) */
function segmentDistance(p, a, b) {
  const [x, y] = p;
  const [x1, y1] = a;
  const [x2, y2] = b;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function simplify(points, tolerance) {
  if (points.length < 3) return points;
  // Iterative, so rings with tens of thousands of points don't overflow the stack
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop();
    let max = 0;
    let index = 0;
    for (let i = first + 1; i < last; i++) {
      const d = segmentDistance(points[i], points[first], points[last]);
      if (d > max) [max, index] = [d, i];
    }
    if (max > tolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** A closed ring, simplified; split at its farthest point so both halves keep their shape. Null when it collapses. */
export function simplifyClosedRing(ring, tolerance) {
  const open = ring.slice(0, -1);
  let far = 0;
  let max = -1;
  for (let i = 1; i < open.length; i++) {
    const d = Math.hypot(open[i][0] - open[0][0], open[i][1] - open[0][1]);
    if (d > max) [max, far] = [d, i];
  }
  const first = simplify(open.slice(0, far + 1), tolerance);
  const second = simplify([...open.slice(far), open[0]], tolerance);
  const out = [...first.slice(0, -1), ...second.slice(0, -1)].map(([x, y]) => [round(x), round(y)]);
  const unique = out.filter((p, i) => i === 0 || p[0] !== out[i - 1][0] || p[1] !== out[i - 1][1]);
  return unique.length >= 3 ? [...unique, unique[0]] : null;
}
