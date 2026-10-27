import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import type { Queryable } from '../../db/drizzle';
import { outboxEvents } from '../../db/schema';
import { formatDate, formatDateTime } from '../../lib/format';
import { withdrawalReceiptDe } from '../../messages/legal-de';
import { messages } from '../../messages/fa';
import { formatPrice } from '../listings/price';
import { listingPath } from '../listings/slug';
import { emailHtml, escapeHtml, type Mailer } from '../notifications/mailer';
import { ltrLine } from '../../lib/bidi';
import { isUnreachable, type TelegramClient } from '../notifications/telegram-api';
import { isUnreachableMarked, markUnreachable } from '../notifications/telegram-reach';
import type { PaymentGateway } from './gateway';

// Payment notices (owner's rule, Oct 26, 2026: users are always told). Pro started, renewed or
// ended for the business owner; a paid order for its buyer; a bump that moved a listing for its
// seller. The first three are written to the outbox in the webhook's transaction (./apply.ts); the
// bump notice hangs off the existing `listing.bumped` event. The worker sends an email with the
// invoice's link (read from Stripe when sending), and Telegram when the bot can reach the person.

export const PAYMENT_NOTICE = 'payment.notice';

const payloadSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('pro_started'), invoiceId: z.string().nullable(), trial: z.boolean(), until: z.string() }),
  z.object({ kind: z.literal('pro_renewed'), invoiceId: z.string().nullable(), until: z.string() }),
  z.object({ kind: z.literal('pro_ended') }),
  z.object({ kind: z.literal('order_paid'), invoiceId: z.string().nullable() }),
  // A consumer's withdrawal (./withdrawals.ts): the receipt at once, then the refund or why none
  z.object({ kind: z.literal('withdrawal_received'), withdrawalId: z.uuid() }),
  z.object({ kind: z.literal('withdrawal_processed'), withdrawalId: z.uuid() }),
]);
export type PaymentNotice = z.infer<typeof payloadSchema>;

/** In the webhook's transaction. Pro notices: the business id; an order notice: the order id. */
export async function queuePaymentNotice(tx: Queryable, aggregateId: string, notice: PaymentNotice): Promise<void> {
  await tx.insert(outboxEvents).values({
    eventType: PAYMENT_NOTICE,
    aggregateType: notice.kind.startsWith('pro_') ? 'organization' : 'order',
    aggregateId,
    payload: notice,
  });
}

export function parsePaymentNotice(payload: Record<string, unknown>): PaymentNotice | null {
  const r = payloadSchema.safeParse(payload);
  return r.success ? r.data : null;
}

type Recipient = { email: string; telegramUserId: number | null; timeZone: string };
type Deps = { mail: Mailer; telegram: TelegramClient | null; appUrl: string; gateway: PaymentGateway | null };
/** `note`: a left-to-right paragraph after the lines (the German receipt) */
type Content = { subject: string; lines: string[]; note?: string; button: string; link: string; invoiceUrl: string | null };

const invoiceLinks = z.object({ hosted_invoice_url: z.string().url().nullable().optional() });

/** The invoice's page at Stripe (view and download), or null when it can't be read */
export async function invoiceUrl(gateway: PaymentGateway | null, invoiceId: string | null): Promise<string | null> {
  if (!gateway || !invoiceId) return null;
  try {
    return invoiceLinks.parse(await gateway.getInvoice(invoiceId)).hosted_invoice_url ?? null;
  } catch (e) {
    console.error('payment notice: invoice link unavailable:', e instanceof Error ? e.message : e);
    return null;
  }
}

async function deliver(redis: Redis, deps: Deps, to: Recipient, c: Content): Promise<{ email: boolean; telegram: boolean }> {
  const t = messages.email.paymentNotice;
  const invoice = c.invoiceUrl ? `<p><a href="${escapeHtml(c.invoiceUrl)}" style="color:#0b6e77;font-weight:bold">${escapeHtml(t.invoice)}</a></p>` : '';
  const note = c.note ? `<p dir="ltr" lang="de" style="direction:ltr;text-align:left;color:#525252;font-size:13px">${escapeHtml(c.note)}</p>` : '';
  const lines = c.note ? [...c.lines, ltrLine(c.note)] : c.lines;
  await deps.mail({
    to: to.email,
    subject: c.subject,
    text: [...lines, ...(c.invoiceUrl ? [`${t.invoice}: ${c.invoiceUrl}`] : []), c.link].join('\n\n'),
    html: emailHtml(
      `${c.lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}${note}${invoice}<p><a href="${escapeHtml(c.link)}" style="display:inline-block;background:#0b6e77;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(c.button)}</a></p>`,
    ),
  });
  let telegram = false;
  if (deps.telegram && to.telegramUserId !== null && !(await isUnreachableMarked(redis, to.telegramUserId))) {
    try {
      const buttons = [[{ text: c.button, url: c.link }], ...(c.invoiceUrl ? [[{ text: t.invoice, url: c.invoiceUrl }]] : [])];
      await deps.telegram.sendMessage(to.telegramUserId, lines.join('\n\n'), { inline_keyboard: buttons });
      telegram = true;
    } catch (e) {
      if (isUnreachable(e)) await markUnreachable(redis, to.telegramUserId);
      console.error('payment notice: telegram failed:', e instanceof Error ? e.message : e);
    }
  }
  return { email: true, telegram };
}

const tgId = (v: string | number | null) => (v === null ? null : Number(v));

/** Worker: one payment notice. Nothing for a person or business that is gone. */
export async function sendPaymentNotice(db: Queryable, redis: Redis, deps: Deps, aggregateId: string, notice: PaymentNotice): Promise<{ email: boolean; telegram: boolean }> {
  const t = messages.email.paymentNotice;
  const none = { email: false, telegram: false };
  if (notice.kind === 'order_paid') {
    const [r] = await db.execute<{ email: string; telegram_user_id: string | number | null; product: string; title: string; token: string; total: number; currency: string; tz: string }>(sql`
      SELECT u.email, u.telegram_user_id, p.name_fa AS product, l.title, l.public_token AS token, o.total_minor AS total, o.currency,
        coalesce((SELECT c.timezone FROM locations c WHERE c.id = l.location_id), 'Europe/Berlin') AS tz
      FROM orders o
      JOIN users u ON u.id = o.buyer_user_id AND u.status = 'active'
      JOIN products p ON p.id = o.product_id
      JOIN listings l ON l.id = o.listing_id
      WHERE o.id = ${aggregateId}`);
    if (!r) return none;
    const c = t.orderPaid;
    return deliver(redis, deps, { email: r.email, telegramUserId: tgId(r.telegram_user_id), timeZone: r.tz }, {
      subject: c.subject(r.product),
      lines: [c.intro(r.product, r.title, formatPrice(r.total, r.currency, 2)), c.body],
      button: c.button,
      link: `${deps.appUrl}${listingPath(r.title, r.token)}`,
      invoiceUrl: await invoiceUrl(deps.gateway, notice.invoiceId),
    });
  }

  if (notice.kind === 'withdrawal_received' || notice.kind === 'withdrawal_processed') return sendWithdrawalNotice(db, redis, deps, notice);

  const [r] = await db.execute<{ name: string; slug: string; email: string; telegram_user_id: string | number | null; tz: string }>(sql`
    SELECT o.name, o.slug, u.email, u.telegram_user_id,
      coalesce((SELECT c.timezone FROM locations c WHERE c.id = o.location_id), 'Europe/Berlin') AS tz
    FROM organizations o
    JOIN organization_members m ON m.organization_id = o.id AND m.role = 'owner'
    JOIN users u ON u.id = m.user_id AND u.status = 'active'
    WHERE o.id = ${aggregateId} AND o.status <> 'deleted'
    LIMIT 1`);
  if (!r) return none;
  const to = { email: r.email, telegramUserId: tgId(r.telegram_user_id), timeZone: r.tz };
  const manage = `${deps.appUrl}/b/${r.slug}/manage`;
  const billing = `${deps.appUrl}/b/${r.slug}/billing`;
  if (notice.kind === 'pro_started') {
    const c = t.proStarted;
    const until = formatDate(new Date(notice.until), r.tz);
    return deliver(redis, deps, to, {
      subject: c.subject(r.name),
      lines: [notice.trial ? c.introTrial(r.name, until) : c.intro(r.name, until), c.body],
      button: c.button,
      link: manage,
      invoiceUrl: await invoiceUrl(deps.gateway, notice.invoiceId),
    });
  }
  if (notice.kind === 'pro_renewed') {
    const c = t.proRenewed;
    return deliver(redis, deps, to, {
      subject: c.subject(r.name),
      lines: [c.intro(r.name, formatDate(new Date(notice.until), r.tz)), c.body],
      button: c.button,
      link: billing,
      invoiceUrl: await invoiceUrl(deps.gateway, notice.invoiceId),
    });
  }
  const c = t.proEnded;
  return deliver(redis, deps, to, { subject: c.subject(r.name), lines: [c.intro(r.name), c.body], button: c.button, link: billing, invoiceUrl: null });
}

/** The withdrawal's receipt (to the address it named) and, once refunded, its amount or why none */
async function sendWithdrawalNotice(
  db: Queryable,
  redis: Redis,
  deps: Deps,
  notice: Extract<PaymentNotice, { kind: 'withdrawal_received' | 'withdrawal_processed' }>,
): Promise<{ email: boolean; telegram: boolean }> {
  const [r] = await db.execute<{
    order_id: string; email: string; name: string; telegram_user_id: string | number | null; product: string; code: string; title: string | null;
    total: number; currency: string; paid_at: Date; received_at: Date; status: string; refund: number | null; tz: string;
  }>(sql`
    SELECT o.id AS order_id, w.receipt_email AS email, u.display_name AS name, u.telegram_user_id, p.name_fa AS product, p.code, l.title,
      o.total_minor AS total, o.currency, o.paid_at, w.created_at AS received_at, w.status, w.refund_minor AS refund,
      coalesce((SELECT c.timezone FROM locations c WHERE c.id = l.location_id), 'Europe/Berlin') AS tz
    FROM order_withdrawals w
    JOIN orders o ON o.id = w.order_id
    JOIN users u ON u.id = w.user_id
    JOIN products p ON p.id = o.product_id
    LEFT JOIN listings l ON l.id = o.listing_id
    WHERE w.id = ${notice.withdrawalId}`);
  if (!r) return { email: false, telegram: false };
  const t = messages.email.withdrawal;
  const to = { email: r.email, telegramUserId: tgId(r.telegram_user_id), timeZone: r.tz };
  const link = `${deps.appUrl}/my/orders/${r.order_id}`;
  const title = r.title ?? '—';
  if (notice.kind === 'withdrawal_received') {
    const received = formatDateTime(new Date(r.received_at), r.tz);
    const paid = formatPrice(r.total, r.currency, 2);
    return deliver(redis, deps, to, {
      subject: t.received.subject(r.product),
      lines: [
        t.received.intro(r.product, title, received),
        t.received.details(r.product, paid, formatDateTime(new Date(r.paid_at), r.tz), r.name, r.email),
        t.received.body,
      ],
      note: withdrawalReceiptDe({ productCode: r.code, totalMinor: Number(r.total), currency: r.currency, paidAt: new Date(r.paid_at), receivedAt: new Date(r.received_at), timeZone: r.tz }),
      button: t.button,
      link,
      invoiceUrl: null,
    });
  }
  if (r.status === 'received') return { email: false, telegram: false };
  const c = r.status === 'refunded' ? t.refunded : t.noRefund;
  const amount = formatPrice(r.refund ?? 0, r.currency, 2);
  return deliver(redis, deps, to, { subject: c.subject(r.product, amount), lines: [c.intro(r.product, amount), c.body], button: t.button, link, invoiceUrl: null });
}

/** Worker (outbox `listing.bumped`): tells the seller their listing moved to the top */
export async function sendBumpNotice(db: Queryable, redis: Redis, deps: Pick<Deps, 'mail' | 'telegram' | 'appUrl'>, listingId: string): Promise<{ email: boolean; telegram: boolean }> {
  const [r] = await db.execute<{ email: string; telegram_user_id: string | number | null; title: string; token: string }>(sql`
    SELECT u.email, u.telegram_user_id, l.title, l.public_token AS token
    FROM listings l JOIN users u ON u.id = l.user_id AND u.status = 'active'
    WHERE l.id = ${listingId} AND l.status = 'active'`);
  if (!r) return { email: false, telegram: false };
  const c = messages.email.paymentNotice.bumped;
  return deliver(redis, { ...deps, gateway: null }, { email: r.email, telegramUserId: tgId(r.telegram_user_id), timeZone: 'Europe/Berlin' }, {
    subject: c.subject(r.title),
    lines: [c.intro(r.title), c.body],
    button: c.button,
    link: `${deps.appUrl}${listingPath(r.title, r.token)}`,
    invoiceUrl: null,
  });
}
