import { and, eq, gt, sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { randomInt } from 'node:crypto';
import type { Queryable } from '../../db/drizzle';
import { phoneVerifications, users } from '../../db/schema';
import { normalizePersian } from '../../lib/normalize-persian';
import { hit } from '../../lib/rate-limit';
import { sha256 } from '../../lib/tokens';
import { ltr, messages } from '../../messages/fa';
import type { IncomingMessage } from '../notifications/whatsapp-api';
import { completeVerification, failVerification, maskEmail, type FailureReason } from './phone';
import { checkVerifiedNumber } from './phone-number';

// Phone verification with WhatsApp (Nov 3, 2026; mockup after-wave2/whatsapp-verify). The site
// shows a wa.me link (and a QR code on computers) with a ready message holding a one-time code; the
// user only presses Send. WhatsApp itself tells us the sender's number, so nobody types it. The
// number then goes through the same checks as Telegram's (checkVerifiedNumber: no +98, no
// anonymous numbers; completeVerification: not on another account, not banned) and we answer in
// WhatsApp, free inside the 24-hour window the user's message opens. Only the code's hash is
// stored, in phone_verifications.link_token_hash like the bot's token.

export const WHATSAPP_CODE_TTL_MS = 15 * 60_000;
/** No 0/O, 1/I/L: the code is read and sometimes typed */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_IN_TEXT = /(?<![A-Z0-9])([A-HJKMNP-Z2-9]{4})-?([A-HJKMNP-Z2-9]{4})(?![A-Z0-9])/;
const UNIQUE_VIOLATION = '23505';
/** Replies to one number per hour: more would only feed a flood and hurt the number's rating */
const SENDER_LIMIT = { name: 'whatsapp:sender:1h', max: 10, windowSeconds: 3_600 };
/** Meta may deliver a message twice; each is handled once */
const SEEN_SECONDS = 86_400;

/** «7KQ4-M2XW»: 8 characters of 31, about 40 bits, for 15 minutes and one use */
export function whatsAppCode(): string {
  const c = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

function codeHash(code: string): Buffer {
  return sha256(`whatsapp:${code.replace('-', '')}`);
}

/** The code in a message, even with Persian digits, lower case or without the dash */
export function codeInText(text: string): string | null {
  const m = normalizePersian(text).toUpperCase().match(CODE_IN_TEXT);
  return m ? `${m[1]}-${m[2]}` : null;
}

/** The ready message in the wa.me link */
export function whatsAppLink(businessNumber: string, code: string): string {
  return `https://wa.me/${businessNumber}?text=${encodeURIComponent(messages.phone.whatsapp.prefill(code))}`;
}

/** Starts a WhatsApp verification: the code goes into the link, only its hash is stored */
export async function startWhatsAppVerification(
  db: Queryable,
  { userId, ip }: { userId: string; ip: string | null },
): Promise<{ verificationId: string; code: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + WHATSAPP_CODE_TTL_MS);
  for (let tries = 0; ; tries++) {
    const code = whatsAppCode();
    try {
      const [row] = await db
        .insert(phoneVerifications)
        .values({ userId, method: 'whatsapp', linkTokenHash: codeHash(code), ipAddress: ip, expiresAt })
        .returning({ id: phoneVerifications.id });
      return { verificationId: row!.id, code, expiresAt };
    } catch (e) {
      // The same code as an old attempt (hashes are unique): another one
      const err = e as { code?: string; cause?: { code?: string } };
      if ((err?.cause?.code ?? err?.code) !== UNIQUE_VIOLATION || tries >= 3) throw e;
    }
  }
}

export type WhatsAppResult =
  | { ok: true; account: string }
  | {
      ok: false;
      reason: 'no_code' | 'unknown_code' | 'invalid_number' | Extract<FailureReason, 'country_not_allowed' | 'no_country' | 'phone_in_use'>;
      country?: string | null;
    };

/** One message from WhatsApp: `from` is the sender's number as Meta gives it (digits, no +) */
export async function acceptWhatsAppMessage(db: Queryable, m: { from: string; text: string }): Promise<WhatsAppResult> {
  const code = codeInText(m.text);
  if (!code) return { ok: false, reason: 'no_code' };
  const [row] = await db
    .select({ id: phoneVerifications.id, userId: phoneVerifications.userId })
    .from(phoneVerifications)
    .where(
      and(
        eq(phoneVerifications.linkTokenHash, codeHash(code)),
        eq(phoneVerifications.method, 'whatsapp'),
        eq(phoneVerifications.status, 'pending'),
        gt(phoneVerifications.expiresAt, sql`now()`),
      ),
    );
  if (!row) return { ok: false, reason: 'unknown_code' };

  const number = checkVerifiedNumber(`+${m.from.replace(/\D/g, '')}`);
  if (!number.ok) {
    if (number.reason === 'invalid') return { ok: false, reason: 'invalid_number' };
    // Only the country of a refused number is kept, never the number
    await failVerification(db, row.id, number.reason, { numberCountry: number.country });
    return { ok: false, reason: number.reason, country: number.country };
  }
  const result = await completeVerification(db, {
    verificationId: row.id,
    userId: row.userId,
    phoneE164: number.e164,
    numberCountry: number.country,
    method: 'whatsapp',
  });
  if (!result.ok) return { ok: false, reason: 'phone_in_use' };
  // The reply names the account, half hidden, so a code someone else sent is recognisable (as the bot does)
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, row.userId));
  return { ok: true, account: u ? maskEmail(u.email) : '' };
}

/** Our answer in WhatsApp; never says "sanctions" (owner's rule, round 12) */
export function replyText(result: WhatsAppResult): string {
  const t = messages.whatsappReplies;
  if (result.ok) return t.verified(ltr(result.account));
  switch (result.reason) {
    case 'country_not_allowed':
      return result.country === 'IR' ? t.iranNumber : t.countryNotAllowed;
    case 'no_country':
      return t.noCountry;
    case 'invalid_number':
      return t.invalidNumber;
    case 'phone_in_use':
      return t.phoneInUse;
    case 'unknown_code':
      return t.unknownCode;
    case 'no_code':
      return t.help;
  }
}

/**
 * The messages of one webhook call, each once, at most SENDER_LIMIT per number and hour; returns
 * the replies to send. Valkey keys hold a hash of the number, never the number.
 */
export async function handleWhatsAppMessages(
  db: Queryable,
  redis: Redis,
  incoming: IncomingMessage[],
): Promise<Array<{ to: string; text: string }>> {
  const replies: Array<{ to: string; text: string }> = [];
  for (const m of incoming) {
    const first = await redis.set(`whatsapp:seen:${sha256(m.id).toString('hex')}`, '1', 'EX', SEEN_SECONDS, 'NX');
    if (first !== 'OK') continue;
    const limit = await hit(redis, [[SENDER_LIMIT, sha256(`whatsapp:${m.from}`).toString('hex')]]);
    if (!limit.ok) continue; // silently: replying would only feed a flood
    try {
      replies.push({ to: m.from, text: replyText(await acceptWhatsAppMessage(db, m)) });
    } catch (e) {
      // Meta still gets its 200 (it would resend the whole batch); the user can send again
      await redis.del(`whatsapp:seen:${sha256(m.id).toString('hex')}`);
      console.error('whatsapp: message failed:', e instanceof Error ? e.message : e);
    }
  }
  return replies;
}
