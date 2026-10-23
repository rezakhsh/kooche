import Link from 'next/link';
import { Alert, Pill } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { admin, faDigits, messages } from '../../../messages/fa';
import { moderationQueue, type QueueKind, type QueueSort } from '../../../modules/admin/queue';
import { adminHref, requireStaff } from '../../../modules/admin/server';
import { Ago, AdminTitle, Chips, StatusPill } from '../ui';

const KINDS: Array<QueueKind | 'all'> = ['all', 'listing', 'user', 'business', 'message'];

export default async function QueuePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff('queue.view');
  const sp = await searchParams;
  const sort: QueueSort = sp.sort === 'most' ? 'most' : 'oldest';
  const kind = typeof sp.kind === 'string' && KINDS.includes(sp.kind as QueueKind) && sp.kind !== 'all' ? (sp.kind as QueueKind) : null;
  const country = sp.country === 'DE' || sp.country === 'AT' ? sp.country : null;
  const items = await moderationQueue(appDb(), { sort, kind, country });
  const t = admin.queue;
  const href = (p: Record<string, string | null>) => {
    const q = new URLSearchParams(Object.entries({ sort, kind, country, ...p }).filter((e): e is [string, string] => !!e[1] && e[1] !== 'oldest' && e[1] !== 'all'));
    return adminHref(`/queue${q.size ? `?${q}` : ''}`);
  };
  return (
    <>
      <AdminTitle title={t.title} intro={t.intro}>
        <span className="text-sm text-neutral-600">{t.count(items.length)}</span>
      </AdminTitle>
      {sp.done && <div className="mb-4"><Alert tone="success">{t.done}</Alert></div>}
      <div className="mb-5 space-y-3">
        <Chips items={KINDS.map((k) => ({ href: href({ kind: k }), label: t.kinds[k]!, active: (kind ?? 'all') === k }))} />
        <Chips
          items={[
            ...(['oldest', 'most'] as const).map((s) => ({ href: href({ sort: s }), label: t.sort[s], active: sort === s })),
            ...(['DE', 'AT'] as const).map((c) => ({ href: href({ country: country === c ? null : c }), label: c, active: country === c })),
          ]}
        />
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-neutral-600">{t.empty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((i) => (
            <li key={`${i.kind}-${i.id}`}>
              <Link
                href={adminHref(`/items/${i.kind}/${i.id}`)}
                prefetch={false}
                className={`block rounded-2xl border p-4 hover:bg-neutral-50 ${i.illegal ? 'border-red-300 bg-red-50/40' : 'border-neutral-200'}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="brand">{admin.item.kinds[i.kind]}</Pill>
                  <StatusPill status={i.status} />
                  {i.illegal && <Pill tone="danger">{t.tags.illegal}</Pill>}
                  {i.reports > 0 && <Pill tone="warning">{t.tags.reports(i.reports)}</Pill>}
                  {i.flagged && <Pill tone="saffron">{t.tags.flagged}</Pill>}
                  {i.resubmitted && <Pill tone="saffron">{t.tags.resubmitted}</Pill>}
                  {i.appeals > 0 && <Pill tone="neutral">{t.tags.appeals(i.appeals)}</Pill>}
                </div>
                <p className="mt-2 truncate font-bold">
                  <bdi dir="auto">{i.title ?? admin.common.none}</bdi>
                </p>
                <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-neutral-500">
                  <span>
                    {t.waiting} <Ago date={i.since} />
                  </span>
                  {i.refNumber !== null && <span>{admin.item.code}: {faDigits(String(i.refNumber))}</span>}
                  {i.reasons.length > 0 && <span>{i.reasons.map((r) => messages.report.reasons[r] ?? r).join('، ')}</span>}
                  {i.countryCode && <span>{i.countryCode}</span>}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
