import Link from 'next/link';
import { Button, Card, PageShell } from '../../components/ui';
import { appDb } from '../../db/drizzle';
import { messages } from '../../messages/fa';
import { loadActor } from '../../modules/users/permissions';
import { requireSession } from '../../modules/users/server';
import { signOut } from './actions';

export const metadata = { title: messages.account.title, robots: { index: false } };

export default async function AccountPage() {
  const { user } = await requireSession('/account');
  const actor = await loadActor(appDb(), user.id);
  const t = messages.account;
  return (
    <PageShell title={t.title}>
      <Card className="space-y-3">
        <p dir="ltr" className="text-end text-sm text-neutral-600">
          {user.email}
        </p>
        <nav className="flex flex-col gap-2">
          <Link href="/account/phone" className="rounded-xl px-3 py-2 hover:bg-neutral-50">
            {t.phone}
            {!actor?.phoneVerifiedAt && <span className="ms-2 text-xs text-amber-700">●</span>}
          </Link>
          <Link href="/my/listings" className="rounded-xl px-3 py-2 hover:bg-neutral-50">
            {t.myListings}
          </Link>
          <Link href="/account/place" className="rounded-xl px-3 py-2 hover:bg-neutral-50">
            {t.place}
          </Link>
          <Link href="/account/devices" className="rounded-xl px-3 py-2 hover:bg-neutral-50">
            {t.devices}
          </Link>
        </nav>
        <form action={signOut}>
          <Button type="submit" variant="secondary" className="w-full">
            {t.signOut}
          </Button>
        </form>
      </Card>
    </PageShell>
  );
}
