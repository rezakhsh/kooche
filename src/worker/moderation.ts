import { Queue, Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Db } from '../db/drizzle';
import { alertPayload, queueSummary, sendAlert } from '../modules/admin/alert';
import { listingBrowseUrls, purgeUrls } from '../modules/admin/purge';
import { collectStatus, writeStatus } from '../modules/admin/system';
import type { Meili } from '../modules/search/meili';
import { restoreAfterSuspensions } from '../modules/moderation/decide';
import { decisionNotices, phoneReleasedMail, reportReceipt } from '../modules/moderation/notices';
import { LISTING_OUTBOX } from '../modules/listings/events';
import type { PlainEmailJob, PlainTelegramJob } from './chat';
import type { OutboxHandlers, OutboxJobData } from './outbox';

// Worker jobs of moderation (roadmap step 8; docs/setup.md, "Admin page"), queue `moderation`:
// - `report.created`: the reporter's receipt (email), and the owner's alert;
// - `appeal.created`: the owner's alert;
// - `moderation.decided`: the statement to the person concerned (email, and Telegram when the
//   bot can reach them) and the outcome to the reporters (email);
// - `listing.rejected` / `listing.restored`: purge the plain browse pages it was on from
//   Cloudflare (when configured) and rebuild the sitemaps a minute later;
// - every 15 minutes: listings of suspensions that ran out come back;
// - every minute: the system status snapshot for the admin page.
// Emails and Telegram messages go through the chat's send queues (one limiter for the bot).
// The owner's alert waits 2 minutes to gather a burst and goes out at most once per 10 minutes.

const KEEP = { removeOnComplete: 200, removeOnFail: 1_000 };
const RETRY = { attempts: 8, backoff: { type: 'exponential' as const, delay: 10_000 } };

export const ALERT_GATHER_MS = 2 * 60_000;
export const ALERT_EVERY_MS = 10 * 60_000;
const ALERT_LAST_KEY = 'admin-alert:last';

export type ModerationJobOptions = {
  appUrl: string;
  adminPath?: string;
  send: { email: Queue; telegram: Queue };
  alert: { url: string; secret: string } | null;
  purge: { zoneId: string; token: string } | null;
  /** The sitemap queue (`seo`) */
  seo: Queue | null;
  /** For the status snapshot's document count */
  meili?: Meili | null;
  fetchFn?: typeof fetch;
  prefix?: string;
  gatherMs?: number;
};

export async function startModerationJobs(db: Db, connection: Redis, opts: ModerationJobOptions) {
  const prefix = opts.prefix ? { prefix: opts.prefix } : {};
  const queue = new Queue('moderation', { connection, ...prefix, defaultJobOptions: { ...RETRY, ...KEEP } });
  await queue.upsertJobScheduler('suspensions-ended', { every: 15 * 60_000 }, { name: 'suspensions_ended', opts: { removeOnComplete: 20, removeOnFail: 50 } });
  // The admin page's system status (src/modules/admin/system.ts)
  await queue.upsertJobScheduler('system-status', { every: 60_000 }, { name: 'system_status', opts: { removeOnComplete: 5, removeOnFail: 20, attempts: 1 } });
  const gather = opts.gatherMs ?? ALERT_GATHER_MS;

  /** One alert job per ten-minute slot, after a short wait so a burst goes out as one message */
  const scheduleAlert = async () => {
    if (!opts.alert) return;
    const slot = Math.floor(Date.now() / ALERT_EVERY_MS);
    await queue.add('admin_alert', {}, { jobId: `admin_alert_${slot}`, delay: gather });
  };

  const own = connection.duplicate();
  const worker = new Worker<OutboxJobData | Record<string, never>>(
    'moderation',
    async (job: Job) => {
      const data = job.data as OutboxJobData;
      switch (job.name) {
        case 'report_received': {
          const mail = await reportReceipt(db, data.aggregateId);
          if (mail) await opts.send.email.add('plain_email', { mail } satisfies PlainEmailJob, { jobId: `mail_report_${data.aggregateId}` });
          await scheduleAlert();
          return mail ? 'sent' : 'no address';
        }
        case 'appeal_received':
          await scheduleAlert();
          return 'alert';
        case 'notify': {
          const n = await decisionNotices(db, connection, data.aggregateId, opts.appUrl, data.payload.notifyUser !== false);
          if (n.user) {
            await opts.send.email.add('plain_email', { mail: n.user.mail } satisfies PlainEmailJob, { jobId: `mail_decision_${data.aggregateId}` });
            if (n.user.telegram) await opts.send.telegram.add('plain_telegram', n.user.telegram satisfies PlainTelegramJob, { jobId: `tg_decision_${data.aggregateId}` });
          }
          for (const [i, mail] of n.reporters.entries()) await opts.send.email.add('plain_email', { mail } satisfies PlainEmailJob, { jobId: `mail_outcome_${data.aggregateId}_${i}` });
          return `${n.user ? 1 : 0} notice, ${n.reporters.length} reporters`;
        }
        case 'listing_changed': {
          if (opts.seo) await opts.seo.add('sitemaps', {}, { jobId: `sitemaps_moderation_${Math.floor(Date.now() / 60_000)}`, delay: 60_000, removeOnComplete: 20, removeOnFail: 50 });
          if (!opts.purge) return 'no purge';
          const urls = await listingBrowseUrls(db, data.aggregateId, opts.appUrl);
          await purgeUrls(opts.purge.zoneId, opts.purge.token, urls, opts.fetchFn);
          return `purged ${urls.length}`;
        }
        case 'admin_alert': {
          if (!opts.alert) return 'off';
          const since = new Date(Number((await connection.get(ALERT_LAST_KEY)) ?? Date.now() - 3_600_000));
          const now = Date.now();
          const summary = await queueSummary(db, since);
          if (summary.newReports + summary.newAppeals === 0) return 'nothing new';
          await sendAlert(opts.alert.url, opts.alert.secret, alertPayload(summary, opts.appUrl, opts.adminPath), opts.fetchFn);
          await connection.set(ALERT_LAST_KEY, String(now), 'EX', 7 * 86_400);
          return 'sent';
        }
        case 'phone_released': {
          const mail = await phoneReleasedMail(db, data.aggregateId, opts.appUrl);
          if (mail) await opts.send.email.add('plain_email', { mail } satisfies PlainEmailJob, { jobId: `mail_phone_${data.outboxId}` });
          return mail ? 'sent' : 'gone';
        }
        case 'system_status': {
          await writeStatus(connection, await collectStatus(db, connection, opts.meili ?? null, opts.prefix));
          return 'written';
        }
        case 'suspensions_ended': {
          const n = await restoreAfterSuspensions(db);
          if (n) console.log(`moderation: ${n} listings back after suspensions ended`);
          return n;
        }
        default:
          throw new Error(`moderation: unknown job ${job.name}`);
      }
    },
    { connection: own, concurrency: 2, ...prefix },
  );
  worker.on('failed', (job, e) => console.error(`moderation: ${job?.name} failed (attempt ${job?.attemptsMade}):`, e.message));

  const handlers: OutboxHandlers = {
    'report.created': [{ name: 'report_received', queue }],
    'appeal.created': [{ name: 'appeal_received', queue }],
    'moderation.decided': [{ name: 'notify', queue }],
    'user.phone_released': [{ name: 'phone_released', queue }],
    [LISTING_OUTBOX.rejected]: [{ name: 'listing_changed', queue }],
    [LISTING_OUTBOX.restored]: [{ name: 'listing_changed', queue }],
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
