import { inArray } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { auditLog, moderationDecisions, outboxEvents, reports, webhookEvents } from '../src/db/schema';
import { purgeEventData, purgeHistory } from '../src/db/retention';
import { workerSql } from './accounts';
import { client, db, makeListing, makeUser, publicToken } from './db';

// Event and history retention (docs/schema.md, section 14), run as classifieds_worker, so the
// test also proves the worker's grants are enough. Rows are committed (the purge runs on another
// connection) and every assertion looks only at this file's own rows.

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const yearsAgo = (n: number) => new Date(Date.now() - n * 365.25 * DAY);

async function makeOutboxEvents(processedAt: (Date | null)[]) {
  const rows = await db
    .insert(outboxEvents)
    .values(
      processedAt.map((p) => ({
        eventType: 'test.retention',
        aggregateType: 'test',
        aggregateId: '00000000-0000-7000-8000-000000000000',
        processedAt: p,
        // Never due, so tests/outbox.test.ts doesn't pick up the unprocessed ones
        availableAt: daysAgo(-365),
      })),
    )
    .returning({ id: outboxEvents.id });
  return rows.map((r) => r.id);
}

async function makeAuditRows(createdAt: Date[], ipAddress: string | null = null) {
  const rows = await db
    .insert(auditLog)
    .values(createdAt.map((c) => ({ actorType: 'system' as const, action: 'test.retention', ipAddress, createdAt: c })))
    .returning({ id: auditLog.id });
  return rows.map((r) => r.id);
}

async function remaining(table: 'outbox_events' | 'webhook_events' | 'audit_log', ids: string[]) {
  const rows = await client<{ id: string }[]>`SELECT id FROM ${client(table)} WHERE id IN ${client(ids)}`;
  return new Set(rows.map((r) => r.id));
}

describe('purgeEventData', () => {
  it('deletes outbox events 7 days after processing and keeps newer and unprocessed ones', async () => {
    const [old, recent, unprocessed] = await makeOutboxEvents([daysAgo(8), daysAgo(6), null]);

    const result = await purgeEventData(workerSql);

    expect(result.outboxEvents).toBeGreaterThanOrEqual(1);
    expect(await remaining('outbox_events', [old!, recent!, unprocessed!])).toEqual(new Set([recent, unprocessed]));
  });

  it('deletes processed webhook events older than 90 days and keeps newer and unprocessed ones', async () => {
    const event = (createdAt: Date, processedAt: Date | null) => ({
      provider: 'test',
      providerEventId: `evt_${publicToken()}`,
      type: 'test.retention',
      payload: {},
      createdAt,
      processedAt,
    });
    const rows = await db
      .insert(webhookEvents)
      .values([
        event(daysAgo(91), daysAgo(91)),
        event(daysAgo(89), daysAgo(89)),
        event(daysAgo(120), null),
      ])
      .returning({ id: webhookEvents.id });
    const [old, recent, unprocessed] = rows.map((r) => r.id);

    const result = await purgeEventData(workerSql);

    expect(result.webhookEvents).toBeGreaterThanOrEqual(1);
    expect(await remaining('webhook_events', [old!, recent!, unprocessed!])).toEqual(new Set([recent, unprocessed]));
  });

  it('works in batches and stops after maxBatches', async () => {
    const ids = await makeOutboxEvents(Array.from({ length: 7 }, () => daysAgo(10)));

    expect((await purgeEventData(workerSql, { batchSize: 3, maxBatches: 1 })).outboxEvents).toBe(3);
    expect((await remaining('outbox_events', ids)).size).toBe(4);

    expect((await purgeEventData(workerSql, { batchSize: 3 })).outboxEvents).toBe(4);
    expect((await remaining('outbox_events', ids)).size).toBe(0);
  });
});

describe('purgeHistory', () => {
  it('deletes audit rows older than 2 years and scrubs IP addresses older than 90 days', async () => {
    const [old, halfYear, recent] = await makeAuditRows([yearsAgo(3), daysAgo(180), new Date()], '192.0.2.1');

    const result = await purgeHistory(workerSql);

    expect(result.auditRows).toBeGreaterThanOrEqual(1);
    expect(result.auditIpsScrubbed).toBeGreaterThanOrEqual(1);
    const left = await db
      .select({ id: auditLog.id, ip: auditLog.ipAddress })
      .from(auditLog)
      .where(inArray(auditLog.id, [old!, halfYear!, recent!]));
    expect(new Map(left.map((r) => [r.id, r.ip]))).toEqual(
      new Map([
        [halfYear, null],
        [recent, '192.0.2.1'],
      ]),
    );
  });

  it('deletes closed reports and unreferenced decisions older than 2 years and keeps newer ones', async () => {
    const { oldReport, oldDecision, recentDecision } = await db.transaction(async (tx) => {
      const user = await makeUser(tx);
      const listing = await makeListing(tx, user.id);
      const decision = (createdAt: Date) => ({
        listingId: listing.id,
        listingRevision: 1,
        decision: 'approve' as const,
        decidedBy: 'rule' as const,
        createdAt,
      });
      const [oldDecision, recentDecision] = await tx
        .insert(moderationDecisions)
        .values([decision(yearsAgo(3)), decision(new Date())])
        .returning({ id: moderationDecisions.id });
      const [oldReport] = await tx
        .insert(reports)
        .values({
          reporterUserId: user.id,
          listingId: listing.id,
          reasonCode: 'spam',
          status: 'resolved',
          moderationDecisionId: oldDecision!.id,
          resolvedAt: yearsAgo(3),
        })
        .returning({ id: reports.id });
      return { oldReport: oldReport!.id, oldDecision: oldDecision!.id, recentDecision: recentDecision!.id };
    });

    const result = await purgeHistory(workerSql);

    expect(result.reports).toBeGreaterThanOrEqual(1);
    expect(result.moderationDecisions).toBeGreaterThanOrEqual(1);
    expect(await db.select().from(reports).where(inArray(reports.id, [oldReport]))).toEqual([]);
    const left = await db
      .select({ id: moderationDecisions.id })
      .from(moderationDecisions)
      .where(inArray(moderationDecisions.id, [oldDecision, recentDecision]));
    expect(left.map((r) => r.id)).toEqual([recentDecision]);
  });

  it('calls the functions until they come back short, at most maxBatches times', async () => {
    const ids = await makeAuditRows(Array.from({ length: 5 }, () => yearsAgo(3)));

    expect((await purgeHistory(workerSql, { batchSize: 2, maxBatches: 1 })).auditRows).toBe(2);
    expect((await remaining('audit_log', ids)).size).toBe(3);

    expect((await purgeHistory(workerSql, { batchSize: 2 })).auditRows).toBe(3);
    expect((await remaining('audit_log', ids)).size).toBe(0);
  });
});
