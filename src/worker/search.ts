import { DelayedError, Queue, Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Db } from '../db/drizzle';
import { cachedCatalog } from '../modules/listings/catalog';
import { EVENT_OUTBOX } from '../modules/events/events';
import { LISTING_OUTBOX } from '../modules/listings/events';
import { indexCode, LISTINGS_INDEX } from '../modules/search/documents';
import type { Meili } from '../modules/search/meili';
import { phraseCode, rebuildPhrases, SUGGESTIONS_INDEX } from '../modules/search/phrases';
import { indexState, rebuildIndex, syncListings } from '../modules/search/sync';
import type { OutboxHandlers, OutboxJobData } from './outbox';

// The Meilisearch index (docs/setup.md, "Keyword search and saved searches"), on queue
// `search-sync` with concurrency 1, so a publish and a quick delete can never overtake each other
// and a rebuild never runs next to single writes (they wait and correct whatever changed during it):
// - `search_sync` (from the outbox): every listing and event change; the listing is re-read.
// - `reindex`: at start when the index is missing or outdated, and nightly at 04:00 UTC (after the
//   03:15 backup), which also repairs anything missed while Meilisearch was down.
// - `task-cleanup`: daily, deletes Meilisearch's finished tasks older than 7 days.
// - `suggest-rebuild`: the phrase index of suggestions while typing (src/modules/search/phrases.ts),
//   at start, a minute after listing changes (one job gathers a burst of them) and every 15
//   minutes; skipped when its records wouldn't change.
// Start-up rebuilds carry the stamp of the code that asked for them (indexCode(), phraseCode()).
// During a deploy Coolify keeps the old worker running until the new one is healthy, and both take
// jobs from the queue: the old code would rebuild the index in its own, outdated shape. A worker
// whose stamp differs puts such a job back for STAMP_RETRY_MS, until the worker that asked takes it;
// after STAMP_WAIT_MS (that worker is gone) any worker runs it. Scheduled and change-driven jobs
// carry no stamp; one an old worker ran during a deploy is corrected by the next rebuild, which
// sees another stamp in the index.
// After a listing is published and indexed, `afterPublish` hands it to the saved-search matching.
// Without MEILI_URL the queue still runs, writes nothing and hands publications on.

const SCHEDULES = {
  reindex: { pattern: '0 4 * * *', tz: 'UTC' },
  'task-cleanup': { pattern: '30 4 * * *', tz: 'UTC' },
  'suggest-rebuild': { pattern: '*/15 * * * *', tz: 'UTC' },
} as const;

/** After a listing change, the phrase counts are rebuilt this much later, once for all changes meanwhile */
export const SUGGEST_DELAY_MS = 60_000;
const SUGGEST_SOON = { jobId: 'suggest-rebuild-soon', delay: SUGGEST_DELAY_MS, attempts: 3, backoff: { type: 'exponential' as const, delay: 10_000 }, removeOnComplete: true, removeOnFail: true };

const RETRY = { attempts: 8, backoff: { type: 'exponential' as const, delay: 10_000 } };
const KEEP = { removeOnComplete: 200, removeOnFail: 1_000 };
const TASKS_KEPT_MS = 7 * 86_400_000;

/** Event types whose listing may have entered or left the index or changed in it */
export const SYNC_EVENTS = [
  LISTING_OUTBOX.published,
  LISTING_OUTBOX.updated,
  LISTING_OUTBOX.submitted,
  LISTING_OUTBOX.paused,
  LISTING_OUTBOX.resumed,
  LISTING_OUTBOX.sold,
  LISTING_OUTBOX.expired,
  LISTING_OUTBOX.renewed,
  LISTING_OUTBOX.rejected,
  LISTING_OUTBOX.deleted,
  EVENT_OUTBOX.published,
  EVENT_OUTBOX.changed,
  EVENT_OUTBOX.cancelled,
] as const;

export const STAMP_RETRY_MS = 10_000;
export const STAMP_WAIT_MS = 30 * 60_000;

/** A start-up rebuild's data: why, which code asked for it, and when */
export type StartupJobData = { reason: string; code: string; queuedAt: number };

/** Whether this worker should leave the job to the code that queued it (and for how long at most) */
export function leaveToOtherCode(data: Partial<StartupJobData> | undefined, own: string, now = Date.now()): boolean {
  return !!data?.code && data.code !== own && now - (data.queuedAt ?? 0) < STAMP_WAIT_MS;
}

export type SearchJobOptions = {
  meili: Meili | null;
  index?: string;
  suggestIndex?: string;
  /** Tests: the delay before the phrase counts follow a change */
  suggestDelayMs?: number;
  /** Called once a newly published listing is in the index (saved-search matching) */
  afterPublish?: (listingId: string) => Promise<void>;
  /** Tests: a BullMQ key prefix of their own, no schedules, no start-up check */
  prefix?: string;
  /** Tests: how long a job from other code is put back */
  stampRetryMs?: number;
  schedules?: boolean;
};

export async function startSearchJobs(db: Db, connection: Redis, opts: SearchJobOptions) {
  const index = opts.index ?? LISTINGS_INDEX;
  const suggestIndex = opts.suggestIndex ?? SUGGESTIONS_INDEX;
  const soon = { ...SUGGEST_SOON, delay: opts.suggestDelayMs ?? SUGGEST_DELAY_MS };
  const prefix = opts.prefix ? { prefix: opts.prefix } : {};
  const queue = new Queue('search-sync', { connection, ...prefix, defaultJobOptions: { ...RETRY, ...KEEP } });
  if (opts.schedules !== false) {
    for (const [name, repeat] of Object.entries(SCHEDULES)) {
      await queue.upsertJobScheduler(name, repeat, { name, opts: { removeOnComplete: 20, removeOnFail: 50 } });
    }
  }

  const { meili } = opts;
  const own = connection.duplicate();
  const worker = new Worker(
    'search-sync',
    async (job: Job, token?: string) => {
      const own = job.name === 'reindex' ? indexCode() : job.name === 'suggest-rebuild' ? phraseCode() : null;
      if (own && leaveToOtherCode(job.data, own)) {
        await job.moveToDelayed(Date.now() + (opts.stampRetryMs ?? STAMP_RETRY_MS), token);
        throw new DelayedError();
      }
      if (job.name === 'search_sync') {
        const data = job.data as OutboxJobData;
        const published = data.eventType === LISTING_OUTBOX.published;
        if (meili) {
          const r = await syncListings(db, meili, index, await cachedCatalog(db), [data.aggregateId]);
          // Matching asks the index about this listing, so it must be in it first
          if (published && r.upserted.length) for (const t of r.tasks) await meili.wait(t);
          // Already waiting (same job id): this change joins it
          await queue.add('suggest-rebuild', { reason: 'changes' }, soon);
        }
        if (published && opts.afterPublish) await opts.afterPublish(data.aggregateId);
      } else if (job.name === 'reindex') {
        if (!meili) return;
        const started = Date.now();
        const n = await rebuildIndex(db, meili, index, await cachedCatalog(db));
        console.log(`search: index rebuilt (${job.data?.reason ?? 'nightly'}): ${n} documents, ${Date.now() - started} ms`);
      } else if (job.name === 'suggest-rebuild') {
        if (!meili) return;
        const started = Date.now();
        const n = await rebuildPhrases(db, meili, suggestIndex, await cachedCatalog(db));
        if (n !== null) console.log(`search: suggestions rebuilt (${job.data?.reason ?? 'schedule'}): ${n} phrases, ${Date.now() - started} ms`);
      } else if (job.name === 'task-cleanup') {
        if (meili) await meili.deleteTasks(new Date(Date.now() - TASKS_KEPT_MS));
      } else throw new Error(`search: unknown job ${job.name}`);
    },
    { connection: own, concurrency: 1, ...prefix },
  );
  worker.on('failed', (job, e) => console.error(`search: ${job?.name} failed (attempt ${job?.attemptsMade}):`, e.message));

  // At start: rebuild when the index can't be used as it is. A Meilisearch that doesn't answer is
  // only logged; the nightly rebuild and the retries of single writes catch up later.
  if (meili && opts.schedules !== false) {
    const startup = (reason: string, code: string): StartupJobData => ({ reason, code, queuedAt: Date.now() });
    await queue.add('suggest-rebuild', startup('start', phraseCode()), { removeOnComplete: true, removeOnFail: 50 });
    try {
      const state = await indexState(db, meili, index);
      if (state !== 'ok') {
        console.log(`search: index ${state}, rebuilding`);
        await queue.add('reindex', startup(state, indexCode()), { removeOnComplete: true, removeOnFail: 50 });
      }
    } catch (e) {
      console.error('search: start-up check failed:', e instanceof Error ? e.message : e);
    }
  } else if (!meili) {
    console.log('search: MEILI_URL not set, keyword search runs on PostgreSQL');
  }

  const toSync = [{ name: 'search_sync', queue }];
  const handlers: OutboxHandlers = Object.fromEntries(SYNC_EVENTS.map((t) => [t, toSync]));
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
