import { cookies } from 'next/headers';
import { appDb } from '../../db/drizzle';
import { webEnv } from '../../lib/env';
import { valkey } from '../../lib/valkey';
import { addFavorite } from '../../modules/listings/favorites';

// A ♡ tapped while logged out: the listing's public token waits in a short-lived HTTP-only cookie
// while the visitor signs in, and the login action saves it once. Saving never happens on a GET
// request, so another site can't make anyone save a listing.

export const PENDING_FAVORITE_COOKIE = 'pending_favorite';
const PENDING_SECONDS = 30 * 60;

export async function rememberPendingFavorite(token: string): Promise<void> {
  (await cookies()).set(PENDING_FAVORITE_COOKIE, token, {
    httpOnly: true,
    secure: webEnv().APP_URL.startsWith('https://'),
    sameSite: 'lax',
    path: '/',
    maxAge: PENDING_SECONDS,
  });
}

/** After a sign-in: saves the waiting favorite, if any, and forgets it either way */
export async function savePendingFavorite(userId: string): Promise<void> {
  const jar = await cookies();
  const token = jar.get(PENDING_FAVORITE_COOKIE)?.value;
  if (!token) return;
  jar.delete({ name: PENDING_FAVORITE_COOKIE, path: '/' });
  // A listing that went away or is the user's own is simply not saved
  await addFavorite(appDb(), valkey(), userId, token);
}
