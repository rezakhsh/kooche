import { Redis } from 'ioredis';
import { writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import postgres from 'postgres';
import { workerEnv } from '../lib/env';
import { type OutboxHandlers, BATCH_SIZE, processOutboxBatch } from './outbox';

// Background worker entry point: one process that polls the outbox and (as features arrive) runs
// the BullMQ job processors. Bundled to dist/worker.js for the `worker` Docker target.

const POLL_INTERVAL_MS = 1_000;
const ERROR_BACKOFF_MS = 5_000;
// Touched after every poll; the Docker HEALTHCHECK fails when it gets stale.
const HEARTBEAT_FILE = '/tmp/worker-heartbeat';

const env = workerEnv();

// Direct connection, as classifieds_worker (never through a pooler: FOR UPDATE SKIP LOCKED).
const sql = postgres(env.WORKER_DATABASE_URL, { max: 5, connect_timeout: 10, onnotice: () => {} });

// BullMQ requires maxRetriesPerRequest: null on the connections its workers use.
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
connection.on('error', (e) => console.error('valkey:', e.message));

// Event type → handlers. Empty until the first feature that writes outbox events.
const handlers: OutboxHandlers = {};

let stopping = false;

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

  const done = pollOutbox();

  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`worker: ${signal}, shutting down`);
    await done;
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
