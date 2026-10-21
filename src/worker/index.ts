import { drizzle } from 'drizzle-orm/postgres-js';
import { Redis } from 'ioredis';
import { writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import postgres from 'postgres';
import * as schema from '../db/schema';
import { workerEnv } from '../lib/env';
import { notificationMailer } from '../modules/notifications/mailer';
import { TelegramClient } from '../modules/notifications/telegram-api';
import { type OutboxHandlers, BATCH_SIZE, mergeHandlers, processOutboxBatch } from './outbox';
import { startAccountJobs } from './accounts';
import { startChatJobs } from './chat';
import { startEventJobs } from './events';
import { startListingJobs } from './listings';
import { startRetention } from './retention';
import { startSeoJobs } from './seo';
import { runTelegramBot } from './telegram';

// Background worker entry point: one process that polls the outbox, runs the phone verification
// Telegram bot, the chat jobs and notices, account erasure, the daily retention jobs, the hourly sitemaps and (as
// features arrive) other BullMQ job processors.
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
  handlers = mergeHandlers(listingJobs.handlers, eventJobs.handlers, chatJobs.handlers, accountJobs.handlers);
  const done = pollOutbox();
  const bot = env.TELEGRAM_BOT_TOKEN
    ? runTelegramBot(db, connection, env.TELEGRAM_BOT_TOKEN, abort.signal)
    : (console.log('telegram: TELEGRAM_BOT_TOKEN not set, bot disabled'), Promise.resolve());

  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`worker: ${signal}, shutting down`);
    abort.abort();
    await Promise.all([done, bot, retention.close(), listingJobs.close(), eventJobs.close(), chatJobs.close(), seoJobs.close(), accountJobs.close()]);
    await Promise.all([sql.end({ timeout: 5 }), connection.quit()]);
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((e) => {
  console.error('worker: failed to start:', e instanceof Error ? e.message : e);
  process.exit(1);
});
