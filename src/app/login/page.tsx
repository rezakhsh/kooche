import { redirect } from 'next/navigation';
import { Card, PageShell } from '../../components/ui';
import { messages } from '../../messages/fa';
import { currentSession, safeNext } from '../../modules/users/server';
import { EmailForm } from './forms';

export const metadata = { title: messages.login.title, robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  if (await currentSession()) redirect(next);
  const t = messages.login;
  return (
    <PageShell title={t.title} logo>
      <Card>
        <p className="mb-5 text-sm leading-relaxed text-neutral-600">{t.intro}</p>
        <EmailForm next={next} />
      </Card>
    </PageShell>
  );
}
