import { Queue } from 'bullmq';
import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import type { Queryable } from '../../db/drizzle';
import { LISTINGS_INDEX } from '../search/documents';
import type { Meili } from '../search/meili';
import { stuckErasures } from '../users/erasure';

// The system status on the admin page (roadmap step 8). The worker writes a snapshot to Valkey
// every minute (queue depths, the outbox, webhooks, Meilisearch, the sitemaps); it expires after
// 5 minutes, so a missing snapshot means the worker is down. The web adds its own live checks.
// The nightly backup script on the host writes BACKUP_KEY after a successful run
// (/usr/local/bin/classifieds-backup, docs/setup.md, "Admin page").

export const STATUS_KEY = 'admin:status';
export const STATUS_TTL_SECONDS = 300;
export const BACKUP_KEY = 'peydoo:backup:last-ok';

export const QUEUES = ['listing-checks', 'media', 'listings', 'events', 'chat', 'chat-notify', 'telegram-send', 'email-send', 'accounts', 'search-sync', 'search-alerts', 'payments', 'seo', 'retention', 'moderation'] as const;

export type StatusSnapshot = {
  at: string;
  queues: Record<string, { waiting: number; active: number; delayed: number; failed: number }>;
  outbox: { backlog: number; oldest: string | null };
  webhooks: number;
  activeListings: number;
  meili: { ok: boolean; documents: number | null } | null;
  sitemapAt: string | null;
  /** Account deletions asked for over a day ago and still not done (code check, Oct 30, 2026) */
  stuckErasures?: number;
};

export async function collectStatus(db: Queryable, connection: Redis, meili: Meili | null, prefix?: string): Promise<StatusSnapshot> {
  const queues: StatusSnapshot['queues'] = {};
  for (const name of QUEUES) {
    const q = new Queue(name, { connection, ...(prefix ? { prefix } : {}) });
    const c = await q.getJobCounts('waiting', 'active', 'delayed', 'failed');
    queues[name] = { waiting: c.waiting ?? 0, active: c.active ?? 0, delayed: c.delayed ?? 0, failed: c.failed ?? 0 };
    await q.close();
  }
  const [r] = await db.execute<{ backlog: number; oldest: string | Date | null; webhooks: number; active: number; sitemap: string | Date | null }>(sql`
    SELECT
      (SELECT count(*)::int FROM outbox_events WHERE processed_at IS NULL) AS backlog,
      (SELECT min(created_at) FROM outbox_events WHERE processed_at IS NULL) AS oldest,
      (SELECT count(*)::int FROM webhook_events WHERE processed_at IS NULL) AS webhooks,
      (SELECT count(*)::int FROM listings WHERE status = 'active') AS active,
      (SELECT max(generated_at) FROM sitemap_files) AS sitemap`);
  let meiliState: StatusSnapshot['meili'] = null;
  if (meili) {
    try {
      const stats = await meili.indexStats(LISTINGS_INDEX);
      meiliState = { ok: true, documents: stats?.numberOfDocuments ?? null };
    } catch {
      meiliState = { ok: false, documents: null };
    }
  }
  const iso = (d: string | Date | null) => (d ? new Date(d).toISOString() : null);
  return {
    at: new Date().toISOString(),
    queues,
    outbox: { backlog: r!.backlog, oldest: iso(r!.oldest) },
    webhooks: r!.webhooks,
    activeListings: r!.active,
    meili: meiliState,
    sitemapAt: iso(r!.sitemap),
    stuckErasures: await stuckErasures(db),
  };
}

export async function writeStatus(redis: Redis, s: StatusSnapshot): Promise<void> {
  await redis.set(STATUS_KEY, JSON.stringify(s), 'EX', STATUS_TTL_SECONDS);
}

export async function readStatus(redis: Redis): Promise<{ snapshot: StatusSnapshot | null; backupAt: string | null }> {
  const [snap, backup] = await Promise.all([redis.get(STATUS_KEY), redis.get(BACKUP_KEY)]);
  return { snapshot: snap ? (JSON.parse(snap) as StatusSnapshot) : null, backupAt: backup };
}
