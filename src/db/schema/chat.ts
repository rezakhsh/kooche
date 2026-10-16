import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, isIn, standardColumns, textArrayWithin, tstz } from './_columns';
import { listings } from './listings';
import { organizations } from './organizations';
import { users } from './users';

// Module: chat (docs/schema.md, section 10).
// Read state is one watermark per side plus unread counters (decision 6): a message is "seen"
// when created_at <= the other side's *_last_read_at.

export const CONVERSATION_STATUSES = ['open', 'closed', 'locked'] as const;

/** One per listing per buyer */
export const conversations = pgTable(
  'conversations',
  {
    ...standardColumns(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'restrict' }),
    buyerUserId: uuid('buyer_user_id')
      .notNull()
      .references(() => users.id),
    /** The listing's user_id when the conversation started */
    sellerUserId: uuid('seller_user_id')
      .notNull()
      .references(() => users.id),
    /** Set for business listings: managers of the business can answer too */
    organizationId: uuid('organization_id').references(() => organizations.id),
    status: text('status', { enum: CONVERSATION_STATUSES }).notNull().default('open'),
    lastMessageAt: tstz('last_message_at').notNull().defaultNow(),
    buyerLastReadAt: tstz('buyer_last_read_at'),
    sellerLastReadAt: tstz('seller_last_read_at'),
    buyerUnreadCount: integer('buyer_unread_count').notNull().default(0),
    sellerUnreadCount: integer('seller_unread_count').notNull().default(0),
    buyerArchivedAt: tstz('buyer_archived_at'),
    sellerArchivedAt: tstz('seller_archived_at'),
  },
  (t) => [
    check('conversations_status_check', isIn(t.status, CONVERSATION_STATUSES)),
    check('conversations_buyer_unread_count_check', sql`${t.buyerUnreadCount} >= 0`),
    check('conversations_seller_unread_count_check', sql`${t.sellerUnreadCount} >= 0`),
    check('conversations_participants_check', sql`${t.buyerUserId} <> ${t.sellerUserId}`),
    uniqueIndex('conversations_listing_id_buyer_user_id_key').on(t.listingId, t.buyerUserId),
    index('conversations_buyer_inbox_idx').on(t.buyerUserId, t.lastMessageAt.desc().nullsFirst()),
    index('conversations_seller_inbox_idx').on(t.sellerUserId, t.lastMessageAt.desc().nullsFirst()),
    index('conversations_organization_inbox_idx')
      .on(t.organizationId, t.lastMessageAt.desc().nullsFirst())
      .where(sql`organization_id IS NOT NULL`),
  ],
);

export const MESSAGE_KINDS = ['text', 'system'] as const;
export const RISK_FLAGS = [
  'link',
  'payment_request',
  'off_platform_contact',
  'phone_number',
  'iban',
] as const;

// When messages is partitioned by month (the plan's growth step), the primary key becomes
// (id, created_at). Not needed earlier.
export const messages = pgTable(
  'messages',
  {
    id: id(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    /** Null for system messages */
    senderUserId: uuid('sender_user_id').references(() => users.id),
    kind: text('kind', { enum: MESSAGE_KINDS }).notNull().default('text'),
    body: text('body').notNull(),
    /** Set by the scam detector when the message is sent */
    riskFlags: text('risk_flags', { enum: RISK_FLAGS })
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    hiddenAt: tstz('hidden_at'),
    createdAt: createdAt(),
  },
  (t) => [
    check('messages_kind_check', isIn(t.kind, MESSAGE_KINDS)),
    check('messages_body_check', sql`char_length(${t.body}) BETWEEN 1 AND 4000`),
    check('messages_risk_flags_check', textArrayWithin(t.riskFlags, RISK_FLAGS)),
    check('messages_sender_check', sql`(${t.kind} = 'system') = (${t.senderUserId} IS NULL)`),
    index('messages_conversation_id_created_at_id_idx').on(t.conversationId, t.createdAt, t.id),
    index('messages_sender_user_id_created_at_idx').on(t.senderUserId, t.createdAt.desc().nullsFirst()),
  ],
);
