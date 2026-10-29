'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { appDb } from '../../db/drizzle';
import { countries, organizations, users } from '../../db/schema';
import { webEnv } from '../../lib/env';
import { verifyStaffCode } from '../../modules/admin/access';
import { findUserToActAs, openActingSession, returnToken, sessionCookieName, signSessionToken, STAFF_RETURN_COOKIE } from '../../modules/admin/acting';
import { staffAudit } from '../../modules/admin/audit';
import { valkey } from '../../lib/valkey';
import { auth } from '../../modules/users/server';
import { VIEW_AS_COOKIE, VIEW_AS_HOURS, viewAsToken } from '../../modules/admin/view-as';
import { eq } from 'drizzle-orm';
import { setStaffRole } from '../../modules/admin/staff';
import { adminHref, requireStaffAction } from '../../modules/admin/server';
import { releasePhone, signOutEverywhere } from '../../modules/admin/users';
import { setVerification } from '../../modules/organizations/organizations';
import { offerFounding } from '../../modules/payments/founding';

// Admin-only changes outside moderation decisions: sessions, phone numbers, business verification
// and staff roles. Each checks its permission first and writes audit_log with the change.

const uuid = (v: FormDataEntryValue | null) => (typeof v === 'string' && /^[0-9a-f-]{36}$/.test(v) ? v : null);
const note = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim().slice(0, 500) : '');

export async function signOutAction(form: FormData): Promise<void> {
  const staff = await requireStaffAction('user.sessions');
  const id = uuid(form.get('userId'));
  if (!id) redirect(adminHref('/users'));
  const n = await signOutEverywhere(appDb(), staff.ctx, id);
  redirect(adminHref(`/users/${id}?signedOut=${n}`));
}

export async function releasePhoneAction(form: FormData): Promise<void> {
  const staff = await requireStaffAction('user.release_phone');
  const id = uuid(form.get('userId'));
  if (!id) redirect(adminHref('/users'));
  await releasePhone(appDb(), staff.ctx, id, note(form.get('note')));
  redirect(adminHref(`/users/${id}?released=1`));
}

export async function verificationAction(form: FormData): Promise<void> {
  const staff = await requireStaffAction('organization.verify');
  const id = uuid(form.get('organizationId'));
  const status = form.get('status');
  if (!id || (status !== 'verified' && status !== 'rejected' && status !== 'unverified')) redirect(adminHref('/businesses'));
  const db = appDb();
  await db.transaction(async (tx) => {
    const [o] = await tx.select({ slug: organizations.slug }).from(organizations).where(eq(organizations.id, id));
    if (o) await setVerification(tx, { slug: o.slug, status, byUserId: staff.ctx.userId, staff: staff.ctx, note: note(form.get('note')) });
  });
  redirect(adminHref(`/businesses?done=1${form.get('tab') === 'all' ? '&tab=all' : ''}`));
}

/** Founding Pro: marks a verified business as founding (src/modules/payments/founding.ts) */
export async function foundingOfferAction(form: FormData): Promise<void> {
  const staff = await requireStaffAction('organization.verify');
  const id = uuid(form.get('organizationId'));
  if (!id) redirect(adminHref('/businesses'));
  const r = await appDb().transaction((tx) => offerFounding(tx, staff.ctx, id));
  const tab = form.get('tab') === 'all' ? '&tab=all' : '';
  const country = !r.ok && 'country' in r ? `&country=${r.country}` : '';
  redirect(adminHref(`/businesses?${r.ok ? 'done=1' : `founding=${r.reason}${country}`}${tab}`));
}

/**
 * View as a country (src/modules/admin/view-as.ts): any staff member, for this browser only, then
 * the first page as a visitor from there sees it. Iran isn't a seeded country but can be chosen.
 */
export async function viewAsAction(form: FormData): Promise<void> {
  const staff = await requireStaffAction('overview.view');
  const code = String(form.get('country') ?? '');
  const db = appDb();
  const [known] = code === 'IR' ? [{ code }] : await db.select({ code: countries.code }).from(countries).where(eq(countries.code, code));
  if (!known) redirect(adminHref('/view-as'));
  const until = new Date(Date.now() + VIEW_AS_HOURS * 3_600_000);
  (await cookies()).set(VIEW_AS_COOKIE, viewAsToken(webEnv().AUTH_SECRET, known.code, until), { path: '/', expires: until, sameSite: 'lax', secure: true, httpOnly: true });
  await staffAudit(db, staff.ctx, 'staff.view_as', null, { country: known.code });
  redirect('/');
}

/**
 * Sign in as a user (src/modules/admin/acting.ts): admins only. A real person needs a reason and
 * a fresh two-step code; a test account needs neither. The admin's own session cookie waits in
 * the return cookie, the session cookie becomes the user's, and the site opens as them.
 */
export async function actAsAction(form: FormData): Promise<void> {
  const staff = await requireStaffAction('user.act_as');
  const db = appDb();
  const fail: (reason: string) => never = (reason) => redirect(adminHref(`/view-as?acting=${reason}`));
  const userId = uuid(form.get('userId')) ?? (await findUserToActAs(db, String(form.get('target') ?? '').slice(0, 254)));
  if (!userId) fail('not_found');
  const [target] = await db.select({ test: users.testAccount }).from(users).where(eq(users.id, userId));
  if (!target) fail('not_found');
  const h = await headers();
  if (!target.test) {
    const code = await verifyStaffCode({ db, redis: valkey(), auth: auth() }, staff.ctx, { code: String(form.get('code') ?? ''), kind: 'totp', headers: new Headers(h) });
    if (!code.ok) fail(code.reason === 'rate_limited' ? 'rate_limited' : 'code');
  }
  const env = webEnv();
  const jar = await cookies();
  const own = jar.get(sessionCookieName(env.APP_URL))?.value;
  if (!own) fail('not_found');
  const r = await db.transaction((tx) => openActingSession(tx, staff.ctx, { userId, reason: String(form.get('reason') ?? ''), userAgent: h.get('user-agent') }));
  if (!r.ok) fail(r.reason);
  const secure = env.APP_URL.startsWith('https://');
  // The return cookie outlives the 30 minutes, so src/proxy.ts can put the admin's cookie back
  jar.set(STAFF_RETURN_COOKIE, returnToken(env.AUTH_SECRET, own, r.until), { path: '/', httpOnly: true, secure, sameSite: 'lax', maxAge: 7 * 86_400 });
  jar.set(sessionCookieName(env.APP_URL), signSessionToken(env.AUTH_SECRET, r.token), { path: '/', httpOnly: true, secure, sameSite: 'lax', expires: r.until });
  redirect('/');
}

export async function staffRoleAction(form: FormData): Promise<void> {
  const staff = await requireStaffAction('staff.manage');
  const email = String(form.get('email') ?? '').slice(0, 254);
  const role = form.get('role') === 'moderator' ? 'moderator' : null;
  const r = await appDb().transaction((tx) => setStaffRole(tx, { email, role, by: staff.ctx }));
  redirect(adminHref(`/staff?${r.ok ? 'done=1' : `error=${r.reason}`}`));
}
