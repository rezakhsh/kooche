import Link from 'next/link';
import { Alert, PageShell } from '../../../components/ui';
import { messages } from '../../../messages/fa';
import { safeNext } from '../../../modules/users/server';

export const metadata = { title: messages.report.sent.title, robots: { index: false } };

export default async function ReportSent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const t = messages.report.sent;
  return (
    <PageShell title={t.title}>
      <Alert tone="success">{sp.already === '1' ? t.already : t.body}</Alert>
      <Link href={safeNext(sp.back)} className="mt-6 inline-block text-sm font-medium text-brand-800 hover:underline">
        {t.back}
      </Link>
    </PageShell>
  );
}
