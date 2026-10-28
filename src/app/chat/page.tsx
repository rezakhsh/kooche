import Link from 'next/link';
import { Icon } from '../../components/icons';
import { Alert } from '../../components/ui';
import { appDb } from '../../db/drizzle';
import { webEnv } from '../../lib/env';
import { formatAgo } from '../../lib/format';
import { messages } from '../../messages/fa';
import { inbox, type InboxFilter } from '../../modules/chat/queries';
import { imageUrl } from '../../modules/media/server';
import { requireSession } from '../../modules/users/server';
import { InboxLive } from './inbox-live';

export const metadata = { title: messages.chat.title, robots: { index: false } };

// The inbox (approved Oct 18, 2026): buyer and seller conversations merged, newest first, with
// unread badges and "seen" on my last message. Filters and paging are plain links. Wave 1 (no
// mockup; designed like «آگهی‌های من»): the same title row, chips and rows, the unread badge in
// saffron like the bottom bar's.

const FILTERS: InboxFilter[] = ['all', 'buying', 'selling', 'archived'];

type Search = { f?: string; before?: string; done?: string };

export default async function InboxPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { user } = await requireSession('/chat');
  const filter = FILTERS.find((f) => f === sp.f) ?? 'all';
  const [at, id] = (sp.before ?? '').split('_');
  const before = at && id && /^\d+$/.test(at) && /^[0-9a-f-]{36}$/.test(id) ? { at: new Date(Number(at)), id } : undefined;
  const { items, next } = await inbox(appDb(), user.id, { filter, before });
  const t = messages.chat;
  const tz = webEnv().APP_TIME_ZONE;
  const query = (f: InboxFilter) => (f === 'all' ? '/chat' : `/chat?f=${f}`);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-5 pb-24">
      <h1 className="mb-4 text-2xl font-extrabold">{t.title}</h1>
      <InboxLive />
      {sp.done === 'archived' && (
        <div className="mb-3">
          <Alert tone="success">{t.archived}</Alert>
        </div>
      )}
      <nav aria-label={t.filterLabel} className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={query(f)}
            aria-current={f === filter ? 'page' : undefined}
            className={`flex h-10 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap ${
              f === filter ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50'
            }`}
          >
            {t.filters[f]}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl bg-neutral-50 px-6 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-white text-brand-700">
            <Icon name="chat" className="size-7" />
          </span>
          <p className="max-w-sm text-sm leading-7 text-neutral-700">{filter === 'archived' ? t.emptyArchived : t.empty}</p>
          {filter !== 'archived' && (
            <Link href="/" className="flex h-11 items-center rounded-xl bg-brand-700 px-4 text-sm font-bold text-white hover:bg-brand-800">
              {t.browse}
            </Link>
          )}
        </div>
      ) : (
        <ul>
          {items.map((c) => {
            const cover = c.listing.coverKey ? imageUrl(c.listing.coverKey, 'thumb', 'webp') : null;
            const mine = c.last.senderId === user.id;
            const preview =
              c.last.kind === 'system'
                ? (t.system as Record<string, string>)[c.last.body] ?? ''
                : c.last.hidden
                  ? t.hiddenPreview
                  : c.last.body;
            return (
              <li key={c.id}>
                <Link href={`/chat/${c.id}`} className="-mx-2 flex items-center gap-3 rounded-2xl border-b border-neutral-200 px-2 py-3.5 hover:bg-neutral-50">
                  <span className="size-14 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                    {cover ? <img src={cover} alt="" width={56} height={56} loading="lazy" className="size-full object-cover" /> : <Icon name="image" className="m-4 size-6 text-neutral-400" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`truncate text-sm ${c.unread ? 'font-extrabold' : 'font-bold'}`}>{c.other.name}</span>
                      <span className="shrink-0 rounded-full bg-neutral-100 px-1.5 text-xs text-neutral-600">{c.side === 'buyer' ? t.seller : t.buyer}</span>
                      <span className="ms-auto shrink-0 text-xs text-neutral-500">{formatAgo(c.last.createdAt, tz)}</span>
                    </span>
                    <span className="block truncate text-xs text-neutral-600">{c.listing.title}</span>
                    <span className="mt-0.5 flex items-center gap-1">
                      {mine && <Icon name={c.last.seen ? 'checks' : 'check'} className={`size-3.5 shrink-0 ${c.last.seen ? 'text-brand-600' : 'text-neutral-400'}`} />}
                      <span dir="auto" className={`truncate text-sm ${c.unread ? 'font-semibold text-neutral-900' : 'text-neutral-600'}`}>
                        {mine && c.last.kind === 'text' ? t.you : ''}
                        {preview}
                      </span>
                      {c.unread > 0 && (
                        <span className="ms-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-saffron-500 px-1.5 text-xs font-bold text-ink" title={t.unreadBadge(c.unread)}>
                          {c.unread.toLocaleString('fa-IR')}
                          <span className="sr-only">{t.unreadBadge(c.unread)}</span>
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {next && (
        <div className="mt-4 text-center">
          <Link
            href={`${query(filter)}${filter === 'all' ? '?' : '&'}before=${next.at.getTime()}_${next.id}`}
            className="inline-block rounded-xl border border-neutral-300 px-4 py-2 text-sm font-bold hover:bg-neutral-50"
          >
            {t.more}
          </Link>
        </div>
      )}
    </main>
  );
}
