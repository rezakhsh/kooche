'use server';

import { redirect } from 'next/navigation';
import { appDb } from '../../../db/drizzle';
import { setChatNotices, setSavedSearchAlerts } from '../../../modules/users/notification-prefs';
import { requireSession } from '../../../modules/users/server';

export async function saveNotificationsAction(form: FormData): Promise<void> {
  const { user } = await requireSession('/account/notifications');
  await setChatNotices(appDb(), user.id, form.get('chat') === 'on');
  await setSavedSearchAlerts(appDb(), user.id, form.get('savedSearches') === 'on');
  redirect('/account/notifications?saved=1');
}
