import Link from 'next/link';
import { Alert, PageShell, Pill } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { formatDateTime } from '../../../lib/format';
import { faDigits, messages } from '../../../messages/fa';
import { sectionAnchor } from '../../../messages/legal-types';
import { appealable, decisionsAbout, type Notice } from '../../../modules/moderation/appeals';
import { groundSection } from '../../../modules/moderation/terms';
import { requireSession } from '../../../modules/users/server';
import { AppealForm } from './appeal-form';

// Every decision Peydoo took about the account, its listings, messages or businesses, with the
// statement of reasons and the appeal (terms 7.3 and 7.4). Linked from every notice we send.

export const metadata = { title: messages.notices.title, robots: { index: false } };

const RESTRICTING = new Set(['reject', 'remove', 'hide', 'warn', 'sanction']);

function about(n: Notice): string {
  const a = messages.notices.about;
  return n.kind === 'listing' ? a.listing(n.title ?? '') : n.kind === 'business' ? a.business(n.title ?? '') : n.kind === 'message' ? a.message : a.user;
}

export default async function NoticesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { user } = await requireSession('/account/notices');
  const sp = await searchParams;
  const rows = await decisionsAbout(appDb(), user.id);
  const tz = webEnv().APP_TIME_ZONE;
  const t = messages.notices;
  return (
    <PageShell title={t.title} wide>
      <p className="mb-6 text-sm text-neutral-700">{t.intro}</p>
      {sp.sent && <div className="mb-4"><Alert tone="success">{t.appealSent}</Alert></div>}
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-neutral-600">{t.empty}</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((n) => {
            const section = groundSection(n.policyGround);
            return (
              <li key={n.id} id={`d-${n.id}`} className="rounded-2xl border border-neutral-200 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                  <Pill tone={RESTRICTING.has(n.decision) ? 'danger' : 'success'}>{about(n)}</Pill>
                  {n.listingCode !== null && <span className="text-xs text-neutral-500">{messages.listingCode}: {faDigits(String(n.listingCode))}</span>}
                  <span className="text-xs text-neutral-500">{formatDateTime(n.createdAt, tz)}</span>
                  <span className="text-xs text-neutral-500">{t.by[n.decidedBy]}</span>
                </div>
                {n.answers && <p className="mb-1 text-xs font-bold text-neutral-600">{t.answer}</p>}
                <p className="text-sm leading-relaxed">{n.statement}</p>
                {section && (
                  <Link href={`/terms#${sectionAnchor(section)}`} className="mt-1 inline-block text-xs font-semibold text-brand-800 underline">
                    {messages.moderation.termsSection(section)}
                  </Link>
                )}
                {n.appeal?.status === 'open' && <p className="mt-2 text-xs text-neutral-600">{t.appealOpen}</p>}
                {n.appeal?.status === 'decided' && <p className="mt-2 text-xs text-neutral-600">{t.appealDecided}</p>}
                {appealable(n) && <AppealForm decisionId={n.id} />}
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
