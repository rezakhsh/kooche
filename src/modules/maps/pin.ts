import { z } from 'zod';
import type { Point } from '../../db/types';
import { distanceMeters } from '../../lib/geo';

// The exact spot of an event's venue or a business's shop, tapped on the street map by its owner
// (migration 0027; optional). Public like the address it belongs to; never asked of private sellers.
// The form sends "lat,lng"; the spot must lie near the chosen postal code, so a slip of the finger
// can't put a Berlin shop in Hamburg.

/** How far the pin may be from the chosen place's centre (a large rural postal area is ~10 km across) */
export const PIN_MAX_M = 15_000;

const PIN = /^(-?\d{1,2}(?:\.\d{1,7})?),(-?\d{1,3}(?:\.\d{1,7})?)$/;

/** "52.54321,13.36789" → a point, "" → null; anything else fails */
export const pinField = z
  .string()
  .max(40)
  .default('')
  .transform((s, ctx): Point | null => {
    const v = s.trim();
    if (!v) return null;
    const m = PIN.exec(v);
    const lat = Number(m?.[1]);
    const lng = Number(m?.[2]);
    if (!m || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      ctx.addIssue({ code: 'custom', message: 'pin_invalid' });
      return z.NEVER;
    }
    // Six decimals are about 10 cm: more says nothing a tap could know
    return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
  });

export const pinNear = (pin: Point, center: Point) => distanceMeters(pin, center) <= PIN_MAX_M;
