import type { StatusSnapshot } from './system';

// What needs a person on the admin page (wave 1, mockups admin-overview and admin-system): the
// system's problems first, in red, each with what to do. Pure, so the overview, the system page
// and the nav's red badge agree, and the rules are tested (tests/admin-wave1.test.ts).

export type Live = {
  /** Round trip in ms; null: no answer; undefined: not configured */
  database: number | null;
  valkey: number | null;
  meili: number | null | undefined;
};

export type ProblemKey = 'database' | 'valkey' | 'meili' | 'worker' | 'webhooks' | 'failed' | 'outbox' | 'backup';

export type Problem = { key: ProblemKey; count?: number; queues?: string[]; since?: string | null };

/** Unprocessed outbox events older than this mean the worker is stuck on them */
export const OUTBOX_LATE_MS = 15 * 60_000;
/** The backup runs nightly; a day and a bit more without one is a problem */
export const BACKUP_LATE_MS = 30 * 3_600_000;

export function systemProblems(live: Live, status: { snapshot: StatusSnapshot | null; backupAt: string | null }, ttlSeconds: number, now = new Date()): Problem[] {
  const out: Problem[] = [];
  if (live.database === null) out.push({ key: 'database' });
  if (live.valkey === null) out.push({ key: 'valkey' });
  if (live.meili === null) out.push({ key: 'meili' });
  const s = status.snapshot;
  const fresh = s && now.getTime() - new Date(s.at).getTime() < ttlSeconds * 1_000;
  if (!fresh) out.push({ key: 'worker', since: s?.at ?? null });
  if (s) {
    if (s.webhooks > 0) out.push({ key: 'webhooks', count: s.webhooks });
    const failed = Object.entries(s.queues).filter(([, c]) => c.failed > 0);
    if (failed.length) out.push({ key: 'failed', count: failed.reduce((n, [, c]) => n + c.failed, 0), queues: failed.map(([q]) => q) });
    if (s.outbox.oldest && now.getTime() - new Date(s.outbox.oldest).getTime() > OUTBOX_LATE_MS) out.push({ key: 'outbox', count: s.outbox.backlog, since: s.outbox.oldest });
  }
  if (status.backupAt && now.getTime() - new Date(status.backupAt).getTime() > BACKUP_LATE_MS) out.push({ key: 'backup', since: status.backupAt });
  return out;
}

/** Hours left until the 24-hour target for an item waiting since `since` (negative: late) */
export function hoursToDeadline(since: Date, now = new Date(), targetHours = 24): number {
  return Math.round(targetHours - (now.getTime() - since.getTime()) / 3_600_000);
}

/** Change against the previous period, as a whole percentage; null when there was nothing before */
export function change(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}
