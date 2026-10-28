import Link from 'next/link';
import { Icon } from '../../../components/icons';
import { formatAgo } from '../../../lib/format';
import { webEnv } from '../../../lib/env';
import { admin } from '../../../messages/fa';
import { adminHref, requireStaff } from '../../../modules/admin/server';
import { AdminTitle, Ago } from '../ui';
import { problemText, systemState } from './checks';

// The system status (roadmap step 8): live checks from the web, and the worker's snapshot.
// Wave 1 (mockup admin-system): problems first, in red, each with what to do; the healthy parts
// quiet, as green dots; every queue column visible, failed first and in red.

const fa = (n: number) => n.toLocaleString('fa-IR');

export default async function SystemPage() {
  await requireStaff('system.view');
  const { live, status, problems } = await systemState();
  const tz = webEnv().APP_TIME_ZONE;
  const t = admin.system;
  const s = status.snapshot;
  const bad = new Set(problems.map((p) => p.key));
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
        {s ? (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="text-xs text-neutral-600">
                  <th className="py-2 text-start font-bold">{t.queue}</th>
                  {(['failed', 'active', 'waiting', 'delayed'] as const).map((k) => (
                    <th key={k} className="text-start font-bold">{t.counts[k]}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {Object.entries(s.queues).map(([name, c]) => (
                  <tr key={name}>
                    <td className="py-2">
                      <bdi dir="ltr" className="font-mono text-[13px]">{name}</bdi>
                    </td>
                    <td className={`tabular-nums ${c.failed ? 'font-bold text-red-700' : 'text-neutral-500'}`}>{fa(c.failed)}</td>
                    <td className="tabular-nums">{fa(c.active)}</td>
                    <td className="tabular-nums">{fa(c.waiting)}</td>
                    <td className="tabular-nums text-neutral-600">{fa(c.delayed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-neutral-600">{t.stale}</p>
        )}
      </section>
    </>
  );
}
