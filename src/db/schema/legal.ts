import { sql } from 'drizzle-orm';
import { check, date, index, integer, pgTable, primaryKey, smallint, text, uuid } from 'drizzle-orm/pg-core';
import { insertOnlyColumns, textArrayWithin, tstz } from './_columns';
import { users } from './users';

// Module: legal (Check B, Nov 1, 2026; migration 0043; src/modules/legal/notices.ts). The email
// to every account before the terms of use or the privacy policy change (terms 12: four weeks
// ahead). The owner writes it in admin › «خبر تغییر شرایط به همه»: a draft until confirmed, then
// one row per account that gets it, with the time it went out (proof that each person was told).

export const LEGAL_DOCUMENTS = ['terms', 'privacy'] as const;
export type LegalDocument = (typeof LEGAL_DOCUMENTS)[number];

export const legalNotices = pgTable(
  'legal_notices',
  {
    ...insertOnlyColumns(),
    documents: text('documents', { enum: LEGAL_DOCUMENTS }).array().notNull(),
    /** The day the new version starts (Berlin), copied from the version in the code */
    effectiveOn: date('effective_on', { mode: 'string' }).notNull(),
    summaryFa: text('summary_fa').notNull(),
    summaryDe: text('summary_de').notNull(),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    /** Null while a draft; set when the owner presses «فرستادن به همه» */
    confirmedAt: tstz('confirmed_at'),
    confirmedByUserId: uuid('confirmed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    /** The accounts it went to, counted at the confirmation */
    recipients: integer('recipients'),
    finishedAt: tstz('finished_at'),
  },
  (t) => [
    check('legal_notices_documents_check', sql`cardinality(${t.documents}) BETWEEN 1 AND 2 AND ${textArrayWithin(t.documents, LEGAL_DOCUMENTS)}`),
    check('legal_notices_summary_check', sql`char_length(${t.summaryFa}) BETWEEN 1 AND 2000 AND char_length(${t.summaryDe}) BETWEEN 1 AND 2000`),
    check('legal_notices_confirmed_check', sql`(${t.confirmedAt} IS NULL) = (${t.recipients} IS NULL) AND (${t.finishedAt} IS NULL OR ${t.confirmedAt} IS NOT NULL)`),
    index('legal_notices_confirmed_idx').on(t.effectiveOn).where(sql`${t.confirmedAt} IS NOT NULL`),
  ],
);

/** One row per account a confirmed notice goes to; erase_user deletes the person's rows */
export const legalNoticeRecipients = pgTable(
  'legal_notice_recipients',
  {
    noticeId: uuid('notice_id')
      .notNull()
      .references(() => legalNotices.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    sentAt: tstz('sent_at'),
    /** Given up: three failed sends, or the account was closed before its turn */
    failedAt: tstz('failed_at'),
    attempts: smallint('attempts').notNull().default(0),
  },
  (t) => [
    primaryKey({ name: 'legal_notice_recipients_pkey', columns: [t.noticeId, t.userId] }),
    check('legal_notice_recipients_done_check', sql`${t.sentAt} IS NULL OR ${t.failedAt} IS NULL`),
    index('legal_notice_recipients_due_idx').on(t.noticeId, t.attempts).where(sql`${t.sentAt} IS NULL AND ${t.failedAt} IS NULL`),
    index('legal_notice_recipients_user_idx').on(t.userId),
  ],
);
