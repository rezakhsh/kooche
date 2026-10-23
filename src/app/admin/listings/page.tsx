import Link from 'next/link';
import { Pill } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { LISTING_STATUSES } from '../../../db/schema/_values';
import { admin, faDigits } from '../../../messages/fa';
import { adminHref, requireStaff } from '../../../modules/admin/server';
import { searchListingsAdmin } from '../../../modules/admin/users';
import { AdminTitle, Ago, SearchForm, selectClass, StatusPill } from '../ui';

export default async function ListingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff('listings.view');
  const sp = await searchParams;
  const q = (sp.q ?? '').slice(0, 300);
  const status = (LISTING_STATUSES as readonly string[]).includes(sp.status ?? '') && sp.status !== 'draft' ? sp.status! : null;
  const country = sp.country === 'DE' || sp.country === 'AT' ? sp.country : null;
  const kind = sp.kind === 'events' ? 'events' : sp.kind === 'listings' ? 'listings' : 'all';
  const rows = await searchListingsAdmin(appDb(), { q, status, country, events: kind === 'all' ? null : kind === 'events' });
  const t = admin.listings;
  return (
    <>
      <AdminTitle title={t.title} />
      <SearchForm label={t.searchLabel} value={q}>
        <select name="status" defaultValue={status ?? ''} className={selectClass} aria-label={admin.item.status}>
          <option value="">{t.allStatuses}</option>
          {LISTING_STATUSES.filter((s) => s !== 'draft').map((s) => (
            <option key={s} value={s}>{admin.status[s]}</option>
          ))}
        </select>
        <select name="kind" defaultValue={kind} className={selectClass} aria-label={admin.item.kinds.listing}>
          {Object.entries(t.kind).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
        <select name="country" defaultValue={country ?? ''} className={selectClass} aria-label={admin.common.country}>
          <option value="">{admin.common.all}</option>
          <option value="DE">DE</option>
          <option value="AT">AT</option>
        </select>
      </SearchForm>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">{admin.common.noResults}</p>
      ) : (
        <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200">
          {rows.map((l) => (
            <li key={l.id}>
              <Link href={adminHref(`/items/listing/${l.id}`)} prefetch={false} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm hover:bg-neutral-50">
                <bdi dir="auto" className="min-w-0 flex-1 basis-48 truncate font-bold">{l.title || admin.common.none}</bdi>
                <StatusPill status={l.status} />
                {l.openReports > 0 && <Pill tone="warning">{admin.queue.tags.reports(l.openReports)}</Pill>}
                <span className="text-xs text-neutral-500">{faDigits(String(l.refNumber))}</span>
                <span className="text-xs text-neutral-500"><bdi>{l.seller}</bdi></span>
                <span className="text-xs text-neutral-500">{l.countryCode}</span>
                <span className="text-xs text-neutral-500"><Ago date={l.createdAt} /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
