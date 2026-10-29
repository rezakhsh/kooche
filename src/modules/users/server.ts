import { eq } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { appDb } from '../../db/drizzle';
import { sessions } from '../../db/schema';
import { webEnv } from '../../lib/env';
import { ACTING_BLOCKED_COOKIE, actingGate, actingState, recordActingChange, type ActingState } from '../admin/acting';
import { METHOD_HEADER } from '../admin/gate';
import { viewAsCountry } from '../admin/view-as';
import { valkey } from '../../lib/valkey';
import { type Auth, createAuth } from './auth';
import { smtpMailer } from './email';
import { smsProvider, type SmsProvider } from './sms';
import { seesTestContent } from './test-accounts';
import { telegramTransport, type OidcConfig, type OidcTransport } from './telegram-oidc';

// The Next.js side of the users module: the Better Auth instance and session helpers for pages and
// server actions. Server code only.

const globalForAuth = globalThis as typeof globalThis & { auth?: Auth; sms?: SmsProvider };

export function auth(): Auth {
  if (globalForAuth.auth) return globalForAuth.auth;
  const env = webEnv();
  return (globalForAuth.auth = createAuth({
    db: appDb(),
    redis: valkey(),
    secret: env.AUTH_SECRET,
    baseURL: env.APP_URL,
    sendLoginCode: smtpMailer({ smtpUrl: env.SMTP_URL, from: env.EMAIL_FROM }),
    testAccountCode: env.TEST_ACCOUNT_CODE,
    nextJs: true,
  }));
}

export function sms(): SmsProvider {
  return (globalForAuth.sms ??= smsProvider(webEnv().SMS_PROVIDER));
}

/** "Log in with Telegram" settings, or null when TELEGRAM_OIDC_CLIENT_ID isn't set (the bot only) */
export function telegramLogin(): (OidcConfig & { transport: OidcTransport }) | null {
  const env = webEnv();
  if (!env.TELEGRAM_OIDC_CLIENT_ID || !env.TELEGRAM_OIDC_CLIENT_SECRET) return null;
  const g = globalThis as { telegramTransport?: OidcTransport };
  g.telegramTransport ??= telegramTransport();
  return {
    clientId: env.TELEGRAM_OIDC_CLIENT_ID,
    clientSecret: env.TELEGRAM_OIDC_CLIENT_SECRET,
    redirectUri: `${env.APP_URL}/account/phone/telegram/callback`,
    secret: env.PHONE_CODE_SECRET,
    transport: g.telegramTransport,
  };
}

export type CurrentSession = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>;

/**
 * The signed-in session, or null. Cached per request. Staff viewing the site as a country see it
 * without their account (src/modules/admin/view-as.ts; the admin page never carries the header).
 */
export const currentSession = cache(async (): Promise<CurrentSession | null> => {
  const h = await headers();
  if (viewAsCountry(h)) return null;
  const session = await auth().api.getSession({ headers: h });
  if (!session) return null;
  // A session an admin opened for this user (src/modules/admin/acting.ts)
  const acting = await actingState(appDb(), session.session.id);
  if (!acting) return session;
  if (acting === 'ended') {
    await appDb().delete(sessions).where(eq(sessions.id, session.session.id));
    return null;
  }
  const path = h.get('x-pathname') ?? '/';
  const gate = actingGate(acting, { method: h.get(METHOD_HEADER) ?? 'GET', action: h.has('next-action') });
  if (gate === 'record') await recordActingChange(appDb(), acting, session.session.id, path);
  if (gate === 'block') {
    // In a server action: back to the page, where the banner says why. Anything else: no account.
    if (!h.has('next-action')) return null;
    try {
      (await cookies()).set(ACTING_BLOCKED_COOKIE, '1', { path: '/', maxAge: 15, httpOnly: true, secure: true, sameSite: 'lax' });
    } catch {
      // Cookies can't be set while the page renders again after an action that never asked for
      // the account (the appearance switch): nothing of the user's was changed, so show the page
      return session;
    }
    redirect(path);
  }
  return session;
});

/** The session's state when an admin opened it for this user, else null. Cached per request. */
export const currentActing = cache(async (): Promise<ActingState | null> => {
  const session = await currentSession();
  if (!session) return null;
  const acting = await actingState(appDb(), session.session.id);
  return acting === 'ended' ? null : acting;
});

/**
 * Whether the visitor sees test accounts' listings, events, businesses and seller pages: staff
 * and test accounts only (src/modules/users/test-accounts.ts). Cached per request.
 */
export const viewerSeesTest = cache(async (): Promise<boolean> => {
  const session = await currentSession();
  return seesTestContent(appDb(), session?.user.id);
});

/** For pages behind login: the session, or a redirect to /login that comes back here. */
export async function requireSession(returnTo: string): Promise<CurrentSession> {
  const session = await currentSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return session;
}

/** A same-site path to go to after login. Anything else (other sites, //host) becomes "/". */
export function safeNext(value: unknown): string {
  return typeof value === 'string' && /^\/(?![/\\])[^\s]*$/.test(value) ? value : '/';
}
