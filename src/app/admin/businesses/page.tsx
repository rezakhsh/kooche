import Link from 'next/link';
import { Alert, Button } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { admin } from '../../../messages/fa';
import { adminHref, requireStaff, staffCan } from '../../../modules/admin/server';
import { businessesAdmin } from '../../../modules/admin/users';
import { verificationAction } from '../admin-actions';
import { AdminTitle, Ago, Chips, Facts, SearchForm, StatusPill } from '../ui';

// Businesses and the verification queue (replaces scripts/verify-business.ts, which stays as a
// fallback): the legal details next to each other, then verify or reject, written to audit_log.

export default async function BusinessesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff('businesses.view');
  const sp = await searchParams;
  const tab = sp.tab === 'all' ? 'all' : 'waiting';
  const q = (sp.q ?? '').slice(0, 100);
  const rows = await businessesAdmin(appDb(), { waiting: tab === 'waiting', q });
  const mayVerify = await staffCan('organization.verify');
  const t = admin.businesses;
  return (
    <>
      <AdminTitle title={t.title} intro={tab === 'waiting' ? t.waitingIntro : undefined}>
        <Chips items={(['waiting', 'all'] as const).map((k) => ({ href: adminHref(`/businesses${k === 'all' ? '?tab=all' : ''}`), label: t.tabs[k]!, active: tab === k }))} />
      </AdminTitle>
      {sp.done && <div className="mb-4"><Alert tone="success">{t.done}</Alert></div>}
      {tab === 'all' && <SearchForm label={admin.common.search} value={q}><input type="hidden" name="tab" value="all" /></SearchForm>}
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-neutral-600">{tab === 'waiting' ? t.empty : admin.common.noResults}</p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {rows.map((b) => (
            <li key={b.id} className="rounded-2xl border border-neutral-200 p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <a href={`/b/${b.slug}`} target="_blank" rel="noreferrer" className="font-bold hover:underline">{b.name}</a>
                <StatusPill status={b.status} />
                <span className="text-xs text-neutral-500">{admin.status[b.verification] ?? b.verification}</span>
                <span className="text-xs text-neutral-500"><Ago date={b.createdAt} /></span>
              </div>
              <Facts
                rows={[
                  [t.legal, [b.legalName, b.legalForm].filter(Boolean).join('، ') || null],
                  [t.register, [b.registerCourt, b.registrationNumber].filter(Boolean).join('، ') || null],
                  [t.vat, b.vatId],
                  [t.representative, b.representative],
                  [t.address, b.address ? <bdi key="a" dir="auto">{b.address}</bdi> : null],
                  [t.website, b.website ? <a key="w" href={b.website} target="_blank" rel="noreferrer nofollow" dir="ltr" className="text-brand-800 hover:underline">{b.website}</a> : null],
                ]}
              />
              <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-3">
                {mayVerify && (
                  <form action={verificationAction} className="flex flex-1 flex-wrap items-end gap-2">
                    <input type="hidden" name="organizationId" value={b.id} />
                    <input type="hidden" name="tab" value={tab} />
                    <input name="note" maxLength={500} placeholder={t.note} className="min-w-0 flex-1 basis-40 rounded-xl border border-neutral-300 px-3 py-2 text-sm" />
                    {b.verification !== 'verified' && <Button type="submit" name="status" value="verified">{t.verify}</Button>}
                    {b.verification !== 'rejected' && b.verification !== 'verified' && <Button type="submit" name="status" value="rejected" variant="secondary">{t.reject}</Button>}
                    {b.verification === 'verified' && <Button type="submit" name="status" value="unverified" variant="danger">{t.unverify}</Button>}
                  </form>
                )}
                <Link href={adminHref(`/items/business/${b.id}`)} prefetch={false} className="text-sm font-medium text-brand-800 hover:underline">{t.moderation}</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
