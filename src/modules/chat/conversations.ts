import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import type { Db, Queryable } from '../../db/drizzle';
import { conversations, listings, messages, outboxEvents, users } from '../../db/schema';
import { hit } from '../../lib/rate-limit';
import { activeSanctions, restrictsMessaging } from '../moderation/sanctions';
import { blockState } from '../users/blocks';
import { canSendMessage, loadActor, type Denied } from '../users/permissions';
import { CHAT_LIMITS, isNewAccount } from './limits';
import { BLOCKED_FOR_NEW_ACCOUNTS, detectRisks, type RiskFlag } from './risk';

// Chat (docs/schema.md, section 10; docs/setup.md, "Chat"): one conversation per listing per
// buyer, created with its first message. Every write goes through here, so the rules live in one
// place:
// - only the two participants read or write; sending needs a verified phone and no messaging
//   sanction (canSendMessage, user_sanctions);
// - a closed (listing gone) or locked (moderation) conversation is read-only;
// - the blocker can't write; the blocked person's messages are stored `withheld`: never shown to
//   the blocker, not counted, no notice, and nothing tells the sender;
// - the scam detector sets risk_flags; accounts younger than 7 days can't send links or IBANs;
// - rate limits on messages and, for new accounts, on new conversations.
//
// Sends to one conversation are serialized by locking its row first, and the message takes
// clock_timestamp() (to the millisecond, so JavaScript dates compare exactly) after the lock. So within a conversation (created_at, id) follows commit
// order, which the live stream's replay after Last-Event-ID relies on (realtime.ts).

export type Side = 'buyer' | 'seller';
export type ConversationStatus = (typeof conversations.$inferSelect)['status'];

/** System messages store a code; the text is in the messages file (messages.chat.system) */
export const SYSTEM_CODES = [
  'listing_sold',
  'listing_deleted',
  'listing_expired',
  'listing_removed',
  'listing_active',
] as const;
export type SystemCode = (typeof SYSTEM_CODES)[number];

export type MessageView = {
  id: string;
  conversationId: string;
  senderId: string | null;
  kind: 'text' | 'system';
  /** Empty when hidden by moderation */
  body: string;
  riskFlags: RiskFlag[];
  hidden: boolean;
  createdAt: Date;
};

type MessageRow = typeof messages.$inferSelect;

export function messageView(m: MessageRow): MessageView {
  const hidden = m.hiddenAt !== null;
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderUserId,
    kind: m.kind,
    body: hidden ? '' : m.body,
    riskFlags: hidden ? [] : (m.riskFlags as RiskFlag[]),
    hidden,
    createdAt: m.createdAt,
  };
}

export const MAX_BODY = 4_000;

/** Line endings unified, control characters (except tab and newline) removed, at most one empty line in a row */
export function cleanBody(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type SendRefusal =
  | Denied
  | 'restricted'
  | 'not_found'
  | 'own_listing'
  | 'listing_unavailable'
  | 'closed'
  | 'locked'
  | 'blocked_by_me'
  | 'new_account_links'
  | 'rate_limited'
  | 'empty'
  | 'too_long';

export type Refused<R extends string = SendRefusal> = { ok: false; reason: R; retryAfterSeconds?: number };

export type Sent = {
  ok: true;
  conversationId: string;
  message: MessageView;
  senderId: string;
  recipientId: string;
  withheld: boolean;
  /** This message started the conversation */
  started: boolean;
};

export type SendTarget = { conversationId: string } | { listingToken: string };

type ConversationRow = typeof conversations.$inferSelect;

export function sideOf(c: Pick<ConversationRow, 'buyerUserId' | 'sellerUserId'>, userId: string): Side | null {
  if (c.buyerUserId === userId) return 'buyer';
  if (c.sellerUserId === userId) return 'seller';
  return null;
}

export function otherParticipant(c: Pick<ConversationRow, 'buyerUserId' | 'sellerUserId'>, userId: string): string {
  return c.buyerUserId === userId ? c.sellerUserId : c.buyerUserId;
}

async function lockConversation(tx: Queryable, id: string): Promise<ConversationRow | undefined> {
  const [row] = await tx.select().from(conversations).where(eq(conversations.id, id)).for('update');
  return row;
}

/**
 * Sends a message, starting the conversation when the target is a listing the sender has no
 * conversation about yet. The caller publishes the live events after the commit.
 */
export async function sendMessage(
  db: Db,
  redis: Redis,
  opts: { userId: string; target: SendTarget; body: string; now?: Date },
): Promise<Sent | Refused> {
  const body = cleanBody(opts.body);
  if (!body) return { ok: false, reason: 'empty' };
  if (body.length > MAX_BODY) return { ok: false, reason: 'too_long' };
  const now = opts.now ?? new Date();

  return db.transaction(async (tx) => {
    const actor = await loadActor(tx, opts.userId);
    const allowed = canSendMessage(actor);
    if (!allowed.ok) return allowed;
    if (restrictsMessaging(await activeSanctions(tx, opts.userId, now))) return { ok: false, reason: 'restricted' };

    // The conversation, locked; or the listing to start one about
    let conv: ConversationRow | undefined;
    let listingToStart: { id: string; userId: string; organizationId: string | null } | undefined;
    if ('conversationId' in opts.target) {
      conv = await lockConversation(tx, opts.target.conversationId);
      if (!conv || !sideOf(conv, opts.userId)) return { ok: false, reason: 'not_found' };
    } else {
      const [listing] = await tx
        .select({ id: listings.id, userId: listings.userId, organizationId: listings.organizationId, status: listings.status })
        .from(listings)
        .where(eq(listings.publicToken, opts.target.listingToken));
      if (!listing || listing.status === 'draft' || listing.status === 'deleted') return { ok: false, reason: 'not_found' };
      if (listing.userId === opts.userId) return { ok: false, reason: 'own_listing' };
      const [existing] = await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.listingId, listing.id), eq(conversations.buyerUserId, opts.userId)));
      if (existing) conv = await lockConversation(tx, existing.id);
      else if (listing.status !== 'active') return { ok: false, reason: 'listing_unavailable' };
      else listingToStart = listing;
    }

    if (conv?.status === 'closed') return { ok: false, reason: 'closed' };
    if (conv?.status === 'locked') return { ok: false, reason: 'locked' };

    const otherId = conv ? otherParticipant(conv, opts.userId) : listingToStart!.userId;
    const blocks = await blockState(tx, opts.userId, otherId);
    if (blocks.iBlocked) return { ok: false, reason: 'blocked_by_me' };
    const withheld = blocks.blockedMe;

    const [sender] = await tx.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, opts.userId));
    const riskFlags = detectRisks(body);
    const newAccount = isNewAccount(sender!.createdAt, now);
    if (newAccount && riskFlags.some((f) => BLOCKED_FOR_NEW_ACCOUNTS.includes(f))) {
      return { ok: false, reason: 'new_account_links' };
    }

    const limits: Array<readonly [(typeof CHAT_LIMITS)[keyof typeof CHAT_LIMITS], string]> = [
      [CHAT_LIMITS.messagesPerUserMinute, opts.userId],
      [CHAT_LIMITS.messagesPerUserHour, opts.userId],
    ];
    if (listingToStart) {
      limits.push(
        newAccount
          ? ([CHAT_LIMITS.conversationsPerNewUserHour, opts.userId] as const)
          : ([CHAT_LIMITS.conversationsPerUserHour, opts.userId] as const),
      );
      if (newAccount) limits.push([CHAT_LIMITS.conversationsPerNewUserDay, opts.userId]);
    }
    const limited = await hit(redis, limits);
    if (!limited.ok) return { ok: false, reason: 'rate_limited', retryAfterSeconds: limited.retryAfterSeconds };

    let started = false;
    if (listingToStart) {
      // A double click or a second tab may have created it a moment ago
      const [created] = await tx
        .insert(conversations)
        .values({
          listingId: listingToStart.id,
          buyerUserId: opts.userId,
          sellerUserId: listingToStart.userId,
          organizationId: listingToStart.organizationId,
        })
        .onConflictDoNothing({ target: [conversations.listingId, conversations.buyerUserId] })
        .returning({ id: conversations.id });
      started = !!created;
      const [row] = created
        ? [created]
        : await tx
            .select({ id: conversations.id })
            .from(conversations)
            .where(and(eq(conversations.listingId, listingToStart.id), eq(conversations.buyerUserId, opts.userId)));
      conv = await lockConversation(tx, row!.id);
      if (conv!.status !== 'open') return { ok: false, reason: conv!.status === 'locked' ? 'locked' : 'closed' };
    }

    const c = conv!;
    const side = sideOf(c, opts.userId)!;
    const [message] = await tx
      .insert(messages)
      .values({
        conversationId: c.id,
        senderUserId: opts.userId,
        kind: 'text',
        body,
        riskFlags,
        withheld,
        createdAt: sql`date_trunc('milliseconds', clock_timestamp())`,
      })
      .returning();
    const at = message!.createdAt;

    // Sending reads everything before it; a withheld message changes nothing on the other side
    const mine = side === 'buyer'
      ? { buyerLastReadAt: at, buyerUnreadCount: 0, buyerArchivedAt: null }
      : { sellerLastReadAt: at, sellerUnreadCount: 0, sellerArchivedAt: null };
    const theirs = withheld
      ? {}
      : side === 'buyer'
        ? { lastMessageAt: at, sellerUnreadCount: sql`${conversations.sellerUnreadCount} + 1`, sellerArchivedAt: null }
        : { lastMessageAt: at, buyerUnreadCount: sql`${conversations.buyerUnreadCount} + 1`, buyerArchivedAt: null };
    await tx.update(conversations).set({ ...mine, ...theirs }).where(eq(conversations.id, c.id));

    const events: Array<typeof outboxEvents.$inferInsert> = [];
    if (started) {
      events.push({
        eventType: 'conversation.started',
        aggregateType: 'conversation',
        aggregateId: c.id,
        payload: { listingId: c.listingId, buyerId: c.buyerUserId, sellerId: c.sellerUserId },
      });
    }
    if (!withheld) {
      events.push({
        eventType: 'message.sent',
        aggregateType: 'conversation',
        aggregateId: c.id,
        payload: { messageId: message!.id, senderId: opts.userId, recipientId: otherId, riskFlags },
      });
    }
    if (events.length) await tx.insert(outboxEvents).values(events);

    return {
      ok: true,
      conversationId: c.id,
      message: messageView(message!),
      senderId: opts.userId,
      recipientId: otherId,
      withheld,
      started,
    } satisfies Sent;
  });
}

/**
 * Marks the conversation read up to its newest message from the other side. The row lock makes
 * a message sent at the same moment either count before (and be read) or come after (and stay
 * unread). Returns the new watermark when it moved, for the "seen" ticks on the other side.
 */
export async function markRead(
  db: Db,
  opts: { userId: string; conversationId: string },
): Promise<{ ok: true; readAt: Date | null; otherId: string } | Refused<'not_found'>> {
  return db.transaction(async (tx) => {
    const c = await lockConversation(tx, opts.conversationId);
    const side = c && sideOf(c, opts.userId);
    if (!c || !side) return { ok: false, reason: 'not_found' };
    const otherId = otherParticipant(c, opts.userId);
    const current = side === 'buyer' ? c.buyerLastReadAt : c.sellerLastReadAt;
    const unread = side === 'buyer' ? c.buyerUnreadCount : c.sellerUnreadCount;

    const [latest] = await tx.execute<{ at: Date | string | null }>(sql`
      SELECT max(created_at) AS at FROM messages
      WHERE conversation_id = ${c.id} AND NOT withheld
        AND (sender_user_id IS NULL OR sender_user_id <> ${opts.userId})
    `);
    const at = latest?.at ? new Date(latest.at) : null;
    const moved = at !== null && (!current || at > current);
    if (!moved && unread === 0) return { ok: true, readAt: null, otherId };

    await tx
      .update(conversations)
      .set(
        side === 'buyer'
          ? { buyerUnreadCount: 0, ...(moved ? { buyerLastReadAt: at } : {}) }
          : { sellerUnreadCount: 0, ...(moved ? { sellerLastReadAt: at } : {}) },
      )
      .where(eq(conversations.id, c.id));
    return { ok: true, readAt: moved ? at : null, otherId };
  });
}

/** Archive or bring back a conversation, for one side only */
export async function setArchived(
  db: Queryable,
  opts: { userId: string; conversationId: string; archived: boolean; now?: Date },
): Promise<boolean> {
  const value = opts.archived ? (opts.now ?? new Date()) : null;
  const buyer = await db
    .update(conversations)
    .set({ buyerArchivedAt: value })
    .where(and(eq(conversations.id, opts.conversationId), eq(conversations.buyerUserId, opts.userId)))
    .returning({ id: conversations.id });
  if (buyer.length) return true;
  const seller = await db
    .update(conversations)
    .set({ sellerArchivedAt: value })
    .where(and(eq(conversations.id, opts.conversationId), eq(conversations.sellerUserId, opts.userId)))
    .returning({ id: conversations.id });
  return seller.length > 0;
}

// ---------------------------------------------------------------------------
// Worker: conversations follow their listing
// ---------------------------------------------------------------------------

export type StatusChange = {
  conversationId: string;
  buyerId: string;
  sellerId: string;
  status: ConversationStatus;
  message: MessageView;
};

/** Why a listing's conversations close, by the listing's outbox event */
export const CLOSING_EVENTS: Record<string, SystemCode> = {
  'listing.sold': 'listing_sold',
  'listing.deleted': 'listing_deleted',
  'listing.expired': 'listing_expired',
  'listing.rejected': 'listing_removed',
};
/** Events after which a listing may be live again */
export const REOPENING_EVENTS = ['listing.renewed', 'listing.published', 'listing.resumed'] as const;

async function writeStatusChange(
  tx: Queryable,
  rows: Array<{ id: string; buyer_user_id: string; seller_user_id: string }>,
  status: 'open' | 'closed',
  code: SystemCode,
): Promise<StatusChange[]> {
  if (rows.length === 0) return [];
  const inserted = await tx
    .insert(messages)
    .values(rows.map((r) => ({ conversationId: r.id, senderUserId: null, kind: 'system' as const, body: code, createdAt: sql`date_trunc('milliseconds', clock_timestamp())` })))
    .returning();
  await tx.insert(outboxEvents).values(
    rows.map((r) => ({
      eventType: status === 'closed' ? 'conversation.closed' : 'conversation.reopened',
      aggregateType: 'conversation',
      aggregateId: r.id,
      payload: { reason: code },
    })),
  );
  const byConversation = new Map(inserted.map((m) => [m.conversationId, m]));
  return rows.map((r) => ({
    conversationId: r.id,
    buyerId: r.buyer_user_id,
    sellerId: r.seller_user_id,
    status,
    message: messageView(byConversation.get(r.id)!),
  }));
}

/** Closes the listing's open conversations with a system message. Locked ones stay locked. */
export async function closeListingConversations(db: Db, listingId: string, code: SystemCode): Promise<StatusChange[]> {
  return db.transaction(async (tx) => {
    const rows = await tx.execute<{ id: string; buyer_user_id: string; seller_user_id: string }>(sql`
      UPDATE conversations SET status = 'closed'
      WHERE listing_id = ${listingId} AND status = 'open'
      RETURNING id, buyer_user_id, seller_user_id
    `);
    return writeStatusChange(tx, [...rows], 'closed', code);
  });
}

/**
 * Opens the listing's closed conversations again when the listing is live and both participants
 * still have an account. A conversation closed because someone deleted their account stays closed.
 */
export async function reopenListingConversations(db: Db, listingId: string): Promise<StatusChange[]> {
  return db.transaction(async (tx) => {
    const rows = await tx.execute<{ id: string; buyer_user_id: string; seller_user_id: string }>(sql`
      UPDATE conversations c SET status = 'open'
      FROM listings l, users b, users s
      WHERE c.listing_id = ${listingId} AND c.status = 'closed'
        AND l.id = c.listing_id AND l.status = 'active'
        AND b.id = c.buyer_user_id AND b.status = 'active'
        AND s.id = c.seller_user_id AND s.status = 'active'
      RETURNING c.id, c.buyer_user_id, c.seller_user_id
    `);
    return writeStatusChange(tx, [...rows], 'open', 'listing_active');
  });
}

/** The participants of conversations, for publishing to both */
export async function participants(db: Queryable, ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select({ id: conversations.id, buyerId: conversations.buyerUserId, sellerId: conversations.sellerUserId })
    .from(conversations)
    .where(inArray(conversations.id, ids));
}
