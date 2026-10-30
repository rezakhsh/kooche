import type { Redis } from 'ioredis';
import type { Db } from '../../db/drizzle';
import { auditLog } from '../../db/schema';
import { hit } from '../../lib/rate-limit';
import { blockState } from '../users/blocks';
import { canSendMessage, loadActor, type Denied } from '../users/permissions';
import { mixesTestAndReal } from '../users/test-accounts';
import { LISTING_LIMITS } from './limits';
import { listingPhone } from './queries';

// "Show number" (approved Oct 18, 2026): sellers choose per listing (chat only by default). Only
// signed-in visitors with a verified phone may see a number, rate-limited per visitor and per IP,
// hourly and daily, and every reveal is logged in audit_log (listing.phone_revealed: who, which
// listing, IP and browser; the IP is scrubbed after 90 days, the row deleted after 2 years). The
// number is never in the page.

export type RevealResult =
  | { ok: true; phone: string }
  | { ok: false; reason: Denied | 'rate_limited' | 'hidden'; retryAfterSeconds?: number };

export async function revealPhone(
  db: Db,
  redis: Redis,
  opts: { userId: string; token: string; ip: string | null; userAgent: string | null },
): Promise<RevealResult> {
  // Same rule as writing to the seller: a verified phone
  const allowed = canSendMessage(await loadActor(db, opts.userId));
  if (!allowed.ok) return allowed;
  if (!/^[0-9a-hjkmnp-tv-z]{10}$/.test(opts.token)) return { ok: false, reason: 'hidden' };

  const limited = await hit(redis, [
    [LISTING_LIMITS.phoneRevealPerUserHour, opts.userId],
    [LISTING_LIMITS.phoneRevealPerUserDay, opts.userId],
    ...(opts.ip
      ? ([
          [LISTING_LIMITS.phoneRevealPerIpHour, opts.ip],
          [LISTING_LIMITS.phoneRevealPerIpDay, opts.ip],
        ] as const)
      : []),
  ]);
  if (!limited.ok) return { ok: false, reason: 'rate_limited', retryAfterSeconds: limited.retryAfterSeconds };

  const found = await listingPhone(db, opts.token);
  if (!found) return { ok: false, reason: 'hidden' };
  // As in chat: test accounts and real people never meet, and a seller who blocked this person
  // doesn't show them the number (code check, Oct 30, 2026)
  if (await mixesTestAndReal(db, opts.userId, found.sellerId)) return { ok: false, reason: 'hidden' };
  if ((await blockState(db, opts.userId, found.sellerId)).blockedMe) return { ok: false, reason: 'hidden' };
  await db.insert(auditLog).values({
    actorType: 'user',
    actorUserId: opts.userId,
    action: 'listing.phone_revealed',
    targetType: 'listing',
    targetId: found.listingId,
    ipAddress: opts.ip,
    userAgent: opts.userAgent?.slice(0, 500) ?? null,
  });
  return { ok: true, phone: found.phone };
}
