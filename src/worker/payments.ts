import { Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Db } from '../db/drizzle';
import { ALLOWANCE_REQUESTED, grantAllowance, type AllowanceKind } from '../modules/payments/allowances';
import { applyWebhookEvent, NotReady } from '../modules/payments/apply';
import { applyDueBumps } from '../modules/payments/bumps';
import type { PaymentGateway } from '../modules/payments/gateway';
import { expireStaleOrders } from '../modules/payments/orders';
import { sendFoundingReminders } from '../modules/payments/founding';
import { BUSINESS_NOTICE, noticeKind, sendBusinessNotice } from '../modules/organizations/notices';
import { PAYMENT_NOTICE, parsePaymentNotice, sendBumpNotice, sendPaymentNotice } from '../modules/payments/notices';
import { LISTING_OUTBOX } from '../modules/listings/events';
import type { TelegramClient } from '../modules/notifications/telegram-api';
import type { Mailer } from '../modules/notifications/mailer';
import { WEBHOOK_RECEIVED } from '../modules/payments/webhook';
import { processWithdrawal, WITHDRAWAL_RECEIVED } from '../modules/payments/withdrawals';
import type { OutboxHandlers, OutboxJobData } from './outbox';
import { reportJobFailure } from './monitoring';

// Worker jobs for payments (docs/setup.md, "Payments"): queue `payments` applies stored provider
// webhooks and grants included Pro allowances, one at a time; the job scheduler runs due bumps
// every minute and closes checkouts that were never finished. A webhook whose order or charge
// isn't there yet (events out of order) is retried with backoff, like any failed job.

const KEEP = { removeOnComplete: 500, removeOnFail: 2_000 };
const RETRY = { attempts: 10, backoff: { type: 'exponential' as const, delay: 5_000 } };
const SCHEDULED = { removeOnComplete: 20, removeOnFail: 100 };

export async function startPaymentJobs(
  db: Db,
  connection: Redis,
  opts: { gateway: PaymentGateway | null; prefix?: string; schedule?: boolean; mailer?: Mailer; appUrl?: string; telegram?: TelegramClient | null },
) {
  const prefix = opts.prefix ? { prefix: opts.prefix } : {};
  const queue = new Queue('payments', { connection, ...prefix, defaultJobOptions: { ...RETRY, ...KEEP } });
  if (opts.schedule !== false) {
    await queue.upsertJobScheduler('bumps', { pattern: '* * * * *', tz: 'UTC' }, { name: 'bumps', opts: SCHEDULED });
    await queue.upsertJobScheduler('stale-orders', { pattern: '17 * * * *', tz: 'UTC' }, { name: 'stale-orders', opts: SCHEDULED });
    // Founding Pro reminders, 14 and 3 days before the free months end (08:05 UTC)
    await queue.upsertJobScheduler('founding-reminders', { pattern: '5 8 * * *', tz: 'UTC' }, { name: 'founding-reminders', opts: SCHEDULED });
  }
  const own = connection.duplicate();
  const worker = new Worker<OutboxJobData>(
    'payments',
    async (job) => {
      switch (job.name) {
        case 'apply': {
          if (!opts.gateway) throw new Error('payments: STRIPE_SECRET_KEY is not set, webhook kept for later');
          const outcome = await applyWebhookEvent(db, opts.gateway, job.data.aggregateId);
          console.log(`payments: ${String(job.data.payload.type)} ${job.data.aggregateId}: ${outcome}`);
          return outcome;
        }
        case 'allowance': {
          const p = job.data.payload as { organization_id: string; kind: AllowanceKind };
          const outcome = await db.transaction((tx) =>
            grantAllowance(tx, { listingId: job.data.aggregateId, organizationId: p.organization_id, kind: p.kind }),
          );
          console.log(`payments: allowance ${p.kind} for ${job.data.aggregateId}: ${outcome}`);
          return outcome;
        }
        case 'bumps': {
          const run = await applyDueBumps(db);
          if (run.applied || run.revoked) console.log(`payments: bumps: ${run.applied} applied, ${run.revoked} revoked`);
          return run;
        }
        case 'stale-orders': {
          const n = await expireStaleOrders(db);
          if (n) console.log(`payments: ${n} unfinished checkouts expired`);
          return n;
        }
        case 'business-notice': {
          // Verified, badge removed, rejected, founding (src/modules/organizations/notices.ts)
          const kind = noticeKind(job.data.payload);
          if (!kind || !opts.mailer || !opts.appUrl) return 'skipped';
          const sent = await sendBusinessNotice(db, connection, { mail: opts.mailer, telegram: opts.telegram ?? null, appUrl: opts.appUrl }, job.data.aggregateId, kind);
          console.log(`payments: business notice ${kind} ${job.data.aggregateId}: email ${sent.email}, telegram ${sent.telegram}`);
          return sent;
        }
        case 'payment-notice': {
          // Pro started, renewed or ended; an order paid; a withdrawal (src/modules/payments/notices.ts)
          const notice = parsePaymentNotice(job.data.payload);
          if (!notice || !opts.mailer || !opts.appUrl) return 'skipped';
          const sent = await sendPaymentNotice(db, connection, { mail: opts.mailer, telegram: opts.telegram ?? null, appUrl: opts.appUrl, gateway: opts.gateway }, job.data.aggregateId, notice);
          console.log(`payments: notice ${notice.kind} ${job.data.aggregateId}: email ${sent.email}, telegram ${sent.telegram}`);
          return sent;
        }
        case 'bump-notice': {
          if (!opts.mailer || !opts.appUrl) return 'skipped';
          const sent = await sendBumpNotice(db, connection, { mail: opts.mailer, telegram: opts.telegram ?? null, appUrl: opts.appUrl }, job.data.aggregateId);
          console.log(`payments: bump notice ${job.data.aggregateId}: email ${sent.email}, telegram ${sent.telegram}`);
          return sent;
        }
        case 'withdrawal': {
          // A consumer's withdrawal: refund what wasn't used (src/modules/payments/withdrawals.ts)
          if (!opts.gateway) throw new Error('payments: STRIPE_SECRET_KEY is not set, withdrawal kept for later');
          const withdrawalId = String(job.data.payload.withdrawal_id);
          const outcome = await processWithdrawal(db, opts.gateway, withdrawalId);
          console.log(`payments: withdrawal ${withdrawalId}: ${outcome}`);
          return outcome;
        }
        case 'founding-reminders': {
          if (!opts.mailer || !opts.appUrl) return 0;
          const n = await sendFoundingReminders(db, connection, opts.mailer, { appUrl: opts.appUrl });
          if (n) console.log(`payments: ${n} founding Pro reminders sent`);
          return n;
        }
        default:
          throw new Error(`payments: unknown job ${job.name}`);
      }
    },
    { connection: own, concurrency: 1, ...prefix },
  );
  worker.on('failed', (job, e) => {
    const level = e instanceof NotReady ? 'warn' : 'error';
    console[level](`payments: ${job?.name} failed (attempt ${job?.attemptsMade}):`, e.message);
    reportJobFailure(job, e);
  });

  const handlers: OutboxHandlers = {
    [WEBHOOK_RECEIVED]: [{ name: 'apply', queue }],
    [ALLOWANCE_REQUESTED]: [{ name: 'allowance', queue }],
    [BUSINESS_NOTICE]: [{ name: 'business-notice', queue }],
    [PAYMENT_NOTICE]: [{ name: 'payment-notice', queue }],
    [WITHDRAWAL_RECEIVED]: [{ name: 'withdrawal', queue }],
    // The search worker re-indexes the bumped listing; this tells its seller
    [LISTING_OUTBOX.bumped]: [{ name: 'bump-notice', queue }],
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
