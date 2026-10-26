import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import type { StaffContext } from '../src/modules/admin/audit';
import type { Mail } from '../src/modules/notifications/mailer';
import type { TelegramClient } from '../src/modules/notifications/telegram-api';
import { BUSINESS_NOTICE, noticeKind, sendBusinessNotice } from '../src/modules/organizations/notices';
import { setVerification } from '../src/modules/organizations/organizations';
import { offerFounding } from '../src/modules/payments/founding';
import { redis, workerDb } from './accounts';
import { db, publicToken } from './db';
import { city } from './listings-fixtures';
import { business } from './payments-fixtures';

// The owner's rule (Oct 26, 2026): when staff change something about a business, its owner is
// always told, both ways. Verified, badge removed, rejected, founding: an outbox notice in the same
// transaction, then an email, and Telegram when the bot can reach the owner.

const APP = 'https://app.example.test';

async function notices(organizationId: string) {
  const rows = await db.select().from(schema.outboxEvents).where(and(eq(schema.outboxEvents.eventType, BUSINESS_NOTICE), eq(schema.outboxEvents.aggregateId, organizationId))).orderBy(schema.outboxEvents.id);
  return rows.map((r) => noticeKind(r.payload as Record<string, unknown>));
}

function outbox() {
  const mails: Mail[] = [];
  const tg: Array<{ chatId: number; text: string }> = [];
  const telegram = { sendMessage: async (chatId: number, text: string) => void tg.push({ chatId, text }) } as unknown as TelegramClient;
  return { mails, tg, opts: { mail: async (m: Mail) => void mails.push(m), telegram, appUrl: APP } };
}

describe('business notices', () => {
  it('verifying, removing the badge and rejecting each queue a notice for the owner', async () => {
    const { org } = await business();
    for (const status of ['verified', 'unverified', 'rejected'] as const) {
      await db.transaction((tx) => setVerification(tx, { slug: org.slug, status, byUserId: null }));
    }
    expect(await notices(org.id)).toEqual(['verified', 'unverified', 'rejected']);
  });

  it('the founding offer queues one too', async () => {
    const { org } = await business();
    await db.update(schema.organizations).set({ verificationStatus: 'verified', locationId: (await city('berlin')).id }).where(eq(schema.organizations.id, org.id));
    const [u] = await db.insert(schema.users).values({ publicToken: publicToken(), email: `${randomUUID()}@example.test`, displayName: 'مدیر', displayNameNormalized: 'مدیر' }).returning();
    const ctx: StaffContext = { userId: u!.id, role: 'admin', sessionId: randomUUID(), ip: null, userAgent: null };
    await db.transaction((tx) => offerFounding(tx, ctx, org.id));
    expect(await notices(org.id)).toEqual(['founding']);
  });

  it('emails the owner with the right link, and sends Telegram when linked', async () => {
    const { org, ownerId } = await business();
    const o = outbox();
    expect(await sendBusinessNotice(workerDb, redis, o.opts, org.id, 'verified')).toEqual({ email: true, telegram: false });
    expect(o.mails[0]!.subject).toContain('تأیید شد');
    expect(o.mails[0]!.text).toContain(`${APP}/b/${org.slug}/manage`);

    await sendBusinessNotice(workerDb, redis, o.opts, org.id, 'unverified');
    expect(o.mails[1]!.subject).toContain('برداشته شد');
    expect(o.mails[1]!.text).toContain(`${APP}/b/${org.slug}/edit`);
    expect(o.mails[1]!.text).toContain('منتشر می‌مانند');

    await db.update(schema.users).set({ telegramUserId: 7_200_000_000 + Math.floor(Math.random() * 1e6) }).where(eq(schema.users.id, ownerId));
    expect(await sendBusinessNotice(workerDb, redis, o.opts, org.id, 'rejected')).toEqual({ email: true, telegram: true });
    expect(o.tg[0]!.text).toContain('نتوانستیم');
  });

  it('a Telegram failure never stops the email', async () => {
    const { org, ownerId } = await business();
    await db.update(schema.users).set({ telegramUserId: 7_300_000_000 + Math.floor(Math.random() * 1e6) }).where(eq(schema.users.id, ownerId));
    const mails: Mail[] = [];
    const broken = { sendMessage: async () => Promise.reject(new Error('down')) } as unknown as TelegramClient;
    expect(await sendBusinessNotice(workerDb, redis, { mail: async (m) => void mails.push(m), telegram: broken, appUrl: APP }, org.id, 'founding')).toEqual({ email: true, telegram: false });
    expect(mails).toHaveLength(1);
  });

  it('nothing for a deleted business, and unknown kinds are ignored', async () => {
    const { org } = await business();
    await db.update(schema.organizations).set({ status: 'deleted', deletedAt: new Date() }).where(eq(schema.organizations.id, org.id));
    const o = outbox();
    expect(await sendBusinessNotice(workerDb, redis, o.opts, org.id, 'verified')).toEqual({ email: false, telegram: false });
    expect(noticeKind({ kind: 'anything' })).toBeNull();
  });
});
