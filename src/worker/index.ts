import { Queue } from 'bullmq';
import { drizzle } from 'drizzle-orm/postgres-js';
import { Redis } from 'ioredis';
import { writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import postgres from 'postgres';
import * as schema from '../db/schema';
import { workerEnv } from '../lib/env';
import { monitoringConfig } from '../lib/monitoring/config';
import { flushMonitoring, initMonitoring, reportError } from '../lib/monitoring/server';
import { notificationMailer } from '../modules/notifications/mailer';
import { TelegramClient } from '../modules/notifications/telegram-api';
import { StripeGateway } from '../modules/payments/gateway';
import { Meili } from '../modules/search/meili';
import { type OutboxHandlers, BATCH_SIZE, mergeHandlers, processOutboxBatch } from './outbox';
import { startAccountJobs } from './accounts';
import { startChatJobs } from './chat';
import { startEventJobs } from './events';
import { startListingJobs } from './listings';
import { startModerationJobs } from './moderation';
import { startPaymentJobs } from './payments';
import { startRetention } from './retention';
import { startSearchJobs } from './search';
import { startSearchAlertJobs } from './search-alerts';
import { startSeoJobs } from './seo';
import { runTelegramBot } from './telegram';

// Background worker entry point: one process that polls the outbox, runs the phone verification
// Telegram bot, the chat jobs and notices, account erasure, the daily retention jobs, the hourly sitemaps, the
// search index, payments and (as features arrive) other BullMQ job processors.
// Bundled to dist/worker.js for the `worker` Docker target.

const POLL_INTERVAL_MS = 1_000;
const ERROR_BACKOFF_MS = 5_000;
// Touched after every poll; the Docker HEALTHCHECK fails when it gets stale.
const HEARTBEAT_FILE = '/tmp/worker-heartbeat';

const env = workerEnv();

// Direct connection, as classifieds_worker (never through a pooler: FOR UPDATE SKIP LOCKED).
const sql = postgres(env.WORKER_DATABASE_URL, { max: 5, connect_timeout: 10, onnotice: () => {} });
const db = drizzle(sql, { schema });

// BullMQ requires maxRetriesPerRequest: null on the connections its workers use.
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
connection.on('error', (e) => console.error('valkey:', e.message));

// Error monitoring (docs/setup.md, "Error monitoring"): jobs that fail for good (./monitoring.ts),
// the outbox, the Telegram bot and crashes. Off without SENTRY_DSN.
initMonitoring(monitoringConfig(env), 'worker', () => connection);
process.on('unhandledRejection', (reason) => {
  console.error('worker: unhandled rejection:', reason instanceof Error ? reason.message : reason);
  reportError(reason, { tags: { mechanism: 'unhandledRejection' } });
});
process.on('uncaughtException', (e) => {
  // Node's default: log and exit. Coolify restarts the container; the report goes out first.
  console.error('worker: uncaught exception:', e);
  reportError(e, { tags: { mechanism: 'uncaughtException' } });
  void flushMonitoring(2_000).finally(() => process.exit(1));
});

// Event type → handlers, registered by the features in main()
let handlers: OutboxHandlers = {};

let stopping = false;
const abort = new AbortController();

async function pollOutbox(): Promise<void> {
  while (!stopping) {
    let handled = 0;
    try {
      handled = await processOutboxBatch(sql, handlers);
      await writeFile(HEARTBEAT_FILE, String(Date.now()));
    } catch (e) {
      console.error('outbox: poll failed:', e instanceof Error ? e.message : e);
      reportError(e, { tags: { loop: 'outbox' } });
      await sleep(ERROR_BACKOFF_MS);
      continue;
    }
    // A full batch means more are probably waiting: go again at once.
    if (handled < BATCH_SIZE) await sleep(POLL_INTERVAL_MS);
  }
}

async function main(): Promise<void> {
  await connection.ping();
  await sql`SELECT 1`;
  console.log('worker: connected to PostgreSQL and Valkey, polling the outbox');

  const retention = await startRetention(sql, connection);
  const listingJobs = await startListingJobs(db, connection);
  const eventJobs = await startEventJobs(db, connection);
  const chatJobs = await startChatJobs(db, connection, {
    telegram: env.TELEGRAM_BOT_TOKEN ? new TelegramClient(env.TELEGRAM_BOT_TOKEN, abort.signal) : null,
    mailer: notificationMailer({ smtpUrl: env.SMTP_URL, from: env.EMAIL_FROM }),
    appUrl: env.APP_URL,
  });
  const seoJobs = await startSeoJobs(db, connection, env.APP_URL);
  const accountJobs = await startAccountJobs(db, connection);
  const meili = env.MEILI_URL && env.MEILI_WRITE_KEY ? new Meili({ url: env.MEILI_URL, key: env.MEILI_WRITE_KEY }) : null;
  const alertJobs = await startSearchAlertJobs(db, connection, { meili, send: chatJobs.queues, telegram: !!env.TELEGRAM_BOT_TOKEN });
  const searchJobs = await startSearchJobs(db, connection, { meili, afterPublish: alertJobs.afterPublish });
  // Applies payment webhooks; reads subscriptions and invoices back from Stripe
  const paymentJobs = await startPaymentJobs(db, connection, { gateway: env.STRIPE_SECRET_KEY ? new StripeGateway(env.STRIPE_SECRET_KEY) : null });
  // Moderation (roadmap step 8): receipts and notices, the owner's alert, purges after take-downs
  const seoQueue = new Queue('seo', { connection });
  const moderationJobs = await startModerationJobs(db, connection, {
    appUrl: env.APP_URL,
    adminPath: env.ADMIN_PATH,
    send: chatJobs.queues,
    alert: env.N8N_ADMIN_ALERT_URL && env.N8N_WEBHOOK_SECRET ? { url: env.N8N_ADMIN_ALERT_URL, secret: env.N8N_WEBHOOK_SECRET } : null,
    purge: env.CLOUDFLARE_ZONE_ID && env.CLOUDFLARE_PURGE_TOKEN ? { zoneId: env.CLOUDFLARE_ZONE_ID, token: env.CLOUDFLARE_PURGE_TOKEN } : null,
    seo: seoQueue,
    meili,
  });
  handlers = mergeHandlers(listingJobs.handlers, eventJobs.handlers, chatJobs.handlers, accountJobs.handlers, searchJobs.handlers, paymentJobs.handlers, moderationJobs.handlers);
  const done = pollOutbox();
  const bot = env.TELEGRAM_BOT_TOKEN
    ? runTelegramBot(db, connection, env.TELEGRAM_BOT_TOKEN, abort.signal)
    : (console.log('telegram: TELEGRAM_BOT_TOKEN not set, bot disabled'), Promise.resolve());

  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`worker: ${signal}, shutting down`);
    abort.abort();
    await Promise.all([done, bot, retention.close(), listingJobs.close(), eventJobs.close(), chatJobs.close(), seoJobs.close(), accountJobs.close(), searchJobs.close(), alertJobs.close(), paymentJobs.close(), moderationJobs.close(), seoQueue.close()]);
    await Promise.all([sql.end({ timeout: 5 }), flushMonitoring()]);
    await connection.quit();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch(async (e) => {
  console.error('worker: failed to start:', e instanceof Error ? e.message : e);
  reportError(e, { tags: { loop: 'start' } });
  await flushMonitoring();
  process.exit(1);
});
