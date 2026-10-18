'use server';

import { z } from 'zod';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { snapToGrid } from '../../../lib/geo';
import { activeCountries } from '../../../modules/listings/queries';
import { createNearToken } from '../../../modules/search/near';
import { nearestCity } from '../../../modules/search/places';

// "Near me": the browser sends its position, already snapped to the ~500 m grid. The server snaps
// again, checks it is in the page's country and answers with the encrypted token for the
// address. Nothing here stores or logs the position.

const input = z.object({
  country: z.string().regex(/^[a-z][a-z-]{1,40}$/),
  lat: z.number().finite().min(-89).max(89),
  lng: z.number().finite().min(-180).max(180),
});

/** A point further than this from every city of the country is "not in this country" */
const IN_COUNTRY_M = 100_000;

export async function nearMeToken(raw: { country: string; lat: number; lng: number }): Promise<{ token: string } | { error: 'invalid' | 'outside' }> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { error: 'invalid' };
  const db = appDb();
  const country = (await activeCountries(db)).find((c) => c.slug === parsed.data.country);
  if (!country) return { error: 'invalid' };
  const cell = snapToGrid(parsed.data);
  if (!(await nearestCity(db, country.code, cell, IN_COUNTRY_M))) return { error: 'outside' };
  return { token: createNearToken(webEnv().AUTH_SECRET, cell) };
}
