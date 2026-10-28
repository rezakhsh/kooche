'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { appDb } from '../../db/drizzle';
import { countries, organizations } from '../../db/schema';
import { webEnv } from '../../lib/env';
import { staffAudit } from '../../modules/admin/audit';
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
  if (!known) redirect(adminHref('/users/view-as'));
  const until = new Date(Date.now() + VIEW_AS_HOURS * 3_600_000);
  (await cookies()).set(VIEW_AS_COOKIE, viewAsToken(webEnv().AUTH_SECRET, known.code, until), { path: '/', expires: until, sameSite: 'lax', secure: true, httpOnly: true });
  await staffAudit(db, staff.ctx, 'staff.view_as', null, { country: known.code });
  redirect('/');
}

export async function staffRoleAction(form: FormData): Promise<void> {
  const staff = await requireStaffAction('staff.manage');
  const email = String(form.get('email') ?? '').slice(0, 254);
  const role = form.get('role') === 'moderator' ? 'moderator' : null;
  const r = await appDb().transaction((tx) => setStaffRole(tx, { email, role, by: staff.ctx }));
  redirect(adminHref(`/staff?${r.ok ? 'done=1' : `error=${r.reason}`}`));
}
