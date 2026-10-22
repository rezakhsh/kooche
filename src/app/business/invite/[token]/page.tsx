import { Alert, Button, PageShell } from '../../../../components/ui';
import { appDb } from '../../../../db/drizzle';
import { messages } from '../../../../messages/fa';
import { invitationByToken } from '../../../../modules/organizations/members';
import { requireSession } from '../../../../modules/users/server';
import { acceptInvitationAction } from '../../actions';

// The link in an invitation email. Accepting needs the account with the invited email address.

export const metadata = { title: messages.business.invitation.title, robots: { index: false } };

export default async function InvitationPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;
  const { user } = await requireSession(`/business/invite/${encodeURIComponent(token)}`);
  const inv = await invitationByToken(appDb(), token);
  const t = messages.business;
  const wrong = inv && inv.email !== user.email.toLowerCase();
  return (
    <PageShell title={t.invitation.title}>
      <div className="space-y-4">
        {!inv || !inv.usable || error === 'expired' || error === 'not_found' ? (
          <Alert tone="error">{t.invitation.expired}</Alert>
        ) : wrong || error === 'wrong_account' ? (
          <Alert tone="error">{t.invitation.wrongAccount(inv.email!)}</Alert>
        ) : (
          <>
            {error === 'no_seats' && <Alert tone="error">{t.invitation.noSeats}</Alert>}
            <p>{t.invitation.text(inv.orgName, t.roles[inv.role])}</p>
            <form action={acceptInvitationAction}>
              <input type="hidden" name="token" value={token} />
              <Button type="submit" className="w-full">
                {t.invitation.accept}
              </Button>
            </form>
          </>
        )}
      </div>
    </PageShell>
  );
}
