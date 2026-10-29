import Link from 'next/link';
import { Alert, Button, Pill } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { formatDate } from '../../../lib/format';
import { admin, faDigits } from '../../../messages/fa';
import { adminHref, requireStaff, staffCan } from '../../../modules/admin/server';
import { cachedCatalog } from '../../../modules/listings/catalog';
import { listingPath } from '../../../modules/listings/slug';
import { ASK_DAYS, suspicionQueue } from '../../../modules/organizations/suspicions';
import { suspicionAction } from '../admin-actions';
import { Ago, AdminTitle } from '../ui';

// «احتمالاً کسب‌وکار» (wave 2 part 4, src/modules/organizations/suspicions.ts): private accounts that
// look commercial, one card each with the reasons, their live offers and what can be done: ask
// (14 days, an email), «کسب‌وکار نیست», and after the deadline restrict (admins only). Asked cases
// past their deadline come first.

export default async function BusinessQueuePage({ searchParams }: { searchParams: Promise<{ done?: string; stale?: string }> }) {
  await requireStaff('business.suspicion');
  const sp = await searchParams;
  const db = appDb();
  const [cases, catalog, mayRestrict] = await Promise.all([suspicionQueue(db), cachedCatalog(db), staffCan('business.restrict')]);
  const t = admin.businessQueue;
  const zone = webEnv().APP_TIME_ZONE;
  const now = new Date();
  return (
    <>
      <AdminTitle title={t.title} intro={t.intro(ASK_DAYS)}>
        <span className="text-sm text-neutral-600">{t.count(cases.length)}</span>
      </AdminTitle>
      {sp.done && (
        <div className="mb-4">
          <Alert tone="success">{t.done[sp.done as keyof typeof t.done] ?? t.done.ask}</Alert>
        </div>
      )}
      {sp.stale && (
        <div className="mb-4">
          <Alert tone="info">{t.stale}</Alert>
        </div>
      )}
      {cases.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-neutral-600">{t.empty}</p>
      ) : (
        <ul className="space-y-3">
          {cases.map((c) => {
            const overdue = c.status === 'asked' && !!c.deadlineAt && c.deadlineAt < now;
            return (
              <li key={c.id} className={`rounded-2xl border p-4 ${overdue ? 'border-saffron-300 bg-saffron-50' : 'border-neutral-200 bg-white'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={c.status === 'asked' ? 'saffron' : 'brand'}>{t.status[c.status]}</Pill>
                  {overdue && <Pill tone="warning">{t.overdue}</Pill>}
                  {c.reasons.map((r) => (
                    <Pill key={r.code} tone="neutral">
                      {t.reasons[r.code](r.n ?? 0)}
                    </Pill>
                  ))}
                </div>
                <p className="mt-2 font-bold">
                  <Link href={adminHref(`/users/${c.user.id}`)} prefetch={false} className="hover:underline">
                    <bdi dir="auto">{c.user.displayName}</bdi>
                  </Link>
                </p>
                <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-neutral-600">
                  <span>
                    {t.found} <Ago date={c.createdAt} />
                  </span>
                  {c.deadlineAt && <span>{t.deadline(formatDate(c.deadlineAt, zone))}</span>}
                  <span>{t.roots(c.rootSlugs.map((s) => catalog.bySlug.get(s)?.nameFa ?? s).join('، '))}</span>
                </p>
                {c.listings.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {c.listings.map((l) => (
                      <li key={l.publicToken} className="truncate">
                        <Link href={listingPath(l.title, l.publicToken)} prefetch={false} className="text-brand-800 hover:underline">
                          <bdi dir="auto">{l.title}</bdi>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <form action={suspicionAction} className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="caseId" value={c.id} />
                  {c.status === 'open' && (
                    <Button type="submit" name="decision" value="ask">
                      {t.ask(ASK_DAYS)}
                    </Button>
                  )}
                  {overdue && mayRestrict && (
                    <Button type="submit" name="decision" value="restrict" variant="danger">
                      {t.restrict}
                    </Button>
                  )}
                  <Button type="submit" name="decision" value="dismiss" variant="secondary">
                    {t.dismiss}
                  </Button>
                </form>
                {overdue && !mayRestrict && <p className="mt-2 text-xs text-neutral-600">{t.adminRestricts}</p>}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-6 text-xs leading-6 text-neutral-600">{t.rules(faDigits('20'), faDigits('4'), faDigits('2'))}</p>
    </>
  );
}
