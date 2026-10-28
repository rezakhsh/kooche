import Link from 'next/link';
import { Icon, type IconName } from '../../components/icons';
import { appDb } from '../../db/drizzle';
import { formatAgo } from '../../lib/format';
import { webEnv } from '../../lib/env';
import { admin } from '../../messages/fa';
import { can } from '../../modules/admin/access';
import { change } from '../../modules/admin/attention';
import { cityMetrics, METRICS, overview, type CityMetrics } from '../../modules/admin/overview';
import { checkoutFunnel } from '../../modules/admin/payments';
import { queueAge } from '../../modules/admin/queue';
import { adminHref, requireStaff } from '../../modules/admin/server';
import { businessesAdmin } from '../../modules/admin/users';
import { Bar, formatValue, LineChart } from './charts';
import { problemText, systemState } from './system/checks';
import { AdminTitle, Panel, Progress } from './ui';

// The overview (wave 1, mockup admin-overview): what needs attention first (the queue, the
// system's problems, businesses waiting for verification), then the period's numbers with their
// change against the period before, then the biggest city against the next-city gates from
// docs/strategy.md, the charts and every city. Numbers are computed at most every 5 minutes per
// process; every staff member sees the same ones.

const CACHE_MS = 5 * 60_000;
const PERIODS = ['7', '30', '90'] as const;
const cache = new Map<string, { at: number; data: Promise<[Awaited<ReturnType<typeof overview>>, CityMetrics[]]> }>();

function data(days: number) {
  const key = String(days);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const db = appDb();
  const fresh = Promise.all([overview(db, { days, timeZone: webEnv().APP_TIME_ZONE }), cityMetrics(db)]);
  cache.set(key, { at: Date.now(), data: fresh });
  fresh.catch(() => cache.delete(key));
  return fresh;
}

/** The next-city gates (docs/strategy.md, "Gates") */
const GATES = { active: 100, chat: 50, posters: 30 };

/** The stat cards in the mockup's order; events after users */
const STATS = ['listings', 'users', 'events', 'chats', 'reports', 'revenue'] as const;

export default async function AdminHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireStaff('overview.view');
  const sp = await searchParams;
  const days = sp.days === '30' ? 30 : sp.days === '90' ? 90 : 7;
  const db = appDb();
  const tz = webEnv().APP_TIME_ZONE;
  const [[{ totals, series }, cities], queue, system, waiting, funnel] = await Promise.all([
    data(days),
    can(staff.role, 'queue.view') ? queueAge(db) : null,
    can(staff.role, 'system.view') ? systemState() : null,
    can(staff.role, 'businesses.view') ? businessesAdmin(db, { waiting: true, q: '' }) : [],
    can(staff.role, 'payments.view') ? checkoutFunnel(db, days) : null,
  ]);
  const t = admin.overview;
  const period = t.periods[String(days)]!;

  const attention: Array<{ icon: IconName; title: string; sub: string; href: string; red: boolean }> = [
    ...(queue?.count ? [{ icon: 'flag' as const, title: t.queueItems(queue.count), sub: queue.oldest ? t.oldest(formatAgo(queue.oldest, tz)) : '', href: adminHref('/queue'), red: false }] : []),
    ...(system?.problems ?? []).map((p) => ({ icon: 'alert' as const, title: problemText(p, tz).title, sub: t.systemLink, href: adminHref('/system'), red: true })),
    ...(waiting.length ? [{ icon: 'store' as const, title: t.businessesWaiting(waiting.length), sub: formatAgo(waiting[0]!.updatedAt, tz), href: adminHref('/businesses'), red: false }] : []),
  ];
  const top = cities[0];
  const chatPct = top?.cohort ? Math.round((top.withChat / top.cohort) * 100) : 0;
  const maxActive = Math.max(1, ...cities.map((c) => c.active));

  return (
    <>
      <AdminTitle title={t.title}>
        <nav aria-label={t.title} className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-neutral-200">
          {PERIODS.map((d) => (
            <Link
              key={d}
              href={adminHref(d === '7' ? '' : `?days=${d}`)}
              prefetch={false}
              aria-current={String(days) === d ? 'page' : undefined}
              className={`rounded-lg px-3 text-sm leading-9 ${String(days) === d ? 'bg-brand-700 font-bold text-white' : 'text-neutral-700 hover:bg-neutral-50'}`}
            >
              {t.periods[d]}
            </Link>
          ))}
        </nav>
      </AdminTitle>

      {attention.length > 0 ? (
        <section className="grid gap-2 lg:grid-cols-3">
          {attention.map((a) => (
            <Link key={a.title} href={a.href} prefetch={false} className={`flex items-center gap-3 rounded-2xl border p-3.5 ${a.red ? 'border-red-300 bg-red-50 hover:bg-red-100/60' : 'border-saffron-100 bg-saffron-50 hover:bg-saffron-100/60'}`}>
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-white ${a.red ? 'text-red-700' : 'text-saffron-800'}`}>
                <Icon name={a.icon} className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-sm">{a.title}</b>
                <span className="text-xs text-neutral-700">{a.sub}</span>
              </span>
              <Icon name="chevronEnd" className="size-4 shrink-0 text-neutral-500" />
            </Link>
          ))}
        </section>
      ) : (
        <p className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">
          <Icon name="check" className="size-5" />
          {t.allClear}
        </p>
      )}

      <section className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-6">
        {STATS.map((m) => {
          const v = totals[m];
          const d = change(v.period, v.previous);
          return (
            <div key={m} className="rounded-2xl border border-neutral-200 bg-white p-3.5">
              <p className="text-xs text-neutral-600">{t.stat(t.statNames[m]!, period)}</p>
              <p className="mt-1 text-2xl font-black tabular-nums">{formatValue(v.period, m === 'revenue')}</p>
              <p className={`text-xs font-bold ${d === null ? 'text-neutral-600' : d > 0 ? 'text-green-800' : 'text-neutral-600'}`}>
                {d === null ? (v.period > 0 ? t.changeNew : '—') : `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d).toLocaleString('fa-IR')}٪`}
              </p>
            </div>
          );
        })}
      </section>

      {top && (
        <section className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
          <h2 className="font-extrabold">{t.gatesTitle(top.cityFa)}</h2>
          <p className="text-xs text-neutral-600">{t.gatesIntro}</p>
          <ul className="mt-3 space-y-3">
            {[
              [t.gates.active, top.gateActive, GATES.active, ''],
              [t.gates.chat, chatPct, GATES.chat, '٪'],
              [t.gates.posters, top.weeklyPosters, GATES.posters, ''],
            ].map(([label, v, goal, unit]) => (
              <li key={label as string}>
                <p className="flex justify-between gap-3 text-sm">
                  <span>{label}</span>
                  <b className="shrink-0 tabular-nums">{t.of(`${(v as number).toLocaleString('fa-IR')}${unit}`, `${(goal as number).toLocaleString('fa-IR')}${unit}`)}</b>
                </p>
                <Progress value={v as number} goal={goal as number} className="mt-1" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="mt-8 mb-3 font-extrabold">{t.charts}</h2>
      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {METRICS.map((m) => (
          <LineChart key={m} title={`${t.metrics[m]}، ${period}`} points={series[m]} money={m === 'revenue'} />
        ))}
      </div>

      {funnel && (
        <Panel title={t.funnel(period)} className="mb-5">
          <p className="mb-3 text-xs text-neutral-600">{t.funnelIntro}</p>
          {funnel.length === 0 ? (
            <p className="text-sm text-neutral-600">{t.funnelEmpty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-sm">
                <thead className="text-xs text-neutral-600">
                  <tr>
                    <th className="py-2 text-start font-medium">{t.funnelProduct}</th>
                    <th className="py-2 text-start font-medium">{t.funnelOpened}</th>
                    <th className="py-2 text-start font-medium">{t.funnelPaid}</th>
                    <th className="py-2 text-start font-medium">{t.funnelRate}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {funnel.map((f) => (
                    <tr key={f.code}>
                      <td className="py-2 pe-3 font-medium">{f.code === 'pro-founding' ? t.funnelFounding : (f.name ?? f.code)}</td>
                      <td className="py-2 pe-3 tabular-nums">{f.opened.toLocaleString('fa-IR')}</td>
                      <td className="py-2 pe-3 tabular-nums">{f.paid.toLocaleString('fa-IR')}</td>
                      <td className="py-2 tabular-nums">{f.opened ? `${Math.round((f.paid / f.opened) * 100).toLocaleString('fa-IR')}٪` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      <Panel title={t.cities}>
        <p className="mb-3 text-xs text-neutral-600">{t.citiesIntro}</p>
        {cities.length === 0 ? (
          <p className="text-sm text-neutral-600">{t.noCities}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-xs text-neutral-600">
                <tr>
                  <th className="py-2 text-start font-medium">{t.city}</th>
                  <th className="py-2 text-start font-medium">{t.active}</th>
                  <th className="py-2 text-start font-medium">{t.gateActive}</th>
                  <th className="py-2 text-start font-medium">{t.posters}</th>
                  <th className="py-2 text-start font-medium">{t.withChat}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {cities.map((c) => {
                  const pct = c.cohort ? Math.round((c.withChat / c.cohort) * 100) : null;
                  return (
                    <tr key={`${c.country}-${c.city}`}>
                      <td className="py-2 pe-3 font-medium">{c.cityFa}</td>
                      <td className="w-40 py-2 pe-3"><Bar value={c.active} max={maxActive} /></td>
                      <td className="w-40 py-2 pe-3"><Bar value={c.gateActive} max={Math.max(100, maxActive)} ok={c.gateActive >= 100} /></td>
                      <td className="py-2 pe-3 tabular-nums">{c.weeklyPosters.toLocaleString('fa-IR')}{c.weeklyPosters >= 30 ? ' ✓' : ''}</td>
                      <td className="py-2 tabular-nums">{t.withChatValue(pct, c.cohort)}{pct !== null && pct >= 50 ? ' ✓' : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
