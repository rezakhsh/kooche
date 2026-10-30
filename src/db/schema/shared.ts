import { sql } from 'drizzle-orm';
import { check, index, inet, pgTable, smallint, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { PATTERNS, createdAt, id, isIn, isObject, jsonObject, matches, tstz } from './_columns';
import { users } from './users';

// Shared tables owned by src/db (docs/schema.md, section 13).

/**
 * Side effects (search sync, notifications, n8n webhooks) are written here in the same
 * transaction and handed to BullMQ by the worker. Autovacuum settings are in migration 0002.
 */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    /** Time-ordered, so also the processing order */
    id: id(),
    eventType: text('event_type').notNull(),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    /** IDs and small facts only. Handlers re-read the current state. */
    payload: jsonObject('payload'),
    availableAt: tstz('available_at').notNull().defaultNow(),
    attempts: smallint('attempts').notNull().default(0),
    lastError: text('last_error'),
    processedAt: tstz('processed_at'),
    createdAt: createdAt(),
  },
  (t) => [
    check('outbox_events_event_type_check', matches(t.eventType, PATTERNS.dottedName)),
    check('outbox_events_payload_check', isObject(t.payload)),
    // Only unprocessed rows, so it stays tiny however large the table gets
    index('outbox_events_unprocessed_idx').on(t.id).where(sql`processed_at IS NULL`),
  ],
);

export const AUDIT_ACTOR_TYPES = ['user', 'staff', 'system', 'webhook'] as const;

/** Security and staff actions. Append-only, enforced by grants (migration 0003). */
export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    actorType: text('actor_type', { enum: AUDIT_ACTOR_TYPES }).notNull(),
    /** Users are never hard-deleted (tombstones), so the FK is safe */
    actorUserId: uuid('actor_user_id').references(() => users.id),
    action: text('action').notNull(),
    targetType: text('target_type'),
    /** No FK: it can point at any table */
    targetId: uuid('target_id'),
    sessionId: uuid('session_id'),
    /** Cleared after 90 days by scrub_audit_ip() */
    ipAddress: inet('ip_address'),
    /** Cleared after 90 days by scrub_audit_ip() */
    userAgent: text('user_agent'),
    /** Before and after values */
    data: jsonObject('data'),
    createdAt: createdAt(),
  },
  (t) => [
    check('audit_log_actor_type_check', isIn(t.actorType, AUDIT_ACTOR_TYPES)),
    check('audit_log_action_check', matches(t.action, PATTERNS.dottedName)),
    check('audit_log_data_check', isObject(t.data)),
    index('audit_log_actor_user_id_created_at_idx')
      .on(t.actorUserId, t.createdAt.desc().nullsFirst())
      .where(sql`actor_user_id IS NOT NULL`),
    index('audit_log_target_idx').on(t.targetType, t.targetId, t.createdAt.desc().nullsFirst()),
    index('audit_log_created_at_idx').using('brin', t.createdAt),
  ],
);

/**
 * Software updates an admin marked «لازم نیست» (owner, Oct 30, 2026; src/modules/admin/software.ts).
 * The key names the package, the version on offer and its security warnings, so the update comes
 * back on the admin page when a newer version or another warning appears.
 */
export const softwareDismissals = pgTable(
  'software_dismissals',
  {
    id: id(),
    createdAt: createdAt(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    reason: text('reason').notNull(),
    userId: uuid('user_id').references(() => users.id),
  },
  (t) => [
    uniqueIndex('software_dismissals_key_key').on(t.key),
    check('software_dismissals_key_check', sql`char_length(${t.key}) BETWEEN 3 AND 600`),
    check('software_dismissals_reason_check', sql`char_length(${t.reason}) BETWEEN 3 AND 300`),
  ],
);
