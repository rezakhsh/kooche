import { Queue, Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Db } from '../db/drizzle';
import { workerEnv } from '../lib/env';
import { expireDueListings } from '../modules/listings/listings';
import { flushViews } from '../modules/listings/views';
import { cleanupAbandonedUploads } from '../modules/media/cleanup';
import { deleteDecidedDocuments } from '../modules/organizations/verification';
import { storageFromEnv } from '../modules/media/config';
import { markImageFailed, processImage } from '../modules/media/process';
import { runListingChecks } from '../modules/moderation/checks';
import { LOGO_OUTBOX, processLogo } from '../modules/organizations/logo';
import { sendExpiryReminders } from '../modules/notifications/expiry-reminder';
import { notificationMailer } from '../modules/notifications/mailer';
import { testInbox } from '../modules/users/test-accounts';
import type { OutboxHandlers, OutboxJobData } from './outbox';
import { reportJobFailure } from './monitoring';
import { EVERY_HOUR, scheduledTime } from '../modules/notifications/local-hour';
import { sendRewardNotices } from '../modules/launch/rewards';
import { purgeDeletedListings } from '../modules/listings/purge';

// Worker jobs of the posting feature:
// - queue `media` (from the outbox): process an uploaded photo or business logo, delete a removed
//   photo's or logo's file.
//   Concurrency 1: one image in memory at a time (4 GB server).
// - queue `listing-checks` (from the outbox): the post-checks after publish, edit, photo change
//   and resubmission (src/modules/moderation/checks.ts).
// - queue `listings` (job schedulers): expiry every 15 minutes, the expiry reminder daily at
//   09:00 on the seller's clock (run hourly, wave 2 part 7), the waitlist reward's "ready" email
//   at 09:00 on the city's clock (wave 2 part 9), the cleanup of abandoned uploads (and of verification documents 7 days after
//   the decision) daily at 02:45 UTC, the purge of listings deleted 12 months ago daily at 02:50
//   UTC, the listing views
//   counted in Valkey written to PostgreSQL every 5 minutes.

const RETRY = { attempts: 5, backoff: { type: 'exponential' as const, delay: 10_000 } };
const KEEP = { removeOnComplete: 100, removeOnFail: 500 };

const SCHEDULES = {
  'listing-expiry': { pattern: '*/15 * * * *', tz: 'UTC' },
  'expiry-reminder': EVERY_HOUR,
  'reward-notices': EVERY_HOUR,
  'upload-cleanup': { pattern: '45 2 * * *', tz: 'UTC' },
  'listing-purge': { pattern: '50 2 * * *', tz: 'UTC' },
  'view-flush': { pattern: '*/5 * * * *', tz: 'UTC' },
} as const;

export async function startListingJobs(
  db: Db,
  connection: Redis,
): Promise<{ handlers: OutboxHandlers; close: () => Promise<void> }> {
  const env = workerEnv();
  const storage = storageFromEnv(env);
  const mailer = notificationMailer({ smtpUrl: env.SMTP_URL, from: env.EMAIL_FROM, route: testInbox(db, env.TEST_INBOX_EMAIL).mail });

  const media = new Queue('media', { connection, defaultJobOptions: { ...RETRY, ...KEEP } });
  const checks = new Queue('listing-checks', { connection, defaultJobOptions: { ...RETRY, ...KEEP } });
  const scheduled = new Queue('listings', { connection });
  for (const [name, repeat] of Object.entries(SCHEDULES)) {
    await scheduled.upsertJobScheduler(name, repeat, { name, opts: { removeOnComplete: 50, removeOnFail: 100 } });
  }

  const needStorage = () => {
    if (!storage) throw new Error('S3_* is not configured, photos cannot be processed');
    return storage;
  };

  // A Worker blocks on its connection, so each gets its own
  const connections = [connection.duplicate(), connection.duplicate(), connection.duplicate()];
  const workers = [
    new Worker<OutboxJobData>(
      'media',
      async (job) => {
        if (job.name === 'media_process') {
          const outcome = await processImage(db, needStorage(), job.data.aggregateId);
          console.log(`media: ${job.data.aggregateId}: ${outcome.status}${'reason' in outcome ? ` (${outcome.reason})` : ''}`);
        } else if (job.name === 'logo_process') {
          const key = job.data.payload.uploadKey;
          if (typeof key !== 'string') return;
          const outcome = await processLogo(db, needStorage(), job.data.aggregateId, key);
          console.log(`media: logo of ${job.data.aggregateId}: ${outcome.status}${'reason' in outcome ? ` (${outcome.reason})` : ''}`);
        } else if (job.name === 'media_delete') {
          const key = job.data.payload.storageKey;
          if (typeof key === 'string') await needStorage().delete(key);
        } else throw new Error(`media: unknown job ${job.name}`);
      },
      { connection: connections[0]!, concurrency: 1 },
    ),
    new Worker<OutboxJobData>(
      'listing-checks',
      async (job) => {
        const result = await runListingChecks(db, job.data.aggregateId);
        if (result !== 'passed' && result !== 'skipped') console.log(`checks: ${job.data.aggregateId}: ${result}`);
      },
      { connection: connections[1]!, concurrency: 2 },
    ),
    new Worker(
      'listings',
      async (job) => {
        if (job.name === 'listing-expiry') {
          const n = await expireDueListings(db);
          if (n) console.log(`listings: expired ${n} listings`);
        } else if (job.name === 'expiry-reminder') {
          const n = await sendExpiryReminders(db, connection, mailer, env.APP_URL, scheduledTime(job), { localHour: 9 });
          if (n.emails) console.log(`listings: expiry reminders: ${n.emails} emails about ${n.listings} listings`);
        } else if (job.name === 'reward-notices') {
          const n = await sendRewardNotices(db, mailer, env.APP_URL, scheduledTime(job));
          if (n) console.log(`listings: ${n} waitlist reward emails`);
        } else if (job.name === 'listing-purge') {
          // Deleted listings after 12 months, with their photos (src/modules/listings/purge.ts)
          const n = await purgeDeletedListings(db, storage);
          console.log(`listings: purged ${n.purged} deleted listings, ${n.photos} photos`);
        } else if (job.name === 'view-flush') {
          await flushViews(connection, db);
        } else if (job.name === 'upload-cleanup') {
          const n = storage ? await cleanupAbandonedUploads(db, storage) : 0;
          console.log(`listings: removed ${n} abandoned uploads`);
          // Verification documents 7 days after the decision (src/modules/organizations/verification.ts)
          const docs = storage ? await deleteDecidedDocuments(db, storage) : 0;
          if (docs) console.log(`listings: deleted ${docs} verification documents`);
        } else throw new Error(`listings: unknown job ${job.name}`);
      },
      { connection: connections[2]!, concurrency: 1 },
    ),
  ];

  const onFailed = (job: Job<OutboxJobData> | undefined, e: Error) => {
    console.error(`${job?.queueName}: ${job?.name} failed (attempt ${job?.attemptsMade}):`, e.message);
    reportJobFailure(job, e);
    // After the last retry, the photo is marked failed so the seller sees it and can remove it
    if (job?.name === 'media_process' && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      void markImageFailed(db, job.data.aggregateId).catch(() => {});
    }
  };
  for (const w of workers) w.on('failed', onFailed);

  const toChecks = [{ name: 'listing_checks', queue: checks }];
  const handlers: OutboxHandlers = {
    'listing_image.uploaded': [{ name: 'media_process', queue: media }],
    'listing_image.deleted': [{ name: 'media_delete', queue: media }],
    [LOGO_OUTBOX.uploaded]: [{ name: 'logo_process', queue: media }],
    [LOGO_OUTBOX.deleted]: [{ name: 'media_delete', queue: media }],
    'listing.published': toChecks,
    'listing.updated': toChecks,
    'listing.submitted': toChecks,
    // Search sync subscribes to these too (./search.ts); nothing else needs them yet
    'listing.created': [],
    'listing.paused': [],
    'listing.resumed': [],
    'listing.sold': [],
    'listing.expired': [],
    'listing.renewed': [],
    'listing.rejected': [],
    'listing.deleted': [],
  };

  return {
    handlers,
    close: async () => {
      await Promise.all(workers.map((w) => w.close()));
      await Promise.all([media.close(), checks.close(), scheduled.close()]);
      await Promise.all(connections.map((c) => c.quit()));
    },
  };
}
