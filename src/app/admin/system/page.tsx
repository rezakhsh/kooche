import Link from 'next/link';
import { Icon } from '../../../components/icons';
import { formatAgo } from '../../../lib/format';
import { webEnv } from '../../../lib/env';
import { admin } from '../../../messages/fa';
import { adminHref, requireStaff } from '../../../modules/admin/server';
import { AdminTitle, Ago } from '../ui';
import { problemText, systemState } from './checks';
import { SoftwareCard } from './software';

// The system status (roadmap step 8): live checks from the web, and the worker's snapshot.
// Wave 1 (mockup admin-system): problems first, in red, each with what to do; the healthy parts
// quiet, as green dots; the busy queues only, failed first and in red.

const fa = (n: number) => n.toLocaleString('fa-IR');

type Counts = { waiting: number; active: number; delayed: number; failed: number };

/** One queue: its name and only the counts that aren't zero */
function QueueRow({ name, counts }: { name: string; counts: Counts }) {
  const shown = (['failed', 'active', 'waiting', 'delayed'] as const).filter((k) => counts[k] > 0);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
      <bdi dir="ltr" className="font-mono text-[13px]">{name}</bdi>
      {shown.map((k) => (
        <span key={k} className={`text-xs tabular-nums ${k === 'failed' ? 'font-bold text-red-700' : 'text-neutral-700'}`}>
          {admin.system.queueCount(fa(counts[k]), admin.system.counts[k]!)}
        </span>
      ))}
    </li>
  );
}

export default async function SystemPage({ searchParams }: { searchParams: Promise<{ dismiss?: string }> }) {
  await requireStaff('system.view');
  const { live, status, problems, software } = await systemState();
  const { dismiss } = await searchParams;
  const tz = webEnv().APP_TIME_ZONE;
  const t = admin.system;
  const s = status.snapshot;
  const bad = new Set(problems.map((p) => p.key));
  const queues = Object.entries(s?.queues ?? {}).sort(([, a], [, b]) => b.failed - a.failed);
  const busy = queues.filter(([, c]) => c.failed > 0 || c.active > 0 || c.waiting > 0);
  const calm = queues.filter(([, c]) => !(c.failed > 0 || c.active > 0 || c.waiting > 0));
  const ms = (v: number | null | undefined) => (v === undefined ? t.unknown : v === null ? t.down : `${fa(v)} ms`);
  const ago = (iso: string | null | undefined) => (iso ? <Ago date={new Date(iso)} /> : t.unknown);
  const tiles: Array<[string, React.ReactNode, boolean]> = [
    [t.database, ms(live.database), bad.has('database')],
    [t.valkey, ms(live.valkey), bad.has('valkey')],
    [t.meili, live.meili === undefined ? t.unknown : <>{ms(live.meili)}{s?.meili?.documents != null && <>، {t.documents(s.meili.documents, s.activeListings)}</>}</>, bad.has('meili')],
    [t.worker, ago(s?.at), bad.has('worker')],
    [t.backupTile, ago(status.backupAt), bad.has('backup')],
    [t.sitemapTile, ago(s?.sitemapAt), false],
    [t.outboxTile, s ? (s.outbox.backlog ? `${fa(s.outbox.backlog)}، ${t.oldestOutbox} ${s.outbox.oldest ? formatAgo(new Date(s.outbox.oldest), tz) : ''}` : t.none) : t.unknown, bad.has('outbox')],
    [t.webhooksTile, s ? (s.webhooks ? fa(s.webhooks) : t.none) : t.unknown, bad.has('webhooks')],
  ];
  return (
    <>
      <AdminTitle title={t.title} intro={s ? `${t.updated} ${formatAgo(new Date(s.at), tz)}` : t.stale} />
      {problems.length > 0 ? (
        <section className="mb-4 rounded-2xl border-2 border-red-300 bg-red-50 p-4">
          <p className="flex items-center gap-2 font-extrabold text-red-800">
            <Icon name="alert" className="size-5" />
            {t.problemsTitle(problems.length)}
          </p>
          <ul className="mt-3 space-y-2">
            {problems.map((p) => {
              const x = problemText(p, tz);
              return (
                <li key={p.key} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3">
                  <div className="min-w-0 flex-1 basis-64">
                    <b className="block">{x.title}</b>
                    <span className="text-sm leading-7 text-neutral-700">{x.what}</span>
                  </div>
                  {x.action && (
                    <Link href={x.action.href} prefetch={false} className="flex h-10 shrink-0 items-center rounded-lg bg-danger px-3 text-sm font-bold text-snow hover:bg-danger-hover">
                      {x.action.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className="mb-4 flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 p-4 font-bold text-green-800">
          <Icon name="check" className="size-5" />
          {t.allOk}
        </p>
      )}

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {tiles.map(([k, v, red]) => (
          <div key={k} className={`flex items-center gap-2.5 rounded-xl border bg-white p-3 ${red ? 'border-red-300' : 'border-neutral-200'}`}>
            <span className={`size-2.5 shrink-0 rounded-full ${red ? 'bg-red-600' : 'bg-green-600'}`} />
            <div className="min-w-0">
              <b className="block text-sm" dir="auto">{k}</b>
              <span className={`text-xs ${red ? 'font-bold text-red-700' : 'text-neutral-600'}`}>{v}</span>
            </div>
          </div>
        ))}
      </section>

      <section id="queues" className="mt-4 scroll-mt-20 rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="font-extrabold">{t.queues}</h2>
        {/* Only queues with something failed, running or waiting; the calm ones folded away. Rows, not a
            table: on phones the table ran off the side (design check, Oct 31, 2026). Scheduled jobs
            (repeating ones) are normal and don't make a queue busy. */}
        {s ? (
          <>
            {busy.length > 0 ? (
              <ul className="mt-2 divide-y divide-neutral-100 text-sm">
                {busy.map(([name, c]) => <QueueRow key={name} name={name} counts={c} />)}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-green-800">{t.queuesAllCalm(calm.length)}</p>
            )}
            {busy.length > 0 && calm.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer py-2 text-sm text-neutral-600">{t.queuesCalm(calm.length)}</summary>
                <ul className="divide-y divide-neutral-100 text-sm">
                  {calm.map(([name, c]) => <QueueRow key={name} name={name} counts={c} />)}
                </ul>
              </details>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-neutral-600">{t.stale}</p>
        )}
      </section>

      <SoftwareCard report={software.report} dismissed={software.dismissed} errorKey={typeof dismiss === 'string' ? dismiss : null} now={new Date()} />
    </>
  );
}
