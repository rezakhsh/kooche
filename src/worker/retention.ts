import { Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import type postgres from 'postgres';
import { purgeEventData, purgeHistory } from '../db/retention';
import { purgeChatsOfDeletedUsers } from '../modules/chat/retention';
import { purgeAccountData } from '../modules/users/retention';
import { reportJobFailure } from './monitoring';

// Daily retention jobs (docs/schema.md, section 14). A BullMQ job scheduler keeps the schedule in
// Valkey, so a restart doesn't reset it and the old and new worker of a rolling deploy run each
// job only once. All jobs share one pattern; concurrency 1 runs them one after another, and a
// failing job doesn't stop the others.

const QUEUE = 'retention';
// 02:30 UTC, before the nightly backup at 03:15
const PATTERN = '30 2 * * *';

// Job name → one run, returning the log line with its counts
const JOBS: Record<string, (sql: postgres.Sql) => Promise<string>> = {
  'account-retention': async (sql) => {
    const n = await purgeAccountData(sql);
    return (
      `deleted ${n.sessions} expired sessions, ${n.verifications} login codes, ` +
      `${n.phoneVerifications} phone verification attempts`
    );
  },
  'event-retention': async (sql) => {
    const n = await purgeEventData(sql);
    return `deleted ${n.outboxEvents} processed outbox events, ${n.webhookEvents} processed webhook events`;
  },
  'history-retention': async (sql) => {
    const n = await purgeHistory(sql);
    return (
      `deleted ${n.auditRows} audit log rows, scrubbed ${n.auditIpsScrubbed} audit IP addresses, ` +
      `deleted ${n.reports} reports, ${n.moderationDecisions} moderation decisions`
    );
  },
  'chat-retention': async (sql) => {
    const n = await purgeChatsOfDeletedUsers(sql);
    return `deleted ${n} conversations of accounts deleted more than 90 days ago`;
  },
};

export async function startRetention(
  sql: postgres.Sql,
  connection: Redis,
): Promise<{ close: () => Promise<void> }> {
  const queue = new Queue(QUEUE, { connection });
  for (const name of Object.keys(JOBS)) {
    await queue.upsertJobScheduler(
      name,
      { pattern: PATTERN, tz: 'UTC' },
      { name, opts: { removeOnComplete: 30, removeOnFail: 100 } },
    );
  }

  // A Worker blocks on its connection, so it gets its own.
  const workerConnection = connection.duplicate();
  const worker = new Worker(
    QUEUE,
    async (job) => {
      const run = JOBS[job.name];
      if (!run) throw new Error(`retention: unknown job ${job.name}`);
      console.log(`retention: ${job.name}: ${await run(sql)}`);
    },
    { connection: workerConnection, concurrency: 1 },
  );
  worker.on('failed', (job, e) => {
    console.error(`retention: ${job?.name} failed:`, e.message);
    reportJobFailure(job, e);
  });

  return {
    close: async () => {
      await worker.close();
      await queue.close();
      await workerConnection.quit();
    },
  };
}
