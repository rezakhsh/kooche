import Link from 'next/link';
import { Alert, Button } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { admin, messages } from '../../../messages/fa';
import { qrPath } from '../../../modules/admin/qr';
import { adminHref, requireStaff } from '../../../modules/admin/server';
import { visitReport, type FunnelRow, type Row } from '../../../modules/stats/visits';
import { LineChart } from '../charts';
import { AdminTitle, Panel } from '../ui';
import { archiveRefCodeAction, createRefCodeAction } from './actions';

// Admin › «آمار بازدید» (owner, Oct 30, 2026: our own counter and personal links instead of Google
// Analytics; no mockup, in the admin pages' style). Admins only.

const t = admin.stats;
const PERIODS = ['7', '30', '90'] as const;
const fa = (n: number) => n.toLocaleString('fa-IR');
const field = 'block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-600';

function countryName(code: string): string {
  if (code === 'XX') return '—';
  try {
    return new Intl.DisplayNames(['fa'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

function Table({ head, rows }: { head: string[]; rows: Array<Array<string | number>> }) {
  if (!rows.length) return <p className="text-sm text-neutral-600">{t.empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-neutral-600">
            {head.map((h, i) => (
              <th key={h} className={`pb-2 font-medium ${i ? 'text-end' : 'text-start'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-neutral-100">
              {r.map((c, j) => (
                <td key={j} className={`py-2 ${j ? 'text-end tabular-nums' : 'text-start'}`}>
                  {typeof c === 'number' ? fa(c) : <bdi>{c}</bdi>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function StatsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff('stats.view');
  const sp = await searchParams;
  const days = sp.days === '30' ? 30 : sp.days === '90' ? 90 : 7;
  const r = await visitReport(appDb(), days);
  const appUrl = webEnv().APP_URL.replace(/\/$/, '');
  const labels = new Map(r.refs.map((x) => [`ref:${x.code}`, x.label]));
  const sourceName = (s: string) => (s.startsWith('ref:') ? t.refLabel(labels.get(s) ?? s.slice(4)) : (t.sources[s] ?? s));
  const funnel = new Map<string, FunnelRow>(r.funnel.map((f) => [f.source, f]));
  // Every source with visitors, then the ones with sign-ups only (e.g. accounts from before the counting)
  const sourceRows = [...r.sources.map((s) => s.key), ...r.funnel.map((f) => f.source).filter((s) => !r.sources.some((x) => x.key === s))].map((key) => {
    const v: Row | undefined = r.sources.find((s) => s.key === key);
    const f = funnel.get(key);
    return [sourceName(key), v?.visitors ?? 0, v?.views ?? 0, f?.signups ?? 0, f?.verified ?? 0, f?.posted ?? 0, f?.messaged ?? 0];
  });
  const signups = r.funnel.reduce((n, f) => n + f.signups, 0);
  const cards: Array<[string, number, string?]> = [
    [t.cards.visitors, r.totals.visitors],
    [t.cards.views, r.totals.views],
    [t.cards.signups, signups],
    [t.cards.returning, r.returning, t.returningHint],
  ];

  return (
    <>
      <AdminTitle title={t.title} intro={t.intro}>
        <nav aria-label={t.title} className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-neutral-200">
          {PERIODS.map((d) => (
            <Link
              key={d}
              href={adminHref(`/stats?days=${d}`)}
              prefetch={false}
              aria-current={String(days) === d ? 'page' : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm ${String(days) === d ? 'bg-brand-700 font-bold text-white' : 'text-neutral-700 hover:bg-neutral-100'}`}
            >
              {t.periods[d]}
            </Link>
          ))}
        </nav>
      </AdminTitle>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {cards.map(([label, value, hint]) => (
          <div key={label} className="rounded-2xl border border-neutral-200 bg-white p-3.5">
            <p className="text-xs text-neutral-600">{label}</p>
            <p className="mt-1 text-2xl font-black tabular-nums">{fa(value)}</p>
            {hint && <p className="text-xs text-neutral-500">{hint}</p>}
          </div>
        ))}
      </section>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <LineChart title={t.visitorsChart} points={r.series.map((d) => ({ day: d.day, value: d.visitors }))} />
        <LineChart title={t.viewsChart} points={r.series.map((d) => ({ day: d.day, value: d.views }))} />
      </div>

      <Panel title={t.sourcesTitle} className="mt-4">
        <p className="mb-3 text-xs text-neutral-600">{t.sourcesIntro}</p>
        <Table head={[t.cols.source, t.cols.visitors, t.cols.visits, t.cols.signups, t.cols.verified, t.cols.posted, t.cols.messaged]} rows={sourceRows} />
      </Panel>

      <section id="links" className="mt-4 scroll-mt-20">
        <Panel title={t.refsTitle}>
          <p className="mb-3 text-sm leading-6 text-neutral-700">{t.refsIntro}</p>
          {sp.created && <div className="mb-3"><Alert tone="success">{t.refCreated}</Alert></div>}
          {sp.error && t.refErrors[sp.error] && <div className="mb-3"><Alert tone="error">{t.refErrors[sp.error]}</Alert></div>}
          <form action={createRefCodeAction} className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{t.refCode}</span>
              <input name="code" required pattern="[a-z0-9][a-z0-9\-]{1,30}[a-z0-9]" dir="ltr" placeholder={t.refCodeHint} className={field} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{t.refName}</span>
              <input name="label" required maxLength={80} placeholder={t.refNameHint} className={field} />
            </label>
            <Button type="submit">{t.refCreate}</Button>
          </form>
          {r.refs.length === 0 ? (
            <p className="text-sm text-neutral-600">{t.refsEmpty}</p>
          ) : (
            <ul className="space-y-3">
              {r.refs.map((ref) => {
                const link = `${appUrl}/?ref=${ref.code}`;
                const qr = qrPath(link);
                return (
                  <li key={ref.id} className={`rounded-xl border border-neutral-200 p-3 ${ref.archived ? 'opacity-60' : ''}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <b>
                        <bdi>{ref.label}</bdi>
                        {ref.archived && <span className="ms-2 text-xs font-normal text-neutral-500">{t.refArchived}</span>}
                      </b>
                      <span className="text-sm text-neutral-700 tabular-nums">
                        {t.cols.visitors}: {fa(ref.visitors)} · {t.cols.signups}: {fa(ref.signups)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">
                      {t.refLink}:{' '}
                      <bdi dir="ltr" className="font-mono text-xs select-all">
                        {link}
                      </bdi>
                    </p>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-bold text-brand-800">{t.refQr}</summary>
                      <svg viewBox={`0 0 ${qr.size} ${qr.size}`} className="mt-2 size-48 rounded-lg bg-white" role="img" aria-label={`${t.refQr}: ${link}`}>
                        <rect width={qr.size} height={qr.size} fill="#fff" />
                        <path d={qr.d} fill="#000" />
                      </svg>
                      <p className="mt-1 text-xs text-neutral-500">{t.refQrHint}</p>
                    </details>
                    {!ref.archived && (
                      <form action={archiveRefCodeAction} className="mt-2">
                        <input type="hidden" name="id" value={ref.id} />
                        <button className="text-xs text-neutral-500 underline hover:text-neutral-700">{t.refArchive}</button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </section>

      <div className="mt-4 mb-6 grid gap-4 md:grid-cols-2">
        <Panel title={t.countriesTitle}>
          <Table head={['', t.cols.visitors, t.cols.views]} rows={r.countries.map((c) => [countryName(c.key), c.visitors, c.views])} />
        </Panel>
        <Panel title={t.pagesTitle}>
          <Table head={[t.cols.key, t.cols.views]} rows={r.pages.map((p) => [t.pages[p.key] ?? p.key, p.views])} />
        </Panel>
        <Panel title={t.devicesTitle}>
          <Table head={['', t.cols.visitors, t.cols.views]} rows={r.devices.map((d) => [t.devices[d.key] ?? d.key, d.visitors, d.views])} />
        </Panel>
        <Panel title={t.answersTitle}>
          {r.answers.length === 0 ? (
            <p className="text-sm text-neutral-600">{t.answersEmpty}</p>
          ) : (
            <Table head={['', t.cols.signups]} rows={r.answers.map((a) => [messages.account.signupQuestion.answers[a.answer] ?? a.answer, a.n])} />
          )}
        </Panel>
      </div>
    </>
  );
}
