import Link from 'next/link';
import type React from 'react';
import { Icon } from '../../../components/icons';
import { Sheet } from '../../../components/sheet';
import { Alert } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { messages } from '../../../messages/fa';
import { conversationCounts } from '../../../modules/chat/queries';
import { formatEventStart } from '../../../modules/events/format';
import { myEvents } from '../../../modules/events/queries';
import { eventPath } from '../../../modules/events/slug';
import { dayNumber, localParts } from '../../../modules/events/time';
import { favoriteCounts } from '../../../modules/listings/favorites';
import { canApply } from '../../../modules/listings/listings';
import { imageUrl } from '../../../modules/media/server';
import { requireSession } from '../../../modules/users/server';
import { eventStatusAction } from '../../events/actions';
import { ShareRow } from '../listings/share-row';

export const metadata = { title: messages.events.my.title, robots: { index: false } };

// My events (wave 1; no mockup, designed like «آگهی‌های من», mockup final/mylistings): a row per
// event with its poster, status, next date («۱۴ روز دیگر») and what people did (views, interested,
// chats), one action that fits the moment (continue a draft, post an ended one again, show a
// paused one) and ⋯ for the rest, cancelling and deleting with a second tap.

const STATUS_CLASS: Record<string, string> = {
  active: 'bg-green-50 text-green-800',
  draft: 'bg-saffron-50 text-saffron-800',
  pending_review: 'bg-saffron-50 text-saffron-800',
  paused: 'bg-neutral-100 text-neutral-700',
  expired: 'bg-neutral-100 text-neutral-600',
  rejected: 'bg-red-50 text-red-800',
};

const button = 'flex h-10 items-center rounded-lg px-3.5 text-sm font-bold whitespace-nowrap';
const primary = `${button} bg-brand-700 text-white hover:bg-brand-800`;
const secondary = `${button} border border-neutral-300 hover:bg-neutral-50`;
const row = 'flex h-14 w-full items-center gap-3 text-start text-base';

function StatusForm({ id, action, className, children }: { id: string; action: string; className: string; children: React.ReactNode }) {
  return (
    <form action={eventStatusAction} className="contents">
      <input type="hidden" name="listingId" value={id} />
      <input type="hidden" name="action" value={action} />
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}

export default async function MyEventsPage({ searchParams }: { searchParams: Promise<{ done?: string; error?: string }> }) {
  const { user } = await requireSession('/my/events');
  const db = appDb();
  const rows = await myEvents(db, user.id);
  const ids = rows.map((r) => r.listing.id);
  const [saves, chats] = await Promise.all([favoriteCounts(db, user.id, ids), conversationCounts(db, user.id, ids)]);
  const params = await searchParams;
  const t = messages.events.my;
  const m = messages.my;
  const now = new Date();
  const done = params.done && params.done in t.done ? t.done[params.done as keyof typeof t.done] : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-5 pb-24">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t.title}</h1>
        <Link href="/events/new" className="flex h-11 items-center gap-1.5 rounded-xl bg-brand-700 px-4 text-sm font-bold text-white hover:bg-brand-800">
          <Icon name="plus" className="size-4" />
          {messages.events.post}
        </Link>
      </div>
      <nav aria-label={m.tabs} className="mt-4 flex gap-2">
        <Link href="/my/listings" className="flex h-10 items-center rounded-full border border-neutral-300 bg-white px-3.5 text-sm font-medium hover:bg-neutral-50">
          {t.listings}
        </Link>
        <span aria-current="page" className="flex h-10 items-center rounded-full border border-neutral-900 bg-neutral-900 px-3.5 text-sm font-medium text-white">
          {t.events}
        </span>
      </nav>
      <div className="mt-4 space-y-3 empty:hidden">
        {done && <Alert tone="success">{done}</Alert>}
        {params.error && <Alert tone="error">{m.notAllowed}</Alert>}
      </div>
      {rows.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl bg-neutral-50 px-6 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-white text-brand-700">
            <Icon name="calendar" className="size-7" />
          </span>
          <p className="max-w-sm text-sm leading-7 text-neutral-700">{t.empty}</p>
          <p className="max-w-sm text-xs leading-6 text-neutral-600">{messages.events.emptyHint}</p>
        </div>
      )}
      <ul className="mt-2">
        {rows.map(({ listing: l, details: d, coverKey, firstStart }) => {
          const poster = coverKey ? imageUrl(coverKey, 'poster', 'webp') : null;
          const ev = { ...l, isEvent: true };
          const can = (a: 'pause' | 'resume') => canApply(a, ev, now);
          const editable = ['draft', 'active', 'paused', 'rejected'].includes(l.status);
          const live = l.status === 'active' || l.status === 'paused';
          const title = l.title || m.untitled;
          const path = l.status === 'draft' ? null : eventPath(l.title, l.publicToken);
          const main: 'continue' | 'copy' | 'resume' | null = l.status === 'draft' ? 'continue' : l.status === 'expired' ? 'copy' : can('resume') ? 'resume' : null;
          const days = firstStart && l.status !== 'expired' ? dayNumber(localParts(firstStart, d.timeZone)) - dayNumber(localParts(now, d.timeZone)) : null;
          const stats = l.status === 'draft' ? [] : ([[l.viewCount, m.views], [saves.get(l.id) ?? 0, t.interested], [chats.get(l.id) ?? 0, m.chats]] as const);
          return (
            <li key={l.id} className="flex gap-3 border-b border-neutral-200 py-3.5">
              {poster ? (
                <img src={poster} alt="" width={80} height={100} className="aspect-[4/5] w-16 shrink-0 rounded-xl object-cover lg:w-20" />
              ) : (
                <span className="flex aspect-[4/5] w-16 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400 lg:w-20">
                  <Icon name="calendar" className="size-6" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                {path ? (
                  <Link href={path} className="block truncate text-[15px] font-bold hover:underline">
                    {title}
                  </Link>
                ) : (
                  <p className="truncate text-[15px] font-bold">{title}</p>
                )}
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                  <span className={`rounded-full px-2 font-bold leading-6 ${STATUS_CLASS[l.status] ?? STATUS_CLASS.paused}`}>
                    {l.status === 'expired' ? t.ended : messages.status[l.status]}
                  </span>
                  {d.scheduleStatus !== 'scheduled' && <span className="rounded-full bg-red-50 px-2 font-bold leading-6 text-red-800">{messages.events.scheduleStatus[d.scheduleStatus]}</span>}
                  <span className="text-neutral-600">{firstStart ? formatEventStart(firstStart, d.timeZone) : t.noDate}</span>
                  {days !== null && days >= 0 && l.status !== 'draft' && <span className="font-bold text-saffron-800">{messages.events.view.inDays(days)}</span>}
                </p>
                {stats.length > 0 && (
                  <p className="mt-1 text-xs text-neutral-700">
                    {stats.map(([n, label], i) => (
                      <span key={label}>
                        {i > 0 && '، '}
                        <b>{n.toLocaleString('fa-IR')}</b> {label}
                      </span>
                    ))}
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  {main === 'continue' ? (
                    <Link href={`/my/events/${l.id}`} className={primary}>
                      {m.continueDraft}
                    </Link>
                  ) : (
                    main && (
                      <StatusForm id={l.id} action={main} className={primary}>
                        {main === 'copy' ? t.copy : m.resume}
                      </StatusForm>
                    )
                  )}
                  {editable && main !== 'continue' && (
                    <Link href={`/my/events/${l.id}`} className={secondary}>
                      {m.edit}
                    </Link>
                  )}
                  <Sheet
                    title={title}
                    closeLabel={m.close}
                    summaryLabel={m.moreLabel(title)}
                    summaryClassName={`${button} gap-1 border border-neutral-300 px-3 hover:bg-neutral-50`}
                    summary={
                      <>
                        <span className="max-[379px]:sr-only">{m.more}</span>
                        <Icon name="more" className="size-4" />
                      </>
                    }
                  >
                    <ul className="divide-y divide-neutral-100">
                      {l.status === 'active' && (
                        <li>
                          <Link href={`/my/listings/${l.id}/promote`} className={`${row} font-bold text-saffron-800`}>
                            <Icon name="arrow-up" className="size-5" />
                            {messages.promote.titleEvent}
                          </Link>
                        </li>
                      )}
                      {path && (
                        <li>
                          <Link href={path} className={row}>
                            <Icon name="calendar" className="size-5" />
                            {t.view}
                          </Link>
                        </li>
                      )}
                      {path && l.status === 'active' && (
                        <li>
                          <ShareRow title={title} path={path} className={row} />
                        </li>
                      )}
                      {can('pause') && (
                        <li>
                          <StatusForm id={l.id} action="pause" className={row}>
                            <Icon name="clock" className="size-5" />
                            {m.pauseTemp}
                          </StatusForm>
                        </li>
                      )}
                      {l.status !== 'draft' && main !== 'copy' && (
                        <li>
                          <StatusForm id={l.id} action="copy" className={row}>
                            <Icon name="plus" className="size-5" />
                            {t.copy}
                          </StatusForm>
                        </li>
                      )}
                      {live && d.scheduleStatus !== 'cancelled' && (
                        <li>
                          <details>
                            <summary className={`${row} cursor-pointer list-none text-red-700 [&::-webkit-details-marker]:hidden`}>
                              <Icon name="ban" className="size-5" />
                              {t.cancel}
                            </summary>
                            <div className="pb-3">
                              <p className="text-sm">{t.cancelConfirm}</p>
                              <StatusForm id={l.id} action="cancel" className="mt-2 flex h-11 w-full items-center justify-center rounded-xl bg-red-700 text-sm font-bold text-white hover:bg-red-800">
                                {t.cancelYes}
                              </StatusForm>
                            </div>
                          </details>
                        </li>
                      )}
                      <li>
                        <details>
                          <summary className={`${row} cursor-pointer list-none text-red-700 [&::-webkit-details-marker]:hidden`}>
                            <Icon name="trash" className="size-5" />
                            {t.deleteEvent}
                          </summary>
                          <div className="pb-3">
                            <p className="text-sm">{t.deleteConfirm}</p>
                            <StatusForm id={l.id} action="delete" className="mt-2 flex h-11 w-full items-center justify-center rounded-xl bg-red-700 text-sm font-bold text-white hover:bg-red-800">
                              {m.deleteYes}
                            </StatusForm>
                          </div>
                        </details>
                      </li>
                    </ul>
                  </Sheet>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
