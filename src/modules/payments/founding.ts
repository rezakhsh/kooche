import { and, eq, isNotNull, sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import type { Db, Queryable } from '../../db/drizzle';
import { organizations, subscriptions } from '../../db/schema';
import { staffAudit, type StaffContext } from '../admin/audit';
import { activePrice, confirmBusinessBuyer, customerFor, isOwner, type BusinessBuyer, type CheckoutResult, type Where } from './checkout';
import { formatDate } from '../../lib/format';
import { messages } from '../../messages/fa';
import { emailHtml, escapeHtml, type Mailer } from '../notifications/mailer';
import { queueBusinessNotice } from '../organizations/notices';
import type { PaymentGateway } from './gateway';
import { activeSubscription } from './plans';

// Founding Pro (round 12, wave 0, docs/wave0-plan.md item 4). The owner marks a verified business
// as founding in admin; its owner then starts 6 months of Pro as a Stripe trial without a card.
// Stripe cancels the subscription at the end unless the business has added a payment method
// itself (then Pro continues at the normal €24 a month). Nothing is ever charged automatically.
// Pro still arrives only through Stripe's webhook (the €0 trial invoice), as CLAUDE.md requires.
// The «بنیان‌گذار» badge lasts a year from the day the business page was created (owner, Oct 26).

export const FOUNDING_MONTHS = 6;
/** Founding places per city: its business goal; an open city without one (Berlin) has 30 */
export const DEFAULT_FOUNDING_PLACES = 30;

/** Six calendar months from now (UTC) */
export function foundingTrialEnd(now: Date): Date {
  const end = new Date(now);
  end.setUTCMonth(end.getUTCMonth() + FOUNDING_MONTHS);
  return end;
}

/** The badge: a founding business, during the year after its page was created */
export function foundingBadge(org: { foundingOfferedAt: Date | null; createdAt: Date }, now = new Date()): boolean {
  if (!org.foundingOfferedAt) return false;
  const until = new Date(org.createdAt);
  until.setUTCFullYear(until.getUTCFullYear() + 1);
  return now < until;
}

/** The founding places of the business's city (counted with its launch group: Bonn with Cologne) */
export async function foundingPlaces(db: Queryable, organizationId: string): Promise<{ city: string; places: number; used: number } | null> {
  const [row] = await db.execute<{ city: string; places: number; used: number }>(sql`
    SELECT a.name_fa AS city, coalesce(a.business_goal, ${DEFAULT_FOUNDING_PLACES})::int AS places,
      (SELECT count(*)::int FROM organizations o2
        WHERE o2.founding_offered_at IS NOT NULL
          AND o2.location_id IN (SELECT g.id FROM locations g WHERE g.id = a.id OR g.launch_with_id = a.id)) AS used
    FROM organizations o
    JOIN locations c ON c.id = o.location_id
    JOIN locations a ON a.id = coalesce(c.launch_with_id, c.id)
    WHERE o.id = ${organizationId}`);
  return row ?? null;
}

export type OfferResult = { ok: true } | { ok: false; reason: 'not_found' | 'not_verified' | 'no_city' | 'already' | 'full' };

/** Admin: marks a verified business as founding, within its city's places; in audit_log */
export async function offerFounding(tx: Queryable, ctx: StaffContext, organizationId: string): Promise<OfferResult> {
  const [org] = await tx
    .select({ status: organizations.status, verification: organizations.verificationStatus, locationId: organizations.locationId, offered: organizations.foundingOfferedAt })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .for('update');
  if (!org || org.status !== 'active') return { ok: false, reason: 'not_found' };
  if (org.verification !== 'verified') return { ok: false, reason: 'not_verified' };
  if (!org.locationId) return { ok: false, reason: 'no_city' };
  if (org.offered) return { ok: false, reason: 'already' };
  const places = await foundingPlaces(tx, organizationId);
  if (!places || places.used >= places.places) return { ok: false, reason: 'full' };
  await tx.update(organizations).set({ foundingOfferedAt: sql`now()`, foundingOfferedByUserId: ctx.userId }).where(eq(organizations.id, organizationId));
  await staffAudit(tx, ctx, 'organization.founding_offered', { type: 'organization', id: organizationId }, { city: places.city, place: places.used + 1, of: places.places });
  // The owner hears about it by email and Telegram (../organizations/notices.ts)
  await queueBusinessNotice(tx, organizationId, 'founding');
  return { ok: true };
}

/** What the billing page offers: start the free months, or nothing (not founding, or already used) */
export async function foundingState(db: Queryable, organizationId: string): Promise<'none' | 'offered' | 'used'> {
  const [org] = await db.select({ offered: organizations.foundingOfferedAt }).from(organizations).where(eq(organizations.id, organizationId));
  if (!org?.offered) return 'none';
  // One trial per business, ever (a trial leaves its trial end on the subscription row)
  const [trial] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.organizationId, organizationId), isNotNull(subscriptions.trialEndsAt)))
    .limit(1);
  return trial ? 'used' : 'offered';
}

/** The business owner starts the 6 free months: monthly Pro, a trial, no card asked */
export async function startFoundingCheckout(
  db: Db,
  gateway: PaymentGateway | null,
  opts: { userId: string; organizationId: string; appUrl: string; now?: Date } & BusinessBuyer & Where,
): Promise<CheckoutResult> {
  if (!gateway) return { ok: false, reason: 'payments_off' };
  if (opts.fromIran) return { ok: false, reason: 'from_iran' };
  if (!(await isOwner(db, opts.userId, opts.organizationId))) return { ok: false, reason: 'not_found' };
  if ((await foundingState(db, opts.organizationId)) !== 'offered') return { ok: false, reason: 'not_allowed' };
  if (await activeSubscription(db, opts.organizationId)) return { ok: false, reason: 'already_subscribed' };
  const [org] = await db
    .select({ id: organizations.id, slug: organizations.slug, name: organizations.name, legalName: organizations.legalName, email: organizations.email })
    .from(organizations)
    .where(eq(organizations.id, opts.organizationId));
  const price = await activePrice(db, 'pro', 'EUR', 'month');
  if (!org || !price) return { ok: false, reason: 'not_allowed' };
  if (!(await confirmBusinessBuyer(db, opts.userId, org.id, opts, 'pro-founding'))) return { ok: false, reason: 'business_required' };
  const [owner] = await db.execute<{ email: string }>(sql`SELECT email FROM users WHERE id = ${opts.userId}`);
  const customerId = await customerFor(db, gateway, { organizationId: org.id }, { email: org.email ?? owner!.email, name: org.legalName ?? org.name });
  const session = await gateway.createCheckout({
    mode: 'subscription',
    customerId,
    priceId: price.price.providerPriceId,
    clientReferenceId: org.id,
    metadata: { organization_id: org.id, plan: 'pro', founding: '1' },
    successUrl: `${opts.appUrl}/b/${org.slug}/billing?done=1`,
    cancelUrl: `${opts.appUrl}/b/${org.slug}/billing`,
    promotionCodes: false,
    trialEnd: foundingTrialEnd(opts.now ?? new Date()),
  });
  return { ok: true, url: session.url };
}

export type FoundingReminder = { subscriptionId: string; days: 14 | 3; trialEndsAt: Date; email: string; name: string; slug: string; timeZone: string };

/**
 * Trials ending in 14 or 3 days (one day wide, so a daily run finds each once), with the owner's
 * email. The worker remembers what it sent in Valkey, so a second run the same day sends nothing.
 */
export async function dueFoundingReminders(db: Queryable, now: Date): Promise<FoundingReminder[]> {
  const out: FoundingReminder[] = [];
  for (const days of [14, 3] as const) {
    const rows = await db.execute<{ id: string; trial_ends_at: Date; email: string; name: string; slug: string; time_zone: string }>(sql`
      SELECT s.id, s.trial_ends_at, u.email, o.name, o.slug,
        coalesce((SELECT c.timezone FROM locations c WHERE c.id = o.location_id), 'Europe/Berlin') AS time_zone
      FROM subscriptions s
      JOIN organizations o ON o.id = s.organization_id AND o.status = 'active'
      JOIN organization_members m ON m.organization_id = o.id AND m.role = 'owner'
      JOIN users u ON u.id = m.user_id AND u.status = 'active'
      WHERE s.status = 'trialing'
        AND s.trial_ends_at > ${now.toISOString()}::timestamptz + make_interval(days => ${days - 1})
        AND s.trial_ends_at <= ${now.toISOString()}::timestamptz + make_interval(days => ${days})`);
    for (const r of rows) out.push({ subscriptionId: r.id, days, trialEndsAt: new Date(r.trial_ends_at), email: r.email, name: r.name, slug: r.slug, timeZone: r.time_zone });
  }
  return out;
}

/** Worker, daily: the 14- and 3-day reminders, each sent once (Valkey guard) */
export async function sendFoundingReminders(db: Queryable, redis: Redis, mail: Mailer, opts: { appUrl: string }, now = new Date()): Promise<number> {
  let sent = 0;
  for (const r of await dueFoundingReminders(db, now)) {
    if ((await redis.set(`founding-reminder:${r.subscriptionId}:${r.days}`, '1', 'EX', 40 * 86_400, 'NX')) !== 'OK') continue;
    const t = messages.email.foundingReminder;
    // In the business's own city's time zone (Peydoo is in many countries)
    const date = formatDate(r.trialEndsAt, r.timeZone);
    const link = `${opts.appUrl}/b/${r.slug}/billing`;
    await mail({
      to: r.email,
      subject: t.subject(r.name, r.days),
      text: t.text(r.name, date, link),
      html: emailHtml(
        `<p>${escapeHtml(t.intro(r.name, date))}</p><p>${escapeHtml(t.body)}</p><p><a href="${escapeHtml(link)}" style="display:inline-block;background:#0b6e77;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(t.button)}</a></p>`,
      ),
    });
    sent++;
  }
  return sent;
}
