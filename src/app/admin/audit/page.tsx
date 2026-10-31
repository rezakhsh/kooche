import Link from 'next/link';
import { appDb } from '../../../db/drizzle';
import { admin } from '../../../messages/fa';
import { AUDIT_GROUPS, auditRows } from '../../../modules/admin/audit-log';
import { adminHref, requireStaff, staffCan } from '../../../modules/admin/server';
import { AdminTitle, Panel, selectClass, When } from '../ui';

const LINKS: Record<string, string> = { listing: 'listing', user: 'user', organization: 'business', message: 'message' };
/** Technical ids in a row's data: the row's target link and the code cover them */
const HIDDEN = /(Id|Ids|^ids|^key|^of|^role)$/;

/** A row's data as short lines (design check, Oct 31, 2026: it was raw JSON) */
function details(data: Record<string, unknown>): string[] {
  const t = admin.audit;
  const value = (v: unknown): string =>
    typeof v === 'boolean' ? (v ? t.yes : t.no) : Array.isArray(v) ? v.map(value).join('، ') : v && typeof v === 'object' ? JSON.stringify(v) : String(v);
  return Object.entries(data)
    .filter(([k, v]) => !HIDDEN.test(k) && v !== null && v !== '')
    .map(([k, v]) => `${t.keys[k] ?? k}: ${value(v)}`);
}

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
        <select name="action" defaultValue={sp.action && sp.action in AUDIT_GROUPS ? sp.action : ''} className={selectClass} aria-label={t.action}>
          {Object.entries(t.groups).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
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
              <li key={r.id} className="py-2.5">
                <p>
                  <bdi className="font-bold">{r.actor ?? t.actorTypes[r.actorType] ?? r.actorType}</bdi>
                  {typeof (r.data as Record<string, unknown>).role === 'string' && (
                    <span className="text-neutral-500"> {t.asRole(admin.roles[(r.data as { role: 'admin' | 'moderator' }).role] ?? '')}</span>
                  )}{' '}
                  {t.actions[r.action] ?? <code dir="ltr" className="rounded bg-neutral-100 px-1.5 text-xs">{r.action}</code>}
                  {r.targetType && r.targetId && LINKS[r.targetType] && (
                    <>
                      {'، '}
                      <Link href={adminHref(`/items/${LINKS[r.targetType]}/${r.targetId}`)} prefetch={false} className="font-medium text-brand-800 hover:underline">{t.targets[r.targetType] ?? r.targetType}</Link>
                    </>
                  )}
                </p>
                {details(r.data as Record<string, unknown>).length > 0 && (
                  <ul className="mt-1 flex flex-wrap gap-x-3 text-xs text-neutral-700">
                    {details(r.data as Record<string, unknown>).map((d) => (
                      <li key={d}><bdi>{d}</bdi></li>
                    ))}
                  </ul>
                )}
                <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-neutral-500">
                  <When date={r.at} />
                  {r.ip && <bdi dir="ltr">{r.ip}</bdi>}
                  <code dir="ltr" className="text-[11px]">{r.action}</code>
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
