'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { appDb } from '../../db/drizzle';
import { SIGNUP_ANSWERS, users } from '../../db/schema';
import { revokeDevice, revokeOtherDevices } from '../../modules/users/devices';
import { auth, requireSession } from '../../modules/users/server';

export async function signOut(): Promise<void> {
  await auth().api.signOut({ headers: await headers() });
  redirect('/');
}

const sessionId = z.uuid();

export async function revokeDeviceAction(form: FormData): Promise<void> {
  const { session } = await requireSession('/account/devices');
  const id = sessionId.safeParse(form.get('sessionId'));
  // The current device logs out with "sign out" instead
  if (id.success && id.data !== session.id) await revokeDevice(appDb(), session.userId, id.data);
  redirect('/account/devices?revoked=1');
}

export async function revokeOtherDevicesAction(): Promise<void> {
  const { session } = await requireSession('/account/devices');
  const n = await revokeOtherDevices(appDb(), session.userId, session.id);
  redirect(`/account/devices?revokedOthers=${n}`);
}

const answerSchema = z.enum(SIGNUP_ANSWERS);

/** «از کجا با پیدو آشنا شدید؟»: answered once (or skipped), for the visitor numbers */
export async function signupAnswerAction(form: FormData): Promise<void> {
  const { user } = await requireSession('/account');
  const answer = answerSchema.safeParse(form.get('answer'));
  if (answer.success) {
    await appDb().update(users).set({ signupAnswer: answer.data }).where(and(eq(users.id, user.id), isNull(users.signupAnswer)));
  }
  redirect(answer.success && answer.data !== 'skipped' ? '/account?answered=1' : '/account');
}
