import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { createdAt, id, isIn, isObject, jsonObject, standardColumns, tstz } from './_columns';
import { REASON_CODES } from './_values';
import { messages } from './chat';
import { listings } from './listings';
import { listingImages } from './media';
import { organizations } from './organizations';
import { users } from './users';

// Module: moderation, trust and safety (docs/schema.md, section 11).
// Targets use one nullable FK per target type plus CHECK (num_nonnulls(...) = 1), so a report or
// decision can't point at a row that doesn't exist.

export const REPORT_STATUSES = ['open', 'in_review', 'resolved', 'dismissed'] as const;

export const reports = pgTable(
  'reports',
  {
    ...standardColumns(),
    /** Null: a logged-out person sending a DSA notice */
    reporterUserId: uuid('reporter_user_id').references(() => users.id),
    reporterEmail: text('reporter_email'),
    reporterName: text('reporter_name'),
    listingId: uuid('listing_id').references(() => listings.id, { onDelete: 'restrict' }),
    reportedUserId: uuid('reported_user_id').references(() => users.id, { onDelete: 'restrict' }),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'restrict',
    }),
    messageId: uuid('message_id').references(() => messages.id, { onDelete: 'restrict' }),
    reasonCode: text('reason_code', { enum: REASON_CODES }).notNull(),
    details: text('details'),
    /** The reporter states the content is illegal (DSA art. 16), not just against our rules */
    isIllegalContentNotice: boolean('is_illegal_content_notice').notNull().default(false),
    legalReference: text('legal_reference'),
    goodFaithConfirmed: boolean('good_faith_confirmed').notNull().default(false),
    status: text('status', { enum: REPORT_STATUSES }).notNull().default('open'),
    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id),
    /** Several reports can be closed by one decision */
    moderationDecisionId: uuid('moderation_decision_id').references(
      (): AnyPgColumn => moderationDecisions.id,
      { onDelete: 'restrict' },
    ),
    resolvedAt: tstz('resolved_at'),
  },
  (t) => [
    check(
      'reports_reporter_check',
      sql`num_nonnulls(${t.reporterUserId}, ${t.reporterEmail}) >= 1`,
    ),
    check('reports_reason_code_check', isIn(t.reasonCode, REASON_CODES)),
    check('reports_details_check', sql`char_length(${t.details}) <= 2000`),
    check(
      'reports_good_faith_check',
      sql`NOT ${t.isIllegalContentNotice} OR ${t.goodFaithConfirmed}`,
    ),
    check('reports_status_check', isIn(t.status, REPORT_STATUSES)),
    check(
      'reports_target_check',
      sql`num_nonnulls(${t.listingId}, ${t.reportedUserId}, ${t.organizationId}, ${t.messageId}) = 1`,
    ),
    index('reports_queue_idx').on(t.createdAt).where(sql`status IN ('open', 'in_review')`),
    index('reports_listing_id_idx').on(t.listingId).where(sql`listing_id IS NOT NULL`),
    index('reports_reported_user_id_idx')
      .on(t.reportedUserId)
      .where(sql`reported_user_id IS NOT NULL`),
    index('reports_message_id_idx').on(t.messageId).where(sql`message_id IS NOT NULL`),
    index('reports_reporter_user_id_created_at_idx')
      .on(t.reporterUserId, t.createdAt.desc().nullsFirst())
      .where(sql`reporter_user_id IS NOT NULL`),
    // One open report per person per listing
    uniqueIndex('reports_open_per_reporter_listing_key')
      .on(t.reporterUserId, t.listingId)
      .where(
        sql`status IN ('open', 'in_review') AND reporter_user_id IS NOT NULL AND listing_id IS NOT NULL`,
      ),
  ],
);

export const DECISIONS = [
  'approve',
  'reject',
  'remove',
  'hide',
  'restore',
  'warn',
  'sanction',
  'no_action',
  'escalate',
] as const;
export const DECIDED_BY = ['staff', 'ai', 'rule'] as const;

/** Append-only, enforced by grants (migration 0003) */
export const moderationDecisions = pgTable(
  'moderation_decisions',
  {
    id: id(),
    listingId: uuid('listing_id').references((): AnyPgColumn => listings.id, {
      onDelete: 'restrict',
    }),
    listingImageId: uuid('listing_image_id').references(() => listingImages.id, {
      onDelete: 'restrict',
    }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'restrict' }),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'restrict',
    }),
    messageId: uuid('message_id').references(() => messages.id, { onDelete: 'restrict' }),
    /** Which listing revision was judged */
    listingRevision: integer('listing_revision'),
    decision: text('decision', { enum: DECISIONS }).notNull(),
    /** Null for approve, no_action, restore */
    reasonCode: text('reason_code', { enum: REASON_CODES }),
    /** Section of our terms, e.g. terms-4.2 */
    policyGround: text('policy_ground'),
    legalGround: text('legal_ground'),
    /** The Persian explanation sent to the user */
    statementFa: text('statement_fa'),
    /** "Automated means used" (DSA) is derived from this */
    decidedBy: text('decided_by', { enum: DECIDED_BY }).notNull(),
    moderatorUserId: uuid('moderator_user_id').references(() => users.id),
    aiModel: text('ai_model'),
    aiScore: real('ai_score'),
    aiOutput: jsonb('ai_output'),
    appealOfDecisionId: uuid('appeal_of_decision_id'),
    /** Title, description, price, attributes and image keys as judged */
    contentSnapshot: jsonObject('content_snapshot'),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: 'moderation_decisions_appeal_of_decision_id_fkey',
      columns: [t.appealOfDecisionId],
      foreignColumns: [t.id],
    }),
    check(
      'moderation_decisions_target_check',
      sql`num_nonnulls(${t.listingId}, ${t.listingImageId}, ${t.userId}, ${t.organizationId}, ${t.messageId}) = 1`,
    ),
    check(
      'moderation_decisions_listing_revision_check',
      sql`(${t.listingId} IS NULL) = (${t.listingRevision} IS NULL)`,
    ),
    check('moderation_decisions_decision_check', isIn(t.decision, DECISIONS)),
    check('moderation_decisions_reason_code_check', isIn(t.reasonCode, REASON_CODES)),
    check('moderation_decisions_decided_by_check', isIn(t.decidedBy, DECIDED_BY)),
    check(
      'moderation_decisions_moderator_check',
      sql`(${t.decidedBy} = 'staff') = (${t.moderatorUserId} IS NOT NULL)`,
    ),
    check('moderation_decisions_ai_score_check', sql`${t.aiScore} BETWEEN 0 AND 1`),
    check('moderation_decisions_ai_output_check', isObject(t.aiOutput)),
    check('moderation_decisions_content_snapshot_check', isObject(t.contentSnapshot)),
    // No restriction without its reasons (DSA art. 17)
    check(
      'moderation_decisions_statement_check',
      sql`${t.decision} NOT IN ('reject', 'remove', 'hide', 'warn', 'sanction') OR (
        ${t.reasonCode} IS NOT NULL AND ${t.statementFa} IS NOT NULL
        AND num_nonnulls(${t.policyGround}, ${t.legalGround}) >= 1)`,
    ),
    index('moderation_decisions_listing_id_created_at_idx')
      .on(t.listingId, t.createdAt.desc().nullsFirst())
      .where(sql`listing_id IS NOT NULL`),
    index('moderation_decisions_user_id_created_at_idx')
      .on(t.userId, t.createdAt.desc().nullsFirst())
      .where(sql`user_id IS NOT NULL`),
    index('moderation_decisions_moderator_created_at_idx')
      .on(t.moderatorUserId, t.createdAt.desc().nullsFirst())
      .where(sql`moderator_user_id IS NOT NULL`),
    index('moderation_decisions_ai_sample_idx').on(t.createdAt).where(sql`decided_by = 'ai'`),
  ],
);

export const SANCTION_TYPES = [
  'warning',
  'posting_restricted',
  'messaging_restricted',
  'suspended',
  'banned',
] as const;

/** The single source of truth for restrictions on accounts */
export const userSanctions = pgTable(
  'user_sanctions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    type: text('type', { enum: SANCTION_TYPES }).notNull(),
    /** Required: every sanction has its reasons and statement */
    moderationDecisionId: uuid('moderation_decision_id').notNull(),
    startsAt: tstz('starts_at').notNull().defaultNow(),
    /** Null means permanent */
    endsAt: tstz('ends_at'),
    revokedAt: tstz('revoked_at'),
    revokedByUserId: uuid('revoked_by_user_id').references(() => users.id),
    revokeNote: text('revoke_note'),
    /** Null: set by a rule */
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: 'user_sanctions_moderation_decision_id_fkey',
      columns: [t.moderationDecisionId],
      foreignColumns: [moderationDecisions.id],
    }).onDelete('restrict'),
    check('user_sanctions_type_check', isIn(t.type, SANCTION_TYPES)),
    check('user_sanctions_period_check', sql`${t.endsAt} IS NULL OR ${t.endsAt} > ${t.startsAt}`),
    check(
      'user_sanctions_permanent_check',
      sql`${t.type} NOT IN ('banned', 'warning') OR ${t.endsAt} IS NULL`,
    ),
    index('user_sanctions_active_idx').on(t.userId, t.startsAt).where(sql`revoked_at IS NULL`),
  ],
);
