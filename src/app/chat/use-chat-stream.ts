'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChatEvent, WireMessage } from '../../modules/chat/realtime';

// The browser side of the live chat (src/app/chat/stream/route.ts). EventSource reconnects by
// itself and sends Last-Event-ID; this hook adds:
// - closing the stream 30 seconds after the tab is hidden and opening it again (with the last
//   message id, so the server replays what came in between) when it is visible. A hidden tab
//   doesn't count as "has the chat open", so its owner gets notices;
// - the fallback: when the stream can't be kept open (three failures within a minute, or the
//   server refuses it), the page reloads its data every 20 seconds while visible.

const HIDDEN_CLOSE_MS = 30_000;
const FALLBACK_REFRESH_MS = 20_000;
const FAILURES_BEFORE_FALLBACK = 3;
const FAILURE_WINDOW_MS = 60_000;

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
  const ref = useRef(handlers);
  ref.current = handlers;
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

    const startFallback = () => {
      es?.close();
      es = null;
      setLive(false);
      fallback ??= setInterval(() => document.visibilityState === 'visible' && ref.current.onReload?.(), FALLBACK_REFRESH_MS);
    };

    const open = () => {
      if (es) return;
      const params = new URLSearchParams();
      if (conversationId) params.set('c', conversationId);
      const after = ref.current.lastId;
      if (after) params.set('after', after);
      const source = new EventSource(`/chat/stream${params.size ? `?${params}` : ''}`);
      es = source;
      source.onopen = () => {
        failures = [];
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
        if (source.readyState === EventSource.CLOSED || failures.length >= FAILURES_BEFORE_FALLBACK) startFallback();
      };
      const parse = <T,>(e: MessageEvent): T | null => {
        try {
          return JSON.parse(e.data) as T;
        } catch {
          return null;
        }
      };
      source.addEventListener('message', (e) => {
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

    if (document.visibilityState === 'visible') open();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (hiddenTimer) clearTimeout(hiddenTimer);
      if (fallback) clearInterval(fallback);
      close();
    };
  }, [conversationId]);

  return { live };
}
