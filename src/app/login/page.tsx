import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, PageShell } from '../../components/ui';
import { messages } from '../../messages/fa';
import { turnstileSiteKey } from '../../modules/security/server';
import { currentSession, safeNext } from '../../modules/users/server';
import { EmailForm } from './forms';
import { IranNotice, fromIran } from '../../components/iran';

export const metadata = { title: messages.login.title, robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // Iran is read-only (src/lib/region.ts): a notice instead of a form that would be refused
  if (await fromIran()) return <IranNotice />;
  const next = safeNext((await searchParams).next);
  if (await currentSession()) redirect(next);
  const t = messages.login;
  return (
    <PageShell title={t.title} logo>
      <Card>
        <p className="mb-5 text-sm leading-relaxed text-neutral-600">{t.intro}</p>
        <EmailForm next={next} turnstileSiteKey={turnstileSiteKey()} />
        <p className="mt-4 text-xs leading-relaxed text-neutral-600">
          {t.noticeBefore}
          <Link href="/terms" className="text-brand-800 underline">
            {t.noticeTerms}
          </Link>
          {t.noticeMiddle}
          <Link href="/privacy" className="text-brand-800 underline">
            {t.noticePrivacy}
          </Link>
          {t.noticeAfter}
        </p>
      </Card>
    </PageShell>
  );
}
