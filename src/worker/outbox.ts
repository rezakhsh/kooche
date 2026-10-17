import type { Queue } from 'bullmq';
import type postgres from 'postgres';

// Outbox processor (docs/schema.md, section 13). Each committed `outbox_events` row is handed to
// BullMQ: one job per interested handler, then the row is marked processed. Retrying a handler is
// BullMQ's job; the outbox only guarantees the hand-off from a committed transaction to the queue.

export const BATCH_SIZE = 100;

/** One job per event for this handler, on its queue. */
export interface OutboxHandler {
  /** Short name, part of the job id: [a-z_]+ */
  name: string;
  queue: Queue;
}

/** Handlers by event type (`listing.published`, …). Features register theirs as they arrive. */
export type OutboxHandlers = Readonly<Record<string, readonly OutboxHandler[]>>;

interface OutboxRow {
  id: string;
  event_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
}

/** What every outbox job carries: the event's ids and small facts. Handlers re-read the rest. */
export type OutboxJobData = {
  outboxId: string;
  eventType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
};

/**
 * Hands one batch of due events to BullMQ and marks them processed, in one transaction.
 * Returns the number of events handled. Rows locked by another worker are skipped.
 */
export async function processOutboxBatch(sql: postgres.Sql, handlers: OutboxHandlers): Promise<number> {
  return sql.begin(async (tx) => {
    const rows = await tx<OutboxRow[]>`
      SELECT id, event_type, aggregate_id, payload FROM outbox_events
      WHERE processed_at IS NULL AND available_at <= now()
      ORDER BY id
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    `;
    if (rows.length === 0) return 0;

    for (const row of rows) {
      const targets = handlers[row.event_type] ?? [];
      // A type registered with no handlers is known and needs nothing yet; an unknown one is logged
      if (!(row.event_type in handlers)) {
        console.warn(`outbox: no handler for ${row.event_type} (${row.id}), marking it processed`);
      }
      for (const handler of targets) {
        // The job id makes a retried hand-off idempotent: BullMQ drops a job whose id it already
        // has. BullMQ rejects ":" in custom ids, hence "_".
        const data: OutboxJobData = {
          outboxId: row.id,
          eventType: row.event_type,
          aggregateId: row.aggregate_id,
          payload: row.payload,
        };
        await handler.queue.add(handler.name, data, { jobId: `${row.id}_${handler.name}` });
      }
    }

    await tx`UPDATE outbox_events SET processed_at = now() WHERE id IN ${tx(rows.map((r) => r.id))}`;
    return rows.length;
  });
}
