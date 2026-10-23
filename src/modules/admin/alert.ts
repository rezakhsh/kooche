import { createHmac } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { admin } from '../../messages/fa';
import { adminAddress } from './gate';

// The owner's Telegram alert for new reports and appeals (roadmap step 8): the worker sends one
// summary at most every ten minutes to the n8n workflow "Peydoo – admin alerts", which checks the
// signature and posts it to Telegram. No names, emails or text from the reports, only counts and
// a link to the queue. Signed like Stripe's webhooks: `t=<unix seconds>,v1=<hex HMAC-SHA256 of
// "<t>.<body>">` in `x-peydoo-signature`; n8n refuses a wrong signature or one older than 5 minutes.

export const SIGNATURE_HEADER = 'x-peydoo-signature';

export function signature(secret: string, body: string, timestamp: number): string {
  return `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
}

export type QueueSummary = { newReports: number; newAppeals: number; illegal: number; open: number; oldestMinutes: number | null };

/** New reports and appeals since `since`, and the queue as it stands */
export async function queueSummary(db: Queryable, since: Date): Promise<QueueSummary> {
  const [r] = await db.execute<{ new_reports: number; new_appeals: number; illegal: number; open_reports: number; open_appeals: number; oldest: string | Date | null }>(sql`
    SELECT
      (SELECT count(*)::int FROM reports WHERE created_at > ${since.toISOString()}::timestamptz) AS new_reports,
      (SELECT count(*)::int FROM moderation_appeals WHERE created_at > ${since.toISOString()}::timestamptz) AS new_appeals,
      (SELECT count(*)::int FROM reports WHERE created_at > ${since.toISOString()}::timestamptz AND is_illegal_content_notice) AS illegal,
      (SELECT count(*)::int FROM reports WHERE status IN ('open', 'in_review')) AS open_reports,
      (SELECT count(*)::int FROM moderation_appeals WHERE status = 'open') AS open_appeals,
      least((SELECT min(created_at) FROM reports WHERE status IN ('open', 'in_review')),
            (SELECT min(created_at) FROM moderation_appeals WHERE status = 'open')) AS oldest
  `);
  return {
    newReports: r!.new_reports,
    newAppeals: r!.new_appeals,
    illegal: r!.illegal,
    open: r!.open_reports + r!.open_appeals,
    oldestMinutes: r!.oldest ? Math.max(0, Math.round((Date.now() - new Date(r!.oldest).getTime()) / 60_000)) : null,
  };
}

export function alertPayload(s: QueueSummary, appUrl: string, adminPath: string | undefined) {
  const url = adminPath ? `${appUrl}${adminAddress(adminPath, '/queue')}` : null;
  return { kind: 'admin_queue', text: admin.alert(s), url, ...s };
}

export async function sendAlert(url: string, secret: string, payload: object, fetchFn: typeof fetch = fetch, now = Date.now()): Promise<void> {
  const body = JSON.stringify(payload);
  const res = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [SIGNATURE_HEADER]: signature(secret, body, Math.floor(now / 1000)) },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`n8n alert: ${res.status}`);
}
