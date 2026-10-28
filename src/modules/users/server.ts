import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { appDb } from '../../db/drizzle';
import { webEnv } from '../../lib/env';
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

/** The signed-in session, or null. Cached per request. */
export const currentSession = cache(async (): Promise<CurrentSession | null> => {
  return auth().api.getSession({ headers: await headers() });
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
