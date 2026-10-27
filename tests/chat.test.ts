import { and, eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema';
import {
  closeListingConversations,
  markRead,
  reopenListingConversations,
  sendMessage,
  setArchived,
  type Sent,
} from '../src/modules/chat/conversations';
import { exportChatData } from '../src/modules/chat/export';
import { CHAT_LIMITS } from '../src/modules/chat/limits';
import { conversationCounts, conversationFor, inbox, messagesAfter, messagesPage, unreadConversations } from '../src/modules/chat/queries';
import { purgeChatsOfDeletedUsers } from '../src/modules/chat/retention';
import { revealPhone } from '../src/modules/listings/phone-reveal';
import { reportMessage } from '../src/modules/moderation/reports';
import { blockUser, unblockUser } from '../src/modules/users/blocks';
import { appDb, redis, workerDb, workerSql } from './accounts';
import { db, makeListing, type Tx } from './db';
import { outbox, user } from './listings-fixtures';

// Chat (approved Oct 18, 2026): run as classifieds_app (the web) and classifieds_worker (closing
// and retention), so the tests also prove the grants are enough.

const DAY = 86_400_000;
const owner = db as unknown as Tx;

/** A seller with an active listing, and a buyer; both verified and older than 7 days */
async function pair(opts: { buyerNew?: boolean; allowPhone?: boolean } = {}) {
  const seller = await user({ name: 'فروشنده' });
  const buyer = await user({ name: 'خریدار' });
  const old = new Date(Date.now() - 30 * DAY);
  await db.update(schema.users).set({ createdAt: old }).where(eq(schema.users.id, seller.id));
  if (!opts.buyerNew) await db.update(schema.users).set({ createdAt: old }).where(eq(schema.users.id, buyer.id));
  const listing = await makeListing(owner, seller.id, { allowPhoneContact: opts.allowPhone ?? false });
  return { seller, buyer, listing };
}

async function first(buyerId: string, token: string, body = 'سلام، هنوز موجوده؟'): Promise<Sent> {
  const r = await sendMessage(appDb, redis, { userId: buyerId, target: { listingToken: token }, body });
  if (!r.ok) throw new Error(`send refused: ${r.reason}`);
  return r;
}

async function conv(id: string) {
  const [c] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, id));
  return c!;
}

describe('starting and sending', () => {
  it('counts the buyers who wrote about each listing, for its seller only («۴ گفتگو» in my listings)', async () => {
    const { seller, buyer, listing } = await pair();
    const other = await user({ name: 'خریدار دوم', createdAt: new Date(Date.now() - 30 * DAY) });
    await first(buyer.id, listing.publicToken);
    await first(buyer.id, listing.publicToken, 'قیمت آخر؟');
    await first(other.id, listing.publicToken);
    const quiet = await makeListing(owner, seller.id);
    const counts = await conversationCounts(appDb, seller.id, [listing.id, quiet.id]);
    expect(counts.get(listing.id)).toBe(2);
    expect(counts.has(quiet.id)).toBe(false);
    // Someone else asking about the seller's listings learns nothing
    expect((await conversationCounts(appDb, buyer.id, [listing.id])).size).toBe(0);
    expect((await conversationCounts(appDb, seller.id, [])).size).toBe(0);
  });

  it('creates the conversation with its first message and reuses it afterwards', async () => {
    const { seller, buyer, listing } = await pair();
    const a = await first(buyer.id, listing.publicToken);
    expect(a.started).toBe(true);
    expect(a.recipientId).toBe(seller.id);
    const b = await first(buyer.id, listing.publicToken, 'قیمت آخر؟');
    expect(b.started).toBe(false);
    expect(b.conversationId).toBe(a.conversationId);

    const c = await conv(a.conversationId);
    expect(c.sellerUserId).toBe(seller.id);
    expect(c.sellerUnreadCount).toBe(2);
    expect(c.buyerUnreadCount).toBe(0);
    const types = await outbox(a.conversationId);
    expect(types).toEqual(['conversation.started', 'message.sent', 'message.sent']);
  });

  it('refuses the seller on their own listing, unverified users and listings that are not active', async () => {
    const { seller, listing } = await pair();
    const own = await sendMessage(appDb, redis, { userId: seller.id, target: { listingToken: listing.publicToken }, body: 'x' });
    expect(own).toMatchObject({ ok: false, reason: 'own_listing' });

    const unverified = await user({ verified: false });
    const r = await sendMessage(appDb, redis, { userId: unverified.id, target: { listingToken: listing.publicToken }, body: 'سلام' });
    expect(r).toMatchObject({ ok: false, reason: 'phone_required' });

    const buyer = await user();
    await db.update(schema.listings).set({ status: 'paused' }).where(eq(schema.listings.id, listing.id));
    const paused = await sendMessage(appDb, redis, { userId: buyer.id, target: { listingToken: listing.publicToken }, body: 'سلام' });
    expect(paused).toMatchObject({ ok: false, reason: 'listing_unavailable' });
  });

  it('refuses empty and too long messages', async () => {
    const { buyer, listing } = await pair();
    const t = { listingToken: listing.publicToken };
    expect(await sendMessage(appDb, redis, { userId: buyer.id, target: t, body: '  \n ' })).toMatchObject({ reason: 'empty' });
    expect(await sendMessage(appDb, redis, { userId: buyer.id, target: t, body: 'آ'.repeat(4001) })).toMatchObject({ reason: 'too_long' });
  });

  it('refuses a user with a messaging sanction', async () => {
    const { buyer, listing } = await pair();
    const [d] = await db
      .insert(schema.moderationDecisions)
      .values({ userId: buyer.id, decision: 'sanction', reasonCode: 'spam', policyGround: 'terms-spam', statementFa: 'هرزنامه', decidedBy: 'rule' })
      .returning();
    await db.insert(schema.userSanctions).values({ userId: buyer.id, type: 'messaging_restricted', moderationDecisionId: d!.id });
    const r = await sendMessage(appDb, redis, { userId: buyer.id, target: { listingToken: listing.publicToken }, body: 'سلام' });
    expect(r).toMatchObject({ ok: false, reason: 'restricted' });
  });
});

describe('only participants', () => {
  it('lets nobody else read, send, mark read, archive or report', async () => {
    const { buyer, listing } = await pair();
    const a = await first(buyer.id, listing.publicToken);
    const stranger = await user();
    const id = a.conversationId;

    expect(await sendMessage(appDb, redis, { userId: stranger.id, target: { conversationId: id }, body: 'سلام' })).toMatchObject({ ok: false, reason: 'not_found' });
    expect(await conversationFor(appDb, stranger.id, id)).toBeNull();
    expect((await messagesPage(appDb, { userId: stranger.id, conversationId: id })).messages).toEqual([]);
    expect(await messagesAfter(appDb, { userId: stranger.id, conversationId: id, afterId: a.message.id })).toEqual([]);
    expect(await markRead(appDb, { userId: stranger.id, conversationId: id })).toMatchObject({ ok: false });
    expect(await setArchived(appDb, { userId: stranger.id, conversationId: id, archived: true })).toBe(false);
    expect(await reportMessage(appDb, redis, { userId: stranger.id, messageId: a.message.id, reason: 'spam' })).toMatchObject({ ok: false, reason: 'not_found' });
    expect((await inbox(appDb, stranger.id)).items).toEqual([]);
  });

  it('shows both participants the conversation in their merged inbox', async () => {
    const { seller, buyer, listing } = await pair();
    const a = await first(buyer.id, listing.publicToken);
    const s = await inbox(appDb, seller.id);
    expect(s.items[0]).toMatchObject({ id: a.conversationId, side: 'seller', unread: 1, other: { id: buyer.id } });
    expect((await inbox(appDb, buyer.id, { filter: 'buying' })).items[0]).toMatchObject({ id: a.conversationId, side: 'buyer', unread: 0 });
    expect((await inbox(appDb, buyer.id, { filter: 'selling' })).items).toEqual([]);
    expect(await unreadConversations(appDb, seller.id)).toBe(1);
  });
});

describe('read state and archive', () => {
  it('moves the watermark, clears the unread count and gives "seen" on the other side', async () => {
    const { seller, buyer, listing } = await pair();
    const a = await first(buyer.id, listing.publicToken);
    const r = await markRead(appDb, { userId: seller.id, conversationId: a.conversationId });
    expect(r).toMatchObject({ ok: true, otherId: buyer.id });
    if (!r.ok) return;
    expect(r.readAt?.getTime()).toBe(a.message.createdAt.getTime());
    const c = await conv(a.conversationId);
    expect(c.sellerUnreadCount).toBe(0);
    expect((await inbox(appDb, buyer.id)).items[0]!.last.seen).toBe(true);
    // Nothing new: nothing to tell the other side
    expect(await markRead(appDb, { userId: seller.id, conversationId: a.conversationId })).toMatchObject({ readAt: null });
  });

  it('archives per side and brings the conversation back with a new message', async () => {
    const { seller, buyer, listing } = await pair();
    const a = await first(buyer.id, listing.publicToken);
    await setArchived(appDb, { userId: seller.id, conversationId: a.conversationId, archived: true });
    expect((await inbox(appDb, seller.id)).items).toEqual([]);
    expect((await inbox(appDb, seller.id, { filter: 'archived' })).items).toHaveLength(1);
    expect((await inbox(appDb, buyer.id)).items).toHaveLength(1);
    await first(buyer.id, listing.publicToken, 'هستید؟');
    expect((await inbox(appDb, seller.id)).items).toHaveLength(1);
  });

  it('replays the messages after a given one, in order, for a reconnecting stream', async () => {
    const { seller, buyer, listing } = await pair();
    const a = await first(buyer.id, listing.publicToken, 'یک');
    const b = await sendMessage(appDb, redis, { userId: seller.id, target: { conversationId: a.conversationId }, body: 'دو' });
    const c = await first(buyer.id, listing.publicToken, 'سه');
    const missed = await messagesAfter(appDb, { userId: seller.id, conversationId: a.conversationId, afterId: a.message.id });
    expect(missed?.map((m) => m.body)).toEqual(['دو', 'سه']);
    expect(b.ok && c.ok).toBe(true);
    expect(await messagesAfter(appDb, { userId: seller.id, conversationId: a.conversationId, afterId: '00000000-0000-7000-8000-000000000000' })).toBeNull();
  });
});

describe('blocking', () => {
  it('withholds the blocked person’s messages from the blocker without telling them', async () => {
    const { seller, buyer, listing } = await pair();
    const a = await first(buyer.id, listing.publicToken);
    await blockUser(appDb, seller.id, buyer.id);

    const hidden = await first(buyer.id, listing.publicToken, 'چرا جواب نمی‌دهید؟');
    expect(hidden.withheld).toBe(true);
    // The buyer sees their message as sent, like any other
    const mine = await messagesPage(appDb, { userId: buyer.id, conversationId: a.conversationId });
    expect(mine.messages.map((m) => m.body)).toContain('چرا جواب نمی‌دهید؟');
    // The seller never does, the count doesn't move, and no notice goes out
    const theirs = await messagesPage(appDb, { userId: seller.id, conversationId: a.conversationId });
    expect(theirs.messages.map((m) => m.body)).not.toContain('چرا جواب نمی‌دهید؟');
    expect((await conv(a.conversationId)).sellerUnreadCount).toBe(1);
    const notices = (await outbox(a.conversationId)).filter((e) => e === 'message.sent');
    expect(notices).toHaveLength(1);
    // The blocker can't write
    const r = await sendMessage(appDb, redis, { userId: seller.id, target: { conversationId: a.conversationId }, body: 'x' });
    expect(r).toMatchObject({ ok: false, reason: 'blocked_by_me' });
    expect((await conversationFor(appDb, seller.id, a.conversationId))!.blocks.iBlocked).toBe(true);
    // Nothing on the blocked side says so
    expect((await conversationFor(appDb, buyer.id, a.conversationId))!.blocks).toEqual({ iBlocked: false, blockedMe: false });

    // Even after an unblock, what was withheld stays withheld
    await unblockUser(appDb, seller.id, buyer.id);
    const after = await messagesPage(appDb, { userId: seller.id, conversationId: a.conversationId });
    expect(after.messages.map((m) => m.body)).not.toContain('چرا جواب نمی‌دهید؟');
  });

  it('keeps a conversation that a blocked person started out of the blocker’s inbox', async () => {
    const { seller, buyer, listing } = await pair();
    await blockUser(appDb, seller.id, buyer.id);
    const a = await first(buyer.id, listing.publicToken);
    expect(a.withheld).toBe(true);
    expect((await inbox(appDb, seller.id)).items).toEqual([]);
    expect(await unreadConversations(appDb, seller.id)).toBe(0);
    expect((await inbox(appDb, buyer.id)).items).toHaveLength(1);
  });
});

describe('scam guard', () => {
  it('stores the risk flags of a message', async () => {
    const { buyer, listing } = await pair();
    const a = await first(buyer.id, listing.publicToken, 'اول بیعانه کارت به کارت کنید، در واتساپ پیام بدهید');
    const [m] = await db.select().from(schema.messages).where(eq(schema.messages.id, a.message.id));
    expect(m!.riskFlags).toEqual(['payment_request', 'off_platform_contact']);
  });

  it('refuses links and IBANs from accounts younger than 7 days, and lets them through later', async () => {
    const { buyer, listing } = await pair({ buyerNew: true });
    const t = { listingToken: listing.publicToken };
    expect(await sendMessage(appDb, redis, { userId: buyer.id, target: t, body: 'عکس‌ها: https://example.com/x' })).toMatchObject({ reason: 'new_account_links' });
    expect(await sendMessage(appDb, redis, { userId: buyer.id, target: t, body: 'DE89 3704 0044 0532 0130 00' })).toMatchObject({ reason: 'new_account_links' });
    // Nothing was stored
    expect((await inbox(appDb, buyer.id)).items).toEqual([]);
    // Other flags only warn
    const phone = await first(buyer.id, listing.publicToken, 'شماره‌ام 0176 12345678');
    expect(phone.message.riskFlags).toEqual(['phone_number']);

    await db.update(schema.users).set({ createdAt: new Date(Date.now() - 8 * DAY) }).where(eq(schema.users.id, buyer.id));
    const link = await first(buyer.id, listing.publicToken, 'عکس‌ها: https://example.com/x');
    expect(link.message.riskFlags).toEqual(['link']);
  });

  it('limits messages per minute', async () => {
    const { buyer, listing } = await pair();
    await redis.set(`rl:${CHAT_LIMITS.messagesPerUserMinute.name}:${buyer.id}`, String(CHAT_LIMITS.messagesPerUserMinute.max), 'EX', 60);
    const r = await sendMessage(appDb, redis, { userId: buyer.id, target: { listingToken: listing.publicToken }, body: 'سلام' });
    expect(r).toMatchObject({ ok: false, reason: 'rate_limited' });
  });

  it('limits new conversations of new accounts to 5 an hour', async () => {
    const buyer = await user();
    for (let i = 0; i < 5; i++) {
      const { listing } = await pair();
      await first(buyer.id, listing.publicToken);
    }
    const { listing } = await pair();
    const r = await sendMessage(appDb, redis, { userId: buyer.id, target: { listingToken: listing.publicToken }, body: 'سلام' });
    expect(r).toMatchObject({ ok: false, reason: 'rate_limited' });
  });
});

describe('closed conversations', () => {
  it('close with a system message when the listing is sold, are read-only, and reopen when it is live again', async () => {
    const { seller, buyer, listing } = await pair();
    const a = await first(buyer.id, listing.publicToken);
    await db.update(schema.listings).set({ status: 'expired' }).where(eq(schema.listings.id, listing.id));
    const closed = await closeListingConversations(workerDb, listing.id, 'listing_expired');
    expect(closed).toHaveLength(1);
    expect(closed[0]!.message).toMatchObject({ kind: 'system', body: 'listing_expired', senderId: null });
    expect((await conv(a.conversationId)).status).toBe('closed');
    // No unread count for a system message
    expect((await conv(a.conversationId)).sellerUnreadCount).toBe(1);

    for (const userId of [buyer.id, seller.id]) {
      const r = await sendMessage(appDb, redis, { userId, target: { conversationId: a.conversationId }, body: 'سلام' });
      expect(r).toMatchObject({ ok: false, reason: 'closed' });
    }
    const viaListing = await sendMessage(appDb, redis, { userId: buyer.id, target: { listingToken: listing.publicToken }, body: 'سلام' });
    expect(viaListing).toMatchObject({ ok: false, reason: 'closed' });

    // Still expired: nothing reopens
    expect(await reopenListingConversations(workerDb, listing.id)).toEqual([]);
    await db.update(schema.listings).set({ status: 'active' }).where(eq(schema.listings.id, listing.id));
    const reopened = await reopenListingConversations(workerDb, listing.id);
    expect(reopened.map((r) => r.message.body)).toEqual(['listing_active']);
    expect((await sendMessage(appDb, redis, { userId: buyer.id, target: { conversationId: a.conversationId }, body: 'تمدید شد؟' })).ok).toBe(true);
  });

  it('stay closed after a participant deleted their account, and locked ones stay locked', async () => {
    const { buyer, listing } = await pair();
    const a = await first(buyer.id, listing.publicToken);
    await workerDb.execute(sql`SELECT erase_user(${buyer.id})`);
    expect((await conv(a.conversationId)).status).toBe('closed');
    expect(await reopenListingConversations(workerDb, listing.id)).toEqual([]);

    const p = await pair();
    const b = await first(p.buyer.id, p.listing.publicToken);
    await db.update(schema.conversations).set({ status: 'locked' }).where(eq(schema.conversations.id, b.conversationId));
    expect(await closeListingConversations(workerDb, p.listing.id, 'listing_sold')).toEqual([]);
    const r = await sendMessage(appDb, redis, { userId: p.buyer.id, target: { conversationId: b.conversationId }, body: 'x' });
    expect(r).toMatchObject({ ok: false, reason: 'locked' });
  });
});

describe('reports', () => {
  it('reports a message once per person, with an outbox event; never one’s own message', async () => {
    const { seller, buyer, listing } = await pair();
    const a = await first(buyer.id, listing.publicToken, 'بیعانه بفرستید');
    const r = await reportMessage(appDb, redis, { userId: seller.id, messageId: a.message.id, reason: 'scam', details: 'درخواست پول' });
    expect(r).toMatchObject({ ok: true, already: false, senderId: buyer.id });
    const again = await reportMessage(appDb, redis, { userId: seller.id, messageId: a.message.id, reason: 'scam' });
    expect(again).toMatchObject({ ok: true, already: true });
    const own = await reportMessage(appDb, redis, { userId: buyer.id, messageId: a.message.id, reason: 'spam' });
    expect(own).toMatchObject({ ok: false, reason: 'not_found' });

    const rows = await db.select().from(schema.reports).where(eq(schema.reports.messageId, a.message.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ reporterUserId: seller.id, reasonCode: 'scam', status: 'open' });
    const [event] = await db.select().from(schema.outboxEvents).where(eq(schema.outboxEvents.aggregateId, rows[0]!.id));
    expect(event!.eventType).toBe('report.created');
  });

  it('can’t report a message withheld from oneself', async () => {
    const { seller, buyer, listing } = await pair();
    await blockUser(appDb, seller.id, buyer.id);
    const a = await first(buyer.id, listing.publicToken);
    expect(await reportMessage(appDb, redis, { userId: seller.id, messageId: a.message.id, reason: 'spam' })).toMatchObject({ ok: false });
  });
});

describe('phone reveal', () => {
  const reveal = (userId: string, token: string, ip = `198.51.100.${Math.floor(Math.random() * 250)}`) =>
    revealPhone(appDb, redis, { userId, token, ip, userAgent: 'test' });

  it('needs a verified phone, shows the number only when the seller chose it, and logs every reveal', async () => {
    const { seller, listing } = await pair({ allowPhone: true });
    const unverified = await user({ verified: false });
    expect(await reveal(unverified.id, listing.publicToken)).toMatchObject({ ok: false, reason: 'phone_required' });

    const viewer = await user();
    const r = await reveal(viewer.id, listing.publicToken);
    expect(r).toEqual({ ok: true, phone: seller.phoneE164 });
    const logs = await db
      .select()
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.actorUserId, viewer.id), eq(schema.auditLog.action, 'listing.phone_revealed')));
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ targetType: 'listing', targetId: listing.id, userAgent: 'test' });
    expect(logs[0]!.ipAddress).toMatch(/^198\.51\.100\./);

    const chatOnly = await pair();
    expect(await reveal(viewer.id, chatOnly.listing.publicToken)).toMatchObject({ ok: false, reason: 'hidden' });
  });

  it('limits reveals per viewer per hour and per day, and per IP', async () => {
    const { listing } = await pair({ allowPhone: true });
    const viewer = await user();
    for (let i = 0; i < 10; i++) expect((await reveal(viewer.id, listing.publicToken)).ok).toBe(true);
    expect(await reveal(viewer.id, listing.publicToken)).toMatchObject({ ok: false, reason: 'rate_limited' });

    const daily = await user();
    await redis.set(`rl:phone-reveal:user:1d:${daily.id}`, '30', 'EX', 86_400);
    expect(await reveal(daily.id, listing.publicToken)).toMatchObject({ ok: false, reason: 'rate_limited' });

    const ip = '192.0.2.77';
    await redis.set(`rl:phone-reveal:ip:1d:${ip}`, '100', 'EX', 86_400);
    expect(await reveal((await user()).id, listing.publicToken, ip)).toMatchObject({ ok: false, reason: 'rate_limited' });
  });
});

describe('retention and export', () => {
  it('deletes chats 90 days after a participant deleted their account, unless a report points at them', async () => {
    const old = await pair();
    const a = await first(old.buyer.id, old.listing.publicToken);
    const reported = await pair();
    const b = await first(reported.buyer.id, reported.listing.publicToken);
    await reportMessage(appDb, redis, { userId: reported.seller.id, messageId: b.message.id, reason: 'scam' });
    const recent = await pair();
    const c = await first(recent.buyer.id, recent.listing.publicToken);

    for (const u of [old.buyer, reported.buyer, recent.buyer]) await workerDb.execute(sql`SELECT erase_user(${u.id})`);
    for (const u of [old.buyer, reported.buyer]) {
      await db.update(schema.users).set({ deletedAt: new Date(Date.now() - 91 * DAY) }).where(eq(schema.users.id, u.id));
    }
    await db.update(schema.users).set({ deletedAt: new Date(Date.now() - 30 * DAY) }).where(eq(schema.users.id, recent.buyer.id));

    expect(await purgeChatsOfDeletedUsers(workerSql)).toBeGreaterThanOrEqual(1);
    const left = async (id: string) => (await db.select().from(schema.conversations).where(eq(schema.conversations.id, id))).length;
    expect(await left(a.conversationId)).toBe(0);
    expect(await db.select().from(schema.messages).where(eq(schema.messages.id, a.message.id))).toEqual([]);
    expect(await left(b.conversationId)).toBe(1);
    expect(await left(c.conversationId)).toBe(1);
  });

  it('exports what the user can see of their conversations', async () => {
    const { seller, buyer, listing } = await pair();
    const a = await first(buyer.id, listing.publicToken, 'سلام');
    await sendMessage(appDb, redis, { userId: seller.id, target: { conversationId: a.conversationId }, body: 'سلام، بله' });
    await blockUser(appDb, seller.id, buyer.id);
    await first(buyer.id, listing.publicToken, 'پنهان از فروشنده');

    const mine = await exportChatData(appDb, buyer.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.messages.map((m) => [m.from, m.body])).toEqual([
      ['me', 'سلام'],
      ['other', 'سلام، بله'],
      ['me', 'پنهان از فروشنده'],
    ]);
    const theirs = await exportChatData(appDb, seller.id);
    expect(theirs[0]!.messages.map((m) => m.body)).toEqual(['سلام', 'سلام، بله']);
  });
});
