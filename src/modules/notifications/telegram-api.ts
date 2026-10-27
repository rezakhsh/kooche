import { rtlLines } from '../../lib/bidi';
import type { BotApi, ReplyMarkup } from '../users/telegram-bot';

// The Telegram Bot API client, shared by the bot's polling loop (src/worker/telegram.ts) and the
// chat notices (src/worker/chat.ts). The token is never logged: it is part of every request URL.

export class TelegramError extends Error {
  constructor(
    readonly method: string,
    readonly status: number,
    readonly description: string,
    /** Seconds to wait, from a 429's parameters.retry_after */
    readonly retryAfter?: number,
  ) {
    super(`telegram ${method}: ${status} ${description}`);
  }
}

export const TELEGRAM_API = 'https://api.telegram.org';

export class TelegramClient implements BotApi {
  constructor(
    private readonly token: string,
    private readonly signal?: AbortSignal,
    /** Another base URL, for tests with a fake Telegram */
    private readonly base: string = TELEGRAM_API,
  ) {}

  async call<T>(method: string, body: Record<string, unknown>, timeoutMs = 10_000): Promise<T> {
    const signals = [AbortSignal.timeout(timeoutMs), ...(this.signal ? [this.signal] : [])];
    const res = await fetch(`${this.base}/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.any(signals),
    });
    const json = (await res.json().catch(() => null)) as
      | { ok: true; result: T }
      | { ok: false; description?: string; parameters?: { retry_after?: number } }
      | null;
    if (!json?.ok) {
      throw new TelegramError(method, res.status, json?.description ?? 'no body', json?.parameters?.retry_after);
    }
    return json.result;
  }

  async sendMessage(chatId: number, text: string, replyMarkup?: ReplyMarkup): Promise<void> {
    await this.call('sendMessage', {
      chat_id: chatId,
      // Every line right to left, whatever it starts with (../../lib/bidi.ts)
      text: rtlLines(text),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
  }
}

/**
 * The person can't be reached through the bot: they blocked it, deleted their Telegram account
 * or never opened a chat with it. Retrying won't help; the notice goes by email instead.
 */
export function isUnreachable(e: unknown): boolean {
  if (!(e instanceof TelegramError)) return false;
  if (e.status === 403) return true;
  return e.status === 400 && /chat not found|user not found|PEER_ID_INVALID/i.test(e.description);
}
