import type postgres from 'postgres';

// Retention of event and history data (docs/schema.md, section 14), run daily by the worker as
// classifieds_worker. Same pattern as src/modules/users/retention.ts: fixed periods in code,
// bounded batches oldest id first, a cap on batches per run.
//
// Every id is a UUIDv7, so ORDER BY id walks the primary key from the oldest row. Neither
// outbox_events nor webhook_events needs another index for this: their partial indexes cover
// only unprocessed rows, and the tables hold at most 7 and 90 days of processed rows.

/** Processed outbox events are kept 7 days after processed_at */
export const OUTBOX_RETENTION = '7 days';
/** Processed webhook events are kept 90 days after created_at (received); unprocessed ones stay */
export const WEBHOOK_RETENTION = '90 days';
/** audit_log rows; the SECURITY DEFINER functions refuse anything shorter (migration 0004) */
export const AUDIT_LOG_RETENTION = '2 years';
/** IP address and user agent in audit_log */
export const AUDIT_IP_RETENTION = '90 days';
/** Closed reports and unreferenced moderation decisions */
export const MODERATION_RETENTION = '2 years';

export interface PurgeOptions {
  /** Rows per DELETE or function call (the functions accept at most 100,000) */
  batchSize?: number;
  /** Batches per table per run; what's left goes in the next run */
  maxBatches?: number;
}

/** Repeats one batch until it comes back short or maxBatches is reached. Returns the rows affected. */
export async function inBatches(
  deleteBatch: (limit: number) => Promise<number>,
  batchSize: number,
  maxBatches: number,
): Promise<number> {
  let total = 0;
  for (let i = 0; i < maxBatches; i++) {
    const n = await deleteBatch(batchSize);
    total += n;
    if (n < batchSize) break;
  }
  return total;
}

export interface EventPurgeResult {
  outboxEvents: number;
  webhookEvents: number;
}

/** Deletes processed outbox events and processed webhook events past their periods. */
export async function purgeEventData(
  sql: postgres.Sql,
  { batchSize = 5_000, maxBatches = 100 }: PurgeOptions = {},
): Promise<EventPurgeResult> {
  const outboxEvents = await inBatches(
    async (limit) =>
      (
        await sql`
          DELETE FROM outbox_events WHERE id IN (
            SELECT id FROM outbox_events
            WHERE processed_at < now() - ${OUTBOX_RETENTION}::interval
            ORDER BY id LIMIT ${limit})
        `
      ).count,
    batchSize,
    maxBatches,
  );
  const webhookEvents = await inBatches(
    async (limit) =>
      (
        await sql`
          DELETE FROM webhook_events WHERE id IN (
            SELECT id FROM webhook_events
            WHERE processed_at IS NOT NULL AND created_at < now() - ${WEBHOOK_RETENTION}::interval
            ORDER BY id LIMIT ${limit})
        `
      ).count,
    batchSize,
    maxBatches,
  );
  return { outboxEvents, webhookEvents };
}

export interface HistoryPurgeResult {
  auditRows: number;
  auditIpsScrubbed: number;
  reports: number;
  moderationDecisions: number;
}

/** Calls the SECURITY DEFINER retention functions of migration 0004 in batches. */
export async function purgeHistory(
  sql: postgres.Sql,
  { batchSize = 5_000, maxBatches = 100 }: PurgeOptions = {},
): Promise<HistoryPurgeResult> {
  const auditRows = await inBatches(
    async (limit) => {
      const [row] = await sql`SELECT purge_audit_log(${AUDIT_LOG_RETENTION}::interval, ${limit}) AS n`;
      return Number(row!.n);
    },
    batchSize,
    maxBatches,
  );
  const auditIpsScrubbed = await inBatches(
    async (limit) => {
      const [row] = await sql`SELECT scrub_audit_ip(${AUDIT_IP_RETENTION}::interval, ${limit}) AS n`;
      return Number(row!.n);
    },
    batchSize,
    maxBatches,
  );
  // One call deletes up to max_rows reports and up to max_rows decisions: go on while either is full.
  let reports = 0;
  let moderationDecisions = 0;
  for (let i = 0; i < maxBatches; i++) {
    const [row] = await sql`
      SELECT reports_deleted, decisions_deleted
      FROM purge_moderation_records(${MODERATION_RETENTION}::interval, ${batchSize})
    `;
    const r = Number(row!.reports_deleted);
    const d = Number(row!.decisions_deleted);
    reports += r;
    moderationDecisions += d;
    if (r < batchSize && d < batchSize) break;
  }
  return { auditRows, auditIpsScrubbed, reports, moderationDecisions };
}
