import Link from 'next/link';
import { Alert, Button, Card, LinkButton, PageShell } from '../../../components/ui';
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

const STATUS_TONE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-800',
  draft: 'bg-neutral-100 text-neutral-700',
  pending_review: 'bg-amber-50 text-amber-800',
  paused: 'bg-neutral-100 text-neutral-700',
  sold: 'bg-sky-50 text-sky-800',
  expired: 'bg-amber-50 text-amber-800',
  rejected: 'bg-red-50 text-red-800',
};

export default async function MyListingsPage({ searchParams }: { searchParams: Promise<{ done?: string; error?: string }> }) {
  const { user } = await requireSession('/my/listings');
  const rows = await myListings(appDb(), user.id);
  const params = await searchParams;
  const zone = webEnv().APP_TIME_ZONE;
  const t = messages.my;
  const now = new Date();
  const done = params.done && params.done in t.done ? t.done[params.done as keyof typeof t.done] : null;

  return (
    <PageShell title={t.title}>
      <div className="space-y-4">
        <LinkButton href="/new" className="w-full">
          {t.newListing}
        </LinkButton>
        {done && <Alert tone="success">{done}</Alert>}
        {params.error && <Alert tone="error">{t.notAllowed}</Alert>}
        {rows.length === 0 && <p className="text-neutral-600">{t.empty}</p>}
        <ul className="space-y-3">
          {rows.map(({ listing: l, coverKey }) => {
            const thumb = coverKey ? imageUrl(coverKey, 'thumb', 'webp') : null;
            const actions = (['renew', 'pause', 'resume', 'sold'] as StatusAction[]).filter((a) => canApply(a, l, now));
            const editable = ['draft', 'active', 'paused', 'expired', 'rejected'].includes(l.status);
            return (
              <li key={l.id}>
                <Card className="space-y-3">
                  <div className="flex gap-3">
                    <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                      {thumb && <img src={thumb} alt="" width={80} height={80} className="size-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      {l.status === 'draft' ? (
                        <p className="truncate font-semibold">{l.title || t.untitled}</p>
                      ) : (
                        <Link href={listingPath(l.title, l.publicToken)} className="block truncate font-semibold hover:underline">
                          {l.title}
                        </Link>
                      )}
                      <span className={`inline-block rounded-md px-2 py-0.5 text-xs ${STATUS_TONE[l.status] ?? ''}`}>
                        {messages.status[l.status]}
                      </span>
                      {l.expiresAt && l.status === 'active' && <p className="text-xs text-neutral-500">{t.expires(formatDate(l.expiresAt, zone))}</p>}
                      {l.expiresAt && l.status === 'expired' && (
                        <p className="text-xs text-neutral-500">{t.expiredOn(formatDate(l.expiresAt, zone))}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editable && (
                      <LinkButton href={`/my/listings/${l.id}`} variant="secondary" className="px-3 py-2">
                        {l.status === 'draft' ? t.continue : t.edit}
                      </LinkButton>
                    )}
                    {actions.map((a) => (
                      <form key={a} action={listingStatusAction}>
                        <input type="hidden" name="listingId" value={l.id} />
                        <input type="hidden" name="action" value={a} />
                        <Button type="submit" variant={a === 'renew' ? 'primary' : 'secondary'} className="px-3 py-2">
                          {t[a]}
                        </Button>
                      </form>
                    ))}
                    <details className="group">
                      <summary className="inline-flex cursor-pointer list-none items-center rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                        {t.delete}
                      </summary>
                      <form action={listingStatusAction} className="mt-2 flex items-center gap-2">
                        <input type="hidden" name="listingId" value={l.id} />
                        <input type="hidden" name="action" value="delete" />
                        <span className="text-sm">{t.deleteConfirm}</span>
                        <Button type="submit" variant="danger" className="px-3 py-2">
                          {t.deleteYes}
                        </Button>
                      </form>
                    </details>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </div>
    </PageShell>
  );
}
