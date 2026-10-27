import { eq } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { createServer, type Server } from 'node:http';
import { randomInt, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import { markRead, sendMessage, type Sent } from '../src/modules/chat/conversations';
import { markViewing } from '../src/modules/chat/presence';
import { decideNotice, planNotice, type NoticeJob } from '../src/modules/notifications/chat-notice';
import type { Mail } from '../src/modules/notifications/mailer';
import { TelegramClient } from '../src/modules/notifications/telegram-api';
import { isUnreachableMarked, markUnreachable } from '../src/modules/notifications/telegram-reach';
import { setChatNotices } from '../src/modules/users/notification-prefs';
import { startChatJobs, TELEGRAM_PER_SECOND } from '../src/worker/chat';
import type { OutboxJobData } from '../src/worker/outbox';
import { appDb, redis, workerDb } from './accounts';
import { db, makeListing, type Tx } from './db';
import { user } from './listings-fixtures';

// Chat notices (approved Oct 18, 2026): who gets one and when, the debounce, Telegram before
// email, and the send queues against a fake Telegram that answers 429 with retry_after and 403
// for a blocked bot. The queues run for real on the test Valkey, under a key prefix of their own.

const DAY = 86_400_000;

async function chat(opts: { telegram?: boolean } = {}) {
  const seller = await user({ name: 'فروشنده' });
  const buyer = await user({ name: 'مریم' });
  const old = new Date(Date.now() - 30 * DAY);
  await db.update(schema.users).set({ createdAt: old }).where(eq(schema.users.id, buyer.id));
  const tg = 1_000_000_000 + randomInt(1_000_000_000);
  if (opts.telegram !== false) await db.update(schema.users).set({ telegramUserId: tg }).where(eq(schema.users.id, seller.id));
  const listing = await makeListing(db as unknown as Tx, seller.id, { title: 'دوچرخه کوهستان' });
  const send = async (body = 'سلام') => {
    const r = await sendMessage(appDb, redis, { userId: buyer.id, target: { listingToken: listing.publicToken }, body });
    if (!r.ok) throw new Error(r.reason);
    return r;
  };
  return { seller, buyer, listing, tg, send };
}

const jobOf = (s: Sent): NoticeJob => ({ conversationId: s.conversationId, messageId: s.message.id, recipientId: s.recipientId });

describe('who gets a notice', () => {
  it('plans one for an away receiver and picks Telegram when linked', async () => {
    const c = await chat();
    const s = await c.send();
    expect(await planNotice(workerDb, redis, jobOf(s))).toBe('later');
    expect(await decideNotice(workerDb, redis, jobOf(s))).toEqual({ channels: ['telegram'] });
  });

  it('sends none while the receiver has the conversation or the inbox open', async () => {
    const c = await chat();
    const s = await c.send();
    await markViewing(redis, c.seller.id, s.conversationId, randomUUID());
    expect(await planNotice(workerDb, redis, jobOf(s))).toBe('viewing');
    expect(await decideNotice(workerDb, redis, jobOf(s))).toEqual({ skip: 'viewing' });

    const d = await chat();
    const t = await d.send();
    await markViewing(redis, d.seller.id, '*', randomUUID());
    expect(await planNotice(workerDb, redis, jobOf(t))).toBe('viewing');
  });

  it('sends none once read, or when the receiver turned chat notices off', async () => {
    const c = await chat();
    const s = await c.send();
    await markRead(appDb, { userId: c.seller.id, conversationId: s.conversationId });
    expect(await decideNotice(workerDb, redis, jobOf(s))).toEqual({ skip: 'already_read' });

    const d = await chat();
    await setChatNotices(appDb, d.seller.id, false);
    const t = await d.send();
    expect(await planNotice(workerDb, redis, jobOf(t))).toBe('turned_off');
    await setChatNotices(appDb, d.seller.id, true);
    expect(await planNotice(workerDb, redis, jobOf(t))).toBe('later');
  });

  it('sends at most one notice per conversation in the debounce window', async () => {
    const c = await chat();
    const a = await c.send('یک');
    const b = await c.send('دو');
    expect(await decideNotice(workerDb, redis, jobOf(a))).toEqual({ channels: ['telegram'] });
    expect(await decideNotice(workerDb, redis, jobOf(b))).toEqual({ skip: 'debounced' });
    // Telegram's window is 5 minutes, email's 15
    expect(await redis.ttl(`notice:${a.conversationId}:${c.seller.id}`)).toBeLessThanOrEqual(300);
  });

  it('uses email when the account has no Telegram, or the bot can’t reach it', async () => {
    const c = await chat({ telegram: false });
    expect(await decideNotice(workerDb, redis, jobOf(await c.send()))).toEqual({ channels: ['email'] });
    expect(await redis.ttl(`notice:${(await c.send()).conversationId}:${c.seller.id}:email`)).toBeGreaterThan(300);

    const d = await chat();
    await markUnreachable(redis, d.tg);
    expect(await decideNotice(workerDb, redis, jobOf(await d.send()))).toEqual({ channels: ['email'] });
  });
});

// A fake Telegram Bot API: each request is answered by the next scripted reply (then 200)
type Reply = { status: number; body: unknown };
let server: Server;
let base = '';
const calls: Array<{ at: number; chatId: number; text: string }> = [];
let script: Reply[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = JSON.parse(raw || '{}') as { chat_id: number; text: string };
      calls.push({ at: Date.now(), chatId: body.chat_id, text: body.text });
      const reply = script.shift() ?? { status: 200, body: { ok: true, result: {} } };
      res.writeHead(reply.status, { 'content-type': 'application/json' }).end(JSON.stringify(reply.body));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
afterAll(async () => {
  await new Promise((r) => server.close(r));
});

async function jobs(mails: Mail[]) {
  const connection = new Redis(process.env.TEST_REDIS_URL!, { maxRetriesPerRequest: null });
  const started = await startChatJobs(workerDb, connection, {
    telegram: new TelegramClient('123:test-token-test-token-test-token-xx', undefined, base),
    mailer: async (m) => {
      mails.push(m);
    },
    appUrl: 'https://app.example.test',
    prefix: `test-${randomUUID()}`,
    delayMs: 50,
    telegramBackoffMs: 50,
  });
  return {
    ...started,
    close: async () => {
      await started.close();
      await connection.quit();
    },
  };
}

function outboxJob(s: Sent): OutboxJobData {
  return {
    outboxId: randomUUID(),
    eventType: 'message.sent',
    aggregateId: s.conversationId,
    payload: { messageId: s.message.id, senderId: s.senderId, recipientId: s.recipientId },
  };
}

async function until(check: () => boolean | Promise<boolean>, ms = 10_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('timed out');
}

describe('send queues', () => {
  it('delivers a Telegram notice with the sender, the listing and a link, after the delay', async () => {
    const mails: Mail[] = [];
    const q = await jobs(mails);
    try {
      const c = await chat();
      const s = await c.send();
      await q.queues.notify.add('chat_notify', outboxJob(s));
      await until(() => calls.some((x) => x.chatId === c.tg));
      const call = calls.find((x) => x.chatId === c.tg)!;
      expect(call.text).toContain('مریم');
      expect(call.text).toContain('دوچرخه کوهستان');
      expect(call.text).not.toContain('سلام');
      expect(mails).toEqual([]);
    } finally {
      await q.close();
    }
  });

  it('honors a 429 with retry_after: the queue waits, the job keeps its attempts and is delivered once', async () => {
    const mails: Mail[] = [];
    const q = await jobs(mails);
    try {
      const c = await chat();
      const s = await c.send();
      script = [{ status: 429, body: { ok: false, error_code: 429, description: 'Too Many Requests: retry after 1', parameters: { retry_after: 1 } } }];
      const job = await q.queues.telegram.add('chat_telegram', { conversationId: s.conversationId, messageId: s.message.id, recipientId: c.seller.id });
      const before = calls.length;
      await until(async () => (await job.getState()) === 'completed', 15_000);
      const mine = calls.slice(before).filter((x) => x.chatId === c.tg);
      expect(mine).toHaveLength(2);
      expect(mine[1]!.at - mine[0]!.at).toBeGreaterThanOrEqual(950);
      const done = await q.queues.telegram.getJob(job.id!);
      expect(done!.attemptsMade).toBeLessThanOrEqual(1);
      expect(done!.returnvalue).toBe('sent');
      expect(mails).toEqual([]);
    } finally {
      script = [];
      await q.close();
    }
  });

  it('falls back to email and marks the bot unreachable when the person blocked it (403)', async () => {
    const mails: Mail[] = [];
    const q = await jobs(mails);
    try {
      const c = await chat();
      const s = await c.send();
      script = [{ status: 403, body: { ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' } }];
      await q.queues.telegram.add('chat_telegram', { conversationId: s.conversationId, messageId: s.message.id, recipientId: c.seller.id });
      await until(() => mails.length > 0);
      expect(mails[0]!.to).toBe(c.seller.email);
      expect(mails[0]!.subject).toContain('دوچرخه کوهستان');
      expect(mails[0]!.text).toContain(`https://app.example.test/chat/${s.conversationId}`);
      expect(await isUnreachableMarked(redis, c.tg)).toBe(true);
    } finally {
      script = [];
      await q.close();
    }
  });

  it('retries server errors and, after the last attempt, still delivers by email', async () => {
    const mails: Mail[] = [];
    const q = await jobs(mails);
    try {
      const c = await chat();
      const s = await c.send();
      script = Array.from({ length: 10 }, () => ({ status: 502, body: { ok: false, error_code: 502, description: 'Bad Gateway' } }));
      await q.queues.telegram.add('chat_telegram', { conversationId: s.conversationId, messageId: s.message.id, recipientId: c.seller.id });
      await until(() => mails.length > 0, 20_000);
      expect(calls.filter((x) => x.chatId === c.tg)).toHaveLength(10);
      expect(mails[0]!.to).toBe(c.seller.email);
    } finally {
      script = [];
      await q.close();
    }
  });

  it(`sends at most ${TELEGRAM_PER_SECOND} Telegram messages a second`, async () => {
    const mails: Mail[] = [];
    const q = await jobs(mails);
    try {
      const n = TELEGRAM_PER_SECOND + 15;
      const people = await Promise.all(Array.from({ length: n }, () => chat()));
      const sent = await Promise.all(people.map((c) => c.send()));
      const before = calls.length;
      const start = Date.now();
      await q.queues.telegram.addBulk(
        sent.map((s) => ({ name: 'chat_telegram', data: { conversationId: s.conversationId, messageId: s.message.id, recipientId: s.recipientId } })),
      );
      await until(() => calls.length - before >= n, 20_000);
      const ours = calls.slice(before);
      // Spread evenly: no one-second span holds more than the limit (plus the one at its edge)
      const busiest = Math.max(...ours.map((x) => ours.filter((y) => y.at >= x.at && y.at < x.at + 1_000).length));
      expect(busiest).toBeLessThanOrEqual(TELEGRAM_PER_SECOND + 1);
      expect(Date.now() - start).toBeGreaterThanOrEqual(1_000);
    } finally {
      await q.close();
    }
  });
});

describe('bot reachability', () => {
  it('follows the person blocking and unblocking the bot, and writing to it', async () => {
    const { handleUpdate } = await import('../src/modules/users/telegram-bot');
    const api = { sendMessage: async () => {} };
    const id = 2_000_000_000 + randomInt(1_000_000);
    const member = (status: string) => ({
      update_id: 1,
      my_chat_member: { chat: { id, type: 'private' }, from: { id }, new_chat_member: { status } },
    });
    await handleUpdate(workerDb, redis, api, member('kicked'));
    expect(await isUnreachableMarked(redis, id)).toBe(true);
    await handleUpdate(workerDb, redis, api, member('member'));
    expect(await isUnreachableMarked(redis, id)).toBe(false);
    await markUnreachable(redis, id);
    await handleUpdate(workerDb, redis, api, { update_id: 2, message: { message_id: 1, from: { id }, chat: { id, type: 'private' }, text: '/start' } });
    expect(await isUnreachableMarked(redis, id)).toBe(false);
  });
});
