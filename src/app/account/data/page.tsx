import Link from 'next/link';
import { Icon } from '../../../components/icons';
import { Alert, Button, Card, PageShell } from '../../../components/ui';
import { messages } from '../../../messages/fa';
import { requireSession } from '../../../modules/users/server';

export const metadata = { title: messages.account.data.title, robots: { index: false } };

// "My data": download everything we keep (GDPR) and the way to delete the account (approved
// Oct 21, 2026). The download is a plain form post to the export route, so it works without
// JavaScript and a link elsewhere can't start it.

export default async function DataPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireSession('/account/data');
  const { error } = await searchParams;
  const t = messages.account.data;
  return (
    <PageShell title={t.title}>
      <div className="space-y-6">
        {error === 'rate_limited' && <Alert tone="error">{t.exportLimited}</Alert>}
        <Card className="space-y-3">
          <h2 className="font-bold">{t.exportTitle}</h2>
          <p className="text-sm leading-relaxed text-neutral-600">{t.exportIntro}</p>
          <form action="/account/data/export" method="post">
            <Button type="submit" variant="secondary" className="w-full">
              <Icon name="download" className="size-4" />
              {t.exportButton}
            </Button>
          </form>
        </Card>
        <Card className="space-y-3">
          <h2 className="font-bold">{t.deleteTitle}</h2>
          <p className="text-sm leading-relaxed text-neutral-600">{t.deleteIntro}</p>
          <Link
            href="/account/delete"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 font-bold text-red-700 hover:bg-red-50"
          >
            <Icon name="trash" className="size-4" />
            {t.deleteLink}
          </Link>
        </Card>
      </div>
    </PageShell>
  );
}
