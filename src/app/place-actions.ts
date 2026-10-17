'use server';

import { z } from 'zod';
import { appDb } from '../db/drizzle';
import { snapToGrid } from '../lib/geo';
import { hit } from '../lib/rate-limit';
import { valkey } from '../lib/valkey';
import { LISTING_LIMITS } from '../modules/listings/limits';
import { nearestPostalPlace, searchPlaces, toSuggestion, type PlaceSuggestion } from '../modules/listings/places';
import { activeCountries } from '../modules/listings/queries';
import { currentSession } from '../modules/users/server';

// The place field (posting form, "my location" in the account): suggestions from our own postal
// codes and cities, and the postal code nearest the browser's position. Signed-in users only,
// rate-limited. Positions arrive snapped to ~500 m and are snapped again; nothing is stored.

const query = z.object({ country: z.string().length(2), q: z.string().max(100) });
const near = z.object({ country: z.string().length(2), lat: z.number(), lng: z.number() });

async function allowed(country: string): Promise<boolean> {
  const session = await currentSession();
  if (!session) return false;
  const open = await activeCountries(appDb());
  if (!open.some((c) => c.code === country)) return false;
  return (await hit(valkey(), [[LISTING_LIMITS.placeSearchPerUserHour, session.user.id]])).ok;
}

export async function searchPlacesAction(country: string, q: string): Promise<PlaceSuggestion[]> {
  const input = query.safeParse({ country, q });
  if (!input.success || !(await allowed(input.data.country))) return [];
  return searchPlaces(appDb(), input.data.country, input.data.q);
}

export async function nearestPlaceAction(country: string, lat: number, lng: number): Promise<PlaceSuggestion | null> {
  const input = near.safeParse({ country, lat, lng });
  if (!input.success || !(await allowed(input.data.country))) return null;
  let point;
  try {
    point = snapToGrid(input.data);
  } catch {
    return null;
  }
  const place = await nearestPostalPlace(appDb(), input.data.country, point);
  return place ? toSuggestion(place) : null;
}
