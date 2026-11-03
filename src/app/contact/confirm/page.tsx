import Link from 'next/link';
import { Alert, Button, PageShell } from '../../../components/ui';
import { messages } from '../../../messages/fa';
import { confirmContactAction } from '../actions';

// The link in a guest's confirmation email lands here; the button sends the waiting message (a mail
// scanner that opens the link sends nothing). src/modules/users/contact.ts

export const metadata = { title: messages.contactForm.confirm.title, robots: { index: false } };

export default async function ConfirmContactPage({ searchParams }: { searchParams: Promise<{ t?: string; done?: string; invalid?: string; failed?: string }> }) {
  const sp = await searchParams;
  const t = messages.contactForm.confirm;
  return (
    <PageShell title={t.title}>
      {sp.done ? (
        <Alert tone="success">{t.done}</Alert>
      ) : sp.failed ? (
        <Alert tone="error">{messages.contactForm.errors.failed}</Alert>
      ) : sp.invalid || !sp.t ? (
        <Alert tone="error">{t.invalid}</Alert>
      ) : (
        <form action={confirmContactAction} className="space-y-4">
          <input type="hidden" name="t" value={sp.t} />
          <p className="leading-7 text-neutral-700">{t.ask}</p>
          <Button type="submit" className="w-full">
            {t.button}
          </Button>
        </form>
      )}
      <Link href="/" className="mt-6 inline-block text-sm text-brand-800 underline">
        {t.home}
      </Link>
    </PageShell>
  );
}
