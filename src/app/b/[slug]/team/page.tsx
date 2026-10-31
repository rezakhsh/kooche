import { Alert, Button, Card, Field, Pill } from '../../../../components/ui';
import { appDb } from '../../../../db/drizzle';
import { webEnv } from '../../../../lib/env';
import { formatDate } from '../../../../lib/format';
import { messages } from '../../../../messages/fa';
import { members, pendingInvitations } from '../../../../modules/organizations/members';
import { businessPlan } from '../../../../modules/payments/plans';
import { changeMemberAction, inviteAction, revokeInvitationAction } from '../../../business/actions';
import { memberOf } from '../member';
import { TaskPage } from '../../../../components/settings';

// The business's members and invitations (owner only; anyone else may leave from here too, but
// only the owner sees this page). Seats come from the plan.

export const metadata = { title: messages.business.team.title, robots: { index: false } };

const ROLES = ['owner', 'manager', 'staff'] as const;

export default async function TeamPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { slug } = await params;
  const query = await searchParams;
  const { user, org } = await memberOf(slug, `/b/${slug}/team`, ['owner']);
  const db = appDb();
  const t = messages.business;
  const zone = webEnv().APP_TIME_ZONE;
  const [list, pending, plan] = await Promise.all([members(db, org.id), pendingInvitations(db, org.id), businessPlan(db, org.id)]);
  const used = list.length - 1 + pending.length;
  const seats = plan.features.staffSeats;
  const error = query.error && query.error in t.team.errors ? t.team.errors[query.error as keyof typeof t.team.errors] : null;
  const hidden = (
    <>
      <input type="hidden" name="organizationId" value={org.id} />
      <input type="hidden" name="slug" value={org.slug} />
    </>
  );

  // TaskPage: a way back to the dashboard (design check, Oct 31, 2026)
  return (
    <TaskPage title={`${t.team.title}: ${org.name}`} back={`/b/${org.slug}/manage`} backLabel={messages.business.backToPanel} wide>
      <div className="space-y-5">
        {query.sent && <Alert tone="success">{t.team.sent}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
          {list.map((m) => {
            // The only owner can't step down or leave: those buttons could only fail (design check, Oct 31, 2026)
            const lastOwner = m.role === 'owner' && list.filter((x) => x.role === 'owner').length === 1;
            const self = m.userId === user.id;
            return (
            <li key={m.userId} className="space-y-2 px-4 py-3">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-bold">
                  <bdi>{m.name}</bdi> {m.userId === user.id && <span className="text-xs font-normal text-neutral-500">{t.team.you}</span>}
                </span>
                <Pill tone={m.role === 'owner' ? 'brand' : 'neutral'}>{t.roles[m.role]}</Pill>
              </p>
              <p className="text-xs text-neutral-500" dir="ltr">
                {m.email}
              </p>
              {!lastOwner && (
              <div className="flex flex-wrap items-start gap-2">
                {ROLES.filter((r) => r !== m.role).map((r) => (
                  <form key={r} action={changeMemberAction}>
                    {hidden}
                    <input type="hidden" name="memberId" value={m.userId} />
                    <input type="hidden" name="to" value={r} />
                    <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
                      {t.team.makeRole(t.roles[r])}
                    </Button>
                  </form>
                ))}
                {/* Removing someone, or leaving, asks once more, like deleting a listing */}
                <details className="w-full">
                  <summary className="inline-flex cursor-pointer list-none items-center rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 [&::-webkit-details-marker]:hidden">
                    {self ? t.team.leave : t.team.remove}
                  </summary>
                  <div className="mt-2 rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-800">
                    <p>{self ? t.team.leaveConfirm : t.team.removeConfirm(m.name)}</p>
                    <form action={changeMemberAction} className="mt-2">
                      {hidden}
                      <input type="hidden" name="memberId" value={m.userId} />
                      <input type="hidden" name="to" value="removed" />
                      <Button type="submit" variant="danger" className="px-3 py-1.5 text-xs">
                        {self ? t.team.leaveYes : t.team.removeYes}
                      </Button>
                    </form>
                  </div>
                </details>
              </div>
              )}
            </li>
            );
          })}
        </ul>

        {pending.length > 0 && (
          <Card className="space-y-2">
            <h2 className="text-sm font-extrabold">{t.team.pending}</h2>
            <ul className="space-y-2">
              {pending.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span dir="ltr">{i.email}</span>
                  <Pill tone="neutral">{t.roles[i.role]}</Pill>
                  <span className="text-xs text-neutral-500">{t.team.until(formatDate(i.expiresAt, zone))}</span>
                  <form action={revokeInvitationAction}>
                    {hidden}
                    <input type="hidden" name="invitationId" value={i.id} />
                    <Button type="submit" variant="secondary" className="px-2 py-1 text-xs">
                      {t.team.revoke}
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card className="space-y-3">
          <h2 className="font-extrabold">{t.team.invite}</h2>
          <p className="text-sm text-neutral-600">{seats > 0 ? t.team.seats(used, seats) : t.team.noSeats}</p>
          {used < seats && (
            <form action={inviteAction} className="space-y-3">
              {hidden}
              <Field label={t.team.email} name="email" type="email" required maxLength={200} dir="ltr" />
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-neutral-700">{t.team.role}</span>
                <select name="role" defaultValue="staff" className="block w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base">
                  <option value="staff">
                    {t.roles.staff}: {t.roleHints.staff}
                  </option>
                  <option value="manager">
                    {t.roles.manager}: {t.roleHints.manager}
                  </option>
                </select>
              </label>
              <Button type="submit">{t.team.send}</Button>
            </form>
          )}
        </Card>
      </div>
    </TaskPage>
  );
}
