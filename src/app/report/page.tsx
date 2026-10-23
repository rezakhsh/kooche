import { notFound } from 'next/navigation';
import { PageShell } from '../../components/ui';
import { appDb } from '../../db/drizzle';
import { messages } from '../../messages/fa';
import { PUBLIC_REASONS, type ReportTargetKind } from '../../modules/moderation/reasons';
import { reportTargetSummary } from '../../modules/moderation/public-reports';
import { turnstileSiteKey } from '../../modules/security/server';
import { currentSession } from '../../modules/users/server';
import { ReportForm } from './report-form';

// The report page behind every report button (DSA art. 16): /report?t=listing|user|business&id=…
// A page, not a dialog, so it works without JavaScript; never cached at the edge ('report' is in
// the proxy's NOT_BROWSE).

export const metadata = { title: messages.report.title, robots: { index: false } };

export default async function ReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const kind = typeof sp.t === 'string' && sp.t in PUBLIC_REASONS ? (sp.t as ReportTargetKind) : null;
  const ref = typeof sp.id === 'string' ? sp.id : null;
  if (!kind || !ref) notFound();
  const target = await reportTargetSummary(appDb(), kind, ref);
  if (!target) notFound();
  const session = await currentSession();
  const t = messages.report;
  const headingKey = target.isEvent ? 'event' : kind;
  return (
    <PageShell title={t.heading[headingKey]}>
      <p className="mb-2 rounded-xl bg-neutral-50 px-4 py-3 text-sm font-medium">
        <bdi dir="auto">{target.label}</bdi>
      </p>
      <p className="mb-6 text-sm text-neutral-700">{t.intro}</p>
      <ReportForm
        kind={kind}
        refId={ref}
        back={target.back}
        reasons={[...PUBLIC_REASONS[kind]]}
        signedIn={!!session}
        turnstileSiteKey={session ? null : turnstileSiteKey()}
      />
    </PageShell>
  );
}
