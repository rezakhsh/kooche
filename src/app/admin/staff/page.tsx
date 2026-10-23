import { Alert, Button, Pill } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { admin } from '../../../messages/fa';
import { requireStaff } from '../../../modules/admin/server';
import { staffList } from '../../../modules/admin/staff';
import { staffRoleAction } from '../admin-actions';
import { AdminTitle, Panel, StatusPill } from '../ui';

export default async function StaffPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireStaff('staff.manage');
  const sp = await searchParams;
  const rows = await staffList(appDb());
  const t = admin.staffPage;
  return (
    <>
      <AdminTitle title={t.title} intro={t.intro} />
      {sp.done && <div className="mb-4"><Alert tone="success">{t.done}</Alert></div>}
      {sp.error && <div className="mb-4"><Alert tone="error">{t.errors[sp.error] ?? admin.common.forbidden}</Alert></div>}
      <Panel className="mb-5">
        <ul className="divide-y divide-neutral-100 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
              <bdi className="font-medium">{r.name}</bdi>
              <bdi dir="ltr" className="text-neutral-500">{r.email}</bdi>
              <Pill tone="brand">{admin.roles[r.role!]}</Pill>
              <StatusPill status={r.status} />
              <span className="text-xs text-neutral-500">{t.twoFactor}: {r.twoFactor ? admin.common.yes : admin.common.no}</span>
              {r.role === 'moderator' && r.id !== me.ctx.userId && (
                <form action={staffRoleAction} className="ms-auto">
                  <input type="hidden" name="email" value={r.email} />
                  <input type="hidden" name="role" value="none" />
                  <Button type="submit" variant="danger" className="py-2">{t.remove}</Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title={t.appoint}>
        <form action={staffRoleAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="role" value="moderator" />
          <label className="min-w-0 flex-1 basis-64">
            <span className="mb-1 block text-sm font-medium text-neutral-700">{t.email}</span>
            <input name="email" type="email" required dir="ltr" className="block w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm" />
          </label>
          <Button type="submit">{t.appoint}</Button>
        </form>
      </Panel>
    </>
  );
}
