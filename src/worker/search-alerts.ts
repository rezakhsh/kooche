import { Queue, Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Db } from '../db/drizzle';
import { cachedCatalog } from '../modules/listings/catalog';
import { claimAlert, dueForDaily, matchListing, noticeDelay, purgeHits, type AlertJob, type Channel } from '../modules/search/alerts';
import { LISTINGS_INDEX } from '../modules/search/documents';
import type { Meili } from '../modules/search/meili';
import { reportJobFailure } from './monitoring';

// Saved-search notices (src/modules/search/alerts.ts), on queue `search-alerts`:
// - `match`: a listing was published and indexed (handed over by ./search.ts); records the
//   searches it matches and schedules a notice for each instant one, GATHER_MS later or once
//   the search's debounce is over. The job id is per search, so matches arriving meanwhile
//   join the notice that is already waiting.
// - `notify`: takes the search's waiting matches and queues the message on the shared send queues
//   (./chat.ts): Telegram, email or both, as the person's switches say (wave 1). During their
//   quiet hours it waits for the morning.
// - `daily` (18:00 Berlin time): the daily searches' notices, instant ones whose job was lost,
//   and the purge of matches older than 30 days. A person who bundles gets one message for all
//   their searches.

const SCHEDULES = {
  daily: { pattern: '0 18 * * *', tz: 'Europe/Berlin' },
} as const;

const RETRY = { attempts: 5, backoff: { type: 'exponential' as const, delay: 10_000 } };

export type AlertJobOptions = {
  meili: Meili | null;
  index?: string;
  /** The shared send queues of ./chat.ts */
  send: { telegram: Queue; email: Queue };
  /** Without a Telegram bot every notice goes by email */
  telegram: boolean;
  /** Quiet hours for people without a saved place (APP_TIME_ZONE) */
  timeZone?: string;
  /** Tests */
  prefix?: string;
  schedules?: boolean;
  now?: () => Date;
};

export async function startSearchAlertJobs(db: Db, connection: Redis, opts: AlertJobOptions) {
  const prefix = opts.prefix ? { prefix: opts.prefix } : {};
  const now = opts.now ?? (() => new Date());
  const queue = new Queue('search-alerts', { connection, ...prefix, defaultJobOptions: { ...RETRY, removeOnComplete: 200, removeOnFail: 500 } });
  if (opts.schedules !== false) {
    for (const [name, repeat] of Object.entries(SCHEDULES)) {
      await queue.upsertJobScheduler(name, repeat, { name, opts: { removeOnComplete: 20, removeOnFail: 50 } });
    }
  }

  /** One waiting notice per search: a second add with the same id is ignored until it ran */
  const schedule = (savedSearchId: string, delay: number, suffix = '') =>
    queue.add('notify', { savedSearchId }, { jobId: `notify_${savedSearchId}${suffix}`, delay, removeOnComplete: true, removeOnFail: true });

  /** Puts a notice on the send queues: Telegram, email or both */
  const enqueue = async (job: AlertJob, channels: Channel[], key: string) => {
    const email = channels.includes('email');
    if (channels.includes('telegram') && opts.telegram) {
      await opts.send.telegram.add('search_telegram', { ...job, emailToo: email }, { jobId: `tg_${key}` });
      if (email) await opts.send.email.add('search_email', job, { jobId: `mail_${key}` });
    } else await opts.send.email.add('search_email', job, { jobId: `mail_${key}` });
  };

  /** `bundles`: the daily run collects bundling people's notices here and sends one per person */
  const send = async (savedSearchId: string, mode: 'instant' | 'daily', bundles?: Map<string, { jobs: AlertJob[]; channels: Channel[] }>) => {
    const claim = await claimAlert(db, connection, savedSearchId, now(), mode, opts.timeZone);
    if ('later' in claim) {
      await schedule(savedSearchId, claim.later, `_${now().getTime()}`);
      return 'later';
    }
    if ('skip' in claim) return claim.skip;
    if (claim.bundle && bundles) {
      const b = bundles.get(claim.job.userId) ?? { jobs: [], channels: claim.send };
      b.jobs.push(claim.job);
      bundles.set(claim.job.userId, b);
      return claim.send.join('+');
    }
    await enqueue(claim.job, claim.send, `${savedSearchId}_${now().getTime()}`);
    return claim.send.join('+');
  };

  const own = connection.duplicate();
  const worker = new Worker(
    'search-alerts',
    async (job: Job) => {
      if (job.name === 'match') {
        const hits = await matchListing(db, await cachedCatalog(db), job.data.listingId, { meili: opts.meili, index: opts.index ?? LISTINGS_INDEX });
        for (const h of hits) if (h.frequency === 'instant') await schedule(h.savedSearchId, noticeDelay(h.lastNotifiedAt, now()));
        return hits.length;
      }
      if (job.name === 'notify') return send(job.data.savedSearchId, 'instant');
      if (job.name === 'daily') {
        const due = await dueForDaily(db, now());
        const bundles = new Map<string, { jobs: AlertJob[]; channels: Channel[] }>();
        let sent = 0;
        for (const id of due) {
          const r = await send(id, 'daily', bundles);
          if (r.includes('telegram') || r.includes('email')) sent++;
        }
        for (const [userId, b] of bundles) {
          const [first, ...more] = b.jobs;
          await enqueue({ ...first!, more }, b.channels, `digest_${userId}_${now().getTime()}`);
        }
        const purged = await purgeHits(db, now());
        console.log(`search: daily alerts: ${sent} of ${due.length} searches notified, ${purged} old matches deleted`);
        return sent;
      }
      throw new Error(`search-alerts: unknown job ${job.name}`);
    },
    { connection: own, ...prefix, concurrency: 2 },
  );
  worker.on('failed', (job, e) => {
    console.error(`search-alerts: ${job?.name} failed (attempt ${job?.attemptsMade}):`, e.message);
    reportJobFailure(job, e);
  });

  return {
    queue,
    worker,
    /** For ./search.ts: a published listing is in the index now */
    afterPublish: async (listingId: string) => {
      await queue.add('match', { listingId }, { jobId: `match_${listingId}_${now().getTime()}` });
    },
    close: async () => {
      await worker.close();
      await queue.close();
      await own.quit();
    },
  };
}
