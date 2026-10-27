import { and, eq, inArray, sql } from 'drizzle-orm';
import { conversations } from '../../db/schema';
import type { Queryable } from '../../db/drizzle';
import { coverKeys } from '../listings/queries';
import { blockState, type BlockState } from '../users/blocks';
import { type ConversationStatus, type MessageView, type Side } from './conversations';
import type { RiskFlag } from './risk';

// Reads for the chat pages. Every read takes the viewer and returns nothing for anyone who isn't
// a participant. A message withheld because its sender is blocked is visible only to its sender.

export const INBOX_PAGE = 30;
export const MESSAGES_PAGE = 50;
export const REPLAY_LIMIT = 100;

export type InboxFilter = 'all' | 'buying' | 'selling' | 'archived';

export type InboxItem = {
  id: string;
  side: Side;
  status: ConversationStatus;
  unread: number;
  lastMessageAt: Date;
  listing: { id: string; title: string; token: string; status: string; isEvent: boolean; coverKey: string | null };
  other: { id: string; name: string };
  last: { senderId: string | null; kind: 'text' | 'system'; body: string; hidden: boolean; createdAt: Date; seen: boolean };
};

type InboxRow = {
  id: string;
  side: Side;
  status: ConversationStatus;
  unread: number;
  last_message_at: Date | string;
  listing_id: string;
  title: string;
  token: string;
  listing_status: string;
  is_event: boolean;
  other_id: string;
  other_name: string;
  other_read_at: Date | string | null;
  m_sender: string | null;
  m_kind: 'text' | 'system';
  m_body: string;
  m_hidden: boolean;
  m_at: Date | string;
};

const toDate = (v: Date | string) => (v instanceof Date ? v : new Date(v));

/**
 * The inbox: buyer and seller conversations merged, newest first, `INBOX_PAGE` at a time.
 * `before` is the last item of the previous page. Conversations without a message the viewer may
 * see (one a blocked person started) are left out.
 */
export async function inbox(
  db: Queryable,
  userId: string,
  opts: { filter?: InboxFilter; before?: { at: Date; id: string } } = {},
): Promise<{ items: InboxItem[]; next: { at: Date; id: string } | null }> {
  const filter = opts.filter ?? 'all';
  const archived = filter === 'archived';
  const cursor = opts.before
    ? sql`AND (c.last_message_at, c.id) < (${opts.before.at.toISOString()}::timestamptz, ${opts.before.id}::uuid)`
    : sql``;
  const part = (side: Side) => {
    const me = side === 'buyer' ? sql`c.buyer_user_id` : sql`c.seller_user_id`;
    const arch = side === 'buyer' ? sql`c.buyer_archived_at` : sql`c.seller_archived_at`;
    const unread = side === 'buyer' ? sql`c.buyer_unread_count` : sql`c.seller_unread_count`;
    const other = side === 'buyer' ? sql`c.seller_user_id` : sql`c.buyer_user_id`;
    const otherRead = side === 'buyer' ? sql`c.seller_last_read_at` : sql`c.buyer_last_read_at`;
    return sql`(
      SELECT c.id, ${side}::text AS side, c.status, ${unread} AS unread, c.last_message_at, c.listing_id,
             ${other} AS other_id, ${otherRead} AS other_read_at
      FROM conversations c
      WHERE ${me} = ${userId} AND ${archived ? sql`${arch} IS NOT NULL` : sql`${arch} IS NULL`} ${cursor}
      ORDER BY c.last_message_at DESC, c.id DESC
      LIMIT ${INBOX_PAGE + 1}
    )`;
  };
  const parts =
    filter === 'buying' ? part('buyer') : filter === 'selling' ? part('seller') : sql`${part('buyer')} UNION ALL ${part('seller')}`;

  const rows = await db.execute<InboxRow>(sql`
    WITH page AS (
      SELECT * FROM (${parts}) p ORDER BY last_message_at DESC, id DESC LIMIT ${INBOX_PAGE + 1}
    )
    SELECT page.*, l.title, l.public_token AS token, l.status AS listing_status,
           EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = l.id) AS is_event,
           o.display_name AS other_name,
           m.sender_user_id AS m_sender, m.kind AS m_kind, m.body AS m_body,
           (m.hidden_at IS NOT NULL) AS m_hidden, m.created_at AS m_at
    FROM page
    JOIN listings l ON l.id = page.listing_id
    JOIN users o ON o.id = page.other_id
    JOIN LATERAL (
      SELECT sender_user_id, kind, body, hidden_at, created_at FROM messages
      WHERE conversation_id = page.id AND (NOT withheld OR sender_user_id = ${userId})
      ORDER BY created_at DESC, id DESC LIMIT 1
    ) m ON true
    ORDER BY page.last_message_at DESC, page.id DESC
  `);
  const all = [...rows];
  const covers = await coverKeys(db, [...new Set(all.map((r) => r.listing_id))]);
  // The page was cut before conversations without a visible message were left out
  const hasMore = all.length > INBOX_PAGE;
  const items = all.slice(0, INBOX_PAGE).map((r): InboxItem => {
    const lastAt = toDate(r.m_at);
    return {
      id: r.id,
      side: r.side,
      status: r.status,
      unread: Number(r.unread),
      lastMessageAt: toDate(r.last_message_at),
      listing: { id: r.listing_id, title: r.title, token: r.token, status: r.listing_status, isEvent: r.is_event, coverKey: covers.get(r.listing_id) ?? null },
      other: { id: r.other_id, name: r.other_name },
      last: {
        senderId: r.m_sender,
        kind: r.m_kind,
        body: r.m_hidden ? '' : r.m_body,
        hidden: r.m_hidden,
        createdAt: lastAt,
        seen: r.m_sender === userId && r.other_read_at !== null && lastAt <= toDate(r.other_read_at),
      },
    };
  });
  const lastItem = items.at(-1);
  return { items, next: hasMore && lastItem ? { at: lastItem.lastMessageAt, id: lastItem.id } : null };
}

/** How many conversations have unread messages, for the badge in the header and bottom bar */
export async function unreadConversations(db: Queryable, userId: string): Promise<number> {
  const [row] = await db.execute<{ n: number }>(sql`
    SELECT (SELECT count(*) FROM conversations WHERE buyer_user_id = ${userId} AND buyer_unread_count > 0)
         + (SELECT count(*) FROM conversations WHERE seller_user_id = ${userId} AND seller_unread_count > 0) AS n
  `);
  return Number(row?.n ?? 0);
}

/** How many buyers wrote about each of the seller's listings («۴ گفتگو» in "my listings") */
export async function conversationCounts(db: Queryable, sellerId: string, listingIds: string[]): Promise<Map<string, number>> {
  if (listingIds.length === 0) return new Map();
  const rows = await db
    .select({ id: conversations.listingId, n: sql<number>`count(*)::int` })
    .from(conversations)
    .where(and(eq(conversations.sellerUserId, sellerId), inArray(conversations.listingId, listingIds)))
    .groupBy(conversations.listingId);
  return new Map(rows.map((r) => [r.id, Number(r.n)]));
}

export type ConversationView = {
  id: string;
  side: Side;
  status: ConversationStatus;
  archived: boolean;
  /** The other side's read watermark: my messages up to it are "seen" */
  otherReadAt: Date | null;
  listing: {
    id: string;
    title: string;
    token: string;
    status: string;
    isEvent: boolean;
    categoryId: string | null;
    coverKey: string | null;
    price: { type: string; minor: number | null; currency: string | null; minorUnit: number | null };
  };
  other: { id: string; name: string; active: boolean; phoneVerified: boolean; memberSince: Date };
  blocks: BlockState;
};

/** One conversation for one of its participants, or null */
export async function conversationFor(db: Queryable, userId: string, conversationId: string): Promise<ConversationView | null> {
  if (!/^[0-9a-f-]{36}$/.test(conversationId)) return null;
  const [r] = await db.execute<{
    id: string;
    buyer_user_id: string;
    seller_user_id: string;
    status: ConversationStatus;
    buyer_archived_at: string | null;
    seller_archived_at: string | null;
    buyer_last_read_at: Date | string | null;
    seller_last_read_at: Date | string | null;
    listing_id: string;
    title: string;
    token: string;
    listing_status: string;
    is_event: boolean;
    category_id: string | null;
    price_type: string;
    price_minor: string | number | null;
    currency: string | null;
    minor_unit: number | null;
  }>(sql`
    SELECT c.id, c.buyer_user_id, c.seller_user_id, c.status, c.buyer_archived_at, c.seller_archived_at,
           c.buyer_last_read_at, c.seller_last_read_at,
           l.id AS listing_id, l.title, l.public_token AS token, l.status AS listing_status,
           EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = l.id) AS is_event,
           l.category_id, l.price_type, l.price_minor, l.currency, cur.minor_unit
    FROM conversations c
    JOIN listings l ON l.id = c.listing_id
    LEFT JOIN currencies cur ON cur.code = l.currency
    WHERE c.id = ${conversationId} AND (c.buyer_user_id = ${userId} OR c.seller_user_id = ${userId})
  `);
  if (!r) return null;
  const side: Side = r.buyer_user_id === userId ? 'buyer' : 'seller';
  const otherId = side === 'buyer' ? r.seller_user_id : r.buyer_user_id;
  const [o] = await db.execute<{ display_name: string; status: string; phone_verified_at: unknown; created_at: Date | string }>(
    sql`SELECT display_name, status, phone_verified_at, created_at FROM users WHERE id = ${otherId}`,
  );
  // A blocked person isn't shown that they're blocked: only the blocker's own block counts here
  const blocks = await blockState(db, userId, otherId);
  const otherRead = side === 'buyer' ? r.seller_last_read_at : r.buyer_last_read_at;
  const covers = await coverKeys(db, [r.listing_id]);
  return {
    id: r.id,
    side,
    status: r.status,
    archived: (side === 'buyer' ? r.buyer_archived_at : r.seller_archived_at) !== null,
    otherReadAt: otherRead ? toDate(otherRead) : null,
    listing: {
      id: r.listing_id,
      title: r.title,
      token: r.token,
      status: r.listing_status,
      isEvent: r.is_event,
      categoryId: r.category_id,
      coverKey: covers.get(r.listing_id) ?? null,
      price: { type: r.price_type, minor: r.price_minor === null ? null : Number(r.price_minor), currency: r.currency, minorUnit: r.minor_unit },
    },
    other: {
      id: otherId,
      name: o!.display_name,
      active: o!.status === 'active',
      phoneVerified: o!.phone_verified_at !== null,
      memberSince: toDate(o!.created_at),
    },
    blocks: { iBlocked: blocks.iBlocked, blockedMe: false },
  };
}

/** The viewer's conversation about a listing, if there is one */
export async function conversationIdForListing(db: Queryable, userId: string, listingId: string): Promise<string | null> {
  const [r] = await db.execute<{ id: string }>(
    sql`SELECT id FROM conversations WHERE listing_id = ${listingId} AND buyer_user_id = ${userId}`,
  );
  return r?.id ?? null;
}

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_user_id: string | null;
  kind: 'text' | 'system';
  body: string;
  risk_flags: string[] | string;
  hidden_at: unknown;
  created_at: Date | string;
};

function view(r: MessageRow): MessageView {
  const hidden = r.hidden_at !== null;
  const flags = Array.isArray(r.risk_flags) ? r.risk_flags : r.risk_flags.replace(/[{}]/g, '').split(',').filter(Boolean);
  return {
    id: r.id,
    conversationId: r.conversation_id,
    senderId: r.sender_user_id,
    kind: r.kind,
    body: hidden ? '' : r.body,
    riskFlags: hidden ? [] : (flags as RiskFlag[]),
    hidden,
    createdAt: toDate(r.created_at),
  };
}

const visibleTo = (userId: string) => sql`(NOT m.withheld OR m.sender_user_id = ${userId})`;
const participant = (conversationId: string, userId: string) => sql`EXISTS (
  SELECT 1 FROM conversations c WHERE c.id = ${conversationId} AND (c.buyer_user_id = ${userId} OR c.seller_user_id = ${userId})
)`;

/**
 * A page of messages in time order: the newest `MESSAGES_PAGE`, or the ones before `beforeId`.
 * Empty for anyone who isn't a participant.
 */
export async function messagesPage(
  db: Queryable,
  opts: { userId: string; conversationId: string; beforeId?: string },
): Promise<{ messages: MessageView[]; hasOlder: boolean }> {
  const before = opts.beforeId
    ? sql`AND (m.created_at, m.id) < (SELECT created_at, id FROM messages WHERE id = ${opts.beforeId} AND conversation_id = ${opts.conversationId})`
    : sql``;
  const rows = await db.execute<MessageRow>(sql`
    SELECT m.id, m.conversation_id, m.sender_user_id, m.kind, m.body, m.risk_flags, m.hidden_at, m.created_at
    FROM messages m
    WHERE m.conversation_id = ${opts.conversationId} AND ${participant(opts.conversationId, opts.userId)}
      AND ${visibleTo(opts.userId)} ${before}
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT ${MESSAGES_PAGE + 1}
  `);
  const all = [...rows];
  return { messages: all.slice(0, MESSAGES_PAGE).reverse().map(view), hasOlder: all.length > MESSAGES_PAGE };
}

/**
 * Messages after `afterId`, for the live stream's replay on reconnect. Null when `afterId` isn't
 * a message of this conversation or more than REPLAY_LIMIT came since: the client reloads instead.
 */
export async function messagesAfter(
  db: Queryable,
  opts: { userId: string; conversationId: string; afterId: string },
): Promise<MessageView[] | null> {
  if (!/^[0-9a-f-]{36}$/.test(opts.afterId)) return null;
  const rows = await db.execute<MessageRow & { anchor: boolean }>(sql`
    WITH anchor AS (SELECT created_at, id FROM messages WHERE id = ${opts.afterId} AND conversation_id = ${opts.conversationId})
    SELECT m.id, m.conversation_id, m.sender_user_id, m.kind, m.body, m.risk_flags, m.hidden_at, m.created_at
    FROM messages m, anchor a
    WHERE m.conversation_id = ${opts.conversationId} AND ${participant(opts.conversationId, opts.userId)}
      AND ${visibleTo(opts.userId)} AND (m.created_at, m.id) > (a.created_at, a.id)
    ORDER BY m.created_at, m.id
    LIMIT ${REPLAY_LIMIT + 1}
  `);
  const all = [...rows];
  if (all.length > REPLAY_LIMIT) return null;
  if (all.length === 0) {
    const [exists] = await db.execute<{ ok: number }>(
      sql`SELECT 1 AS ok FROM messages WHERE id = ${opts.afterId} AND conversation_id = ${opts.conversationId}`,
    );
    if (!exists) return null;
  }
  return all.map(view);
}

/** Whether the user takes part in the conversation */
export async function isParticipant(db: Queryable, userId: string, conversationId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/.test(conversationId)) return false;
  const [r] = await db.execute<{ ok: number }>(sql`SELECT 1 AS ok WHERE ${participant(conversationId, userId)}`);
  return !!r;
}
