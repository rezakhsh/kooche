import { appDb } from '../../db/drizzle';
import { webEnv } from '../../lib/env';
import { admin } from '../../messages/fa';
import { cityMetrics, METRICS, overview, type CityMetrics } from '../../modules/admin/overview';
import { queueAge } from '../../modules/admin/queue';
import { adminHref, requireStaff } from '../../modules/admin/server';
import { Bar, formatValue, LineChart } from './charts';
import { AdminTitle, Ago, Chips, Panel } from './ui';

// The overview: totals, a chart per measure, and the launch metrics per city (docs/strategy.md).
// Computed at most every 5 minutes per process; every staff member sees the same numbers.

const CACHE_MS = 5 * 60_000;
const cache = new Map<string, { at: number; data: Promise<[Awaited<ReturnType<typeof overview>>, CityMetrics[]]> }>();

function data(days: 30 | 90) {
  const key = String(days);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const db = appDb();
  const fresh = Promise.all([overview(db, { days, timeZone: webEnv().APP_TIME_ZONE }), cityMetrics(db)]);
  cache.set(key, { at: Date.now(), data: fresh });
  fresh.catch(() => cache.delete(key));
  return fresh;
}

export default async function AdminHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff('overview.view');
  const days = (await searchParams).days === '90' ? 90 : 30;
  const [[{ totals, series }, cities], queue] = await Promise.all([data(days), queueAge(appDb())]);
  const t = admin.overview;
  const maxActive = Math.max(1, ...cities.map((c) => c.active));
  return (
    <>
      <AdminTitle title={t.title}>
        <Chips items={(['30', '90'] as const).map((d) => ({ href: adminHref(d === '30' ? '' : '?days=90'), label: t.periods[d]!, active: String(days) === d }))} />
      </AdminTitle>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <a href={adminHref('/queue')} className="rounded-2xl border border-neutral-200 p-4 hover:bg-neutral-50">
          <p className="text-sm text-neutral-600">{t.queue}</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">{queue.count.toLocaleString('fa-IR')}</p>
          <p className="mt-1 text-xs text-neutral-500">{queue.oldest ? <>{t.queueOldest('')}<Ago date={queue.oldest} /></> : t.queueEmpty}</p>
        </a>
        {METRICS.map((m) => (
          <div key={m} className="rounded-2xl border border-neutral-200 p-4">
            <p className="text-sm text-neutral-600">{t.metrics[m]}</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums">{formatValue(totals[m].week, m === 'revenue')}</p>
            <p className="mt-1 text-xs text-neutral-500">
              {t.week} · {t.today}: {formatValue(totals[m].today, m === 'revenue')} · {t.month}: {formatValue(totals[m].month, m === 'revenue')}
            </p>
            {Object.keys(totals[m].byCountry).length > 1 || !totals[m].byCountry['—'] ? (
              <p className="mt-1 text-xs text-neutral-500" title={t.byCountry}>
                {Object.entries(totals[m].byCountry).map(([c, v]) => `${c} ${formatValue(v, m === 'revenue')}`).join(' · ')}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {METRICS.map((m) => (
          <LineChart key={m} title={`${t.metrics[m]} · ${t.periods[String(days)]}`} points={series[m]} money={m === 'revenue'} />
        ))}
      </div>

      <Panel title={t.cities}>
        <p className="mb-3 text-xs text-neutral-600">{t.citiesIntro}</p>
        {cities.length === 0 ? (
          <p className="text-sm text-neutral-500">{t.noCities}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-xs text-neutral-500">
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
