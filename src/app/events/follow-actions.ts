'use server';

import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { appDb } from '../../db/drizzle';
import { users } from '../../db/schema';
import { valkey } from '../../lib/valkey';
import { follow, unfollow } from '../../modules/events/follows';
import { isUnreachableMarked } from '../../modules/notifications/telegram-reach';
import { setWeeklyEvents } from '../../modules/users/notification-prefs';
import { requireSession } from '../../modules/users/server';

// «خبرم کن» on the events list (the weekly message for a city) and «دنبال کردن» on an event page.
// Plain forms; signed out, requireSession sends the visitor to sign in and back to the page.

/** Only our own pages, never another site */
const back = z
  .string()
  .max(300)
  .regex(/^\/(?!\/)[^\s]*$/)
  .catch('/');

const weeklySchema = z.object({ cityId: z.uuid().nullable(), intent: z.enum(['on', 'off']), back });

export async function weeklyEventsAction(form: FormData): Promise<void> {
  const parsed = weeklySchema.safeParse({ cityId: form.get('cityId') || null, intent: form.get('intent'), back: form.get('back') ?? '/' });
  const to = parsed.success ? parsed.data.back : '/';
  const { user } = await requireSession(to);
  if (!parsed.success) redirect(to);
  const db = appDb();
  if (parsed.data.intent === 'off') await setWeeklyEvents(db, user.id, 'off');
  else {
    const [me] = await db.select({ tg: users.telegramUserId }).from(users).where(eq(users.id, user.id));
    const tg = me?.tg ?? null;
    const telegramReady = tg !== null && !(await isUnreachableMarked(valkey(), tg).catch(() => false));
    await setWeeklyEvents(db, user.id, { cityId: parsed.data.cityId, telegramReady });
  }
  redirect(`${to}${to.includes('?') ? '&' : '?'}weekly=${parsed.data.intent}#weekly`);
}

const followSchema = z.object({ organizationId: z.uuid(), intent: z.enum(['follow', 'unfollow']), back });

export async function followAction(form: FormData): Promise<void> {
  const parsed = followSchema.safeParse({ organizationId: form.get('organizationId'), intent: form.get('intent'), back: form.get('back') ?? '/' });
  const to = parsed.success ? parsed.data.back : '/';
  const { user } = await requireSession(to);
  if (!parsed.success) redirect(to);
  const db = appDb();
  const r = parsed.data.intent === 'follow' ? await follow(db, user.id, parsed.data.organizationId) : await unfollow(db, user.id, parsed.data.organizationId);
  redirect(`${to}${to.includes('?') ? '&' : '?'}${r.ok ? `followed=${r.following ? '1' : '0'}` : `follow=${r.reason}`}#organizer`);
}
