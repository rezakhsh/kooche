import Link from 'next/link';
import { Icon } from '../../../../components/icons';
import { Alert, Button, PageShell } from '../../../../components/ui';
import { appDb } from '../../../../db/drizzle';
import { ltr, messages } from '../../../../messages/fa';
import { imageUrl } from '../../../../modules/media/server';
import { invitationByToken } from '../../../../modules/organizations/members';
import { loadActor } from '../../../../modules/users/permissions';
import { requireSession } from '../../../../modules/users/server';
import { acceptInvitationAction, declineInvitationAction } from '../../actions';

// The link in an invitation email. Accepting needs the account with the invited email address.
// Design check, Oct 31, 2026: the business with its logo, who invited, what the role can do, a
// way to say no, and a note when the phone still has to be verified before posting.

export const metadata = { title: messages.business.invitation.title, robots: { index: false } };

export default async function InvitationPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string; declined?: string }> }) {
  const { token } = await params;
  const { error, declined } = await searchParams;
  const { user } = await requireSession(`/business/invite/${encodeURIComponent(token)}`);
  const db = appDb();
  const [inv, actor] = await Promise.all([invitationByToken(db, token), loadActor(db, user.id)]);
  const t = messages.business;
  const i = t.invitation;
  const wrong = inv && inv.email !== user.email.toLowerCase();
  const logo = inv?.logoKey ? imageUrl(inv.logoKey, 'thumb', 'webp') : null;
  return (
    <PageShell title={i.title}>
      <div className="space-y-4">
        {declined ? (
          <Alert tone="success">{i.declined}</Alert>
        ) : !inv || !inv.usable || error === 'expired' || error === 'not_found' ? (
          <Alert tone="error">{i.expired}</Alert>
        ) : wrong || error === 'wrong_account' ? (
          <Alert tone="error">{i.wrongAccount(ltr(inv.email!))}</Alert>
        ) : (
          <>
            {error === 'no_seats' && <Alert tone="error">{i.noSeats}</Alert>}
            {error === 'restricted' && <Alert tone="error">{t.team.errors.restricted}</Alert>}
            <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-4">
              {logo ? (
                <img src={logo} alt="" width={56} height={56} className="size-14 shrink-0 rounded-2xl object-cover" />
              ) : (
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl font-black text-brand-700">{inv.orgName.slice(0, 1)}</span>
              )}
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <b className="truncate text-lg">{inv.orgName}</b>
                  {inv.verified && <Icon name="verified" className="size-5 shrink-0 text-brand-700" />}
                </span>
                <Link href={`/b/${inv.slug}`} className="text-sm text-brand-800 hover:underline">
                  {i.seePage}
                </Link>
              </span>
            </div>
            <p className="leading-7">{inv.inviter ? i.byWhom(inv.inviter, t.roles[inv.role]) : i.text(inv.orgName, t.roles[inv.role])}</p>
            <p className="rounded-xl bg-neutral-100 p-3 text-sm leading-7 text-neutral-700">{i.roleCan[inv.role]}</p>
            {!actor?.phoneVerifiedAt && (
              <Alert tone="info">
                {i.phoneFirst}{' '}
                <Link href="/account/phone" className="font-bold underline">
                  {messages.account.verifyPhone}
                </Link>
              </Alert>
            )}
            <form action={acceptInvitationAction}>
              <input type="hidden" name="token" value={token} />
              <Button type="submit" className="w-full">
                {i.accept}
              </Button>
            </form>
            <form action={declineInvitationAction}>
              <input type="hidden" name="token" value={token} />
              <Button type="submit" variant="secondary" className="w-full">
                {i.decline}
              </Button>
            </form>
          </>
        )}
      </div>
    </PageShell>
  );
}
