import { createHash } from 'node:crypto';
import type { Queryable } from '../../db/drizzle';
import { auditLog } from '../../db/schema';
import { currentVersion, type LegalVersion } from './versions';

// Which terms each person accepted (legal pieces, Nov 6, 2026; docs/legal-review.md, "Process
// evidence" item 5). A new account accepts the terms shown on the sign-in page (terms 15.1); we
// keep the version, a fingerprint of its exact German and Persian text, and the time, as one row
// in audit_log (the IP and browser are cleared there after 90 days, the rest stays). Purchases
// record the version too (./checkout.ts, ./founding.ts). Nothing for the person to see or do
// (owner, Nov 6, 2026: "very simple").

export const TERMS_ACCEPTED = 'terms.accepted';

/** SHA-256 of the version's German and Persian text: proves which wording it was, even if edited in place */
export function termsFingerprint(v: LegalVersion): string {
  return createHash('sha256').update(JSON.stringify({ de: v.de, fa: v.fa })).digest('hex');
}

/** What a purchase records about the terms in force */
export function termsInForce(now: Date = new Date()): { terms: string; termsSha256: string } {
  const v = currentVersion('terms', now);
  return { terms: v.from, termsSha256: termsFingerprint(v) };
}

export async function recordTermsAcceptance(
  db: Queryable,
  a: { userId: string; way: 'signup'; ip?: string | null; userAgent?: string | null; now?: Date },
): Promise<void> {
  const t = termsInForce(a.now);
  await db.insert(auditLog).values({
    actorType: 'user',
    actorUserId: a.userId,
    action: TERMS_ACCEPTED,
    targetType: 'user',
    targetId: a.userId,
    ipAddress: a.ip ?? null,
    userAgent: a.userAgent?.slice(0, 500) ?? null,
    data: { version: t.terms, sha256: t.termsSha256, way: a.way },
  });
}
