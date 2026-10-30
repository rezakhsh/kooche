import { and, eq, gt, sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { APIError } from 'better-auth/api';
import type { Db, Queryable } from '../../db/drizzle';
import { sessions, users } from '../../db/schema';
import { hit, reset, type Limit } from '../../lib/rate-limit';
import type { Auth } from '../users/auth';
import { staffAudit, type StaffContext } from './audit';

// Who may use the admin page (approved Oct 23, 2026; docs/setup.md, "Admin page").
// Staff are users with users.staff_role. They sign in like everyone (email code) and then pass a
// TOTP check (Better Auth's two-factor plugin) that is stamped on that one session for
// STEP_UP_HOURS. Staff without two-factor set up can only reach the setup page. Everyone else
// gets a 404, signed in or not, so the page doesn't show that it exists.

export type StaffRole = 'moderator' | 'admin';

export const STEP_UP_HOURS = 8;

/**
 * The lowest role for each thing staff do. Moderators handle the queue and content; admins also
 * see personal and payment data, ban for good, verify and suspend businesses and manage staff.
 */
export const PERMISSIONS = {
  'overview.view': 'moderator',
  'queue.view': 'moderator',
  'listing.moderate': 'moderator',
  'message.moderate': 'moderator',
  'appeal.decide': 'moderator',
  'listings.view': 'moderator',
  'users.view': 'moderator',
  'businesses.view': 'moderator',
  'user.warn': 'moderator',
  'user.restrict': 'moderator',
  /** Up to 30 days; for good is user.ban */
  'user.suspend': 'moderator',
  'user.ban': 'admin',
  /** Email, phone and Telegram link of a user */
  'user.contact': 'admin',
  'user.sessions': 'admin',
  'user.release_phone': 'admin',
  'sanction.lift': 'admin',
  'organization.verify': 'admin',
  'organization.suspend': 'admin',
  'payments.view': 'admin',
  /** Admin › prices (wave 2 part 7): a product's euro price */
  'prices.manage': 'admin',
  /** Everyone's audit rows (moderators see their own) */
  'audit.all': 'admin',
  'system.view': 'admin',
  /** Countries and cities: opening, goals, the waitlist export (round 12) */
  'cities.manage': 'admin',
  'staff.manage': 'admin',
  /** Sign in as a user (./acting.ts) */
  'user.act_as': 'admin',
  /** «احتمالاً کسب‌وکار» (src/modules/organizations/suspicions.ts): ask or dismiss; restricting is the owner's */
  'business.suspicion': 'moderator',
  'business.restrict': 'admin',
} as const satisfies Record<string, StaffRole>;

export type StaffAction = keyof typeof PERMISSIONS;

export function can(role: StaffRole, action: StaffAction): boolean {
  return role === 'admin' || PERMISSIONS[action] === 'moderator';
}

export type StaffState =
  | { kind: 'none' }
  | { kind: 'setup' | 'verify' | 'ok'; role: StaffRole; name: string; email: string };

/**
 * Where a signed-in user stands with the admin page: not staff (or not active), staff who must
 * set up two-factor, staff whose session needs the TOTP check, or in.
 */
export async function staffState(db: Queryable, userId: string, sessionId: string, now = new Date()): Promise<StaffState> {
  const [row] = await db
    .select({
      role: users.staffRole,
      status: users.status,
      twoFactor: users.twoFactorEnabled,
      name: users.displayName,
      email: users.email,
      verifiedAt: sessions.staffVerifiedAt,
    })
    .from(users)
    .leftJoin(sessions, and(eq(sessions.id, sessionId), eq(sessions.userId, users.id), gt(sessions.expiresAt, now)))
    .where(eq(users.id, userId));
  if (!row?.role || row.status !== 'active') return { kind: 'none' };
  // A suspended or banned staff member loses the admin page at once (code check, Oct 30, 2026)
  const [sanctioned] = await db.execute<{ yes: boolean }>(sql`
    SELECT EXISTS (SELECT 1 FROM user_sanctions s WHERE s.user_id = ${userId} AND s.revoked_at IS NULL AND s.type IN ('suspended', 'banned')
      AND s.starts_at <= ${now.toISOString()}::timestamptz AND (s.ends_at IS NULL OR s.ends_at > ${now.toISOString()}::timestamptz)) AS yes`);
  if (sanctioned?.yes) return { kind: 'none' };
  const base = { role: row.role, name: row.name, email: row.email };
  if (!row.twoFactor) return { kind: 'setup', ...base };
  const fresh = row.verifiedAt && now.getTime() - row.verifiedAt.getTime() < STEP_UP_HOURS * 3_600_000;
  return { kind: fresh ? 'ok' : 'verify', ...base };
}

export const STAFF_LIMITS = {
  /** Wrong TOTP or backup codes before the check locks for the rest of the window */
  codePerUser: { name: 'staff-code:user', max: 5, windowSeconds: 15 * 60 },
  codePerIp: { name: 'staff-code:ip', max: 20, windowSeconds: 3_600 },
  /** Admin page loads per staff member */
  viewsPerUser: { name: 'admin-view:user', max: 300, windowSeconds: 10 * 60 },
  /** Decisions and other changes per staff member: a stolen session can't change much */
  actionsPerUser: { name: 'admin-act:user', max: 60, windowSeconds: 10 * 60 },
} as const satisfies Record<string, Limit>;

/** A used TOTP code can't be used again while it is still valid (30-second steps, ±1) */
const USED_CODE_SECONDS = 120;

export type CodeKind = 'totp' | 'backup';
export type CodeResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'reused' | 'rate_limited'; retryAfterSeconds?: number };

const DIGITS = /[۰-۹٠-٩]/g;
const latinDigit = (d: string) => String(d.charCodeAt(0) - (d >= '۰' ? 0x06f0 : 0x0660));

/**
 * Persian or Arabic digits, spaces and dashes as typed into the code field. Nothing else is
 * folded: backup codes are case-sensitive.
 */
export function cleanCode(code: string, kind: CodeKind): string | null {
  const c = code.replace(DIGITS, latinDigit).replace(/[\s‌]/g, '');
  if (kind === 'totp') return /^\d{6}$/.test(c) ? c : null;
  // Better Auth's backup codes: 10 letters and digits shown as xxxxx-xxxxx
  const b = c.replace(/-/g, '');
  return /^[A-Za-z0-9]{10}$/.test(b) ? `${b.slice(0, 5)}-${b.slice(5)}` : null;
}

export type StepUpDeps = { db: Db; redis: Redis; auth: Auth };

/**
 * The TOTP check for the admin page: limits, the code itself through Better Auth, no reuse of a
 * TOTP code, then the stamp on this session and an audit row. Failures are audited too
 * (auth.two_factor_failed).
 */
export async function verifyStaffCode(
  { db, redis, auth }: StepUpDeps,
  ctx: Omit<StaffContext, 'role'>,
  input: { code: string; kind: CodeKind; headers: Headers },
): Promise<CodeResult> {
  const checks = [
    [STAFF_LIMITS.codePerUser, ctx.userId],
    ...(ctx.ip ? ([[STAFF_LIMITS.codePerIp, ctx.ip]] as const) : []),
  ] as const;
  const limited = await hit(redis, checks);
  if (!limited.ok) return { ok: false, reason: 'rate_limited', retryAfterSeconds: limited.retryAfterSeconds };

  const fail = async (reason: 'invalid' | 'reused'): Promise<CodeResult> => {
    await db.transaction((tx) => staffAudit(tx, { ...ctx, role: null }, 'auth.two_factor_failed', null, { method: input.kind, reason }, 'user'));
    return { ok: false, reason };
  };

  const code = cleanCode(input.code, input.kind);
  if (!code) return fail('invalid');
  try {
    if (input.kind === 'totp') await auth.api.verifyTOTP({ headers: input.headers, body: { code } });
    else await auth.api.verifyBackupCode({ headers: input.headers, body: { code, disableSession: true } });
  } catch (e) {
    if (e instanceof APIError) return fail('invalid');
    throw e;
  }
  if (input.kind === 'totp') {
    const fresh = await redis.set(`totp-used:${ctx.userId}:${code}`, '1', 'EX', USED_CODE_SECONDS, 'NX');
    if (fresh !== 'OK') return fail('reused');
  }

  await db.transaction(async (tx) => {
    await tx
      .update(sessions)
      .set({ staffVerifiedAt: sql`now()` })
      .where(and(eq(sessions.id, ctx.sessionId), eq(sessions.userId, ctx.userId)));
    await staffAudit(tx, { ...ctx, role: null }, 'staff.two_factor_passed', null, { method: input.kind });
  });
  await reset(redis, [[STAFF_LIMITS.codePerUser, ctx.userId]]);
  return { ok: true };
}

/** Starts two-factor set-up: a new secret and backup codes (shown once) */
export async function startTwoFactorSetup(auth: Auth, headers: Headers): Promise<{ totpURI: string; backupCodes: string[] }> {
  const result = await auth.api.enableTwoFactor({ headers, body: {} });
  if (!('totpURI' in result) || !result.totpURI || !result.backupCodes) throw new Error('two-factor: no TOTP secret returned');
  return { totpURI: result.totpURI, backupCodes: result.backupCodes };
}

/**
 * Confirms set-up with the first code from the app. Better Auth then turns two-factor on and
 * replaces the session with a new one (the old cookie is gone), so the admin page asks for the
 * next code once more before it opens.
 */
export async function confirmTwoFactorSetup(
  { db, redis, auth }: StepUpDeps,
  ctx: Omit<StaffContext, 'role'>,
  input: { code: string; headers: Headers },
): Promise<CodeResult> {
  const limited = await hit(redis, [[STAFF_LIMITS.codePerUser, ctx.userId]]);
  if (!limited.ok) return { ok: false, reason: 'rate_limited', retryAfterSeconds: limited.retryAfterSeconds };
  const code = cleanCode(input.code, 'totp');
  if (!code) return { ok: false, reason: 'invalid' };
  try {
    await auth.api.verifyTOTP({ headers: input.headers, body: { code } });
  } catch (e) {
    if (e instanceof APIError) return { ok: false, reason: 'invalid' };
    throw e;
  }
  await redis.set(`totp-used:${ctx.userId}:${code}`, '1', 'EX', USED_CODE_SECONDS, 'NX');
  await db.transaction((tx) => staffAudit(tx, { ...ctx, role: null }, 'staff.two_factor_enabled', { type: 'user', id: ctx.userId }));
  await reset(redis, [[STAFF_LIMITS.codePerUser, ctx.userId]]);
  return { ok: true };
}
