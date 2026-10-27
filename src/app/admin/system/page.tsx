import { sql } from 'drizzle-orm';
import { Pill } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { valkey } from '../../../lib/valkey';
import { admin } from '../../../messages/fa';
import { readStatus, STATUS_TTL_SECONDS } from '../../../modules/admin/system';
import { requireStaff } from '../../../modules/admin/server';
import { AdminTitle, Ago, Facts, Panel } from '../ui';

// The system status (roadmap step 8): live checks from the web, and the worker's snapshot.

async function timed(check: () => Promise<unknown>): Promise<number | null> {
  const started = Date.now();
  try {
    await Promise.race([check(), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2_000))]);
    return Date.now() - started;
  } catch {
    return null;
  }
}

export default async function SystemPage() {
  await requireStaff('system.view');
  const env = webEnv();
  const [db, vk, meili, status] = await Promise.all([
    timed(() => appDb().execute(sql`SELECT 1`)),
    timed(() => valkey().ping()),
    env.MEILI_URL ? timed(async () => { const r = await fetch(`${env.MEILI_URL}/health`, { signal: AbortSignal.timeout(2_000) }); if (!r.ok) throw new Error(String(r.status)); }) : Promise.resolve(undefined),
    readStatus(valkey()),
  ]);
  const t = admin.system;
  const s = status.snapshot;
  const up = (ms: number | null | undefined) =>
    ms === undefined ? <span key="u" className="text-neutral-500">{t.unknown}</span> : ms === null ? <Pill key="d" tone="danger">{t.down}</Pill> : <Pill key="o" tone="success">{`${t.ok}، ${ms.toLocaleString('fa-IR')} ms`}</Pill>;
  const fresh = s && Date.now() - new Date(s.at).getTime() < STATUS_TTL_SECONDS * 1_000;
  return (
    <>
      <AdminTitle title={t.title} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <Facts
            rows={[
              [t.database, up(db)],
              [t.valkey, up(vk)],
              [t.meili, up(meili)],
              [t.worker, fresh ? <span key="w"><Pill tone="success">{t.ok}</Pill> <Ago date={new Date(s.at)} /></span> : <Pill key="w" tone="danger">{t.stale}</Pill>],
              [t.backup, status.backupAt ? <Ago key="b" date={new Date(status.backupAt)} /> : t.unknown],
              [t.sitemap, s?.sitemapAt ? <Ago key="s" date={new Date(s.sitemapAt)} /> : t.unknown],
              [t.outbox, s ? <span key="o">{s.outbox.backlog.toLocaleString('fa-IR')}{s.outbox.oldest ? <>، {t.oldestOutbox} <Ago date={new Date(s.outbox.oldest)} /></> : null}</span> : t.unknown],
              [t.webhooks, s ? s.webhooks.toLocaleString('fa-IR') : t.unknown],
              [t.meili, s?.meili ? (s.meili.documents !== null ? t.documents(s.meili.documents, s.activeListings) : <Pill key="m" tone="danger">{t.down}</Pill>) : t.unknown],
            ]}
          />
        </Panel>
        <Panel title={t.queues}>
          {s ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-sm">
                <thead className="text-xs text-neutral-500">
                  <tr>
                    <th className="py-1.5 text-start font-medium">{t.queue}</th>
                    {(['waiting', 'active', 'delayed', 'failed'] as const).map((k) => (
                      <th key={k} className="py-1.5 text-end font-medium">{t.counts[k]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {Object.entries(s.queues).map(([name, c]) => (
                    <tr key={name}>
                      <td className="py-1.5"><code dir="ltr">{name}</code></td>
                      <td className="py-1.5 text-end tabular-nums">{c.waiting.toLocaleString('fa-IR')}</td>
                      <td className="py-1.5 text-end tabular-nums">{c.active.toLocaleString('fa-IR')}</td>
                      <td className="py-1.5 text-end tabular-nums">{c.delayed.toLocaleString('fa-IR')}</td>
                      <td className={`py-1.5 text-end tabular-nums ${c.failed ? 'font-bold text-red-700' : ''}`}>{c.failed.toLocaleString('fa-IR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">{t.stale}</p>
          )}
        </Panel>
      </div>
    </>
  );
}
