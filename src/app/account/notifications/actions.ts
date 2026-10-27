'use server';

import { redirect } from 'next/navigation';
import { appDb } from '../../../db/drizzle';
import { NOTICE_KINDS, saveNotificationPrefs, type NoticeChannel, type NoticeKind } from '../../../modules/users/notification-prefs';
import { requireSession } from '../../../modules/users/server';

// Every switch of the page at once (a switch that is off isn't sent)
export async function saveNotificationsAction(form: FormData): Promise<void> {
  const { user } = await requireSession('/account/notifications');
  const on = (name: string) => form.get(name) === 'on';
  const channels = Object.fromEntries(
    NOTICE_KINDS.map((k) => [k, { telegram: on(`${k}.telegram`), email: on(`${k}.email`) }]),
  ) as Record<NoticeKind, Record<NoticeChannel, boolean>>;
  await saveNotificationPrefs(appDb(), user.id, { channels, quiet: on('quiet'), bundle: on('bundle') });
  redirect('/account/notifications?saved=1');
}
