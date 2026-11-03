'use client';

import Link from 'next/link';
import { useActionState, useCallback, useEffect, useRef, useState, useTransition, type KeyboardEvent } from 'react';
import { Flag } from '../../../components/flag';
import { Icon } from '../../../components/icons';
import { Alert, Button, Pill } from '../../../components/ui';
import { admin, messages } from '../../../messages/fa';
import { freshDecideAction, type FreshState } from '../moderation-actions';
import { moreFreshAction } from './actions';

// The review of new listings, one wide card each (owner, Nov 3, 2026: staff should decide from
// the list; mockup after-wave2/fresh-review-2): every photo, the text as the seller wrote it, the
// seller's history, a red «با دقت بررسی کنید» with the reasons, and three ways out. «تأیید» and «رد
// کردن» decide here and the card leaves; «بررسی بیشتر» opens the item page. 20 cards at a time: the
// next 20 come when the end of the list nears, or with the button. On a computer J and K move
// between cards, A approves, R opens the reasons, Enter opens the item page (Persian keys too).

export type FreshPhoto = { thumb: string | null; full: string | null };
export type FreshPart = { text: string; risky: boolean };
export type FreshCard = {
  id: string;
  title: FreshPart[];
  titleText: string;
  description: FreshPart[] | null;
  risky: boolean;
  /** Why to look closely; empty for an ordinary card */
  why: string[];
  site: string;
  reviewHref: string;
  sellerHref: string;
  seller: string;
  sellerSince: string;
  sellerOthers: string;
  published: string;
  categories: string | null;
  price: string | null;
  place: string | null;
  code: string;
  tags: Array<{ text: string; tone: 'danger' | 'saffron' | 'neutral' | 'brand' }>;
  otherZone: { code: string; text: string } | null;
  history: Array<{ label: string; value: string; red: boolean }>;
  photos: FreshPhoto[];
};
export type FreshReason = { code: string; label: string; template: string };
export type FreshBatch = { total: number; suspicious: number; cards: FreshCard[] };

const KEYS = { next: ['j', 'J', 'ت'], prev: ['k', 'K', 'ن'], approve: ['a', 'A', 'ش'], reject: ['r', 'R', 'ق'] };

function typing(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

export function FreshList({ first, reasons }: { first: FreshBatch; reasons: FreshReason[] }) {
  const t = admin.fresh;
  const [cards, setCards] = useState(first.cards);
  const [total, setTotal] = useState(first.total);
  const [suspicious, setSuspicious] = useState(first.suspicious);
  const [gone, setGone] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);
  const [last, setLast] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, startLoading] = useTransition();
  const nodes = useRef(new Map<string, HTMLElement>());
  const end = useRef<HTMLDivElement>(null);
  const left = cards.filter((c) => !gone.includes(c.id));
  const more = left.length < total;
  const leftRef = useRef(left);
  leftRef.current = left;
  const currentRef = useRef(current);
  currentRef.current = current;

  const focusCard = useCallback((index: number) => {
    const list = leftRef.current;
    if (list.length === 0) return;
    const i = Math.max(0, Math.min(list.length - 1, index));
    setCurrent(i);
    const el = nodes.current.get(list[i]!.id);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, []);

  const onDone = useCallback((id: string, op: 'approve' | 'take_down') => {
    const card = leftRef.current.find((c) => c.id === id);
    if (!card) return;
    setLast(t.done[op](card.titleText));
    setGone((g) => [...g, id]);
    setTotal((n) => Math.max(0, n - 1));
    if (card.why.length > 0) setSuspicious((n) => Math.max(0, n - 1));
  }, [t]);

  // The next 20, without every card this screen has had (shown or decided); the totals as they are now
  const loadMore = useCallback(() => {
    startLoading(async () => {
      const batch = await moreFreshAction(cards.map((c) => c.id)).catch(() => null);
      if (!batch) {
        setFailed(true);
        return;
      }
      setFailed(false);
      const shown = cards.length - gone.length;
      setCards((list) => [...list, ...batch.cards.filter((c) => !list.some((x) => x.id === c.id))]);
      setTotal(batch.cards.length === 0 ? shown : batch.total);
      setSuspicious(batch.suspicious);
    });
  }, [cards, gone.length]);

  // Near the end of the list the next ones come by themselves
  useEffect(() => {
    const el = end.current;
    if (!el || !more || loading || failed) return;
    const seen = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMore(), { rootMargin: '800px 0px' });
    seen.observe(el);
    return () => seen.disconnect();
  }, [more, loading, failed, loadMore]);

  // After a card leaves, the next one takes its place and gets the focus
  const count = left.length;
  const firstRender = useRef(true);
  const decided = gone.length;
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (leftRef.current.length > 0) focusCard(Math.min(currentRef.current, leftRef.current.length - 1));
  }, [decided, focusCard]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented || typing(e.target) || document.querySelector('dialog[open]')) return;
      const list = leftRef.current;
      const card = list[currentRef.current] ? nodes.current.get(list[currentRef.current]!.id) : null;
      const press = (sel: string) => {
        const el = card?.querySelector<HTMLElement>(sel);
        if (!el) return;
        e.preventDefault();
        el.click();
      };
      if (KEYS.next.includes(e.key)) {
        e.preventDefault();
        focusCard(currentRef.current + 1);
      } else if (KEYS.prev.includes(e.key)) {
        e.preventDefault();
        focusCard(currentRef.current - 1);
      } else if (KEYS.approve.includes(e.key)) press('[data-fresh="approve"]');
      else if (KEYS.reject.includes(e.key)) press('[data-fresh="reject"]');
      else if (e.key === 'Enter' && e.target === card) press('[data-fresh="review"]');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [focusCard]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <b>{total > 0 ? t.count(total) : t.allDone}</b>
        {suspicious > 0 && <Pill tone="danger">{t.suspiciousCount(suspicious)}</Pill>}
        <span className="hidden text-xs text-neutral-500 lg:inline">{t.keys}</span>
      </div>
      <p role="status" className="empty:hidden">
        {last && <span className="block rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">{last}</span>}
      </p>
      <ul className="space-y-5">
        {left.map((card, i) => (
          <li key={card.id}>
            <Card
              card={card}
              reasons={reasons}
              active={i === current}
              eager={i < 2}
              onDone={onDone}
              onFocus={() => setCurrent(i)}
              cardRef={(el) => {
                if (el) nodes.current.set(card.id, el);
                else nodes.current.delete(card.id);
              }}
            />
          </li>
        ))}
      </ul>
      <div ref={end}>
        {more && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-300 p-5 text-center text-sm text-neutral-600">
            <span>{t.shown(count, total)}</span>
            {failed && <span className="text-red-700">{t.loadError}</span>}
            <Button type="button" variant="secondary" onClick={loadMore} disabled={loading} className="px-6">
              {loading ? t.loading : t.more(Math.min(20, total - count))}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Text({ parts }: { parts: FreshPart[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.risky ? (
          <mark key={i} className="rounded bg-red-100 px-0.5 text-red-900">
            {p.text}
          </mark>
        ) : (
          p.text
        ),
      )}
    </>
  );
}

function Body({ card }: { card: FreshCard }) {
  const t = admin.fresh;
  return (
    <div className="flex h-full min-w-0 flex-col gap-2 text-sm">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600">
        {card.categories && <span>{card.categories}</span>}
        <a href={card.site} target="_blank" rel="noreferrer" className="ms-auto font-bold text-brand-800 hover:underline">
          {admin.common.viewOnSite}
        </a>
      </p>
      <h2 className="text-lg font-extrabold leading-8" dir="auto">
        <Text parts={card.title} />
      </h2>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-neutral-700">
        {card.price && <b className="text-base text-brand-800">{card.price}</b>}
        {card.place && <span>{card.place}</span>}
        <span className="text-xs text-neutral-500">{card.code}</span>
      </p>
      {(card.tags.length > 0 || card.otherZone) && (
        <p className="flex flex-wrap gap-1.5">
          {card.tags.map((tag) => (
            <Pill key={tag.text} tone={tag.tone}>
              {tag.text}
            </Pill>
          ))}
          {card.otherZone && (
            <span className="flex items-center gap-1 rounded-full bg-saffron-50 px-2.5 text-xs font-bold leading-7 text-saffron-800">
              <Flag code={card.otherZone.code} className="h-3 w-4" />
              {card.otherZone.text}
            </span>
          )}
        </p>
      )}
      {card.description ? (
        <p className="max-h-80 overflow-y-auto rounded-xl bg-neutral-50 p-3 leading-7 whitespace-pre-line text-neutral-800" dir="auto">
          <Text parts={card.description} />
        </p>
      ) : (
        <p className="text-neutral-500">{admin.common.none}</p>
      )}
      {card.risky && <p className="text-xs text-neutral-600">{admin.item.riskyNote}</p>}
      <div className="rounded-xl border border-neutral-200 px-3 py-1 text-xs">
        <p className="pt-1.5 font-bold text-neutral-800">{t.history}</p>
        <dl className="grid divide-y divide-neutral-100 sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0">
          {card.history.map((h) => (
            <div key={h.label} className="flex items-center justify-between gap-3 py-1.5">
              <dt className="text-neutral-600">{h.label}</dt>
              <dd className={`text-end font-bold ${h.red ? 'text-red-700' : ''}`}>{h.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-xs text-neutral-600">
        <Link href={card.sellerHref} prefetch={false} className="font-bold text-neutral-800 hover:underline">
          <bdi>{card.seller}</bdi>
        </Link>
        <span>{t.sellerAge(card.sellerSince)}</span>
        <span>{card.sellerOthers}</span>
        <span className="ms-auto">
          {admin.item.published}: {card.published}
        </span>
      </p>
    </div>
  );
}

function Card(props: { card: FreshCard; reasons: FreshReason[]; active: boolean; eager: boolean; onDone: (id: string, op: 'approve' | 'take_down') => void; onFocus: () => void; cardRef: (el: HTMLElement | null) => void }) {
  const { card, onDone } = props;
  const t = admin.fresh;
  const [state, action, pending] = useActionState<FreshState, FormData>(freshDecideAction, undefined);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [facts, setFacts] = useState('');
  const careful = card.why.length > 0;

  useEffect(() => {
    if (state?.done) onDone(card.id, state.done);
  }, [state, card.id, onDone]);

  const pick = (r: FreshReason) => {
    const before = props.reasons.find((x) => x.code === reason)?.template ?? '';
    setReason(r.code);
    // The reason's first sentence, unless the moderator has written their own
    if (!facts.trim() || facts === before) setFacts(r.template);
  };

  return (
    <article
      ref={props.cardRef}
      tabIndex={-1}
      onFocusCapture={props.onFocus}
      onPointerDownCapture={props.onFocus}
      aria-label={card.titleText}
      className={`scroll-mt-20 overflow-hidden rounded-2xl bg-white outline-none ${careful ? 'border-2 border-red-600' : 'border border-neutral-200'} ${props.active ? (careful ? 'ring-4 ring-red-600/20' : 'border-brand-600 ring-2 ring-brand-600/20') : ''}`}
    >
      {careful && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          <b className="flex items-center gap-1.5">
            <Icon name="alert" className="size-5 text-red-600" />
            {t.careful}
          </b>
          <span>{card.why.join('، ')}</span>
        </p>
      )}
      <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Photos photos={card.photos} title={card.titleText} eager={props.eager} />
        <Body card={card} />
      </div>

      <div className="space-y-3 border-t border-neutral-100 bg-neutral-50 p-3 sm:p-4">
        {state?.error && <Alert tone="error">{state.error}</Alert>}
        {rejecting && (
          <form action={action} className="space-y-3 rounded-xl border border-red-200 bg-white p-3">
            <input type="hidden" name="op" value="take_down" />
            <input type="hidden" name="id" value={card.id} />
            <fieldset>
              <legend className="font-bold">{t.rejectTitle}</legend>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {props.reasons.map((r) => (
                  <label
                    key={r.code}
                    className="flex min-h-9 cursor-pointer items-center rounded-full border border-neutral-300 px-3 text-sm has-[:checked]:border-red-600 has-[:checked]:bg-red-50 has-[:checked]:font-bold has-[:checked]:text-red-800 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-red-600/40"
                  >
                    <input type="radio" name="reason" value={r.code} checked={reason === r.code} onChange={() => pick(r)} className="sr-only" />
                    {r.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block text-sm">
              <span className="text-neutral-700">{t.facts}</span>
              <textarea
                name="facts"
                value={facts}
                onChange={(e) => setFacts(e.target.value)}
                rows={2}
                maxLength={1000}
                dir="auto"
                className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
              />
            </label>
            <p className="text-xs text-neutral-600">{t.rejectHint}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={pending || !reason || facts.trim().length < 10}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-snow transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {t.confirmReject}
              </button>
              <Button type="button" variant="secondary" onClick={() => setRejecting(false)}>
                {t.cancel}
              </Button>
            </div>
          </form>
        )}
        <div className="grid grid-cols-3 gap-2">
          <form action={action}>
            <input type="hidden" name="op" value="approve" />
            <input type="hidden" name="id" value={card.id} />
            <Button type="submit" data-fresh="approve" disabled={pending} className="w-full">
              <Icon name="check" className="size-4" />
              {t.ok}
            </Button>
          </form>
          <Button type="button" variant="danger" data-fresh="reject" aria-expanded={rejecting} onClick={() => setRejecting((r) => !r)} className="w-full">
            {t.reject}
          </Button>
          <a href={card.reviewHref} data-fresh="review" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-neutral-300 bg-white px-2 text-center text-sm font-bold text-neutral-800 hover:bg-neutral-50">
            {t.review}
          </a>
        </div>
      </div>
    </article>
  );
}

/** Every photo: one large, all of them small below it; the large one opens the viewer */
function Photos({ photos, title, eager }: { photos: FreshPhoto[]; title: string; eager: boolean }) {
  const t = messages.listing;
  const [shown, setShown] = useState(0);
  const [open, setOpen] = useState(false);
  if (photos.length === 0) {
    return (
      <p className="flex items-center justify-center gap-2 rounded-xl bg-neutral-100 px-3 py-6 text-sm font-bold text-neutral-600 lg:aspect-[4/3]">
        <Icon name="camera" className="size-5" />
        {admin.item.noPhotos}
      </p>
    );
  }
  const main = photos[shown] ?? photos[0]!;
  return (
    <div className="min-w-0 space-y-2">
      <button type="button" onClick={() => setOpen(true)} aria-label={`${t.openViewer}: ${t.photo(shown + 1, photos.length)}`} className="relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded-xl bg-neutral-100">
        {main.full && <img src={main.full} alt={title} loading={eager ? 'eager' : 'lazy'} decoding="async" className="size-full object-contain" />}
        <span className="absolute bottom-2 start-2 flex items-center gap-1 rounded-lg bg-neutral-950/70 px-2 py-0.5 text-xs text-snow">
          <Icon name="camera" className="size-3.5" />
          {t.counter(shown + 1, photos.length)}
        </span>
      </button>
      {photos.length > 1 && (
        <ul className="flex flex-wrap gap-1.5">
          {photos.map((p, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => setShown(i)}
                aria-label={t.photo(i + 1, photos.length)}
                aria-current={i === shown}
                className={`block size-14 overflow-hidden rounded-lg bg-neutral-100 sm:size-16 ${i === shown ? 'ring-2 ring-brand-700' : 'opacity-80 hover:opacity-100'}`}
              >
                {p.thumb && <img src={p.thumb} alt="" loading="lazy" className="size-full object-cover" />}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && <Viewer photos={photos} start={shown} onClose={(i) => { setShown(i); setOpen(false); }} />}
    </div>
  );
}

/** The photos full screen (as on the listing page): swipe or the arrow keys, Esc closes */
function Viewer({ photos, start, onClose }: { photos: FreshPhoto[]; start: number; onClose: (index: number) => void }) {
  const t = messages.listing;
  const dialog = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);
  const total = photos.length;

  const goTo = useCallback((i: number, smooth = true) => {
    const slide = track.current?.children[i] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', inline: 'center', block: 'nearest' });
  }, []);

  useEffect(() => {
    dialog.current?.showModal();
    document.documentElement.classList.add('overflow-hidden');
    requestAnimationFrame(() => goTo(start, false));
    return () => document.documentElement.classList.remove('overflow-hidden');
  }, [goTo, start]);

  function onScroll() {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    // Right to left: scrollLeft runs from 0 to negative values
    setIndex(Math.min(total - 1, Math.round(Math.abs(el.scrollLeft) / el.clientWidth)));
  }

  function onKeyDown(e: KeyboardEvent) {
    // The page reads right to left: the left arrow moves forward
    if (e.key === 'ArrowLeft') goTo(Math.min(total - 1, index + 1));
    else if (e.key === 'ArrowRight') goTo(Math.max(0, index - 1));
  }

  return (
    <dialog ref={dialog} onClose={() => onClose(index)} onKeyDown={onKeyDown} aria-label={t.viewer} className="photo-viewer m-0 h-dvh max-h-none w-screen max-w-none bg-neutral-950 p-0 text-snow">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 text-sm">
          <span aria-live="polite">{t.counter(index + 1, total)}</span>
          <button type="button" onClick={() => dialog.current?.close()} className="flex size-10 items-center justify-center rounded-full bg-snow/15 hover:bg-snow/25" aria-label={t.closeViewer} autoFocus>
            <Icon name="close" className="size-5" />
          </button>
        </div>
        <div ref={track} onScroll={onScroll} className="no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
          {photos.map((p, i) => (
            <div key={i} onClick={(e) => e.target === e.currentTarget && dialog.current?.close()} className="flex h-full w-full shrink-0 snap-center items-center justify-center sm:px-16">
              {p.full && <img src={p.full} alt={t.photo(i + 1, total)} decoding="async" className="max-h-full max-w-full object-contain" />}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-4 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={() => goTo(Math.max(0, index - 1))} disabled={index === 0} className="hidden size-11 items-center justify-center rounded-full bg-snow/15 hover:bg-snow/25 disabled:opacity-30 sm:flex" aria-label={t.previous}>
            <Icon name="chevronStart" className="size-5" />
          </button>
          <div className="flex gap-1.5" aria-hidden>
            {photos.map((_, i) => (
              <span key={i} className={`size-1.5 rounded-full ${i === index ? 'bg-snow' : 'bg-snow/35'}`} />
            ))}
          </div>
          <button type="button" onClick={() => goTo(Math.min(total - 1, index + 1))} disabled={index === total - 1} className="hidden size-11 items-center justify-center rounded-full bg-snow/15 hover:bg-snow/25 disabled:opacity-30 sm:flex" aria-label={t.next}>
            <Icon name="chevronEnd" className="size-5" />
          </button>
        </div>
      </div>
    </dialog>
  );
}
