import type { Redis } from 'ioredis';
import type { Queryable } from '../../db/drizzle';
import { hit } from '../../lib/rate-limit';
import { messages } from '../../messages/fa';
import { clearUnreachable, markUnreachable } from '../notifications/telegram-reach';
import { acceptTelegramContact, bindTelegramLink } from './phone';
import { telegramNumberToE164 } from './phone-number';

// The phone verification bot's logic: one Telegram update in, replies out. The polling loop and
// the HTTP client are in src/worker/telegram.ts. Private chats only; in a private chat the chat id
// equals the user's id.

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; is_bot?: boolean };
    chat: { id: number; type: string };
    text?: string;
    contact?: { phone_number: string; user_id?: number };
  };
  /** The person blocked ("kicked") or unblocked ("member") the bot in their private chat */
  my_chat_member?: {
    chat: { id: number; type: string };
    from: { id: number };
    new_chat_member: { status: string };
  };
};

export type ReplyMarkup =
  | {
      keyboard: Array<Array<{ text: string; request_contact?: boolean }>>;
      resize_keyboard: true;
      one_time_keyboard: true;
      is_persistent?: boolean;
    }
  | { remove_keyboard: true }
  | { inline_keyboard: Array<Array<{ text: string; url: string }>> };

export interface BotApi {
  sendMessage(chatId: number, text: string, replyMarkup?: ReplyMarkup): Promise<void>;
}

const BOT_LIMIT = { name: 'telegram:user:1h', max: 30, windowSeconds: 3_600 };
const REMOVE_KEYBOARD: ReplyMarkup = { remove_keyboard: true };

export async function handleUpdate(
  db: Queryable,
  redis: Redis,
  api: BotApi,
  update: TelegramUpdate,
): Promise<void> {
  const member = update.my_chat_member;
  if (member && member.chat.type === 'private') {
    // Chat notices fall back to email while the bot is blocked (src/worker/chat.ts)
    if (member.new_chat_member.status === 'kicked') await markUnreachable(redis, member.from.id);
    else if (member.new_chat_member.status === 'member') await clearUnreachable(redis, member.from.id);
    return;
  }

  const msg = update.message;
  const from = msg?.from;
  if (!msg || !from || from.is_bot || msg.chat.type !== 'private') return;
  // Writing to the bot means it can reach this person again
  await clearUnreachable(redis, from.id);
  const t = messages.bot;

  const limit = await hit(redis, [[BOT_LIMIT, String(from.id)]]);
  if (!limit.ok) return; // silently: replying would only feed a flood

  if (msg.contact) {
    const result = await acceptTelegramContact(db, {
      fromId: from.id,
      contactUserId: msg.contact.user_id,
      phoneE164: telegramNumberToE164(msg.contact.phone_number),
    });
    if (result.ok) {
      await api.sendMessage(msg.chat.id, t.verified, REMOVE_KEYBOARD);
      return;
    }
    const text = {
      no_pending: t.noPending,
      foreign_contact: t.foreignContact,
      invalid_number: t.invalidNumber,
      phone_in_use: t.phoneInUse,
      telegram_in_use: t.telegramInUse,
      too_many_attempts: t.noPending,
      undeliverable: t.noPending,
    }[result.reason];
    await api.sendMessage(msg.chat.id, text, REMOVE_KEYBOARD);
    return;
  }

  const start = msg.text?.match(/^\/start(?:@\w+)?(?:\s+(\S+))?\s*$/);
  if (start) {
    const token = start[1];
    if (!token) {
      await api.sendMessage(msg.chat.id, t.welcome, REMOVE_KEYBOARD);
      return;
    }
    const bound = await bindTelegramLink(db, { token, telegramUserId: from.id });
    if (!bound.ok) {
      await api.sendMessage(msg.chat.id, t.linkInvalid, REMOVE_KEYBOARD);
      return;
    }
    await api.sendMessage(msg.chat.id, t.sharePrompt, {
      keyboard: [[{ text: t.shareButton, request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
      is_persistent: true,
    });
    return;
  }

  await api.sendMessage(msg.chat.id, t.help);
}
