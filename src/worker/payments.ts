import { Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Db } from '../db/drizzle';
import { ALLOWANCE_REQUESTED, grantAllowance, type AllowanceKind } from '../modules/payments/allowances';
import { applyWebhookEvent, NotReady } from '../modules/payments/apply';
import { applyDueBumps } from '../modules/payments/bumps';
import type { PaymentGateway } from '../modules/payments/gateway';
import { expireStaleOrders } from '../modules/payments/orders';
import { WEBHOOK_RECEIVED } from '../modules/payments/webhook';
import type { OutboxHandlers, OutboxJobData } from './outbox';

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
  opts: { gateway: PaymentGateway | null; prefix?: string; schedule?: boolean },
) {
  const prefix = opts.prefix ? { prefix: opts.prefix } : {};
  const queue = new Queue('payments', { connection, ...prefix, defaultJobOptions: { ...RETRY, ...KEEP } });
  if (opts.schedule !== false) {
    await queue.upsertJobScheduler('bumps', { pattern: '* * * * *', tz: 'UTC' }, { name: 'bumps', opts: SCHEDULED });
    await queue.upsertJobScheduler('stale-orders', { pattern: '17 * * * *', tz: 'UTC' }, { name: 'stale-orders', opts: SCHEDULED });
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
        default:
          throw new Error(`payments: unknown job ${job.name}`);
      }
    },
    { connection: own, concurrency: 1, ...prefix },
  );
  worker.on('failed', (job, e) => {
    const level = e instanceof NotReady ? 'warn' : 'error';
    console[level](`payments: ${job?.name} failed (attempt ${job?.attemptsMade}):`, e.message);
  });

  const handlers: OutboxHandlers = {
    [WEBHOOK_RECEIVED]: [{ name: 'apply', queue }],
    [ALLOWANCE_REQUESTED]: [{ name: 'allowance', queue }],
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
