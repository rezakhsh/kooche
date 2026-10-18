'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/icons';
import { messages } from '../../messages/fa';
import type { WireMessage } from '../../modules/chat/realtime';
import { sendAction, type SendState } from './actions';

// The message box at the bottom of a conversation (and on the "new conversation" page). On a
// computer Enter sends and Shift+Enter starts a new line; on a phone Enter is a new line and the
// button sends. Without JavaScript it is a plain form.

const MAX = 4_000;
const t = messages.chat;

export function Composer({
  hidden,
  onSent,
  quickReplies,
  autoFocus,
}: {
  hidden: { conversationId?: string; listingToken?: string };
  onSent?: (m: WireMessage) => void;
  quickReplies?: readonly string[];
  autoFocus?: boolean;
}) {
  const [state, action, pending] = useActionState<SendState, FormData>(sendAction, undefined);
  const [text, setText] = useState('');
  // Without JavaScript the button must stay usable, so it is only disabled once hydrated
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // Keep what was typed before the page finished loading
    if (area.current?.value) setText(area.current.value);
    setHydrated(true);
  }, []);
  const form = useRef<HTMLFormElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  // What was sent: when the answer comes, only that is cleared, not something typed since
  const sentBody = useRef<string | null>(null);
  useEffect(() => {
    if (state?.message) {
      const sent = sentBody.current;
      sentBody.current = null;
      setText((current) => (current === sent ? '' : current));
      onSent?.(state.message);
      area.current?.focus();
    }
    // `at` makes two identical results count twice
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.message?.id, state?.at]);

  // Grow with the text, up to about six lines
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [text]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    e.preventDefault();
    if (text.trim() && !pending) form.current?.requestSubmit();
  };

  return (
    <div className="border-t border-neutral-200 bg-white px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-6">
      {quickReplies && !text && (
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {quickReplies.map((q) => (
            <button key={q} type="button" onClick={() => setText(q)} className="shrink-0 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-800 hover:bg-brand-100">
              {q}
            </button>
          ))}
        </div>
      )}
      {state?.error && (
        <p role="alert" className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}
      <form ref={form} action={action} onSubmit={() => (sentBody.current = text)} className="flex items-end gap-2">
        {hidden.conversationId && <input type="hidden" name="conversationId" value={hidden.conversationId} />}
        {hidden.listingToken && <input type="hidden" name="listingToken" value={hidden.listingToken} />}
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t.placeholder}</span>
          <textarea
            ref={area}
            name="body"
            rows={1}
            required
            maxLength={MAX}
            dir="auto"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t.placeholder}
            autoFocus={autoFocus}
            className="block max-h-42 w-full resize-none rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-base leading-6 outline-none focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
          />
        </label>
        <button
          type="submit"
          disabled={hydrated && (pending || !text.trim())}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-700/40"
          title={t.send}
        >
          <Icon name="send" className="size-5 -scale-x-100" />
          <span className="sr-only">{pending ? t.sending : t.send}</span>
        </button>
      </form>
      {text.length > MAX - 500 && (
        <p className="mt-1 text-end text-[11px] text-neutral-500" aria-live="polite">
          {t.counter(text.length, MAX)}
        </p>
      )}
    </div>
  );
}
