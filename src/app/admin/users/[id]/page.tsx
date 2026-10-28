import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, Button, Pill } from '../../../../components/ui';
import { appDb } from '../../../../db/drizzle';
import { admin, faDigits } from '../../../../messages/fa';
import { personHistory } from '../../../../modules/admin/items';
import { adminHref, requireStaff, staffCan } from '../../../../modules/admin/server';
import { businessesOf, contactViewed, recentListingsOf, sessionsOf } from '../../../../modules/admin/users';
import { releasePhoneAction, signOutAction } from '../../admin-actions';
import { PersonCard } from '../../items/parts';
import { AdminTitle, Ago, Facts, Panel, StatusPill, When } from '../../ui';

export default async function UserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireStaff('users.view');
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = appDb();
  const p = await personHistory(db, id);
  if (!p) notFound();
  const [contact, sessionsAllowed, releaseAllowed] = await Promise.all([staffCan('user.contact'), staffCan('user.sessions'), staffCan('user.release_phone')]);
  if (contact) await contactViewed(db, staff.ctx, id);
  const [listings, businesses, sessions] = await Promise.all([recentListingsOf(db, id), businessesOf(db, id), sessionsAllowed ? sessionsOf(db, id) : Promise.resolve([])]);
  const t = admin.users;
  return (
    <>
      <AdminTitle title={`${admin.item.kinds.user}: ${p.name}`}>
        <Link href={adminHref(`/items/user/${id}`)} prefetch={false} className="text-sm font-medium text-brand-800 hover:underline">
          {t.moderation}
        </Link>
      </AdminTitle>
      {sp.signedOut && <div className="mb-4"><Alert tone="success">{t.signedOut(Number(sp.signedOut))}</Alert></div>}
      {sp.released && <div className="mb-4"><Alert tone="success">{t.released}</Alert></div>}
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <PersonCard p={p} title={admin.item.person.title} contact={contact} onUserPage />
          {contact && (
            <Panel title={t.contact}>
              <Facts
                rows={[
                  [admin.item.person.email, <bdi key="e" dir="ltr">{p.email}</bdi>],
                  [t.phoneNumber, p.phone ? <bdi key="p" dir="ltr">{p.phone}</bdi> : t.noPhone],
                  [admin.item.person.telegram, p.telegramLinked ? admin.common.yes : admin.common.no],
                ]}
              />
              {releaseAllowed && p.phone && (
                <form action={releasePhoneAction} className="mt-4 space-y-2 border-t border-neutral-100 pt-4">
                  <input type="hidden" name="userId" value={id} />
                  <p className="text-xs text-neutral-600">{t.releaseHint}</p>
                  <input name="note" maxLength={500} placeholder={t.releaseNote} className="block w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" />
                  <Button type="submit" variant="danger">{t.release}</Button>
                </form>
              )}
            </Panel>
          )}
          {sessionsAllowed && (
            <Panel title={t.sessions}>
              {sessions.length === 0 ? (
                <p className="text-sm text-neutral-500">{t.noSessions}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {sessions.map((s) => (
                    <li key={s.id} className="flex flex-wrap gap-x-3 gap-y-1">
                      <span className="font-medium">{[s.device.browser, s.device.os].filter(Boolean).join('، ') || admin.common.none}</span>
                      {s.ip && <bdi dir="ltr" className="text-neutral-500">{s.ip}</bdi>}
                      <span className="text-neutral-500">{t.lastUsed}: <Ago date={s.updatedAt} /></span>
                      {s.staffVerifiedAt && <Pill tone="brand">{t.staffChecked}</Pill>}
                    </li>
                  ))}
                </ul>
              )}
              {sessions.length > 0 && (
                <form action={signOutAction} className="mt-4">
                  <input type="hidden" name="userId" value={id} />
                  <Button type="submit" variant="danger">{t.signOut}</Button>
                </form>
              )}
            </Panel>
          )}
        </div>
        <div className="space-y-5">
          <Panel title={t.listings}>
            {listings.length === 0 ? (
              <p className="text-sm text-neutral-500">{admin.common.noResults}</p>
            ) : (
              <ul className="divide-y divide-neutral-100 text-sm">
                {listings.map((l) => (
                  <li key={l.id}>
                    <Link href={adminHref(`/items/listing/${l.id}`)} prefetch={false} className="flex flex-wrap items-center gap-2 py-2 hover:bg-neutral-50">
                      <bdi dir="auto" className="min-w-0 flex-1 truncate">{l.title || admin.common.none}</bdi>
                      <StatusPill status={l.status} />
                      <span className="text-xs text-neutral-500">{faDigits(String(l.refNumber))}</span>
                      <span className="text-xs text-neutral-500"><When date={l.createdAt} /></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {businesses.length > 0 && (
            <Panel title={t.businesses}>
              <ul className="space-y-1 text-sm">
                {businesses.map((b) => (
                  <li key={b.id} className="flex gap-2">
                    <Link href={adminHref(`/items/business/${b.id}`)} prefetch={false} className="font-medium text-brand-800 hover:underline">{b.name}</Link>
                    <span className="text-neutral-500">{b.role}</span>
                    <StatusPill status={b.status} />
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
