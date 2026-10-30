import { Queue, Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Db } from '../db/drizzle';
import { alertPayload, queueSummary, sendAlert, softwarePayload } from '../modules/admin/alert';
import { checkSoftware, claimNewWarnings, writeSoftwareReport } from '../modules/admin/software';
import { listingBrowseUrls, purgeUrls } from '../modules/admin/purge';
import { collectStatus, writeStatus } from '../modules/admin/system';
import type { Meili } from '../modules/search/meili';
import { restoreAfterSuspensions } from '../modules/moderation/decide';
import { businessCaseMail, decisionNotices, phoneReleasedMail, reportReceipt, signedOutMail, staffActedMail, staffRoleMail } from '../modules/moderation/notices';
import { cachedCatalog } from '../modules/listings/catalog';
import { closeSwitched, findSuspicions } from '../modules/organizations/suspicions';
import { LISTING_OUTBOX } from '../modules/listings/events';
import type { PlainEmailJob, PlainTelegramJob } from './chat';
import type { OutboxHandlers, OutboxJobData } from './outbox';
import { reportJobFailure } from './monitoring';

// Worker jobs of moderation (roadmap step 8; docs/setup.md, "Admin page"), queue `moderation`:
// - `report.created`: the reporter's receipt (email), and the owner's alert;
// - `appeal.created`: the owner's alert;
// - `moderation.decided`: the statement to the person concerned (email, and Telegram when the
//   bot can reach them) and the outcome to the reporters (email);
// - `listing.rejected` / `listing.restored`: purge the plain browse pages it was on from
//   Cloudflare (when configured) and rebuild the sitemaps a minute later;
// - every 15 minutes: listings of suspensions that ran out come back;
// - every minute: the system status snapshot for the admin page;
// - Mondays at 05:00 UTC and a few minutes after each start: the software update check
//   (src/modules/admin/software.ts) and the owner's alert for new security fixes;
// - daily at 03:40 UTC: «احتمالاً کسب‌وکار» cases found, and closed for those who opened a business
//   (src/modules/organizations/suspicions.ts); `user.business_*`: the person's email about their case.
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
  /** The software update check; off in tests */
  software?: { lockfile?: string; nodeVersion?: string } | null;
};

export async function startModerationJobs(db: Db, connection: Redis, opts: ModerationJobOptions) {
  const prefix = opts.prefix ? { prefix: opts.prefix } : {};
  const queue = new Queue('moderation', { connection, ...prefix, defaultJobOptions: { ...RETRY, ...KEEP } });
  await queue.upsertJobScheduler('suspensions-ended', { every: 15 * 60_000 }, { name: 'suspensions_ended', opts: { removeOnComplete: 20, removeOnFail: 50 } });
  // The admin page's system status (src/modules/admin/system.ts)
  await queue.upsertJobScheduler('system-status', { every: 60_000 }, { name: 'system_status', opts: { removeOnComplete: 5, removeOnFail: 20, attempts: 1 } });
  await queue.upsertJobScheduler('business-scan', { pattern: '40 3 * * *', tz: 'UTC' }, { name: 'business_scan', opts: { removeOnComplete: 20, removeOnFail: 50 } });
  if (opts.software) {
    await queue.upsertJobScheduler('software-check', { pattern: '0 5 * * 1', tz: 'UTC' }, { name: 'software_check', opts: { removeOnComplete: 10, removeOnFail: 20, attempts: 3, backoff: { type: 'exponential', delay: 60_000 } } });
    // After a deploy the versions changed: check again, at most once an hour
    await queue.add('software_check', {}, { jobId: `software_check_start_${Math.floor(Date.now() / 3_600_000)}`, delay: 3 * 60_000, removeOnComplete: 10, removeOnFail: 20, attempts: 1 });
  }
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
          // Each message once, also when a retry starts again after the send queues forgot the
          // first (they keep 200 finished jobs; code check, Oct 30, 2026)
          const once = async (key: string, add: () => Promise<unknown>) => {
            if ((await connection.set(`notice-sent:${key}`, '1', 'EX', 30 * 86_400, 'NX')) !== 'OK') return;
            try {
              await add();
            } catch (e) {
              await connection.del(`notice-sent:${key}`);
              throw e;
            }
          };
          if (n.user) {
            const user = n.user;
            await once(`mail_decision_${data.aggregateId}`, () => opts.send.email.add('plain_email', { mail: user.mail } satisfies PlainEmailJob, { jobId: `mail_decision_${data.aggregateId}` }));
            if (user.telegram) await once(`tg_decision_${data.aggregateId}`, () => opts.send.telegram.add('plain_telegram', user.telegram! satisfies PlainTelegramJob, { jobId: `tg_decision_${data.aggregateId}` }));
          }
          for (const [i, mail] of n.reporters.entries()) await once(`mail_outcome_${data.aggregateId}_${i}`, () => opts.send.email.add('plain_email', { mail } satisfies PlainEmailJob, { jobId: `mail_outcome_${data.aggregateId}_${i}` }));
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
        case 'staff_acted': {
          const mail = await staffActedMail(db, data.aggregateId, opts.appUrl);
          if (mail) await opts.send.email.add('plain_email', { mail } satisfies PlainEmailJob, { jobId: `mail_acted_${data.outboxId}` });
          return mail ? 'sent' : 'gone';
        }
        case 'staff_role_changed': {
          const change = (data.payload ?? {}) as { from: string | null; to: string | null };
          const mail = await staffRoleMail(db, data.aggregateId, { from: change.from ?? null, to: change.to ?? null }, opts.appUrl);
          if (mail) await opts.send.email.add('plain_email', { mail } satisfies PlainEmailJob, { jobId: `mail_role_${data.outboxId}` });
          return mail ? 'sent' : 'gone';
        }
        case 'signed_out': {
          const mail = await signedOutMail(db, data.aggregateId, opts.appUrl);
          if (mail) await opts.send.email.add('plain_email', { mail } satisfies PlainEmailJob, { jobId: `mail_signed_out_${data.outboxId}` });
          return mail ? 'sent' : 'gone';
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
        case 'software_check': {
          const report = await checkSoftware(db, connection, { ...opts.software, fetchFn: opts.fetchFn });
          await writeSoftwareReport(connection, report);
          if (report.errors.length) console.log(`moderation: software check, not reached: ${report.errors.join('; ')}`);
          if (!opts.alert) return { updates: report.items.length, alert: 'off' };
          const fresh = await claimNewWarnings(connection, report.items);
          if (fresh.items.length) {
            try {
              await sendAlert(opts.alert.url, opts.alert.secret, softwarePayload(fresh.items, opts.appUrl, opts.adminPath), opts.fetchFn);
            } catch (e) {
              await fresh.release();
              throw e;
            }
          }
          return { updates: report.items.length, alerted: fresh.items.length };
        }
        case 'business_scan': {
          const closed = await closeSwitched(db);
          const found = await findSuspicions(db, await cachedCatalog(db));
          if (closed || found.length) console.log(`moderation: ${found.length} business cases found, ${closed} closed`);
          return { found: found.length, closed };
        }
        case 'business_case': {
          const kind = data.eventType === 'user.business_asked' ? 'asked' : data.eventType === 'user.business_restricted' ? 'restricted' : 'cleared';
          const mail = await businessCaseMail(db, data.aggregateId, kind, opts.appUrl);
          if (mail) await opts.send.email.add('plain_email', { mail } satisfies PlainEmailJob, { jobId: `mail_bizcase_${data.outboxId}` });
          return mail ? 'sent' : 'gone';
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
  worker.on('failed', (job, e) => {
    console.error(`moderation: ${job?.name} failed (attempt ${job?.attemptsMade}):`, e.message);
    reportJobFailure(job, e);
  });

  const handlers: OutboxHandlers = {
    'report.created': [{ name: 'report_received', queue }],
    'appeal.created': [{ name: 'appeal_received', queue }],
    'moderation.decided': [{ name: 'notify', queue }],
    'user.phone_released': [{ name: 'phone_released', queue }],
    'user.staff_acted': [{ name: 'staff_acted', queue }],
    'user.staff_role_changed': [{ name: 'staff_role_changed', queue }],
    'user.signed_out': [{ name: 'signed_out', queue }],
    'user.business_asked': [{ name: 'business_case', queue }],
    'user.business_restricted': [{ name: 'business_case', queue }],
    'user.business_cleared': [{ name: 'business_case', queue }],
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
