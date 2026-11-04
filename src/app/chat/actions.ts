'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { appDb } from '../../db/drizzle';
import { hit } from '../../lib/rate-limit';
import { valkey } from '../../lib/valkey';
import { messages } from '../../messages/fa';
import { sendMessage, setArchived, type SendRefusal } from '../../modules/chat/conversations';
import { CHAT_LIMITS } from '../../modules/chat/limits';
import { conversationFor, messagesPage } from '../../modules/chat/queries';
import { publish, wireMessage, type WireMessage } from '../../modules/chat/realtime';
import { markReadAndPublish } from '../../modules/chat/server';
import { MESSAGE_REPORT_REASONS, reportMessage } from '../../modules/moderation/reports';
import { blockUser, unblockUser } from '../../modules/users/blocks';
import { currentSession, requireSession } from '../../modules/users/server';

export type SendState = { error?: string; message?: WireMessage; at?: number } | undefined;

const uuid = z.uuid();
const sendSchema = z.object({
  conversationId: uuid.optional(),
  listingToken: z.string().regex(/^[0-9a-hjkmnp-tv-z]{10}$/).optional(),
  body: z.string().max(8_000),
});

function refusalText(reason: SendRefusal, retryAfterSeconds?: number): string {
  const e = messages.chat.errors;
  if (reason === 'rate_limited') return e.rate_limited(Math.ceil((retryAfterSeconds ?? 60) / 60));
  return e[reason];
}

/**
 * Sends a message; the first one about a listing starts the conversation and goes to its page.
 * After the commit the message is published to both participants' live streams (only to the
 * sender when it is withheld because the recipient blocked them).
 */
export async function sendAction(_prev: SendState, form: FormData): Promise<SendState> {
  const session = await currentSession();
  if (!session) return { error: messages.chat.errors.sign_in_required };
  const input = sendSchema.safeParse({
    conversationId: form.get('conversationId') || undefined,
    listingToken: form.get('listingToken') || undefined,
    body: form.get('body') ?? '',
  });
  if (!input.success || (!input.data.conversationId && !input.data.listingToken)) return { error: messages.genericError };
  const { conversationId, listingToken, body } = input.data;

  const redis = valkey();
  const result = await sendMessage(appDb(), redis, {
    userId: session.user.id,
    target: conversationId ? { conversationId } : { listingToken: listingToken! },
    body,
  });
  if (!result.ok) return { error: refusalText(result.reason, result.retryAfterSeconds) };

  const wire = wireMessage(result.message);
  await publish(redis, result.withheld ? [result.senderId] : [result.senderId, result.recipientId], { type: 'message', message: wire });
  if (!result.withheld) await publish(redis, [result.recipientId], { type: 'unread' });
  // A new conversation, or a page sent without JavaScript from the "new" page, opens the chat
  if (!conversationId) redirect(`/chat/${result.conversationId}`);
  return { message: wire, at: Date.now() };
}

/** Marks a conversation read and tells the other side, for the "seen" ticks */
export async function markReadAction(conversationId: string): Promise<void> {
  const session = await currentSession();
  if (!session || !uuid.safeParse(conversationId).success) return;
  await markReadAndPublish(session.user.id, conversationId);
}

/** Older messages for "load older", in time order */
export async function olderMessagesAction(conversationId: string, beforeId: string) {
  const session = await currentSession();
  if (!session || !uuid.safeParse(conversationId).success || !uuid.safeParse(beforeId).success) return null;
  const page = await messagesPage(appDb(), { userId: session.user.id, conversationId, beforeId });
  return { messages: page.messages.map(wireMessage), hasOlder: page.hasOlder };
}

export async function archiveAction(form: FormData): Promise<void> {
  const id = uuid.safeParse(form.get('conversationId'));
  if (!id.success) redirect('/chat');
  const { user } = await requireSession(`/chat/${id.data}`);
  const archived = form.get('archived') === '1';
  await setArchived(appDb(), { userId: user.id, conversationId: id.data, archived });
  redirect(archived ? '/chat?done=archived' : `/chat/${id.data}?done=unarchived`);
}

export async function blockAction(form: FormData): Promise<void> {
  const id = uuid.safeParse(form.get('conversationId'));
  if (!id.success) redirect('/chat');
  const { user } = await requireSession(`/chat/${id.data}`);
  const db = appDb();
  const view = await conversationFor(db, user.id, id.data);
  if (!view) redirect('/chat');
  if (form.get('op') === 'unblock') {
    await unblockUser(db, user.id, view.other.id);
    redirect(`/chat/${id.data}?done=unblocked`);
  }
  const limited = await hit(valkey(), [[CHAT_LIMITS.blocksPerUserDay, user.id]]);
  if (limited.ok) await blockUser(db, user.id, view.other.id);
  redirect(`/chat/${id.data}?done=blocked`);
}

export type ReportState = { done?: 'reported' | 'already'; error?: string } | undefined;

const reportSchema = z.object({
  messageId: uuid,
  reason: z.enum(MESSAGE_REPORT_REASONS),
  details: z.string().max(2_000).optional(),
  alsoBlock: z.literal('on').optional(),
});

export async function reportAction(_prev: ReportState, form: FormData): Promise<ReportState> {
  const session = await currentSession();
  if (!session) return { error: messages.chat.errors.sign_in_required };
  const input = reportSchema.safeParse({
    messageId: form.get('messageId'),
    reason: form.get('reason'),
    details: form.get('details') || undefined,
    alsoBlock: form.get('alsoBlock') || undefined,
  });
  if (!input.success) return { error: messages.genericError };
  const db = appDb();
  const redis = valkey();
  const result = await reportMessage(db, redis, {
    userId: session.user.id,
    messageId: input.data.messageId,
    reason: input.data.reason,
    details: input.data.details ?? null,
  });
  if (!result.ok) {
    return { error: result.reason === 'rate_limited' ? messages.rateLimited(Math.ceil((result.retryAfterSeconds ?? 60) / 60)) : messages.genericError };
  }
  if (input.data.alsoBlock) await blockUser(db, session.user.id, result.senderId);
  return { done: result.already ? 'already' : 'reported' };
}
