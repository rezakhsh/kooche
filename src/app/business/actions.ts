'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { appDb } from '../../db/drizzle';
import { clientIp } from '../../lib/client-ip';
import { isIranRequest } from '../../lib/region';
import { webEnv } from '../../lib/env';
import { reportError } from '../../lib/monitoring/server';
import { hit } from '../../lib/rate-limit';
import { valkey } from '../../lib/valkey';
import { messages } from '../../messages/fa';
import { emailHtml, escapeHtml, notificationMailer } from '../../modules/notifications/mailer';
import { acceptInvitation, changeMember, invite, revokeInvitation } from '../../modules/organizations/members';
import { createBusiness, updateBusiness, type BusinessInput } from '../../modules/organizations/organizations';
import { openBillingPortal, startPlanCheckout, type PlanCode } from '../../modules/payments/checkout';
import { startFoundingCheckout } from '../../modules/payments/founding';
import { PAYMENT_LIMITS } from '../../modules/payments/features';
import { paymentGateway } from '../../modules/payments/server';
import { requireSession } from '../../modules/users/server';
import { chosenCountry } from '../country-choice';
import type { BusinessFormState } from './business-form';

// Server actions for businesses: create and edit, members and invitations, the plan. Each one
// takes the user from the session; the module functions check the role inside their transaction.

const t = messages.business;
const uuid = z.uuid();
const INVITES = { name: 'org-invite:user:1d', max: 20, windowSeconds: 86_400 };

const FIELDS = ['name', 'slug', 'legalName', 'legalForm', 'representativeName', 'addressLine1', 'addressLine2', 'place', 'phone', 'email', 'website', 'registerCourt', 'registrationNumber', 'vatId', 'imprintExtra', 'description'] as const;

function formValues(form: FormData): Record<string, string> {
  return Object.fromEntries(FIELDS.map((k) => [k, String(form.get(k) ?? '').slice(0, 6000)]));
}

function businessError(reason: string): string {
  switch (reason) {
    case 'phone_required':
    case 'sign_in_required':
      return t.phoneRequired;
    case 'restricted':
      return messages.post.restricted;
    case 'too_many':
      return t.tooMany;
    case 'place_not_found':
      return t.errors.place_not_found;
    case 'phone_invalid':
      return t.errors.phone_invalid;
    case 'register_incomplete':
      return t.errors.register_incomplete;
    default:
      return t.fixErrors;
  }
}

const FIELD_OF: Record<string, string> = { place_not_found: 'place', phone_invalid: 'phone', register_incomplete: 'registrationNumber' };

export async function createBusinessAction(_: BusinessFormState, form: FormData): Promise<BusinessFormState> {
  const { user } = await requireSession('/business/new');
  const values = formValues(form);
  const country = await chosenCountry(appDb());
  const r = await createBusiness(appDb(), { userId: user.id, countryCode: country?.code ?? 'DE', input: values as BusinessInput });
  if (!r.ok) return { error: businessError(r.reason), fields: r.fields ?? (FIELD_OF[r.reason] ? { [FIELD_OF[r.reason]!]: r.reason } : undefined), values };
  redirect(`/b/${r.slug}/manage?created=1`);
}

export async function updateBusinessAction(organizationId: string, slug: string, _: BusinessFormState, form: FormData): Promise<BusinessFormState> {
  const { user } = await requireSession(`/b/${slug}/edit`);
  if (!uuid.safeParse(organizationId).success) return { error: t.fixErrors };
  const values = formValues(form);
  const r = await updateBusiness(appDb(), { userId: user.id, organizationId, input: { ...values, slug } as BusinessInput });
  if (!r.ok) return { error: businessError(r.reason), fields: r.fields ?? (FIELD_OF[r.reason] ? { [FIELD_OF[r.reason]!]: r.reason } : undefined), values };
  redirect(`/b/${slug}/manage?saved=1`);
}

const inviteSchema = z.object({ organizationId: z.uuid(), slug: z.string().max(40), email: z.string().max(200), role: z.enum(['manager', 'staff']) });

export async function inviteAction(form: FormData): Promise<void> {
  const parsed = inviteSchema.safeParse({ organizationId: form.get('organizationId'), slug: form.get('slug'), email: form.get('email'), role: form.get('role') });
  if (!parsed.success) redirect('/business');
  const back = `/b/${parsed.data.slug}/team`;
  const { user } = await requireSession(back);
  if (!(await hit(valkey(), [[INVITES, user.id]])).ok) redirect(`${back}?error=rate_limited`);
  const r = await invite(appDb(), { userId: user.id, organizationId: parsed.data.organizationId, email: parsed.data.email, role: parsed.data.role });
  if (!r.ok) redirect(`${back}?error=${r.reason}`);
  // The link carries the one-time token: sent straight from here, never through the outbox
  const env = webEnv();
  const link = `${env.APP_URL}/business/invite/${r.token}`;
  const role = t.roles[parsed.data.role];
  const e = t.invitation.email;
  await notificationMailer({ smtpUrl: env.SMTP_URL, from: env.EMAIL_FROM })({
    to: parsed.data.email.trim().toLowerCase(),
    subject: e.subject(r.orgName),
    text: e.text(r.orgName, role, link),
    html: emailHtml(
      `<p style="margin:0 0 16px;font-size:16px">${escapeHtml(t.invitation.text(r.orgName, role))}</p>` +
        `<p style="margin:0 0 16px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#0b6e77;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(e.button)}</a></p>` +
        `<p style="margin:0;font-size:13px;color:#737373">${escapeHtml(e.ignore)}</p>`,
    ),
  });
  redirect(`${back}?sent=1`);
}

const memberSchema = z.object({ organizationId: z.uuid(), slug: z.string().max(40), memberId: z.uuid(), to: z.enum(['owner', 'manager', 'staff', 'removed']) });

export async function changeMemberAction(form: FormData): Promise<void> {
  const parsed = memberSchema.safeParse({ organizationId: form.get('organizationId'), slug: form.get('slug'), memberId: form.get('memberId'), to: form.get('to') });
  if (!parsed.success) redirect('/business');
  const back = `/b/${parsed.data.slug}/team`;
  const { user } = await requireSession(back);
  const r = await changeMember(appDb(), { userId: user.id, organizationId: parsed.data.organizationId, memberId: parsed.data.memberId, to: parsed.data.to });
  if (!r.ok) redirect(`${back}?error=${r.reason}`);
  // Someone who left has no team page any more
  redirect(parsed.data.memberId === user.id && parsed.data.to === 'removed' ? '/business' : back);
}

export async function revokeInvitationAction(form: FormData): Promise<void> {
  const parsed = z.object({ organizationId: z.uuid(), slug: z.string().max(40), invitationId: z.uuid() }).safeParse({ organizationId: form.get('organizationId'), slug: form.get('slug'), invitationId: form.get('invitationId') });
  if (!parsed.success) redirect('/business');
  const { user } = await requireSession(`/b/${parsed.data.slug}/team`);
  await revokeInvitation(appDb(), { userId: user.id, organizationId: parsed.data.organizationId, invitationId: parsed.data.invitationId });
  redirect(`/b/${parsed.data.slug}/team`);
}

export async function acceptInvitationAction(form: FormData): Promise<void> {
  const token = String(form.get('token') ?? '');
  const back = `/business/invite/${encodeURIComponent(token)}`;
  const { user } = await requireSession(back);
  const r = await acceptInvitation(appDb(), { userId: user.id, token });
  redirect(r.ok ? `/b/${r.slug}/manage?joined=1` : `${back}?error=${r.reason}`);
}

/** The "for my business, not as a consumer" tick (terms 14.5), with the request's IP, browser and region */
async function businessBuyer(form: FormData) {
  const h = await headers();
  return { business: form.get('business') === 'on', ip: clientIp(h), userAgent: h.get('user-agent'), fromIran: isIranRequest(h) };
}

const planSchema = z.object({ organizationId: z.uuid(), slug: z.string().max(40), plan: z.enum(['pro', 'pro-plus']), interval: z.enum(['month', 'year']) });

export async function subscribeAction(form: FormData): Promise<void> {
  const parsed = planSchema.safeParse({ organizationId: form.get('organizationId'), slug: form.get('slug'), plan: form.get('plan'), interval: form.get('interval') });
  if (!parsed.success) redirect('/pro');
  const back = `/b/${parsed.data.slug}/billing`;
  const { user } = await requireSession(back);
  if (!(await hit(valkey(), [[PAYMENT_LIMITS.checkoutsPerUserHour, user.id]])).ok) redirect(`${back}?error=rate_limited`);
  const r = await startPlanCheckout(appDb(), paymentGateway(), {
    userId: user.id,
    organizationId: parsed.data.organizationId,
    plan: parsed.data.plan as PlanCode,
    interval: parsed.data.interval,
    appUrl: webEnv().APP_URL,
    ...(await businessBuyer(form)),
  }).catch((e: unknown) => {
    console.error('payments: plan checkout failed:', e instanceof Error ? e.message : e);
    reportError(e, { tags: { action: 'payments.plan_checkout' } });
    return { ok: false, reason: 'failed' } as const;
  });
  if (!r.ok) redirect(`${back}?error=${r.reason}`);
  redirect(r.url);
}

/** Founding Pro: the business owner starts the 6 free months (a trial without a card) */
export async function foundingAction(form: FormData): Promise<void> {
  const parsed = z.object({ organizationId: z.uuid(), slug: z.string().max(40) }).safeParse({ organizationId: form.get('organizationId'), slug: form.get('slug') });
  if (!parsed.success) redirect('/pro');
  const back = `/b/${parsed.data.slug}/billing`;
  const { user } = await requireSession(back);
  if (!(await hit(valkey(), [[PAYMENT_LIMITS.checkoutsPerUserHour, user.id]])).ok) redirect(`${back}?error=rate_limited`);
  const r = await startFoundingCheckout(appDb(), paymentGateway(), {
    userId: user.id,
    organizationId: parsed.data.organizationId,
    appUrl: webEnv().APP_URL,
    ...(await businessBuyer(form)),
  }).catch((e: unknown) => {
    console.error('payments: founding checkout failed:', e instanceof Error ? e.message : e);
    reportError(e, { tags: { action: 'payments.founding_checkout' } });
    return { ok: false, reason: 'failed' } as const;
  });
  if (!r.ok) redirect(`${back}?error=${r.reason}`);
  redirect(r.url);
}

export async function portalAction(form: FormData): Promise<void> {
  const parsed = z.object({ organizationId: z.uuid(), slug: z.string().max(40) }).safeParse({ organizationId: form.get('organizationId'), slug: form.get('slug') });
  if (!parsed.success) redirect('/business');
  const back = `/b/${parsed.data.slug}/billing`;
  const { user } = await requireSession(back);
  const fromIran = isIranRequest(await headers());
  const r = await openBillingPortal(appDb(), paymentGateway(), { userId: user.id, organizationId: parsed.data.organizationId, appUrl: webEnv().APP_URL, fromIran }).catch((e: unknown) => {
    console.error('payments: portal failed:', e instanceof Error ? e.message : e);
    reportError(e, { tags: { action: 'payments.portal' } });
    return { ok: false, reason: 'failed' } as const;
  });
  if (!r.ok) redirect(`${back}?error=${r.reason}`);
  redirect(r.url);
}
