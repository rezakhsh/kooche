import { Alert, Button, Card, PageShell } from '../../../components/ui';
import { messages } from '../../../messages/fa';
import { leaveWaitlistAction } from '../actions';

// The leave link in the owner's opening email (src/modules/launch/waitlist.ts, exportWaitlist).
// The button deletes the signup; also allowed from Iran (src/lib/region.ts).

export const metadata = { title: messages.launch.leave.title, robots: { index: false } };

export default async function LeaveWaitlistPage({ searchParams }: { searchParams: Promise<{ t?: string; done?: string; invalid?: string }> }) {
  const sp = await searchParams;
  const t = messages.launch.leave;
  return (
    <PageShell title={t.title}>
      <Card>
        {sp.done ? (
          <Alert tone="success">{t.done}</Alert>
        ) : sp.invalid || !sp.t ? (
          <Alert tone="error">{t.invalid}</Alert>
        ) : (
          <form action={leaveWaitlistAction} className="space-y-4">
            <p className="leading-7 text-neutral-700">{t.intro}</p>
            <input type="hidden" name="t" value={sp.t.slice(0, 64)} />
            <Button type="submit" variant="danger" className="w-full">
              {t.button}
            </Button>
          </form>
        )}
      </Card>
    </PageShell>
  );
}
