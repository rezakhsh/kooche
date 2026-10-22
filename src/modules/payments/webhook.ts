import { sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import type { PaymentGateway } from './gateway';
import { isHandled } from './stripe-objects';

// The webhook endpoint's whole job (docs/schema.md, section 12): check the signature, store the
// raw event once, hand it to the worker through the outbox, answer. It runs as classifieds_app,
// which may insert webhook_events and outbox_events but never write the money tables; the worker
// applies the event (./apply.ts).

export const WEBHOOK_RECEIVED = 'webhook.received';

export type WebhookOutcome =
  /** Bad or missing signature: answered 400, nothing stored */
  | 'invalid'
  /** A type the endpoint isn't meant to receive: answered 200, nothing stored */
  | 'ignored'
  /** Stored and handed to the worker */
  | 'stored'
  /** Stripe sent it again: answered 200, nothing changed */
  | 'duplicate';

export async function receiveWebhook(
  db: Queryable,
  gateway: PaymentGateway,
  rawBody: string,
  signature: string | null,
): Promise<WebhookOutcome> {
  const event = gateway.verifyEvent(rawBody, signature);
  if (!event) return 'invalid';
  if (!isHandled(event.type)) return 'ignored';
  // One statement: the event row, and the outbox row only when the event is new
  const rows = await db.execute<{ id: string }>(sql`
    WITH stored AS (
      INSERT INTO webhook_events (provider, provider_event_id, type, payload)
      VALUES (${gateway.provider}, ${event.id}, ${event.type}, ${JSON.stringify(event)}::jsonb)
      ON CONFLICT (provider, provider_event_id) DO NOTHING
      RETURNING id
    )
    INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
    SELECT ${WEBHOOK_RECEIVED}, 'webhook_event', id, jsonb_build_object('type', ${event.type}::text)
    FROM stored
    RETURNING aggregate_id AS id
  `);
  return rows.length ? 'stored' : 'duplicate';
}
