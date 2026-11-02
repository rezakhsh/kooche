import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import type { Mail } from '../src/modules/notifications/mailer';
import type { TelegramClient } from '../src/modules/notifications/telegram-api';
import { sendBusinessNotice } from '../src/modules/organizations/notices';
import { acceptInvitation, changeMember, declineInvitation, invite } from '../src/modules/organizations/members';
import { applyWebhookEvent } from '../src/modules/payments/apply';
import { PAYMENT_NOTICE, parsePaymentNotice, sendPaymentNotice } from '../src/modules/payments/notices';
import {
  ACCOUNT_NOTICE,
  maskedPhone,
  parseAccountNotice,
  queueEndedSanctionNotices,
  sendAccountNotice,
  sendGoodbye,
  type AccountNotice,
} from '../src/modules/users/account-notices';
import { eraseRequestedUser, requestErasure } from '../src/modules/users/erasure';
import { checkSmsCode, startSmsVerification } from '../src/modules/users/phone';
import { MemorySms, appDb, redis, workerDb } from './accounts';
import { db, makeListing, publicToken, type Tx } from './db';
import { user } from './listings-fixtures';
import { business, event, FakeGateway, seedCatalog, storeEvent, stripeInvoice, stripePriceId, stripeSubscription } from './payments-fixtures';

// Check B part 6 (Nov 2, 2026): every action that changes something for someone tells them. Team
// changes, a confirmed phone number, a restriction that ran out, the goodbye after «حذف حساب», the
// receipt of a business's verification request and a Pro renewal whose payment failed. Each is an
// outbox notice in the action's transaction, sent by the worker role.

const APP = 'https://app.example.test';
const DAY = 86_400_000;

beforeAll(async () => {
  await seedCatalog();
});

async function noticesFor(userId: string): Promise<AccountNotice[]> {
  const rows = await db
    .select()
    .from(schema.outboxEvents)
    .where(and(eq(schema.outboxEvents.eventType, ACCOUNT_NOTICE), eq(schema.outboxEvents.aggregateId, userId)))
    .orderBy(schema.outboxEvents.id);
  return rows.map((r) => parseAccountNotice(r.payload as Record<string, unknown>)!);
}

function deps() {
  const mails: Mail[] = [];
  const tg: string[] = [];
  const telegram = { sendMessage: async (_: number, text: string) => void tg.push(text) } as unknown as TelegramClient;
  return { mails, tg, d: { mail: async (m: Mail) => void mails.push(m), telegram, appUrl: APP } };
}

/** A Pro Plus period, so the business has seats */
async function givePlan(organizationId: string) {
  const [price] = await db.select().from(schema.productPrices).where(eq(schema.productPrices.providerPriceId, stripePriceId('pro-plus', 'month')));
  const [product] = await db.select().from(schema.products).where(eq(schema.products.id, price!.productId));
  const now = Date.now();
  const [sub] = await db
    .insert(schema.subscriptions)
    .values({ organizationId, productPriceId: price!.id, providerSubscriptionId: `sub_test_${publicToken()}`, status: 'active', currentPeriodStart: new Date(now - DAY), currentPeriodEnd: new Date(now + 29 * DAY) })
    .returning();
  await db.insert(schema.entitlements).values({ type: 'pro_plan', organizationId, subscriptionId: sub!.id, providerInvoiceId: `in_test_${publicToken()}`, startsAt: new Date(now - DAY), endsAt: new Date(now + 36 * DAY), features: product!.features });
}

async function invited(orgId: string, ownerId: string, role: 'manager' | 'staff' = 'staff') {
  const guest = await user({ name: 'سارا آزمایشی' });
  const r = await invite(appDb, { userId: ownerId, organizationId: orgId, email: guest.email, role });
  if (!r.ok) throw new Error(r.reason);
  return { guest, token: r.token };
}

describe('team notices', () => {
  it('the owner hears when an invitation is accepted or turned down', async () => {
    const { org, ownerId } = await business();
    await givePlan(org.id);
    const a = await invited(org.id, ownerId, 'manager');
    expect((await acceptInvitation(appDb, { userId: a.guest.id, token: a.token })).ok).toBe(true);
    const b = await invited(org.id, ownerId);
    expect(await declineInvitation(appDb, { userId: b.guest.id, token: b.token })).toBe(true);
    const [accepted, declined] = await noticesFor(ownerId);
    expect(accepted).toMatchObject({ kind: 'invite_accepted' });
    expect(declined).toMatchObject({ kind: 'invite_declined' });

    const o = deps();
    await sendAccountNotice(workerDb, redis, o.d, ownerId, accepted!);
    expect(o.mails[0]!.subject).toContain('سارا آزمایشی');
    expect(o.mails[0]!.text).toContain('«مدیر»');
    expect(o.mails[0]!.text).toContain(`${APP}/b/${org.slug}/team`);
    await sendAccountNotice(workerDb, redis, o.d, ownerId, declined!);
    expect(o.mails[1]!.subject).toContain('رد شد');
    expect(o.mails[1]!.text).toContain(b.guest.email);
  });

  it('a member hears of a new role, of becoming an owner and of being removed; nobody hears of their own step', async () => {
    const { org, ownerId } = await business();
    await givePlan(org.id);
    const { guest, token } = await invited(org.id, ownerId);
    await acceptInvitation(appDb, { userId: guest.id, token });
    const change = (to: 'owner' | 'manager' | 'staff' | 'removed') => changeMember(appDb, { userId: ownerId, organizationId: org.id, memberId: guest.id, to });
    expect(await change('manager')).toEqual({ ok: true });
    // The same role again changes nothing and tells nobody
    expect(await change('manager')).toEqual({ ok: true });
    expect(await change('owner')).toEqual({ ok: true });
    // Stepping down oneself: no notice to oneself
    expect(await changeMember(appDb, { userId: guest.id, organizationId: org.id, memberId: guest.id, to: 'manager' })).toEqual({ ok: true });
    await changeMember(appDb, { userId: ownerId, organizationId: org.id, memberId: guest.id, to: 'removed' });
    expect((await noticesFor(guest.id)).map((n) => (n.kind === 'role_changed' ? `role:${n.role}` : n.kind))).toEqual(['role:manager', 'role:owner', 'removed']);

    const o = deps();
    const [toManager, toOwner, removed] = await noticesFor(guest.id);
    await sendAccountNotice(workerDb, redis, o.d, guest.id, toManager!);
    expect(o.mails[0]!.text).toContain('«مدیر»');
    expect(o.mails[0]!.text).toContain('همهٔ آگهی‌ها');
    await sendAccountNotice(workerDb, redis, o.d, guest.id, toOwner!);
    expect(o.mails[1]!.subject).toContain('مالک');
    await sendAccountNotice(workerDb, redis, o.d, guest.id, removed!);
    expect(o.mails[2]!.subject).toContain('دیگر در تیم');
    expect(o.mails[2]!.text).toContain(`${APP}/my/listings`);
  });

  it('a member who leaves hands their listings to an owner, who is told how many', async () => {
    const owner = await user({ name: 'مالک آزمایشی' });
    const { org } = await business(owner.id);
    await givePlan(org.id);
    const { guest, token } = await invited(org.id, owner.id);
    await acceptInvitation(appDb, { userId: guest.id, token });
    await makeListing(db as unknown as Tx, guest.id, { organizationId: org.id });
    await makeListing(db as unknown as Tx, guest.id, { organizationId: org.id });
    expect(await changeMember(appDb, { userId: guest.id, organizationId: org.id, memberId: guest.id, to: 'removed' })).toEqual({ ok: true });
    // Leaving is their own step: they get nothing; the owner gets the listings
    expect(await noticesFor(guest.id)).toEqual([]);
    const handed = (await noticesFor(owner.id)).filter((n) => n.kind === 'listings_handed');
    expect(handed).toEqual([{ kind: 'listings_handed', organizationId: org.id, fromUserId: guest.id, count: 2 }]);

    const o = deps();
    await sendAccountNotice(workerDb, redis, o.d, owner.id, handed[0]!);
    expect(o.mails[0]!.subject).toContain('۲ آگهی');
    expect(o.mails[0]!.text).toContain('سارا آزمایشی از تیم');
    expect(o.mails[0]!.text).toContain('«نمایش شماره»');
  });

  it('Telegram too when linked, and nothing for a business that is gone', async () => {
    const { org, ownerId } = await business();
    await db.update(schema.users).set({ telegramUserId: 7_600_000_000 + Math.floor(Math.random() * 1e6) }).where(eq(schema.users.id, ownerId));
    const o = deps();
    const notice: AccountNotice = { kind: 'role_changed', organizationId: org.id, role: 'staff' };
    expect(await sendAccountNotice(workerDb, redis, o.d, ownerId, notice)).toEqual({ email: true, telegram: true });
    expect(o.tg[0]).toContain('«همکار»');
    await db.update(schema.organizations).set({ status: 'deleted', deletedAt: new Date() }).where(eq(schema.organizations.id, org.id));
    expect(await sendAccountNotice(workerDb, redis, o.d, ownerId, notice)).toEqual({ email: false, telegram: false });
  });
});

describe('a confirmed phone number', () => {
  it('queues «شما نبودید؟», sent by email only with the number masked', async () => {
    const u = await user();
    // user() gives a verified number; start from none
    await db.update(schema.users).set({ phoneE164: null, phoneVerifiedAt: null, phoneVerificationMethod: null, telegramUserId: 7_700_000_000 + Math.floor(Math.random() * 1e6) }).where(eq(schema.users.id, u.id));
    const phone = `+49151${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
    const sms = new MemorySms();
    const secret = 'phone-code-secret-phone-code-secret-0123';
    const started = await startSmsVerification(appDb, sms, { userId: u.id, phoneE164: phone, numberCountry: 'DE', ip: '203.0.113.9', secret });
    if (!started.ok) throw new Error(started.reason);
    expect(await checkSmsCode(appDb, { userId: u.id, verificationId: started.verificationId, code: sms.lastCode(), secret })).toEqual({ ok: true });
    const [notice] = await noticesFor(u.id);
    expect(notice).toEqual({ kind: 'phone_verified', telegram: false });

    const o = deps();
    expect(await sendAccountNotice(workerDb, redis, o.d, u.id, notice!)).toEqual({ email: true, telegram: false });
    expect(o.tg).toEqual([]);
    expect(o.mails[0]!.text).toContain(maskedPhone(phone));
    expect(o.mails[0]!.text).not.toContain(phone);
    expect(o.mails[0]!.text).toContain(`${APP}/account/devices`);
    expect(maskedPhone('+4915112345678')).toBe('+49 ••• 78');
    expect(maskedPhone('+12025550123')).toBe('+1 ••• 23');
  });
});

describe('a restriction that ran out', () => {
  async function sanction(userId: string, type: 'suspended' | 'posting_restricted' | 'messaging_restricted', endsAt: Date | null) {
    const [d] = await db
      .insert(schema.moderationDecisions)
      .values({ userId, decision: 'sanction', reasonCode: 'spam', policyGround: 'terms-spam', statementFa: 'هرزنامه', decidedBy: 'rule' })
      .returning();
    const [s] = await db.insert(schema.userSanctions).values({ userId, type, moderationDecisionId: d!.id, startsAt: new Date(Date.now() - 8 * DAY), endsAt }).returning();
    return s!;
  }

  it('is told once, unless another of the same kind still holds', async () => {
    const a = await user();
    const ended = await sanction(a.id, 'posting_restricted', new Date(Date.now() - 3_600_000));
    const b = await user();
    await sanction(b.id, 'suspended', new Date(Date.now() - 3_600_000));
    await sanction(b.id, 'suspended', new Date(Date.now() + 3 * DAY));
    // Ended long ago: not news any more
    const c = await user();
    await sanction(c.id, 'messaging_restricted', new Date(Date.now() - 5 * DAY));

    await queueEndedSanctionNotices(workerDb);
    await queueEndedSanctionNotices(workerDb);
    expect(await noticesFor(a.id)).toEqual([{ kind: 'sanction_ended', sanctionId: ended.id, type: 'posting_restricted' }]);
    expect(await noticesFor(b.id)).toEqual([]);
    expect(await noticesFor(c.id)).toEqual([]);

    const o = deps();
    await sendAccountNotice(workerDb, redis, o.d, a.id, (await noticesFor(a.id))[0]!);
    expect(o.mails[0]!.subject).toContain('محدودیت');
    expect(o.mails[0]!.text).toContain('آگهی و رویداد منتشر کنید');
  });

  it('a suspension whose listings came back was told by that decision already', async () => {
    const u = await user();
    const s = await sanction(u.id, 'suspended', new Date(Date.now() - 3_600_000));
    await db.insert(schema.moderationDecisions).values({ userId: u.id, decision: 'restore', statementFa: 'تمام شد', decidedBy: 'rule', aiOutput: { rule: 'suspension_ended', sanctionId: s.id }, contentSnapshot: {} });
    await queueEndedSanctionNotices(workerDb);
    expect(await noticesFor(u.id)).toEqual([]);
  });
});

describe('«حساب شما حذف شد»', () => {
  it('goes once to the address before it is wiped, and never holds the deletion up', async () => {
    const u = await user();
    expect(await requestErasure(appDb, u.id, u.email)).toEqual({ ok: true });
    const mails: Mail[] = [];
    const key = `test-${publicToken()}`;
    expect(await sendGoodbye(workerDb, redis, async (m) => void mails.push(m), APP, u.id, key)).toBe(true);
    // A retried job sends nothing more
    expect(await sendGoodbye(workerDb, redis, async (m) => void mails.push(m), APP, u.id, key)).toBe(false);
    expect(mails).toHaveLength(1);
    expect(mails[0]!.to).toBe(u.email);
    expect(mails[0]!.subject).toContain('حذف شد');
    expect(mails[0]!.text).toContain('۹۰ روز');

    // A broken mailer is only logged
    const v = await user();
    await requestErasure(appDb, v.id, v.email);
    expect(await sendGoodbye(workerDb, redis, () => Promise.reject(new Error('smtp down')), APP, v.id, `test-${publicToken()}`)).toBe(false);
    expect(await eraseRequestedUser(workerDb, v.id)).toBe('erased');

    // After the erasure there is no address left to write to
    expect(await eraseRequestedUser(workerDb, u.id)).toBe('erased');
    expect(await sendGoodbye(workerDb, redis, async (m) => void mails.push(m), APP, u.id, `test-${publicToken()}`)).toBe(false);
  });

  it('an active account gets no goodbye', async () => {
    const u = await user();
    expect(await sendGoodbye(workerDb, redis, async () => undefined, APP, u.id, `test-${publicToken()}`)).toBe(false);
  });
});

describe('a business’s verification request', () => {
  it('the owner gets a receipt with the manage page', async () => {
    const { org } = await business();
    const o = deps();
    await sendBusinessNotice(workerDb, redis, { mail: o.d.mail, telegram: null, appUrl: APP }, org.id, 'verification_received');
    expect(o.mails[0]!.subject).toContain('به دست ما رسید');
    expect(o.mails[0]!.text).toContain(`${APP}/b/${org.slug}/manage`);
  });
});

describe('a Pro renewal whose payment failed', () => {
  async function failed(opts: { billingReason: string; attempt: number; next: Date | null; status?: string }) {
    const gateway = new FakeGateway();
    const { org } = await business();
    const priceId = stripePriceId('pro', 'month');
    const start = new Date();
    const end = new Date(start.getTime() + 30 * DAY);
    const sub = stripeSubscription({ organizationId: org.id, priceId, start, end });
    gateway.subscriptions.set(sub.id, sub);
    const paid = stripeInvoice({ subscriptionId: sub.id, priceId, amountPaid: 2400, start, end, paymentIntent: `pi_test_${sub.id}` });
    gateway.invoices.set(paid.id, paid);
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('invoice.paid', paid)));

    gateway.subscriptions.set(sub.id, { ...sub, status: opts.status ?? 'past_due' });
    const invoice = {
      ...stripeInvoice({ subscriptionId: sub.id, priceId, amountPaid: 0, start: end, end: new Date(end.getTime() + 30 * DAY) }),
      status: 'open',
      billing_reason: opts.billingReason,
      attempt_count: opts.attempt,
      next_payment_attempt: opts.next ? Math.floor(opts.next.getTime() / 1000) : null,
      hosted_invoice_url: 'https://invoice.stripe.com/i/failed',
    };
    gateway.invoices.set(invoice.id, invoice);
    await applyWebhookEvent(workerDb, gateway, await storeEvent(event('invoice.payment_failed', invoice)));
    const rows = await db.select().from(schema.outboxEvents).where(and(eq(schema.outboxEvents.eventType, PAYMENT_NOTICE), eq(schema.outboxEvents.aggregateId, org.id))).orderBy(schema.outboxEvents.id);
    return { org, gateway, kinds: rows.map((r) => parsePaymentNotice(r.payload as Record<string, unknown>)!) };
  }

  it('the first failure tells the owner the next try, how long Pro holds, and links the invoice', async () => {
    const next = new Date(Date.now() + 3 * DAY);
    const { org, gateway, kinds } = await failed({ billingReason: 'subscription_cycle', attempt: 1, next });
    expect(kinds.map((k) => k.kind)).toEqual(['pro_started', 'pro_payment_failed']);
    const notice = kinds[1]!;
    expect(notice).toMatchObject({ nextAttempt: next.toISOString().replace(/\.\d+Z$/, '.000Z') });

    const mails: Mail[] = [];
    await sendPaymentNotice(workerDb, redis, { mail: async (m) => void mails.push(m), telegram: null, appUrl: APP, gateway }, org.id, notice);
    expect(mails[0]!.subject).toContain('انجام نشد');
    expect(mails[0]!.text).toContain('دوباره در');
    expect(mails[0]!.text).toContain('امکانات پرو تا');
    expect(mails[0]!.text).toContain('https://invoice.stripe.com/i/failed');
    expect(mails[0]!.text).toContain(`${APP}/b/${org.slug}/billing`);
  });

  it('quiet for later tries, the first payment at checkout and a subscription that ended', async () => {
    expect((await failed({ billingReason: 'subscription_cycle', attempt: 2, next: new Date(Date.now() + DAY) })).kinds.map((k) => k.kind)).toEqual(['pro_started']);
    expect((await failed({ billingReason: 'subscription_create', attempt: 1, next: null })).kinds.map((k) => k.kind)).toEqual(['pro_started']);
    // The last try failed and Stripe ended it: «اشتراک تمام شد» says it
    expect((await failed({ billingReason: 'subscription_cycle', attempt: 1, next: null, status: 'canceled' })).kinds.map((k) => k.kind)).toEqual(['pro_started', 'pro_ended']);
  });
});
