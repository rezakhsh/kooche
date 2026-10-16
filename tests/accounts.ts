import { drizzle } from 'drizzle-orm/postgres-js';
import { Redis } from 'ioredis';
import postgres from 'postgres';
import { afterAll } from 'vitest';
import * as schema from '../src/db/schema';
import type { Db } from '../src/db/drizzle';
import { createAuth } from '../src/modules/users/auth';
import type { SmsProvider } from '../src/modules/users/sms';

// Helpers for the account tests: connections that run as the app's and the worker's database
// roles (so the tests also prove the grants are enough), a Valkey database that is emptied before
// each test file, and a Better Auth instance whose emails land in a list instead of SES.

const url = process.env.TEST_DATABASE_URL;
const redisUrl = process.env.TEST_REDIS_URL;
if (!url) throw new Error('TEST_DATABASE_URL is not set');
if (!redisUrl) throw new Error('TEST_REDIS_URL is not set (a Valkey database the tests may empty)');

function asRole(role: 'classifieds_app' | 'classifieds_worker'): { db: Db; end: () => Promise<void> } {
  // `role` as a startup parameter: every session of this pool runs as that role
  const client = postgres(url!, { max: 2, onnotice: () => {}, connection: { role } });
  return { db: drizzle(client, { schema }), end: () => client.end() };
}

const app = asRole('classifieds_app');
const worker = asRole('classifieds_worker');
export const appDb = app.db;
export const workerDb = worker.db;
export const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });

afterAll(async () => {
  await Promise.all([app.end(), worker.end(), redis.quit()]);
});

/** Emails "sent" by the test auth instance, newest last */
export const sentCodes: Array<{ email: string; code: string }> = [];

export function lastCode(email: string): string {
  const found = sentCodes.findLast((m) => m.email === email.toLowerCase());
  if (!found) throw new Error(`no code sent to ${email}`);
  return found.code;
}

export const testAuth = createAuth({
  db: appDb,
  redis,
  secret: 'test-secret-test-secret-test-secret-0123',
  baseURL: 'https://app.example.test',
  sendLoginCode: async (email, code) => {
    sentCodes.push({ email, code });
  },
});

let n = 0;
/** A unique email and client IP per call, so rate limits of one test never touch another */
export function visitor() {
  n += 1;
  const id = `${Date.now().toString(36)}-${n}`;
  return {
    email: `user-${id}@example.test`,
    headers: new Headers({
      'x-forwarded-for': `203.0.113.${n % 250}`,
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1',
    }),
  };
}

/** Requests a code and signs in with it. Returns the user, the session token and a Cookie header. */
export async function signIn(email: string, headers: Headers) {
  await testAuth.api.sendVerificationOTP({ body: { email, type: 'sign-in' }, headers });
  const { headers: out, response } = await testAuth.api.signInEmailOTP({
    body: { email, otp: lastCode(email) },
    headers,
    returnHeaders: true,
  });
  const cookie = out
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  return { user: response.user, token: response.token, cookie };
}

export async function sessionFor(cookie: string) {
  return testAuth.api.getSession({ headers: new Headers({ cookie }) });
}

/** An SMS provider that keeps the messages */
export class MemorySms implements SmsProvider {
  readonly name = 'memory';
  readonly sent: Array<{ to: string; text: string }> = [];
  async send(to: string, text: string) {
    this.sent.push({ to, text });
    return { provider: this.name, messageId: `m-${this.sent.length}` };
  }
  lastCode(): string {
    const text = this.sent.at(-1)?.text ?? '';
    return text.match(/[0-9]{6}/)?.[0] ?? '';
  }
}
