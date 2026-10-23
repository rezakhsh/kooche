import Link from 'next/link';
import { Pill } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { admin } from '../../../messages/fa';
import { searchUsers } from '../../../modules/admin/users';
import { adminHref, requireStaff, staffCan } from '../../../modules/admin/server';
import { AdminTitle, Ago, SearchForm, StatusPill } from '../ui';

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff('users.view');
  const q = ((await searchParams).q ?? '').slice(0, 100);
  const contact = await staffCan('user.contact');
  const rows = await searchUsers(appDb(), q, { withContact: contact });
  const t = admin.users;
  return (
    <>
      <AdminTitle title={t.title} />
      <SearchForm label={t.searchLabel} value={q} />
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">{admin.common.noResults}</p>
      ) : (
        <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200">
          {rows.map((u) => (
            <li key={u.id}>
              <Link href={adminHref(`/users/${u.id}`)} prefetch={false} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm hover:bg-neutral-50">
                <bdi className="font-bold" dir="auto">{u.name}</bdi>
                <StatusPill status={u.status} />
                {u.staffRole && <Pill tone="brand">{admin.roles[u.staffRole]}</Pill>}
                {contact && <bdi dir="ltr" className="text-neutral-500">{u.email}</bdi>}
                <span className="ms-auto flex gap-3 text-xs text-neutral-500">
                  <span>{t.live}: {u.live.toLocaleString('fa-IR')}</span>
                  <span>{u.phoneVerified ? admin.common.yes : admin.common.no} ({t.phone})</span>
                  <Ago date={u.createdAt} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
