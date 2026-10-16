import type { Queue } from 'bullmq';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { processOutboxBatch } from '../src/worker/outbox';
import { client } from './db';

// The outbox hand-off (docs/schema.md, section 13): due rows become one BullMQ job per handler
// and are marked processed; rows that aren't due yet are left alone.

function fakeQueue() {
  const add = vi.fn(async () => ({}));
  return { queue: { add } as unknown as Queue, add };
}

async function insertEvent(eventType: string, availableAt = 'now()') {
  const [row] = await client<{ id: string }[]>`
    INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, available_at)
    VALUES (${eventType}, 'listing', uuidv7(), ${client.unsafe(availableAt)})
    RETURNING id
  `;
  return row!.id;
}

async function processedAt(id: string) {
  const [row] = await client<{ processed_at: string | null }[]>`SELECT processed_at FROM outbox_events WHERE id = ${id}`;
  return row!.processed_at;
}

afterEach(async () => {
  await client`DELETE FROM outbox_events`;
});

describe('processOutboxBatch', () => {
  it('adds one job per handler with an idempotent job id and marks the row processed', async () => {
    const search = fakeQueue();
    const notify = fakeQueue();
    const id = await insertEvent('listing.published');

    const handled = await processOutboxBatch(client, {
      'listing.published': [
        { name: 'search', queue: search.queue },
        { name: 'notify', queue: notify.queue },
      ],
    });

    expect(handled).toBe(1);
    expect(search.add).toHaveBeenCalledWith('search', { outboxId: id }, { jobId: `${id}_search` });
    expect(notify.add).toHaveBeenCalledWith('notify', { outboxId: id }, { jobId: `${id}_notify` });
    expect(await processedAt(id)).not.toBeNull();
  });

  it('marks events without a handler processed', async () => {
    const id = await insertEvent('message.sent');
    expect(await processOutboxBatch(client, {})).toBe(1);
    expect(await processedAt(id)).not.toBeNull();
  });

  it('leaves events that are not due yet', async () => {
    const id = await insertEvent('message.sent', "now() + interval '1 hour'");
    expect(await processOutboxBatch(client, {})).toBe(0);
    expect(await processedAt(id)).toBeNull();
  });

  it('leaves the row unprocessed when the hand-off fails', async () => {
    const id = await insertEvent('listing.published');
    const broken = { add: vi.fn(async () => Promise.reject(new Error('valkey down'))) } as unknown as Queue;

    await expect(
      processOutboxBatch(client, { 'listing.published': [{ name: 'search', queue: broken }] }),
    ).rejects.toThrow('valkey down');
    expect(await processedAt(id)).toBeNull();
  });
});
