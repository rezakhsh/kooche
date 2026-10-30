'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { appDb } from '../../../db/drizzle';
import { requestErasure } from '../../../modules/users/erasure';
import { auth, currentActing, requireSession } from '../../../modules/users/server';

const input = z.object({ email: z.string().max(320), confirm: z.literal('on') });

/** Deletes the signed-in user's own account; there is no user id in the form */
export async function deleteAccountAction(form: FormData): Promise<void> {
  const { user } = await requireSession('/account/delete');
  // Only the person themself, never an admin signed in as them (code check, Oct 30, 2026)
  if (await currentActing()) redirect('/account/delete?error=acting');
  const parsed = input.safeParse({ email: form.get('email') ?? '', confirm: form.get('confirm') });
  if (!parsed.success) redirect('/account/delete?error=not_confirmed');
  const result = await requestErasure(appDb(), user.id, parsed.data.email);
  if (!result.ok) redirect(result.error === 'not_active' ? '/account/deleted' : `/account/delete?error=${result.error}`);
  // Every session row is gone already; clear this browser's cookie too
  await auth()
    .api.signOut({ headers: await headers() })
    .catch(() => undefined);
  // A __Secure- cookie is only replaced by one that is Secure too, which delete() doesn't send
  const jar = await cookies();
  for (const c of jar.getAll()) {
    if (c.name.includes('better-auth.')) jar.set(c.name, '', { maxAge: 0, path: '/', httpOnly: true, sameSite: 'lax', secure: c.name.startsWith('__Secure-') });
  }
  redirect('/account/deleted');
}
