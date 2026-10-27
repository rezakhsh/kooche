'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useActionState, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../../../components/icons';
import { messages } from '../../../messages/fa';
import type { WireMessage } from '../../../modules/chat/realtime';
import { markReadAction, olderMessagesAction, reportAction, type ReportState } from '../actions';
import { Composer } from '../composer';
import { useChatStream } from '../use-chat-stream';

// One conversation, live (docs/setup.md, "Chat"). The page renders the newest messages on the
// server; this component keeps them current through the live stream, marks them read while the
// page is visible, and loads older ones. Without JavaScript the page still works as plain HTML:
// the form posts and the page shows the new state.
//
// My messages sit at the end side (left in RTL), the other person's at the start side, as in
// Telegram and WhatsApp in Persian. Links are shown as text, never as links (scam guard).
// Reporting is in the ⋯ sheet (wave 1), not a flag beside every message.

type Props = {
  conversationId: string;
  meId: string;
  initial: WireMessage[];
  hasOlder: boolean;
  otherReadAt: string | null;
  canWrite: boolean;
  readOnly: ReactNode;
  timeZone: string;
  /** The page just read unread messages: the header, rendered alongside, still counts them */
  refreshBadge?: boolean;
  /** The one safety note at the top, by the listing's kind */
  safety: string;
  quickReplies: readonly string[];
};

const t = messages.chat;

function dayKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

function dayLabel(iso: string, timeZone: string): string {
  const key = dayKey(iso, timeZone);
  const now = Date.now();
  if (key === dayKey(new Date(now).toISOString(), timeZone)) return t.today;
  if (key === dayKey(new Date(now - 86_400_000).toISOString(), timeZone)) return t.yesterday;
  return new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { timeZone, day: 'numeric', month: 'long', weekday: 'long' }).format(new Date(iso));
}

function timeLabel(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('fa-IR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

function merge(list: WireMessage[], more: WireMessage[]): WireMessage[] {
  const byId = new Map(list.map((m) => [m.id, m]));
  for (const m of more) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => (a.createdAt === b.createdAt ? (a.id < b.id ? -1 : 1) : a.createdAt < b.createdAt ? -1 : 1));
}

export function Thread(props: Props) {
  const { conversationId, meId, timeZone } = props;
  const router = useRouter();
  const [list, setList] = useState(props.initial);
  const [hasOlder, setHasOlder] = useState(props.hasOlder);
  const [otherReadAt, setOtherReadAt] = useState(props.otherReadAt);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastId = list.at(-1)?.id ?? null;

  useEffect(() => {
    if (props.refreshBadge) router.refresh();
    // Once, after the first render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A server re-render (after an action or a reload) brings newer props: keep what we have too
  useEffect(() => setList((l) => merge(l, props.initial)), [props.initial]);
  useEffect(() => setOtherReadAt((r) => (props.otherReadAt && (!r || props.otherReadAt > r) ? props.otherReadAt : r)), [props.otherReadAt]);

  const markRead = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRead = useCallback(() => {
    if (document.visibilityState !== 'visible') return;
    if (markRead.current) clearTimeout(markRead.current);
    markRead.current = setTimeout(() => void markReadAction(conversationId), 600);
  }, [conversationId]);

  const { live } = useChatStream({
    conversationId,
    lastId,
    onMessage: (m) => {
      setList((l) => merge(l, [m]));
      if (m.senderId !== meId) scheduleRead();
    },
    onRead: (e) => {
      if (e.readerId !== meId) setOtherReadAt((r) => (!r || e.at > r ? e.at : r));
    },
    onConversation: () => router.refresh(),
    onUnread: () => router.refresh(),
    onReload: () => router.refresh(),
    onVisible: scheduleRead,
  });

  // Keep the view at the newest message unless the reader scrolled up
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [list]);
  const onScroll = () => {
    const el = scroller.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  async function loadOlder(e: React.MouseEvent) {
    const first = list[0];
    if (!first) return;
    e.preventDefault();
    setLoadingOlder(true);
    const el = scroller.current;
    const before = el ? el.scrollHeight - el.scrollTop : 0;
    const page = await olderMessagesAction(conversationId, first.id).catch(() => null);
    setLoadingOlder(false);
    if (!page) return;
    stickToBottom.current = false;
    setList((l) => merge(page.messages, l));
    setHasOlder(page.hasOlder);
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - before;
    });
  }

  let lastDay = '';
  return (
    <>
      <div ref={scroller} onScroll={onScroll} className="flex-1 overflow-y-auto overscroll-contain bg-neutral-50 px-3 py-3" aria-live="polite" aria-relevant="additions">
        <p className="mx-auto mb-2 flex max-w-sm gap-2 rounded-xl bg-saffron-50 p-2.5 text-xs leading-6 text-saffron-800">
          <Icon name="shield" className="mt-1 size-4 shrink-0" />
          <Link href="/safety" className="hover:underline">
            {props.safety}
          </Link>
        </p>
        {hasOlder && list[0] && (
          <div className="mb-3 text-center">
            <a href={`?before=${list[0].id}`} onClick={loadOlder} className="inline-block rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
              {loadingOlder ? '…' : t.older}
            </a>
          </div>
        )}
        <ol className="space-y-2">
          {list.map((m) => {
            const day = dayKey(m.createdAt, timeZone);
            const divider = day !== lastDay;
            lastDay = day;
            return (
              <li key={m.id}>
                {divider && (
                  <p className="py-1 pb-3 text-center">
                    <span className="rounded-full bg-white px-3 py-1 text-xs leading-7 text-neutral-600 ring-1 ring-neutral-200">{dayLabel(m.createdAt, timeZone)}</span>
                  </p>
                )}
                <Bubble m={m} mine={m.senderId === meId} seen={!!otherReadAt && m.createdAt <= otherReadAt} timeZone={timeZone} />
              </li>
            );
          })}
        </ol>
      </div>
      {!live && (
        <p className="border-t border-neutral-200 bg-neutral-50 px-4 py-1.5 text-center text-xs text-neutral-600" role="status">
          {t.offline}
        </p>
      )}
      {props.canWrite ? (
        <Composer
          hidden={{ conversationId }}
          quickReplies={props.quickReplies}
          onSent={(m) => {
            stickToBottom.current = true;
            setList((l) => merge(l, [m]));
          }}
        />
      ) : (
        <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-sm text-neutral-700">{props.readOnly}</div>
      )}
    </>
  );
}

function Bubble({ m, mine, seen, timeZone }: { m: WireMessage; mine: boolean; seen: boolean; timeZone: string }) {
  if (m.kind === 'system') {
    const text = t.system[m.body as keyof typeof t.system] ?? m.body;
    return (
      <p className="my-2 text-center">
        <span className="inline-block rounded-xl bg-brand-50 px-3 py-1.5 text-xs text-brand-800">{text}</span>
      </p>
    );
  }
  const warnings = mine ? [] : m.riskFlags;
  // The time sits at the end of the text's last line (mockup final/chat)
  return (
    <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[15px] leading-7 ${
          mine ? 'rounded-ee-md bg-brand-700 text-white' : 'rounded-es-md bg-white text-neutral-900 ring-1 ring-neutral-200'
        }`}
      >
        {m.hidden ? <span className="text-sm italic opacity-80">{t.hidden}</span> : <bdi className="whitespace-pre-wrap break-words">{m.body}</bdi>}
        <span className={`ms-2 inline-flex items-center gap-0.5 align-bottom text-xs ${mine ? 'text-brand-100' : 'text-neutral-500'}`}>
          <time dateTime={m.createdAt}>{timeLabel(m.createdAt, timeZone)}</time>
          {mine && (
            <span className="flex items-center" title={seen ? t.seen : t.sent}>
              <Icon name={seen ? 'checks' : 'check'} className={`size-3.5 ${seen ? 'text-saffron-300' : ''}`} />
              <span className="sr-only">{seen ? t.seen : t.sent}</span>
            </span>
          )}
        </span>
      </div>
      {warnings.length > 0 && (
        <div role="note" className="mt-1 max-w-[78%] rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          <p className="mb-0.5 flex items-center gap-1 font-bold">
            <Icon name="alert" className="size-4" />
            {t.risk.title}
          </p>
          <ul className="space-y-0.5">
            {warnings.map((f) => (
              <li key={f}>{t.risk[f]}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** «گزارش گفتگو» in the ⋯ sheet: reports the other person's newest message */
export function ReportButton({ messageId, className }: { messageId: string; className: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <Icon name="flag" className="size-5" />
        {t.reportChat}
      </button>
      {open && <ReportDialog messageId={messageId} onClose={() => setOpen(false)} />}
    </>
  );
}

function ReportDialog({ messageId, onClose }: { messageId: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<ReportState, FormData>(reportAction, undefined);
  const r = t.reportForm;
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-2xl p-0 backdrop:bg-neutral-900/50">
      <div className="space-y-4 p-5">
        <h2 className="text-lg font-bold">{r.title}</h2>
        {state?.done ? (
          <>
            <p role="status" className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
              {state.done === 'already' ? r.already : r.done}
            </p>
            <button type="button" onClick={onClose} className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm font-bold">
              {messages.listing.closeViewer}
            </button>
          </>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="messageId" value={messageId} />
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium text-neutral-700">{r.reason}</legend>
              {(Object.keys(r.reasons) as Array<keyof typeof r.reasons>).map((k, i) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="reason" value={k} defaultChecked={i === 0} className="size-4" />
                  {r.reasons[k]}
                </label>
              ))}
            </fieldset>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-neutral-700">{r.details}</span>
              <textarea name="details" maxLength={2000} rows={3} className="block w-full rounded-xl border border-neutral-300 px-3 py-2 text-base outline-none focus:border-brand-600" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="alsoBlock" className="size-4" />
              {r.alsoBlock}
            </label>
            {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="flex-1 rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
                {r.send}
              </button>
              <button type="button" onClick={onClose} className="rounded-xl border border-neutral-300 px-4 py-3 text-sm font-bold">
                {r.cancel}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
