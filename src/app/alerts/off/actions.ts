'use server';

import { redirect } from 'next/navigation';
import { appDb } from '../../../db/drizzle';
import { unsubscribeByToken } from '../../../modules/search/saved';

export async function unsubscribeAction(form: FormData): Promise<void> {
  const token = String(form.get('t') ?? '');
  const done = await unsubscribeByToken(appDb(), token);
  redirect(done ? `/alerts/off?t=${token}&done=1` : '/alerts/off');
}
