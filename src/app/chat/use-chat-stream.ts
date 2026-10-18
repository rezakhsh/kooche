'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChatEvent, WireMessage } from '../../modules/chat/realtime';

// The browser side of the live chat (src/app/chat/stream/route.ts). EventSource reconnects by
// itself and sends Last-Event-ID; this hook adds:
// - closing the stream 30 seconds after the tab is hidden and opening it again (with the last
//   message id, so the server replays what came in between) when it is visible. A hidden tab
//   doesn't count as "has the chat open", so its owner gets notices;
// - reconnecting at once when the browser comes back online, and after 50 seconds without even a
//   ping (a connection that died without closing);
// - the fallback: when the stream can't be kept open (three failures within a minute, or the
//   server refuses it), the page reloads its data every 20 seconds while visible and tries the
//   stream again after 5, 10, 20… up to 60 seconds.

const HIDDEN_CLOSE_MS = 30_000;
const FALLBACK_REFRESH_MS = 20_000;
const FAILURES_BEFORE_FALLBACK = 3;
const FAILURE_WINDOW_MS = 60_000;
// The server sends a ping every 20 s; this long without anything, the connection is dead
const SILENCE_MS = 50_000;

type Handlers = {
  conversationId?: string;
  lastId?: string | null;
  onMessage?: (m: WireMessage) => void;
  onRead?: (e: Extract<ChatEvent, { type: 'read' }>) => void;
  onConversation?: (e: Extract<ChatEvent, { type: 'conversation' }>) => void;
  onUnread?: () => void;
  onReload?: () => void;
  /** The tab became visible again */
  onVisible?: () => void;
};

export function useChatStream(handlers: Handlers): { live: boolean } {
  const [live, setLive] = useState(true);
  // Reloading while offline would make Next.js fall back to a full page load, which fails
  const online = <A extends unknown[]>(fn?: (...a: A) => void) => (...a: A) => {
    if (navigator.onLine) fn?.(...a);
  };
  const ref = useRef(handlers);
  ref.current = {
    ...handlers,
    onReload: online(handlers.onReload),
    onUnread: online(handlers.onUnread),
    onConversation: online(handlers.onConversation),
    onVisible: online(handlers.onVisible),
  };
  const conversationId = handlers.conversationId;

  useEffect(() => {
    if (typeof EventSource === 'undefined') {
      setLive(false);
      const timer = setInterval(() => document.visibilityState === 'visible' && ref.current.onReload?.(), FALLBACK_REFRESH_MS);
      return () => clearInterval(timer);
    }
    let es: EventSource | null = null;
    let failures: number[] = [];
    let fallback: ReturnType<typeof setInterval> | null = null;
    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;
    const startFallback = () => {
      es?.close();
      es = null;
      setLive(false);
      fallback ??= setInterval(() => document.visibilityState === 'visible' && ref.current.onReload?.(), FALLBACK_REFRESH_MS);
      // Keep trying the stream, sooner at first (a deploy takes seconds): 5, 10, 20… up to 60 s
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (document.visibilityState === 'visible' && navigator.onLine) open();
        else startFallback();
      }, Math.min(60_000, 5_000 * 2 ** retries++));
    };

    let lastSeen = Date.now();
    const watchdog = setInterval(() => {
      if (es && Date.now() - lastSeen > SILENCE_MS) {
        // Died without closing (a server gone mid-stream): start again with the last id
        close();
        open();
      }
    }, 10_000);

    const open = () => {
      if (es) return;
      lastSeen = Date.now();
      const params = new URLSearchParams();
      if (conversationId) params.set('c', conversationId);
      const after = ref.current.lastId;
      if (after) params.set('after', after);
      const source = new EventSource(`/chat/stream${params.size ? `?${params}` : ''}`);
      es = source;
      const seen = () => (lastSeen = Date.now());
      source.addEventListener('ping', seen);
      source.onopen = () => {
        seen();
        failures = [];
        retries = 0;
        if (fallback) {
          clearInterval(fallback);
          fallback = null;
        }
        setLive(true);
      };
      source.onerror = () => {
        const now = Date.now();
        failures = [...failures.filter((t) => now - t < FAILURE_WINDOW_MS), now];
        // CLOSED: the server refused (signed out, not a participant, full); no automatic retry
        if (es !== source) return;
        if (source.readyState === EventSource.CLOSED || failures.length >= FAILURES_BEFORE_FALLBACK) {
          failures = [];
          startFallback();
        }
      };
      const parse = <T,>(e: MessageEvent): T | null => {
        try {
          return JSON.parse(e.data) as T;
        } catch {
          return null;
        }
      };
      source.addEventListener('message', (e) => {
        seen();
        const m = parse<WireMessage>(e as MessageEvent);
        if (m) ref.current.onMessage?.(m);
      });
      source.addEventListener('read', (e) => {
        const ev = parse<Extract<ChatEvent, { type: 'read' }>>(e as MessageEvent);
        if (ev) ref.current.onRead?.(ev);
      });
      source.addEventListener('conversation', (e) => {
        const ev = parse<Extract<ChatEvent, { type: 'conversation' }>>(e as MessageEvent);
        if (ev) ref.current.onConversation?.(ev);
      });
      source.addEventListener('unread', () => ref.current.onUnread?.());
      source.addEventListener('reload', () => ref.current.onReload?.());
    };

    const close = () => {
      es?.close();
      es = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenTimer ??= setTimeout(() => {
          hiddenTimer = null;
          close();
        }, HIDDEN_CLOSE_MS);
        return;
      }
      if (hiddenTimer) {
        clearTimeout(hiddenTimer);
        hiddenTimer = null;
      }
      if (!es) {
        // Try the stream again; the fallback stops once it opens
        failures = [];
        open();
      }
      ref.current.onVisible?.();
    };

    // Back online (a phone leaving a tunnel): reconnect at once instead of waiting for a retry
    const onOnline = () => {
      if (document.visibilityState !== 'visible') return;
      close();
      failures = [];
      open();
    };

    if (document.visibilityState === 'visible') open();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      if (hiddenTimer) clearTimeout(hiddenTimer);
      if (fallback) clearInterval(fallback);
      if (retryTimer) clearTimeout(retryTimer);
      clearInterval(watchdog);
      close();
    };
  }, [conversationId]);

  return { live };
}
