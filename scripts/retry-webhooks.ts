// Applies every stored Stripe webhook that was never applied, once more (wave 1, part 11). The
// worker retries an event 10 times and then leaves it on the system page; after a fix, this runs
// them again. Test-mode events about something this database never made are now skipped
// (src/modules/payments/apply.ts, NotOurs). Runs as classifieds_worker, like the worker.
//
//   WORKER_DATABASE_URL=… STRIPE_SECRET_KEY=… npx tsx scripts/retry-webhooks.ts

import { drizzle } from 'drizzle-orm/postgres-js';
import { isNull } from 'drizzle-orm';
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
} finally {
  await sql.end();
}
