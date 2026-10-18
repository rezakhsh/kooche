import Link from 'next/link';
import { Icon } from '../../../components/icons';
import { Alert, Button, LinkButton, PageShell, Pill } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { formatDate } from '../../../lib/format';
import { messages } from '../../../messages/fa';
import { canApply, type StatusAction } from '../../../modules/listings/listings';
import { myListings } from '../../../modules/listings/queries';
import { listingPath } from '../../../modules/listings/slug';
import { imageUrl } from '../../../modules/media/server';
import { requireSession } from '../../../modules/users/server';
import { listingStatusAction } from './actions';

export const metadata = { title: messages.my.title, robots: { index: false } };

type Tone = Parameters<typeof Pill>[0]['tone'];
const STATUS_TONE: Record<string, Tone> = {
  active: 'success',
  draft: 'neutral',
  pending_review: 'warning',
  paused: 'neutral',
  sold: 'brand',
  expired: 'warning',
  rejected: 'danger',
};
/** Tabs by status (approved Oct 17, 2026); "in review" sits with the live ones */
const TABS = ['active', 'draft', 'paused', 'sold', 'expired', 'rejected'] as const;
const tabOf = (status: string) => (status === 'pending_review' ? 'active' : status);

export default async function MyListingsPage({ searchParams }: { searchParams: Promise<{ done?: string; error?: string; tab?: string }> }) {
  const { user } = await requireSession('/my/listings');
  const rows = await myListings(appDb(), user.id);
  const params = await searchParams;
  const zone = webEnv().APP_TIME_ZONE;
  const t = messages.my;
  const now = new Date();
  const done = params.done && params.done in t.done ? t.done[params.done as keyof typeof t.done] : null;
  const tab = TABS.find((x) => x === params.tab) ?? null;
  const count = (x: string) => rows.filter((r) => tabOf(r.listing.status) === x).length;
  const shown = tab ? rows.filter((r) => tabOf(r.listing.status) === tab) : rows;
  const tabClass = (on: boolean) =>
    `shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap ${on ? 'border-brand-700 font-bold text-brand-700' : 'border-transparent text-neutral-600 hover:text-neutral-900'}`;

  return (
    <PageShell title={t.title} wide>
      <div className="space-y-4">
        <LinkButton href="/new" className="w-full sm:w-auto">
          <Icon name="plus" className="size-4" />
          {t.newListing}
        </LinkButton>
        {done && <Alert tone="success">{done}</Alert>}
        {params.error && <Alert tone="error">{t.notAllowed}</Alert>}
        {rows.length > 0 && (
          <nav aria-label={t.tabs} className="no-scrollbar -mx-4 flex overflow-x-auto border-b border-neutral-200 px-4 sm:mx-0 sm:px-0">
            <Link href="/my/listings" className={tabClass(!tab)} aria-current={!tab ? 'page' : undefined}>
              {t.all} ({rows.length.toLocaleString('fa-IR')})
            </Link>
            {TABS.filter((x) => count(x) > 0).map((x) => (
              <Link key={x} href={`/my/listings?tab=${x}`} className={tabClass(tab === x)} aria-current={tab === x ? 'page' : undefined}>
                {messages.status[x]} ({count(x).toLocaleString('fa-IR')})
              </Link>
            ))}
          </nav>
        )}
        {rows.length === 0 && <p className="text-neutral-600">{t.empty}</p>}
        {rows.length > 0 && shown.length === 0 && <p className="text-neutral-600">{t.emptyTab}</p>}
        <ul className="divide-y divide-neutral-200">
          {shown.map(({ listing: l, coverKey }) => {
            const thumb = coverKey ? imageUrl(coverKey, 'thumb', 'webp') : null;
            const actions = (['renew', 'pause', 'resume', 'sold'] as StatusAction[]).filter((a) => canApply(a, l, now));
            const editable = ['draft', 'active', 'paused', 'expired', 'rejected'].includes(l.status);
            const days = l.expiresAt ? Math.ceil((l.expiresAt.getTime() - now.getTime()) / 86_400_000) : null;
            const ending = l.status === 'active' && days !== null && days <= 3;
            return (
              <li key={l.id} className="flex gap-3 py-4">
                <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-neutral-100 sm:size-24">
                  {thumb ? (
                    <img src={thumb} alt="" width={96} height={96} className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-neutral-400">
                      <Icon name="image" className="size-7" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  {l.status === 'draft' ? (
                    <p className="truncate font-bold">{l.title || t.untitled}</p>
                  ) : (
                    <Link href={listingPath(l.title, l.publicToken)} className="block truncate font-bold hover:underline">
                      {l.title}
                    </Link>
                  )}
                  <p className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                    <Pill tone={ending ? 'warning' : (STATUS_TONE[l.status] ?? 'neutral')}>{messages.status[l.status]}</Pill>
                    {l.status === 'active' && days !== null && <span title={t.expires(formatDate(l.expiresAt!, zone))}>{t.daysLeft(days)}</span>}
                    {l.expiresAt && l.status === 'expired' && <span>{t.expiredOn(formatDate(l.expiresAt, zone))}</span>}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {actions.map((a) => (
                      <form key={a} action={listingStatusAction}>
                        <input type="hidden" name="listingId" value={l.id} />
                        <input type="hidden" name="action" value={a} />
                        <Button type="submit" variant={a === 'renew' ? 'primary' : 'secondary'} className="px-3 py-1.5 text-xs">
                          {t[a]}
                        </Button>
                      </form>
                    ))}
                    {editable && (
                      <LinkButton href={`/my/listings/${l.id}`} variant="secondary" className="px-3 py-1.5 text-xs">
                        {l.status === 'draft' ? t.continue : t.edit}
                      </LinkButton>
                    )}
                    <details className="group">
                      <summary className="inline-flex cursor-pointer list-none items-center rounded-xl border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50">
                        {t.delete}
                      </summary>
                      <form action={listingStatusAction} className="mt-2 flex flex-wrap items-center gap-2">
                        <input type="hidden" name="listingId" value={l.id} />
                        <input type="hidden" name="action" value="delete" />
                        <span className="text-sm">{t.deleteConfirm}</span>
                        <Button type="submit" variant="danger" className="px-3 py-1.5 text-xs">
                          {t.deleteYes}
                        </Button>
                      </form>
                    </details>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </PageShell>
  );
}
