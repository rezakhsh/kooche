'use server';

import { and, eq, isNotNull } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { appDb } from '../db/drizzle';
import { sessions } from '../db/schema';
import { clientIp } from '../lib/client-ip';
import { webEnv } from '../lib/env';
import { allowActingChanges, closeActingSession, returningAdmin, sessionCookieName, sessionTokenOf, STAFF_RETURN_COOKIE } from '../modules/admin/acting';
import { ACTING_BLOCKED_COOKIE, OWN_COOKIE_DAYS } from '../modules/admin/acting-cookies';
import type { StaffContext } from '../modules/admin/audit';
import { adminAddress } from '../modules/admin/gate';

// The banner's buttons while an admin is signed in as a user (src/modules/admin/acting.ts). They
// run in the user's session, so the admin is found through the return cookie (their own session
// must still be live and an admin's), never through currentSession().

async function context() {
  const env = webEnv();
  const jar = await cookies();
  const h = await headers();
  const admin = await returningAdmin(appDb(), env.AUTH_SECRET, jar.get(STAFF_RETURN_COOKIE)?.value);
  const actingToken = sessionTokenOf(env.AUTH_SECRET, jar.get(sessionCookieName(env.APP_URL))?.value);
  const ctx: StaffContext | null = admin ? { userId: admin.userId, sessionId: admin.sessionId, role: 'admin', ip: clientIp(h), userAgent: h.get('user-agent') } : null;
  return { env, jar, h, admin, actingToken, ctx };
}

/** «پایان»: the user's session is deleted and the admin's own comes back, on the user's admin page */
export async function endActingAction(): Promise<void> {
  const { env, jar, admin, actingToken, ctx } = await context();
  const ended = ctx ? await appDb().transaction((tx) => closeActingSession(tx, ctx, actingToken)) : null;
  // Without a valid return cookie: still end this browser's opened session, then signed out
  if (!ctx && actingToken) await appDb().delete(sessions).where(and(eq(sessions.token, actingToken), isNotNull(sessions.openedByUserId)));
  jar.delete(STAFF_RETURN_COOKIE);
  if (!admin || !env.ADMIN_PATH) {
    jar.delete(sessionCookieName(env.APP_URL));
    redirect('/');
  }
  jar.set(sessionCookieName(env.APP_URL), admin.ownCookie, { path: '/', httpOnly: true, secure: env.APP_URL.startsWith('https://'), sameSite: 'lax', maxAge: OWN_COOKIE_DAYS * 86_400 });
  redirect(adminAddress(env.ADMIN_PATH, ended ? `/users/${ended.userId}` : '/view-as'));
}

/** «اجازهٔ تغییر»: from now on changes go through, each written to audit_log */
export async function allowActingChangesAction(form: FormData): Promise<void> {
  const { h, actingToken, ctx } = await context();
  if (ctx && actingToken) await appDb().transaction((tx) => allowActingChanges(tx, ctx, actingToken, String(form.get('reason') ?? '')));
  (await cookies()).delete(ACTING_BLOCKED_COOKIE);
  // The banner lives in the root layout, which a redirect alone doesn't render again
  revalidatePath('/', 'layout');
  redirect(h.get('x-pathname') ?? '/');
}
