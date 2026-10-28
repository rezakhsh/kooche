// Applies every stored Stripe webhook that was never applied, once more (wave 1, part 11). The
// worker retries an event 10 times and then leaves it on the system page; after a fix, this runs
// them again. Test-mode events about something this database never made are now skipped
// (src/modules/payments/apply.ts, NotOurs). Runs as classifieds_worker, like the worker. With
// REDIS_URL it also removes the queue's failed jobs whose event is now applied, so the system page
// stops counting them.
//
//   WORKER_DATABASE_URL=… STRIPE_SECRET_KEY=… [REDIS_URL=…] npx tsx scripts/retry-webhooks.ts

import { Queue } from 'bullmq';
import { drizzle } from 'drizzle-orm/postgres-js';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { Redis } from 'ioredis';
import postgres from 'postgres';
import * as schema from '../src/db/schema';
import { applyWebhookEvent } from '../src/modules/payments/apply';
import { StripeGateway } from '../src/modules/payments/gateway';

const url = process.env.WORKER_DATABASE_URL;
const key = process.env.STRIPE_SECRET_KEY;
if (!url || !key) throw new Error('usage: WORKER_DATABASE_URL=… STRIPE_SECRET_KEY=… npx tsx scripts/retry-webhooks.ts');
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const db = drizzle(sql, { schema });
  const gateway = new StripeGateway(key);
  const rows = await db.select({ id: schema.webhookEvents.id, type: schema.webhookEvents.type }).from(schema.webhookEvents).where(isNull(schema.webhookEvents.processedAt)).orderBy(schema.webhookEvents.createdAt);
  for (const r of rows) {
    const outcome = await applyWebhookEvent(db, gateway, r.id).catch((e: unknown) => `failed: ${e instanceof Error ? e.message : String(e)}`);
    console.log(`${r.type} ${r.id}: ${outcome}`);
  }
  console.log(`${rows.length} events`);
  if (process.env.REDIS_URL) {
    const connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
    const queue = new Queue('payments', { connection });
    let removed = 0;
    for (const job of await queue.getFailed(0, 1999)) {
      if (job.name !== 'apply') continue;
      const [done] = await db
        .select({ id: schema.webhookEvents.id })
        .from(schema.webhookEvents)
        .where(and(eq(schema.webhookEvents.id, String(job.data.aggregateId)), isNotNull(schema.webhookEvents.processedAt)));
      if (done) {
        await job.remove();
        removed++;
      }
    }
    console.log(`${removed} failed jobs removed`);
    await queue.close();
    await connection.quit();
  }
} finally {
  await sql.end();
}
