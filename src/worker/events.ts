import { Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Db } from '../db/drizzle';
import { writeWeeklyDigests } from '../modules/events/digest';
import { DEFAULT_TIME_ZONE, EVENT_OUTBOX } from '../modules/events/events';
import type { OutboxHandlers } from './outbox';

// Worker jobs of the events section: the weekly digest (queue `events`, Mondays 08:00 Berlin
// time), which writes one outbox event per country for the planned channel posting. Ending an
// event needs no job of its own: its listing expires at the end of its last date (listing-expiry).

const SCHEDULES = {
  'event-digest': { pattern: '0 8 * * 1', tz: 'Europe/Berlin' },
} as const;

export async function startEventJobs(db: Db, connection: Redis): Promise<{ handlers: OutboxHandlers; close: () => Promise<void> }> {
  const scheduled = new Queue('events', { connection });
  for (const [name, repeat] of Object.entries(SCHEDULES)) {
    await scheduled.upsertJobScheduler(name, repeat, { name, opts: { removeOnComplete: 20, removeOnFail: 50 } });
  }
  const own = connection.duplicate();
  const worker = new Worker(
    'events',
    async (job) => {
      if (job.name !== 'event-digest') throw new Error(`events: unknown job ${job.name}`);
      const n = await writeWeeklyDigests(db, DEFAULT_TIME_ZONE);
      console.log(`events: weekly digest for ${n} countries`);
    },
    { connection: own, concurrency: 1 },
  );
  worker.on('failed', (job, e) => console.error(`events: ${job?.name} failed (attempt ${job?.attemptsMade}):`, e.message));

  // Known, nothing to do yet: the n8n webhook (channel posting) subscribes here later
  const handlers: OutboxHandlers = {
    [EVENT_OUTBOX.published]: [],
    [EVENT_OUTBOX.changed]: [],
    [EVENT_OUTBOX.cancelled]: [],
    [EVENT_OUTBOX.weeklyDigest]: [],
  };
  return {
    handlers,
    close: async () => {
      await worker.close();
      await scheduled.close();
      await own.quit();
    },
  };
}
