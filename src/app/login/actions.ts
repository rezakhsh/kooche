'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { appDb } from '../../db/drizzle';
import { webEnv } from '../../lib/env';
import type { FormState } from '../../lib/form';
import { normalizePersian } from '../../lib/normalize-persian';
import { messages } from '../../messages/fa';
import { authErrorCode, rateLimitMessage } from '../../modules/users/errors';
import { loadActor } from '../../modules/users/permissions';
import { auth, safeNext } from '../../modules/users/server';
import { savePendingFavorite } from '../favorites/pending';

// Sign-in by email code. The email and the page to return to travel between the two steps in
// short-lived HTTP-only cookies, never in the URL.

const EMAIL_COOKIE = 'login_email';
const NEXT_COOKIE = 'login_next';
const COOKIE_SECONDS = 10 * 60;

const emailSchema = z.email().max(254);
const codeSchema = z.string().regex(/^[0-9]{6}$/);

async function setLoginCookie(name: string, value: string) {
  (await cookies()).set(name, value, {
    httpOnly: true,
    secure: webEnv().APP_URL.startsWith('https://'),
    sameSite: 'lax',
    path: '/login',
    maxAge: COOKIE_SECONDS,
  });
}

async function sendCode(email: string): Promise<string | null> {
  try {
    await auth().api.sendVerificationOTP({
      body: { email, type: 'sign-in' },
      headers: await headers(),
    });
    return null;
  } catch (e) {
    const limited = rateLimitMessage(e);
    if (limited) return limited;
    console.error('login: sending the code failed:', e instanceof Error ? e.message : e);
    return messages.login.sendFailed;
  }
}

export async function requestCode(_: FormState, form: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(String(form.get('email') ?? '').trim().toLowerCase());
  if (!email.success) return { error: messages.login.invalidEmail };

  const error = await sendCode(email.data);
  if (error) return { error };

  await setLoginCookie(EMAIL_COOKIE, email.data);
  await setLoginCookie(NEXT_COOKIE, safeNext(form.get('next')));
  redirect('/login/code');
}

export async function resendCode(_: FormState): Promise<FormState> {
  const email = (await cookies()).get(EMAIL_COOKIE)?.value;
  if (!email) return { error: messages.code.noEmail };
  const error = await sendCode(email);
  return error ? { error } : { notice: messages.code.resent };
}

export async function verifyCode(_: FormState, form: FormData): Promise<FormState> {
  const jar = await cookies();
  const email = jar.get(EMAIL_COOKIE)?.value;
  if (!email) return { error: messages.code.noEmail };
  const code = codeSchema.safeParse(normalizePersian(String(form.get('code') ?? '')).replace(/\s/g, ''));
  if (!code.success) return { error: messages.code.invalid };

  let userId: string;
  try {
    const result = await auth().api.signInEmailOTP({
      body: { email, otp: code.data },
      headers: await headers(),
    });
    userId = result.user.id;
  } catch (e) {
    const limited = rateLimitMessage(e);
    if (limited) return { error: limited };
    const t = messages.code;
    switch (authErrorCode(e)) {
      case 'INVALID_OTP':
        return { error: t.invalid };
      case 'OTP_EXPIRED':
        return { error: t.expired };
      case 'TOO_MANY_ATTEMPTS':
        return { error: t.tooManyAttempts };
      case 'ACCOUNT_DISABLED':
        return { error: t.accountDisabled };
    }
    console.error('login: sign-in failed:', e instanceof Error ? e.message : e);
    return { error: messages.genericError };
  }

  const next = safeNext(jar.get(NEXT_COOKIE)?.value);
  jar.delete({ name: EMAIL_COOKIE, path: '/login' });
  jar.delete({ name: NEXT_COOKIE, path: '/login' });
  // A ♡ tapped before signing in
  await savePendingFavorite(userId);

  // New and unverified users go to phone verification first, unless they came from somewhere
  const actor = await loadActor(appDb(), userId);
  redirect(next === '/' && !actor?.phoneVerifiedAt ? '/account/phone' : next);
}
