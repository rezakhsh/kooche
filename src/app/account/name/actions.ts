'use server';

import { redirect } from 'next/navigation';
import { appDb } from '../../../db/drizzle';
import { valkey } from '../../../lib/valkey';
import { displayNameInput, setDisplayName } from '../../../modules/users/profile';
import { requireSession } from '../../../modules/users/server';

export async function saveNameAction(form: FormData): Promise<void> {
  const { user } = await requireSession('/account/name');
  const input = displayNameInput.safeParse({ displayName: form.get('displayName') ?? '' });
  if (!input.success) redirect('/account/name?error=too_long');
  const result = await setDisplayName(appDb(), valkey(), user.id, input.data.displayName);
  redirect(result.ok ? '/account/name?saved=1' : `/account/name?error=${result.error}`);
}
