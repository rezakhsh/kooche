import { Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import type postgres from 'postgres';
import { purgeAccountData } from '../modules/users/retention';

// Daily retention jobs (docs/schema.md, section 14). A BullMQ job scheduler keeps the schedule in
// Valkey, so a restart doesn't reset it and the old and new worker of a rolling deploy run each
// job only once.

const QUEUE = 'retention';
// 02:30 UTC, before the nightly backup at 03:15
const PATTERN = '30 2 * * *';

export async function startRetention(
  sql: postgres.Sql,
  connection: Redis,
): Promise<{ close: () => Promise<void> }> {
  const queue = new Queue(QUEUE, { connection });
  await queue.upsertJobScheduler(
    'account-retention',
    { pattern: PATTERN, tz: 'UTC' },
    { name: 'account-retention', opts: { removeOnComplete: 30, removeOnFail: 100 } },
  );

  // A Worker blocks on its connection, so it gets its own.
  const workerConnection = connection.duplicate();
  const worker = new Worker(
    QUEUE,
    async (job) => {
      if (job.name !== 'account-retention') throw new Error(`retention: unknown job ${job.name}`);
      const n = await purgeAccountData(sql);
      console.log(
        `retention: deleted ${n.sessions} expired sessions, ${n.verifications} login codes, ` +
          `${n.phoneVerifications} phone verification attempts`,
      );
    },
    { connection: workerConnection, concurrency: 1 },
  );
  worker.on('failed', (job, e) => console.error(`retention: ${job?.name} failed:`, e.message));

  return {
    close: async () => {
      await worker.close();
      await queue.close();
      await workerConnection.quit();
    },
  };
}
