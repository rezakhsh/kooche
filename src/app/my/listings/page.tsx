import Link from 'next/link';
import type React from 'react';
import { Icon } from '../../../components/icons';
import { Sheet } from '../../../components/sheet';
import { Alert } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { formatDate } from '../../../lib/format';
import { messages } from '../../../messages/fa';
import { conversationCounts } from '../../../modules/chat/queries';
import { ancestry, cachedCatalog } from '../../../modules/listings/catalog';
import { favoriteCounts } from '../../../modules/listings/favorites';
import { canApply, type StatusAction } from '../../../modules/listings/listings';
import { myListings } from '../../../modules/listings/queries';
import { hasOwnEvents } from '../../../modules/events/queries';
import { formatPrice } from '../../../modules/listings/price';
import { safetyKind } from '../../../modules/listings/safety-kind';
import { listingPath } from '../../../modules/listings/slug';
import { activePrice, LISTING_PRODUCTS } from '../../../modules/payments/checkout';
import { imageUrl } from '../../../modules/media/server';
import { requireSession } from '../../../modules/users/server';
import { listingStatusAction } from './actions';
import { ShareRow } from './share-row';
import { limitMessage } from './limit-message';

export const metadata = { title: messages.my.title, robots: { index: false } };

/** The status label's colours (mockup final/mylistings) */
const STATUS_CLASS: Record<string, string> = {
  active: 'bg-green-50 text-green-800',
  draft: 'bg-saffron-50 text-saffron-800',
  pending_review: 'bg-saffron-50 text-saffron-800',
  paused: 'bg-neutral-100 text-neutral-700',
  sold: 'bg-brand-50 text-brand-800',
  expired: 'bg-red-50 text-red-800',
  rejected: 'bg-red-50 text-red-800',
};
/** Tabs by status (approved Oct 17, 2026); "in review" sits with the live ones. Expired and
 * rejected show only when there are some. */
const TABS = ['active', 'draft', 'paused', 'sold', 'expired', 'rejected'] as const;
const ALWAYS = new Set(['active', 'draft', 'paused', 'sold']);
const tabOf = (status: string) => (status === 'pending_review' ? 'active' : status);

const button = 'flex h-10 items-center rounded-lg px-3.5 text-sm font-bold whitespace-nowrap';
const primary = `${button} bg-brand-700 text-white hover:bg-brand-800`;
const secondary = `${button} border border-neutral-300 hover:bg-neutral-50`;
const row = 'flex h-14 w-full items-center gap-3 text-start text-base';

// My listings (wave 1, mockup final/mylistings): compact rows with what matters (status, days
// left, views, saves, chats), one action that fits the moment (free renewal when it is running
// out, else "sold" or «اجاره داده شد») and ⋯ for the rest (mockup mylistings-menu).

export default async function MyListingsPage({ searchParams }: { searchParams: Promise<{ done?: string; error?: string; tab?: string }> }) {
  const { user } = await requireSession('/my/listings');
  const db = appDb();
  const rows = await myListings(db, user.id);
  const ids = rows.map((r) => r.listing.id);
  // How many people saved each listing and wrote about it: only the seller sees it
  const [saves, chats, catalog, hasEvents] = await Promise.all([favoriteCounts(db, user.id, ids), conversationCounts(db, user.id, ids), cachedCatalog(db), hasOwnEvents(db, user.id)]);
  // «از ۱٫۹۹ €»: the cheapest way up, in each currency of a live listing
  const currencies = [...new Set(rows.filter((r) => r.listing.status === 'active').map((r) => r.listing.currency ?? 'EUR'))];
  const cheapest = new Map(
    await Promise.all(
      currencies.map(async (c) => {
        const prices = (await Promise.all(LISTING_PRODUCTS.map((p) => activePrice(db, p, c)))).filter((o) => !!o).map((o) => o.price.amountMinor);
        return [c, prices.length ? formatPrice(Math.min(...prices), c, 2) : null] as const;
      }),
    ),
  );
  const params = await searchParams;
  const zone = webEnv().APP_TIME_ZONE;
  const t = messages.my;
  const now = new Date();
  const done = params.done && params.done in t.done ? t.done[params.done as keyof typeof t.done] : null;
  const tab = TABS.find((x) => x === params.tab) ?? null;
  const count = (x: string) => rows.filter((r) => tabOf(r.listing.status) === x).length;
  const shown = tab ? rows.filter((r) => tabOf(r.listing.status) === tab) : rows;
  const chip = (on: boolean) =>
    `flex h-10 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap ${on ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50'}`;
  const isRent = (categoryId: string | null) => !!categoryId && safetyKind(ancestry(catalog, categoryId)) === 'rent';

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-5 pb-24">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t.title}</h1>
        <Link href="/new" className="flex h-11 items-center gap-1.5 rounded-xl bg-brand-700 px-4 text-sm font-bold text-white hover:bg-brand-800">
          <Icon name="plus" className="size-4" />
          {t.newListing}
        </Link>
      </div>
      <div className="mt-4 space-y-3 empty:hidden">
        {done && <Alert tone="success">{done}</Alert>}
        {params.error && (
          <Alert tone="error">
            {limitMessage(params.error) ?? t.notAllowed}
          </Alert>
        )}
      </div>
      {/* Someone who posts events switches to them here (part 6; «رویدادهای من» has the same pair) */}
      {hasEvents && (
        <nav aria-label={messages.events.my.title} className="mt-4 flex gap-2">
          <span aria-current="page" className="flex h-10 items-center rounded-full border border-neutral-900 bg-neutral-900 px-3.5 text-sm font-medium text-white">
            {messages.events.my.listings}
          </span>
          <Link href="/my/events" className="flex h-10 items-center rounded-full border border-neutral-300 bg-white px-3.5 text-sm font-medium hover:bg-neutral-50">
            {messages.events.my.events}
          </Link>
        </nav>
      )}
      {rows.length > 0 && (
        <nav aria-label={t.tabs} className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4">
          <Link href="/my/listings" className={chip(!tab)} aria-current={!tab ? 'page' : undefined}>
            {t.tab(t.all, rows.length)}
          </Link>
          {TABS.filter((x) => ALWAYS.has(x) || count(x) > 0 || tab === x).map((x) => (
            <Link key={x} href={`/my/listings?tab=${x}`} className={chip(tab === x)} aria-current={tab === x ? 'page' : undefined}>
              {t.tab(t.tabNames[x], count(x))}
            </Link>
          ))}
        </nav>
      )}
      {rows.length === 0 && <p className="mt-6 text-neutral-600">{t.empty}</p>}
      {rows.length > 0 && shown.length === 0 && <p className="mt-6 text-neutral-600">{t.emptyTab}</p>}
      <ul className="mt-2">
        {shown.map(({ listing: l, coverKey }) => {
          const thumb = coverKey ? imageUrl(coverKey, 'thumb', 'webp') : null;
          const can = (a: StatusAction) => canApply(a, l, now);
          const editable = ['draft', 'active', 'paused', 'expired', 'rejected'].includes(l.status);
          const days = l.expiresAt ? Math.ceil((l.expiresAt.getTime() - now.getTime()) / 86_400_000) : null;
          const ending = l.status === 'active' && days !== null && days <= 3;
          const rent = isRent(l.categoryId);
          const soldLabel = rent ? t.rented : t.sold;
          // The one action that fits the moment
          const main: StatusAction | 'continue' | null =
            l.status === 'draft' ? 'continue' : can('renew') ? 'renew' : can('resume') ? 'resume' : can('sold') ? 'sold' : null;
          const title = l.title || t.untitled;
          const path = l.status === 'draft' ? null : listingPath(l.title, l.publicToken);
          const stats = l.status === 'draft' ? [] : [[l.viewCount, t.views], [saves.get(l.id) ?? 0, t.saves], [chats.get(l.id) ?? 0, t.chats]] as const;
          const promoteFrom = l.status === 'active' ? cheapest.get(l.currency ?? 'EUR') : null;
          return (
            <li key={l.id} className="flex gap-3 border-b border-neutral-200 py-3.5">
              {thumb ? (
                <img src={thumb} alt="" width={96} height={96} className="aspect-square w-20 shrink-0 rounded-xl object-cover lg:w-24" />
              ) : (
                <span className="flex aspect-square w-20 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400 lg:w-24">
                  <Icon name="image" className="size-7" />
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
                    {l.status === 'sold' && rent ? t.rented : messages.status[l.status]}
                  </span>
                  {l.status === 'draft' && <span className="text-neutral-600">{t.notPublished}</span>}
                  {l.status === 'active' && days !== null && (
                    <span className={ending ? 'font-bold text-red-700' : 'text-neutral-600'} title={t.expires(formatDate(l.expiresAt!, zone))}>
                      {t.daysLeft(days)}
                    </span>
                  )}
                  {l.expiresAt && l.status === 'expired' && <span className="font-bold text-red-700">{t.expiredOn(formatDate(l.expiresAt, zone))}</span>}
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
                {/* One line, as in the mockup; on the narrowest phones «بیشتر» keeps only its ⋯ */}
                <div className="mt-2 flex gap-2">
                  {main === 'continue' ? (
                    <Link href={`/my/listings/${l.id}`} className={primary}>
                      {t.continueDraft}
                    </Link>
                  ) : (
                    main && (
                      <StatusForm id={l.id} action={main} className={primary}>
                        {main === 'renew' ? t.renewFree : main === 'sold' ? soldLabel : t[main]}
                      </StatusForm>
                    )
                  )}
                  {editable && (
                    <Link href={`/my/listings/${l.id}`} className={secondary}>
                      {t.edit}
                    </Link>
                  )}
                  <Sheet
                    title={title}
                    closeLabel={t.close}
                    summaryLabel={t.moreLabel(title)}
                    summaryClassName={`${button} gap-1 border border-neutral-300 px-3 hover:bg-neutral-50`}
                    summary={
                      <>
                        <span className="max-[379px]:sr-only">{t.more}</span>
                        <Icon name="more" className="size-4" />
                      </>
                    }
                  >
                    <ul className="divide-y divide-neutral-100">
                      {l.status === 'active' && (
                        <li>
                          <Link href={`/my/listings/${l.id}/promote`} className={`${row} font-bold text-saffron-800`}>
                            <Icon name="arrow-up" className="size-5" />
                            {promoteFrom ? t.promoteFrom(promoteFrom) : t.promote}
                          </Link>
                        </li>
                      )}
                      {path && (
                        <li>
                          <Link href={path} className={row}>
                            <Icon name="pin" className="size-5" />
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
                            {t.pauseTemp}
                          </StatusForm>
                        </li>
                      )}
                      {can('sold') && main !== 'sold' && (
                        <li>
                          <StatusForm id={l.id} action="sold" className={row}>
                            <Icon name="check" className="size-5" />
                            {soldLabel}
                          </StatusForm>
                        </li>
                      )}
                      <li>
                        <details>
                          <summary className={`${row} cursor-pointer list-none text-red-700 [&::-webkit-details-marker]:hidden`}>
                            <Icon name="trash" className="size-5" />
                            {t.deleteListing}
                          </summary>
                          <div className="pb-3">
                            <p className="text-sm">{t.deleteConfirm}</p>
                            <StatusForm id={l.id} action="delete" className="mt-2 flex h-11 w-full items-center justify-center rounded-xl bg-danger text-sm font-bold text-snow hover:bg-danger-hover">
                              {t.deleteYes}
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

/** One status change as a button (works without JavaScript) */
function StatusForm({ id, action, className, children }: { id: string; action: StatusAction; className: string; children: React.ReactNode }) {
  return (
    <form action={listingStatusAction} className="contents">
      <input type="hidden" name="listingId" value={id} />
      <input type="hidden" name="action" value={action} />
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
