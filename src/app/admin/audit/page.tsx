import Link from 'next/link';
import { appDb } from '../../../db/drizzle';
import { admin } from '../../../messages/fa';
import { auditRows } from '../../../modules/admin/audit-log';
import { adminHref, requireStaff, staffCan } from '../../../modules/admin/server';
import { AdminTitle, Panel, When } from '../ui';

const LINKS: Record<string, string> = { listing: 'listing', user: 'user', organization: 'business', message: 'message' };

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireStaff('overview.view');
  const sp = await searchParams;
  const all = await staffCan('audit.all');
  const rows = await auditRows(appDb(), { action: sp.action ?? '', actor: all ? (sp.actor ?? '') : '', target: sp.target ?? '', onlyUserId: all ? null : staff.ctx.userId });
  const t = admin.audit;
  const input = 'block w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm';
  return (
    <>
      <AdminTitle title={t.title} intro={t.intro} />
      <form method="get" className="mb-5 grid gap-2 sm:grid-cols-4">
        <input name="action" defaultValue={sp.action ?? ''} placeholder={t.action} dir="ltr" className={input} aria-label={t.action} />
        {all && <input name="actor" defaultValue={sp.actor ?? ''} placeholder={t.actor} dir="auto" className={input} aria-label={t.actor} />}
        <input name="target" defaultValue={sp.target ?? ''} placeholder={t.target} dir="ltr" className={input} aria-label={t.target} />
        <button type="submit" className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white hover:bg-brand-800">{admin.common.filter}</button>
      </form>
      {!all && <p className="mb-3 text-xs text-neutral-500">{t.mine}</p>}
      <Panel>
        {rows.length === 0 ? (
          <p className="text-sm text-neutral-500">{t.empty}</p>
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm">
            {rows.map((r) => (
              <li key={r.id} className="py-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-xs text-neutral-500"><When date={r.at} /></span>
                  <bdi className="font-medium">{r.actor ?? r.actorType}</bdi>
                  <code dir="ltr" className="rounded bg-neutral-100 px-1.5 text-xs">{r.action}</code>
                  {r.targetType && r.targetId && (LINKS[r.targetType] ? (
                    <Link href={adminHref(`/items/${LINKS[r.targetType]}/${r.targetId}`)} prefetch={false} className="text-xs text-brand-800 hover:underline">{r.targetType}</Link>
                  ) : <span className="text-xs text-neutral-500">{r.targetType}</span>)}
                  {r.ip && <bdi dir="ltr" className="text-xs text-neutral-400">{r.ip}</bdi>}
                </div>
                {Object.keys(r.data as object).length > 0 && (
                  <code dir="ltr" className="mt-1 block truncate text-start text-xs text-neutral-500">{JSON.stringify(r.data)}</code>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
