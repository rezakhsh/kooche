import { sql } from 'drizzle-orm';
import { cache } from 'react';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { valkey } from '../../../lib/valkey';
import { systemProblems, type Live, type Problem, type ProblemKey } from '../../../modules/admin/attention';
import { formatAgo } from '../../../lib/format';
import { admin } from '../../../messages/fa';
import { adminHref } from '../../../modules/admin/server';
import { readStatus, STATUS_TTL_SECONDS } from '../../../modules/admin/system';

// The web's own live checks and the worker's snapshot, once per request: the system page, the
// overview's "needs attention" and the nav's red badge all read them.

async function timed(check: () => Promise<unknown>): Promise<number | null> {
  const started = Date.now();
  try {
    await Promise.race([check(), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2_000))]);
    return Date.now() - started;
  } catch {
    return null;
  }
}

export const systemState = cache(async () => {
  const env = webEnv();
  const [database, vk, meili, status] = await Promise.all([
    timed(() => appDb().execute(sql`SELECT 1`)),
    timed(() => valkey().ping()),
    env.MEILI_URL
      ? timed(async () => {
          const r = await fetch(`${env.MEILI_URL}/health`, { signal: AbortSignal.timeout(2_000) });
          if (!r.ok) throw new Error(String(r.status));
        })
      : Promise.resolve(undefined),
    readStatus(valkey()).catch(() => ({ snapshot: null, backupAt: null })),
  ]);
  const live: Live = { database, valkey: vk, meili };
  return { live, status, problems: systemProblems(live, status, STATUS_TTL_SECONDS) };
});

/** A problem's title, what to do, and where to look */
export function problemText(p: Problem, timeZone: string): { title: string; what: string; action?: { label: string; href: string } } {
  const t = admin.system.problems;
  const ago = (iso: string | null | undefined) => (iso ? formatAgo(new Date(iso), timeZone) : admin.system.unknown);
  switch (p.key) {
    case 'webhooks':
      return { title: t.webhooks.title(p.count ?? 0), what: t.webhooks.what, action: { label: t.webhooks.action, href: adminHref('/payments') } };
    case 'failed':
      return { title: t.failed.title(p.count ?? 0), what: t.failed.what((p.queues ?? []).join('، ')), action: { label: t.failed.action, href: `${adminHref('/system')}#queues` } };
    case 'outbox':
      return { title: t.outbox.title(p.count ?? 0), what: t.outbox.what(ago(p.since)) };
    case 'backup':
      return { title: t.backup.title, what: t.backup.what(ago(p.since)) };
    case 'erasure':
      return { title: t.erasure.title(p.count ?? 0), what: t.erasure.what };
    default:
      return t[p.key as Exclude<ProblemKey, 'webhooks' | 'failed' | 'outbox' | 'backup' | 'erasure'>];
  }
}
