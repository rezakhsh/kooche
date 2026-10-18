import { Queue, UnrecoverableError, Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Db } from '../db/drizzle';
import {
  CLOSING_EVENTS,
  REOPENING_EVENTS,
  closeListingConversations,
  reopenListingConversations,
  type StatusChange,
} from '../modules/chat/conversations';
import { publish, wireMessage } from '../modules/chat/realtime';
import {
  NOTICE_DELAY_MS,
  decideNotice,
  emailNotice,
  noticeContent,
  planNotice,
  telegramNotice,
  type NoticeJob,
} from '../modules/notifications/chat-notice';
import type { Mailer } from '../modules/notifications/mailer';
import { isUnreachable, TelegramError, type TelegramClient } from '../modules/notifications/telegram-api';
import { markUnreachable } from '../modules/notifications/telegram-reach';
import type { OutboxHandlers, OutboxJobData } from './outbox';

// Worker jobs of the chat (docs/setup.md, "Chat"):
// - queue `chat` (from the outbox): a listing sold, deleted, expired or taken down closes its
//   conversations; renewed or live again reopens them. Both publish the change live.
// - queue `chat-notify` (from the outbox, `message.sent`): checks at once whether a notice may be
//   needed, then again after NOTICE_DELAY_MS (chat-notice.ts), and hands it to a send queue.
// - queue `telegram-send`: at most TELEGRAM_PER_SECOND messages a second across all workers (the
//   limiter lives in Valkey). A 429 pauses the whole queue for Telegram's retry_after without
//   using up an attempt; other errors retry with backoff; a blocked bot, or the last failed
//   attempt, sends the notice by email instead. Nothing is dropped.
// - queue `email-send`: at most EMAIL_PER_SECOND through SES, with retries.

export const TELEGRAM_PER_SECOND = 25;
export const EMAIL_PER_SECOND = 10;

const KEEP = { removeOnComplete: 200, removeOnFail: 1_000 };
const OUTBOX_RETRY = { attempts: 5, backoff: { type: 'exponential' as const, delay: 10_000 } };
export const TELEGRAM_RETRY = { attempts: 10, backoff: { type: 'exponential' as const, delay: 5_000 } };
const EMAIL_RETRY = { attempts: 10, backoff: { type: 'exponential' as const, delay: 10_000 } };

type DeliverJob = NoticeJob;
type SendJob = NoticeJob & { fallbackFrom?: 'telegram' };

export type ChatJobOptions = {
  /** Null without TELEGRAM_BOT_TOKEN: every notice goes by email */
  telegram: TelegramClient | null;
  mailer: Mailer;
  appUrl: string;
  /** Tests: a BullMQ key prefix of their own and a short delay */
  prefix?: string;
  delayMs?: number;
  telegramBackoffMs?: number;
};

export async function startChatJobs(db: Db, connection: Redis, opts: ChatJobOptions) {
  const prefix = opts.prefix ? { prefix: opts.prefix } : {};
  const delay = opts.delayMs ?? NOTICE_DELAY_MS;
  const tgRetry = opts.telegramBackoffMs
    ? { ...TELEGRAM_RETRY, backoff: { type: 'fixed' as const, delay: opts.telegramBackoffMs } }
    : TELEGRAM_RETRY;

  const chat = new Queue('chat', { connection, ...prefix, defaultJobOptions: { ...OUTBOX_RETRY, ...KEEP } });
  const notify = new Queue('chat-notify', { connection, ...prefix, defaultJobOptions: { ...OUTBOX_RETRY, ...KEEP } });
  const telegramQueue = new Queue('telegram-send', { connection, ...prefix, defaultJobOptions: { ...tgRetry, ...KEEP } });
  const emailQueue = new Queue('email-send', { connection, ...prefix, defaultJobOptions: { ...EMAIL_RETRY, ...KEEP } });

  const sendEmail = (job: NoticeJob, fallback = false) =>
    emailQueue.add('chat_email', { ...job, ...(fallback ? { fallbackFrom: 'telegram' as const } : {}) }, { jobId: `mail_${job.messageId}` });

  const publishChanges = async (changes: StatusChange[]) => {
    for (const c of changes) {
      await publish(connection, [c.buyerId, c.sellerId], { type: 'message', message: wireMessage(c.message) });
      await publish(connection, [c.buyerId, c.sellerId], { type: 'conversation', conversationId: c.conversationId, status: c.status });
    }
  };

  const connections = [connection.duplicate(), connection.duplicate(), connection.duplicate(), connection.duplicate()];

  const chatWorker = new Worker<OutboxJobData>(
    'chat',
    async (job) => {
      const listingId = job.data.aggregateId;
      if (job.name === 'chat_close') {
        const code = CLOSING_EVENTS[job.data.eventType];
        if (!code) return;
        const changes = await closeListingConversations(db, listingId, code);
        await publishChanges(changes);
        if (changes.length) console.log(`chat: closed ${changes.length} conversations of listing ${listingId} (${code})`);
      } else if (job.name === 'chat_reopen') {
        const changes = await reopenListingConversations(db, listingId);
        await publishChanges(changes);
        if (changes.length) console.log(`chat: reopened ${changes.length} conversations of listing ${listingId}`);
      } else throw new Error(`chat: unknown job ${job.name}`);
    },
    { connection: connections[0]!, ...prefix, concurrency: 2 },
  );

  const notifyWorker = new Worker<OutboxJobData | DeliverJob>(
    'chat-notify',
    async (job) => {
      if (job.name === 'chat_notify') {
        const d = job.data as OutboxJobData;
        const n: NoticeJob = {
          conversationId: d.aggregateId,
          messageId: String(d.payload.messageId),
          recipientId: String(d.payload.recipientId),
        };
        const plan = await planNotice(db, connection, n);
        if (plan === 'later') await notify.add('notice_deliver', n, { delay, jobId: `deliver_${n.messageId}` });
        return plan;
      }
      if (job.name === 'notice_deliver') {
        const n = job.data as DeliverJob;
        const decision = await decideNotice(db, connection, n);
        if ('skip' in decision) return decision.skip;
        if (decision.channel === 'telegram' && opts.telegram) {
          await telegramQueue.add('chat_telegram', n, { jobId: `tg_${n.messageId}` });
        } else await sendEmail(n);
        return decision.channel;
      }
      throw new Error(`chat-notify: unknown job ${job.name}`);
    },
    { connection: connections[1]!, ...prefix, concurrency: 4 },
  );

  const telegramWorker: Worker<SendJob> = new Worker<SendJob>(
    'telegram-send',
    async (job) => {
      const content = await noticeContent(db, job.data, opts.appUrl);
      if (!content) return 'gone';
      if (!opts.telegram || content.telegramUserId === null) {
        await sendEmail(job.data, true);
        return 'email';
      }
      const { text, replyMarkup } = telegramNotice(content);
      try {
        await opts.telegram.sendMessage(content.telegramUserId, text, replyMarkup);
        return 'sent';
      } catch (e) {
        if (e instanceof TelegramError && e.status === 429) {
          // Telegram's flood control: pause the whole queue as long as it asks, keep the attempt
          const ms = Math.max(1, e.retryAfter ?? 1) * 1_000;
          await telegramWorker.rateLimit(ms);
          throw Worker.RateLimitError();
        }
        if (isUnreachable(e)) {
          await markUnreachable(connection, content.telegramUserId);
          await sendEmail(job.data, true);
          return 'unreachable';
        }
        if (e instanceof TelegramError && e.status >= 400 && e.status < 500) {
          // A request Telegram will never accept: no point retrying
          await sendEmail(job.data, true);
          throw new UnrecoverableError(e.message);
        }
        throw e;
      }
    },
    {
      connection: connections[2]!,
      ...prefix,
      concurrency: 5,
      // One message every 40 ms rather than 25 at once each second: any one-second span then holds
      // at most 26, well under Telegram's ~30 (a fixed window could let 50 through at its edge)
      limiter: { max: 1, duration: Math.floor(1_000 / TELEGRAM_PER_SECOND) },
    },
  );

  const emailWorker = new Worker<SendJob>(
    'email-send',
    async (job) => {
      const content = await noticeContent(db, job.data, opts.appUrl);
      if (!content) return 'gone';
      await opts.mailer(emailNotice(content));
      return 'sent';
    },
    { connection: connections[3]!, ...prefix, concurrency: 2, limiter: { max: 1, duration: Math.floor(1_000 / EMAIL_PER_SECOND) } },
  );

  const onFailed = (job: Job | undefined, e: Error) => {
    console.error(`${job?.queueName}: ${job?.name} failed (attempt ${job?.attemptsMade}):`, e.message);
  };
  for (const w of [chatWorker, notifyWorker, emailWorker]) w.on('failed', onFailed);
  telegramWorker.on('failed', (job, e) => {
    onFailed(job, e);
    // After the last attempt the notice still arrives, by email
    if (job && !(e instanceof UnrecoverableError) && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      void sendEmail(job.data, true).catch((err) => console.error('chat: email fallback failed:', err.message));
    }
  });

  const handlers: OutboxHandlers = {
    ...Object.fromEntries(Object.keys(CLOSING_EVENTS).map((t) => [t, [{ name: 'chat_close', queue: chat }]])),
    ...Object.fromEntries(REOPENING_EVENTS.map((t) => [t, [{ name: 'chat_reopen', queue: chat }]])),
    'message.sent': [{ name: 'chat_notify', queue: notify }],
    // Known, nothing to do yet (statistics, the n8n admin alert for reports later)
    'conversation.started': [],
    'conversation.closed': [],
    'conversation.reopened': [],
    'report.created': [],
  };

  return {
    handlers,
    queues: { chat, notify, telegram: telegramQueue, email: emailQueue },
    workers: { chat: chatWorker, notify: notifyWorker, telegram: telegramWorker, email: emailWorker },
    close: async () => {
      await Promise.all([chatWorker, notifyWorker, telegramWorker, emailWorker].map((w) => w.close()));
      await Promise.all([chat, notify, telegramQueue, emailQueue].map((q) => q.close()));
      await Promise.all(connections.map((c) => c.quit()));
    },
  };
}
