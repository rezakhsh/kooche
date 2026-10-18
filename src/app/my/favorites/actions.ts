'use server';

import { redirect } from 'next/navigation';
import { appDb } from '../../../db/drizzle';
import { removeFavorite } from '../../../modules/listings/favorites';
import { requireSession } from '../../../modules/users/server';

/** "Remove" on /my/favorites: only the user's own favorite, then back to the list */
export async function removeFromFavorites(form: FormData): Promise<void> {
  const { user } = await requireSession('/my/favorites');
  await removeFavorite(appDb(), user.id, String(form.get('token') ?? ''));
  redirect('/my/favorites');
}
