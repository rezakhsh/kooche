import { randomUUID } from 'node:crypto';
import { appDb } from '../../../db/drizzle';
import { valkey } from '../../../lib/valkey';
import { chatHub } from '../../../modules/chat/hub';
import { INBOX_SCOPE, markViewing, stopViewing } from '../../../modules/chat/presence';
import { messagesAfter, isParticipant } from '../../../modules/chat/queries';
import { type ChatEvent, wireMessage } from '../../../modules/chat/realtime';
import { currentSession } from '../../../modules/users/server';

// Server-sent events for the chat pages (docs/setup.md, "Chat"). `?c=<conversation>` on a
// conversation page, nothing on the inbox. Events: `message` (with `id:` = message id, so the
// browser's EventSource sends Last-Event-ID when it reconnects), `read`, `conversation`, `unread`,
// and `reload` when too much was missed. The stream subscribes first, then replays what came
// after the last id the browser has (Last-Event-ID, or ?after= on the first connect), so nothing
// falls between the two; the browser drops duplicates by id.
//
// Cloudflare closes a proxied connection after 100 seconds without data: a `ping` event every
// PING_MS keeps it open, refreshes the "viewing" presence, and lets the browser notice a
// connection that died without closing (use-chat-stream.ts reconnects after 50 s of silence). Each stream ends after
// MAX_STREAM_MS and the browser reconnects, so no connection lives forever. A stream holds no
// database connection.

export const dynamic = 'force-dynamic';

const PING_MS = 20_000;
const MAX_STREAM_MS = 10 * 60_000;
const RETRY_MS = 3_000;

export async function GET(request: Request): Promise<Response> {
  const session = await currentSession();
  if (!session) return new Response(null, { status: 401 });
  const userId = session.user.id;
  const url = new URL(request.url);
  const conversationId = url.searchParams.get('c');
  const db = appDb();
  if (conversationId && !(await isParticipant(db, userId, conversationId))) return new Response(null, { status: 404 });

  const hub = chatHub();
  const room = hub.canOpen(userId);
  if (room !== 'ok') return new Response(null, { status: room === 'process_full' ? 503 : 429 });

  const lastId = request.headers.get('last-event-id') ?? url.searchParams.get('after');
  const redis = valkey();
  const scope = conversationId ?? INBOX_SCOPE;
  const connectionId = randomUUID();
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const write = (chunk: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };
      const sent = new Set<string>();
      const send = (event: ChatEvent) => {
        if (event.type === 'message') {
          if (conversationId && event.message.conversationId !== conversationId) {
            // Another conversation: only the badge changes here
            write(`event: unread\ndata: {}\n\n`);
            return;
          }
          if (sent.has(event.message.id)) return;
          sent.add(event.message.id);
          write(`id: ${event.message.id}\nevent: message\ndata: ${JSON.stringify(event.message)}\n\n`);
          return;
        }
        if ((event.type === 'read' || event.type === 'conversation') && conversationId && event.conversationId !== conversationId) return;
        // On a conversation page the badge follows messages of other conversations (above); a
        // plain `unread` would only reload the page for this conversation's own messages
        if (event.type === 'unread' && conversationId) return;
        write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      };

      // Events that arrive during the replay wait until it is done
      let buffer: ChatEvent[] | null = [];
      const unsubscribe = await hub.subscribe(userId, (e) => (buffer ? buffer.push(e) : send(e)));
      const ping = setInterval(() => {
        // A named event, so the browser's watchdog sees it (comments are invisible to scripts)
        write('event: ping\ndata: {}\n\n');
        void markViewing(redis, userId, scope, connectionId).catch(() => {});
      }, PING_MS);
      const end = setTimeout(() => close(), MAX_STREAM_MS);
      function close() {
        if (!open) return;
        open = false;
        clearInterval(ping);
        clearTimeout(end);
        unsubscribe();
        void stopViewing(redis, userId, scope, connectionId).catch(() => {});
        try {
          controller.close();
        } catch {}
      }
      cleanup = close;
      request.signal.addEventListener('abort', close);

      write(`retry: ${RETRY_MS}\n: connected\n\n`);
      void markViewing(redis, userId, scope, connectionId).catch(() => {});
      try {
        if (conversationId && lastId) {
          const missed = await messagesAfter(db, { userId, conversationId, afterId: lastId });
          if (missed === null) write(`event: reload\ndata: {}\n\n`);
          else for (const m of missed) send({ type: 'message', message: wireMessage(m) });
        } else if (!conversationId && lastId) {
          // The inbox simply refreshes after a reconnect
          write(`event: reload\ndata: {}\n\n`);
        }
      } catch (e) {
        console.error('chat stream: replay failed:', e instanceof Error ? e.message : e);
        write(`event: reload\ndata: {}\n\n`);
      }
      const waiting = buffer;
      buffer = null;
      for (const e of waiting) send(e);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, no-transform',
      // Next.js compresses responses, which would hold the events back in a buffer
      'Content-Encoding': 'none',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}
