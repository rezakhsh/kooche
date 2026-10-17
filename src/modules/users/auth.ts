import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { eq } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import type { Db } from '../../db/drizzle';
import { authAccounts, sessions, users, verifications } from '../../db/schema';
import { clientIp } from '../../lib/client-ip';
import { normalizePersian } from '../../lib/normalize-persian';
import { hit, reset } from '../../lib/rate-limit';
import { publicToken } from '../../lib/tokens';
import { messages } from '../../messages/fa';
import type { LoginCodeMailer } from './email';
import { LIMITS } from './limits';

// Better Auth on our own tables (docs/schema.md, section 6): sign-in by email code only, no
// passwords. Google can be added later as a social provider: it links through auth_accounts to
// the user with the same verified email, so existing users need no migration.

export const CODE_LENGTH = 6;
export const CODE_TTL_SECONDS = 10 * 60;
/** Wrong codes before the code is locked and a new one is needed */
export const CODE_ATTEMPTS = 5;
export const SESSION_DAYS = 30;

export type AuthDeps = {
  db: Db;
  redis: Redis;
  secret: string;
  baseURL: string;
  sendLoginCode: LoginCodeMailer;
  /** Next.js only: set cookies from server actions (needs a request scope, so not in tests) */
  nextJs?: boolean;
};

export type RateLimited = { code: 'RATE_LIMITED'; retryAfterSeconds: number };

const emailSchema = z.email().max(254);

async function uniquePublicToken(db: Db): Promise<string> {
  for (;;) {
    const token = publicToken();
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.publicToken, token));
    if (!taken) return token;
  }
}

function tooMany(retryAfterSeconds: number): never {
  throw new APIError('TOO_MANY_REQUESTS', {
    code: 'RATE_LIMITED',
    message: 'Too many requests',
    retryAfterSeconds,
  });
}

export function createAuth({ db, redis, secret, baseURL, sendLoginCode, nextJs }: AuthDeps) {
  return betterAuth({
    appName: messages.site.name,
    baseURL,
    basePath: '/api/auth',
    secret,
    trustedOrigins: [baseURL],
    telemetry: { enabled: false },
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { users, sessions, authAccounts, verifications },
    }),
    emailAndPassword: { enabled: false },
    user: {
      modelName: 'users',
      fields: { name: 'displayName', image: 'avatarKey' },
      additionalFields: {
        publicToken: { type: 'string', required: false, input: false },
        displayNameNormalized: { type: 'string', required: false, input: false, returned: false },
      },
    },
    session: {
      modelName: 'sessions',
      expiresIn: SESSION_DAYS * 86_400,
      // Extend the session at most once a day while it is used
      updateAge: 86_400,
      // No cookie cache: every request checks the sessions table, so a revoked device is
      // logged out on its next request.
      cookieCache: { enabled: false },
    },
    account: {
      modelName: 'authAccounts',
      encryptOAuthTokens: true,
      accountLinking: { enabled: true, trustedProviders: ['google'] },
    },
    verification: { modelName: 'verifications' },
    // Our own limits in Valkey (hooks.before below) instead of Better Auth's in-memory ones
    rateLimit: { enabled: false },
    advanced: {
      // IDs come from PostgreSQL's uuidv7() default
      database: { generateId: false },
      // Better Auth would read a header as given; sessions get clientIp() in the hook below,
      // which accepts CF-Connecting-IP only from Cloudflare.
      ipAddress: { disableIpTracking: true },
      useSecureCookies: baseURL.startsWith('https://'),
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const displayName = user.name?.trim() || messages.account.defaultDisplayName;
            return {
              data: {
                ...user,
                email: user.email.toLowerCase(),
                name: displayName,
                image: null,
                publicToken: await uniquePublicToken(db),
                displayNameNormalized: normalizePersian(displayName),
              },
            };
          },
        },
      },
      session: {
        create: {
          // Deactivated and deleted accounts get no new sessions, whichever way they sign in
          before: async (session, ctx) => {
            const [user] = await db
              .select({ status: users.status })
              .from(users)
              .where(eq(users.id, session.userId));
            if (user?.status !== 'active') {
              throw new APIError('FORBIDDEN', { code: 'ACCOUNT_DISABLED', message: 'Account disabled' });
            }
            const ip = ctx?.headers ? clientIp(ctx.headers) : null;
            return { data: { ...session, ipAddress: ip } };
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const ip = ctx.headers ? clientIp(ctx.headers) : null;
        if (ctx.path === '/email-otp/send-verification-otp') {
          const body = z.object({ email: emailSchema, type: z.literal('sign-in') }).safeParse(ctx.body);
          if (!body.success) throw new APIError('BAD_REQUEST', { code: 'INVALID_EMAIL' });
          const email = body.data.email.toLowerCase();
          const result = await hit(redis, [
            [LIMITS.codeSendPerEmailMinute, email],
            [LIMITS.codeSendPerEmailHour, email],
            ...(ip ? ([[LIMITS.codeSendPerIp, ip]] as const) : []),
          ]);
          if (!result.ok) tooMany(result.retryAfterSeconds);
        } else if (ctx.path === '/sign-in/email-otp') {
          const body = z.object({ email: emailSchema }).safeParse(ctx.body);
          if (!body.success) throw new APIError('BAD_REQUEST', { code: 'INVALID_EMAIL' });
          const email = body.data.email.toLowerCase();
          const result = await hit(redis, [
            [LIMITS.codeCheckPerEmail, email],
            ...(ip ? ([[LIMITS.codeCheckPerIp, ip]] as const) : []),
          ]);
          if (!result.ok) tooMany(result.retryAfterSeconds);
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        // A successful sign-in clears the per-email check counter
        if (ctx.path === '/sign-in/email-otp' && ctx.context.newSession) {
          const email = String((ctx.body as { email?: unknown }).email ?? '').toLowerCase();
          await reset(redis, [[LIMITS.codeCheckPerEmail, email]]);
        }
      }),
    },
    plugins: [
      emailOTP({
        otpLength: CODE_LENGTH,
        expiresIn: CODE_TTL_SECONDS,
        allowedAttempts: CODE_ATTEMPTS,
        storeOTP: 'hashed',
        sendVerificationOTP: async ({ email, otp, type }) => {
          if (type !== 'sign-in') throw new APIError('BAD_REQUEST', { code: 'UNSUPPORTED' });
          await sendLoginCode(email, otp);
        },
      }),
      // Sets the session cookie when auth.api.* runs inside a server action. Must be last.
      ...(nextJs ? [nextCookies()] : []),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
