import type { Point } from '../../db/types';
import { webEnv } from '../../lib/env';

// The street address → a point, for an event's venue or a business's shop (docs/setup.md, "The
// street map"): one lookup when the address is saved, never while someone types. A Nominatim
// server (GEOCODER_URL); OpenStreetMap's own allows one request a second with a User-Agent that
// names the site (https://operations.osmfoundation.org/policies/nominatim/), so lookups from
// this process wait their turn. Only the public address is sent, never anything about a user.
// Any failure is "no point": the page shows the postal code's area and the organizer can tap.

const GAP_MS = 1_100;
const TIMEOUT_MS = 4_000;
let queue: Promise<unknown> = Promise.resolve();
let last = 0;

/** Waits until a second has passed since the previous lookup of this process */
function turn<T>(run: () => Promise<T>): Promise<T> {
  const next = queue.then(async () => {
    const wait = last + GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    return run();
  });
  queue = next.catch(() => undefined);
  return next;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Where an address is, or null (no geocoder, not found, an error) */
export async function geocodeAddress(address: { street: string; place: string; countryCode: string }): Promise<Point | null> {
  // Most environments have no geocoder (development, tests): nothing to read or wait for
  if (!process.env.GEOCODER_URL) return null;
  const env = webEnv();
  const street = address.street.trim();
  if (!env.GEOCODER_URL || !street || !/^[A-Z]{2}$/.test(address.countryCode)) return null;
  const url = new URL('/search', env.GEOCODER_URL);
  url.search = new URLSearchParams({ q: [street, address.place.trim()].filter(Boolean).join(', '), countrycodes: address.countryCode.toLowerCase(), format: 'jsonv2', limit: '1' }).toString();
  try {
    return await turn(async () => {
      const res = await fetch(url, { headers: { 'User-Agent': `Peydoo (${env.APP_URL})`, Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) return null;
      const [hit] = (await res.json()) as { lat?: string; lon?: string }[];
      const lat = Number(hit?.lat);
      const lng = Number(hit?.lon);
      return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat: round6(lat), lng: round6(lng) } : null;
    });
  } catch (e) {
    console.warn('geocode:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * The pin to save for a venue or shop. The address is looked up only when it is new or changed,
 * and only if the owner hasn't placed a pin of their own in this same save: a pin they removed
 * stays removed, one they moved stays where they put it. The old address's pin goes with the old
 * address. `fromAddress` marks a found pin, which is dropped instead of refused if it lands far
 * from the postal code (a wrong match).
 */
export async function pinFromAddress(opts: {
  pin: Point | null;
  street: string | null;
  place: string;
  countryCode: string | null;
  /** What is saved now; null for something new */
  saved: { street: string | null; pin: Point | null } | null;
}): Promise<{ pin: Point | null; fromAddress: boolean }> {
  const { pin, street, saved } = opts;
  const changed = !saved || (saved.street ?? '') !== (street ?? '');
  const oldPin = !!pin && !!saved?.pin && pin.lat === saved.pin.lat && pin.lng === saved.pin.lng;
  if (!street || !opts.countryCode || !changed || (pin && !oldPin)) return { pin, fromAddress: false };
  const found = await geocodeAddress({ street, place: opts.place, countryCode: opts.countryCode });
  return found ? { pin: found, fromAddress: true } : { pin: oldPin ? null : pin, fromAddress: false };
}
