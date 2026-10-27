import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { Icon } from '../../../components/icons';
import { Alert, Pill } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { formatMonth } from '../../../lib/format';
import { messages } from '../../../messages/fa';
import { conversationFor, messagesPage } from '../../../modules/chat/queries';
import { wireMessage } from '../../../modules/chat/realtime';
import { markReadAndPublish } from '../../../modules/chat/server';
import { eventPath } from '../../../modules/events/slug';
import { formatPrice } from '../../../modules/listings/price';
import { listingPath } from '../../../modules/listings/slug';
import { imageUrl } from '../../../modules/media/server';
import { activeSanctions, restrictsMessaging } from '../../../modules/moderation/sanctions';
import { canSendMessage, loadActor } from '../../../modules/users/permissions';
import { requireSession } from '../../../modules/users/server';
import { archiveAction, blockAction } from '../actions';
import { Thread } from './thread';

export const metadata = { title: messages.chat.title, robots: { index: false } };

type Params = { id: string };
type Search = { before?: string; done?: string };

const DONE = ['archived', 'unarchived', 'blocked', 'unblocked'] as const;

export default async function ConversationPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { user } = await requireSession(`/chat/${id}`);
  const db = appDb();
  const view = await conversationFor(db, user.id, id);
  if (!view) notFound();
  // Opening the conversation reads it (the other side sees "seen")
  const wasUnread = await markReadAndPublish(user.id, id);

  const before = sp.before && /^[0-9a-f-]{36}$/.test(sp.before) ? sp.before : undefined;
  const [page, actor, sanctions] = await Promise.all([
    messagesPage(db, { userId: user.id, conversationId: id, beforeId: before }),
    loadActor(db, user.id),
    activeSanctions(db, user.id),
  ]);
  const t = messages.chat;
  const env = webEnv();
  const allowed = canSendMessage(actor);

  let readOnly: ReactNode = null;
  if (view.status === 'closed') readOnly = t.readOnly.closed;
  else if (view.status === 'locked') readOnly = t.readOnly.locked;
  else if (view.blocks.iBlocked) readOnly = t.readOnly.blockedByMe;
  else if (!allowed.ok && allowed.reason === 'phone_required')
    readOnly = (
      <>
        {t.readOnly.phone}{' '}
        <Link href="/account/phone" className="font-bold text-brand-800 underline">
          {t.readOnly.phoneLink}
        </Link>
      </>
    );
  else if (!allowed.ok) readOnly = t.errors[allowed.reason];
  else if (restrictsMessaging(sanctions)) readOnly = t.errors.restricted;

  const l = view.listing;
  const href = l.isEvent ? eventPath(l.title, l.token) : listingPath(l.title, l.token);
  const cover = l.coverKey ? imageUrl(l.coverKey, 'thumb', 'webp') : null;
  const price =
    l.price.minor !== null && l.price.currency && l.price.minorUnit !== null
      ? formatPrice(l.price.minor, l.price.currency, l.price.minorUnit)
      : l.price.type === 'free'
        ? messages.priceType.free
        : null;
  const listingState = l.status === 'active' ? null : (messages.status as Record<string, string>)[l.status];
  const done = DONE.find((d) => d === sp.done);
  const otherName = view.other.active ? view.other.name : t.deletedUser;

  return (
    <main data-chat-thread className="mx-auto flex h-[calc(100dvh-57px)] w-full max-w-3xl flex-col bg-white sm:border-x sm:border-neutral-200">
      <div className="flex items-center gap-2 border-b border-neutral-200 px-2 py-2 sm:px-4">
        <Link href="/chat" className="rounded-full p-2 text-neutral-700 hover:bg-neutral-100" title={t.back}>
          <Icon name="chevronStart" className="size-5" />
          <span className="sr-only">{t.back}</span>
        </Link>
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-3" title={t.viewListing}>
          <span className="size-11 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
            {cover ? <img src={cover} alt="" width={44} height={44} className="size-full object-cover" /> : <Icon name="image" className="m-3 size-5 text-neutral-400" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{l.title}</span>
            <span className="flex items-center gap-1.5 text-xs text-neutral-600">
              <span className="truncate">
                {otherName}، {view.side === 'buyer' ? t.seller : t.buyer}
              </span>
              {price && <span className="shrink-0 font-bold text-brand-700">{price}</span>}
              {listingState && <Pill tone="neutral">{listingState}</Pill>}
            </span>
          </span>
        </Link>
        <details className="relative">
          <summary className="list-none rounded-full p-2 text-neutral-700 hover:bg-neutral-100 [&::-webkit-details-marker]:hidden" title={t.menu}>
            <Icon name="more" className="size-5" />
            <span className="sr-only">{t.menu}</span>
          </summary>
          <div className="absolute end-0 z-20 mt-1 w-64 space-y-1 rounded-2xl border border-neutral-200 bg-white p-2 text-sm shadow-lg">
            <Link href={href} className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-neutral-50">
              <Icon name="doc" className="size-4" />
              {t.viewListing}
            </Link>
            <form action={archiveAction}>
              <input type="hidden" name="conversationId" value={view.id} />
              <input type="hidden" name="archived" value={view.archived ? '0' : '1'} />
              <button type="submit" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 hover:bg-neutral-50">
                <Icon name="archive" className="size-4" />
                {view.archived ? t.unarchive : t.archive}
              </button>
            </form>
            {view.blocks.iBlocked ? (
              <form action={blockAction}>
                <input type="hidden" name="conversationId" value={view.id} />
                <input type="hidden" name="op" value="unblock" />
                <button type="submit" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 hover:bg-neutral-50">
                  <Icon name="ban" className="size-4" />
                  {t.unblock}
                </button>
              </form>
            ) : (
              <details>
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2 text-red-700 hover:bg-red-50 [&::-webkit-details-marker]:hidden">
                  <Icon name="ban" className="size-4" />
                  {t.block}
                </summary>
                <form action={blockAction} className="space-y-2 px-3 pt-1 pb-2">
                  <input type="hidden" name="conversationId" value={view.id} />
                  <input type="hidden" name="op" value="block" />
                  <p className="text-xs leading-relaxed text-neutral-600">{t.blockConfirm(otherName)}</p>
                  <button type="submit" className="w-full rounded-xl bg-red-700 px-3 py-2 text-xs font-bold text-white">
                    {t.blockYes}
                  </button>
                </form>
              </details>
            )}
          </div>
        </details>
      </div>
      {done && (
        <div className="px-3 pt-2 sm:px-6">
          <Alert tone="success">{t[done]}</Alert>
        </div>
      )}
      <p className="sr-only">
        {otherName}، {t.memberSince(formatMonth(view.other.memberSince, env.APP_TIME_ZONE))}
        {view.other.phoneVerified ? `، ${t.phoneVerified}` : ''}
      </p>
      <Thread
        conversationId={view.id}
        meId={user.id}
        initial={page.messages.map(wireMessage)}
        hasOlder={page.hasOlder}
        otherReadAt={view.otherReadAt?.toISOString() ?? null}
        canWrite={readOnly === null}
        readOnly={readOnly}
        timeZone={env.APP_TIME_ZONE}
        refreshBadge={wasUnread}
      />
    </main>
  );
}
