import type { Redis } from 'ioredis';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Queryable } from '../db/drizzle';
import {
  type BotApi,
  type ReplyMarkup,
  type TelegramUpdate,
  handleUpdate,
} from '../modules/users/telegram-bot';

// Telegram Bot API over long polling (getUpdates). The worker has no public URL, and only one
// process may poll a token: during a rolling deploy the old and new worker overlap for a few
// seconds, Telegram answers 409 to one of them, and it retries. Staging and production each need
// their own bot. The token is never logged (it is part of every request URL).

const POLL_TIMEOUT_S = 25;
const RETRY_MS = 5_000;

class TelegramError extends Error {
  constructor(
    readonly method: string,
    readonly status: number,
    description: string,
  ) {
    super(`telegram ${method}: ${status} ${description}`);
  }
}

export class TelegramClient implements BotApi {
  constructor(
    private readonly token: string,
    private readonly signal?: AbortSignal,
  ) {}

  async call<T>(method: string, body: Record<string, unknown>, timeoutMs = 10_000): Promise<T> {
    const signals = [AbortSignal.timeout(timeoutMs), ...(this.signal ? [this.signal] : [])];
    const res = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.any(signals),
    });
    const json = (await res.json().catch(() => null)) as
      | { ok: true; result: T }
      | { ok: false; description?: string }
      | null;
    if (!json?.ok) throw new TelegramError(method, res.status, json?.description ?? 'no body');
    return json.result;
  }

  async sendMessage(chatId: number, text: string, replyMarkup?: ReplyMarkup): Promise<void> {
    await this.call('sendMessage', {
      chat_id: chatId,
      text,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
  }
}

/** Polls until `signal` aborts. Each update is handled once; a failing one is logged and skipped. */
export async function runTelegramBot(
  db: Queryable,
  redis: Redis,
  token: string,
  signal: AbortSignal,
): Promise<void> {
  const api = new TelegramClient(token, signal);
  let offset: number | undefined;

  while (!signal.aborted) {
    try {
      const me = await api.call<{ username: string }>('getMe', {});
      // Long polling and a webhook exclude each other
      await api.call('deleteWebhook', { drop_pending_updates: false });
      console.log(`telegram: polling as @${me.username}`);
      break;
    } catch (e) {
      if (signal.aborted) return;
      console.error('telegram: start failed:', e instanceof Error ? e.message : e);
      await sleep(RETRY_MS, undefined, { signal }).catch(() => {});
    }
  }

  while (!signal.aborted) {
    let updates: TelegramUpdate[];
    try {
      updates = await api.call<TelegramUpdate[]>(
        'getUpdates',
        { offset, timeout: POLL_TIMEOUT_S, allowed_updates: ['message'] },
        (POLL_TIMEOUT_S + 10) * 1_000,
      );
    } catch (e) {
      if (signal.aborted) return;
      const conflict = e instanceof TelegramError && e.status === 409;
      if (!conflict) console.error('telegram: getUpdates failed:', e instanceof Error ? e.message : e);
      await sleep(RETRY_MS, undefined, { signal }).catch(() => {});
      continue;
    }
    for (const update of updates) {
      offset = update.update_id + 1;
      try {
        await handleUpdate(db, redis, api, update);
      } catch (e) {
        console.error(
          `telegram: update ${update.update_id} failed:`,
          e instanceof Error ? e.message : e,
        );
      }
    }
  }
}
