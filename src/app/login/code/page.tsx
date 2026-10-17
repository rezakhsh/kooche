import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, PageShell } from '../../../components/ui';
import { messages } from '../../../messages/fa';
import { CodeForm } from '../forms';

export const metadata = { title: messages.code.title, robots: { index: false } };

export default async function CodePage() {
  const email = (await cookies()).get('login_email')?.value;
  if (!email) redirect('/login');
  const t = messages.code;
  return (
    <PageShell title={t.title}>
      <Card>
        <p className="mb-5 text-sm leading-relaxed text-neutral-600">
          {t.intro('⁨' + email + '⁩')}
        </p>
        <CodeForm />
        <Link href="/login" className="mt-4 block text-center text-sm text-brand-800 underline">
          {t.changeEmail}
        </Link>
      </Card>
    </PageShell>
  );
}
