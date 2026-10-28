import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { Icon } from '../../../components/icons';
import { Sheet } from '../../../components/sheet';
import { Alert } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { formatMonth } from '../../../lib/format';
import { messages } from '../../../messages/fa';
import { conversationFor, messagesPage } from '../../../modules/chat/queries';
import { wireMessage } from '../../../modules/chat/realtime';
import { markReadAndPublish } from '../../../modules/chat/server';
import { eventPath } from '../../../modules/events/slug';
import { ancestry, cachedCatalog } from '../../../modules/listings/catalog';
import { formatPrice } from '../../../modules/listings/price';
import { safetyKind } from '../../../modules/listings/safety-kind';
import { listingPath } from '../../../modules/listings/slug';
import { imageUrl } from '../../../modules/media/server';
import { activeSanctions, restrictsMessaging } from '../../../modules/moderation/sanctions';
import { canSendMessage, loadActor } from '../../../modules/users/permissions';
import { requireSession } from '../../../modules/users/server';
import { archiveAction, blockAction } from '../actions';
import { ReportButton, Thread } from './thread';

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

  const kind = l.categoryId ? safetyKind(ancestry(await cachedCatalog(db), l.categoryId)) : 'general';
  const replies = (view.side === 'seller' ? t.sellerReplies : t.buyerReplies)[kind === 'rent' ? 'rent' : 'other'];
  // «گزارش گفتگو» reports the other person's newest message
  const reportId = page.messages.findLast((m) => m.senderId !== user.id && m.kind !== 'system' && !m.hidden)?.id ?? null;
  const menuRow = 'flex h-14 w-full items-center gap-3 text-start text-base';

  // Wave 1 (mockup final/chat): the conversation fills the screen (no site header), with back,
  // the listing (photo, title, the other person, price) and ⋯ for report, block, archive and the legal pages
  return (
    <main data-chat-thread className="mx-auto flex h-dvh w-full max-w-3xl flex-col bg-white lg:border-x lg:border-neutral-200">
      <header className="flex items-center gap-2 border-b border-neutral-200 px-2 py-2">
        <Link href="/chat" className="flex size-11 shrink-0 items-center justify-center rounded-xl text-neutral-800 hover:bg-neutral-100" aria-label={t.back} title={t.back}>
          <Icon name="back" className="size-6" />
        </Link>
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-2" title={t.viewListing}>
          {cover ? (
            <img src={cover} alt="" width={44} height={44} className="size-11 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
              <Icon name="image" className="size-5" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold">{l.title}</span>
            <span className="block truncate text-xs text-neutral-600">
              {t.with(otherName, view.side === 'buyer' ? t.seller : t.buyer)}
              {price && (
                <>
                  {'، '}
                  <b className="text-brand-800">{price}</b>
                </>
              )}
              {listingState && <> ({listingState})</>}
            </span>
          </span>
        </Link>
        <Sheet
          title={t.menu}
          closeLabel={t.close}
          summaryLabel={t.menu}
          summaryClassName="flex size-11 items-center justify-center rounded-xl text-neutral-700 hover:bg-neutral-100"
          summary={<Icon name="more" className="size-6" />}
        >
          <ul className="divide-y divide-neutral-100">
            <li>
              <Link href={href} className={menuRow}>
                <Icon name="doc" className="size-5" />
                {t.viewListing}
              </Link>
            </li>
            {reportId && (
              <li>
                <ReportButton messageId={reportId} className={menuRow} />
              </li>
            )}
            <li>
              <form action={archiveAction}>
                <input type="hidden" name="conversationId" value={view.id} />
                <input type="hidden" name="archived" value={view.archived ? '0' : '1'} />
                <button type="submit" className={menuRow}>
                  <Icon name="archive" className="size-5" />
                  {view.archived ? t.unarchive : t.archive}
                </button>
              </form>
            </li>
            <li>
              {view.blocks.iBlocked ? (
                <form action={blockAction}>
                  <input type="hidden" name="conversationId" value={view.id} />
                  <input type="hidden" name="op" value="unblock" />
                  <button type="submit" className={menuRow}>
                    <Icon name="ban" className="size-5" />
                    {t.unblock}
                  </button>
                </form>
              ) : (
                <details>
                  <summary className={`${menuRow} cursor-pointer list-none text-red-700 [&::-webkit-details-marker]:hidden`}>
                    <Icon name="ban" className="size-5" />
                    {t.block}
                  </summary>
                  <form action={blockAction} className="space-y-2 pb-3">
                    <input type="hidden" name="conversationId" value={view.id} />
                    <input type="hidden" name="op" value="block" />
                    <p className="text-sm leading-relaxed text-neutral-700">{t.blockConfirm(otherName)}</p>
                    <button type="submit" className="flex h-11 w-full items-center justify-center rounded-xl bg-danger text-sm font-bold text-snow hover:bg-danger-hover">
                      {t.blockYes}
                    </button>
                  </form>
                </details>
              )}
            </li>
            {/* Wave 1, part 8: no site footer here, so the Impressum is two taps away through ⋯ */}
            <li>
              <Link href="/impressum" className={`${menuRow} text-neutral-700`}>
                <Icon name="shield" className="size-5" />
                {t.legal}
              </Link>
            </li>
          </ul>
        </Sheet>
      </header>
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
        safety={t.safety[kind]}
        quickReplies={replies}
      />
    </main>
  );
}
