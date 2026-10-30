import { Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Db } from '../db/drizzle';
import { closeEndedActingSessions } from '../modules/admin/acting';
import { ERASED, ERASE_REQUESTED, eraseRequestedUser } from '../modules/users/erasure';
import type { OutboxHandlers, OutboxJobData } from './outbox';
import { reportJobFailure } from './monitoring';

// Worker jobs for accounts: queue `accounts` erases an account after its owner asked for it
// (src/modules/users/erasure.ts). Retried like the other outbox jobs; a retry after a success
// does nothing. Every minute it also closes sign-in-as sessions that ran out (acting_ended).

const KEEP = { removeOnComplete: 200, removeOnFail: 1_000 };
const RETRY = { attempts: 5, backoff: { type: 'exponential' as const, delay: 10_000 } };

export async function startAccountJobs(db: Db, connection: Redis, opts: { prefix?: string } = {}) {
  const prefix = opts.prefix ? { prefix: opts.prefix } : {};
  const queue = new Queue('accounts', { connection, ...prefix, defaultJobOptions: { ...RETRY, ...KEEP } });
  // Sign-in-as sessions whose time ran out without «پایان» (src/modules/admin/acting.ts)
  await queue.upsertJobScheduler('acting-ended', { every: 60_000 }, { name: 'acting_ended', opts: { removeOnComplete: 5, removeOnFail: 20, attempts: 1 } });
  const own = connection.duplicate();
  const worker = new Worker<OutboxJobData>(
    'accounts',
    async (job) => {
      if (job.name === 'acting_ended') return closeEndedActingSessions(db);
      if (job.name !== 'erase') throw new Error(`accounts: unknown job ${job.name}`);
      const outcome = await eraseRequestedUser(db, job.data.aggregateId);
      console.log(`accounts: erase ${job.data.aggregateId}: ${outcome}`);
      return outcome;
    },
    { connection: own, concurrency: 1, ...prefix },
  );
  worker.on('failed', (job, e) => {
    console.error(`accounts: ${job?.name} failed (attempt ${job?.attemptsMade}):`, e.message);
    reportJobFailure(job, e);
  });

  const handlers: OutboxHandlers = {
    [ERASE_REQUESTED]: [{ name: 'erase', queue }],
    // The avatar file would be deleted here; accounts have no avatars yet
    [ERASED]: [],
  };
  return {
    handlers,
    queue,
    worker,
    close: async () => {
      await worker.close();
      await queue.close();
      await own.quit();
    },
  };
}
