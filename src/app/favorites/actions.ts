'use server';

import { redirect } from 'next/navigation';
import { appDb } from '../../db/drizzle';
import { valkey } from '../../lib/valkey';
import { messages } from '../../messages/fa';
import { addFavorite, removeFavorite } from '../../modules/listings/favorites';
import { currentSession, safeNext } from '../../modules/users/server';
import { rememberPendingFavorite } from './pending';

export type FavoriteState = { saved: boolean; error?: string };

/**
 * The ♡ on cards and listing pages. Signed in: saves or removes. Logged out: remembers the
 * listing and goes to sign-in, which saves it and comes back (src/app/favorites/pending.ts).
 * Works as a plain form post without JavaScript.
 */
export async function favoriteAction(prev: FavoriteState, form: FormData): Promise<FavoriteState> {
  const token = String(form.get('token') ?? '');
  const back = safeNext(form.get('back'));
  const remove = form.get('intent') === 'remove';
  const session = await currentSession();
  if (!session) {
    if (!remove && /^[0-9a-hjkmnp-tv-z]{10}$/.test(token)) await rememberPendingFavorite(token);
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }
  const db = appDb();
  const r = remove ? await removeFavorite(db, session.user.id, token) : await addFavorite(db, valkey(), session.user.id, token);
  if (r.ok) return { saved: r.saved };
  const t = messages.favorites;
  return { saved: prev.saved, error: r.reason === 'own' ? t.own : r.reason === 'limit' ? t.limit : r.reason === 'rate_limited' ? t.rateLimited : t.unavailable };
}
