import { and, desc, eq, gt, ne, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { auditLog, phoneVerifications, users } from '../../db/schema';
import { hmacSha256, linkToken, numericCode, sameBytes, sha256 } from '../../lib/tokens';
import { messages } from '../../messages/fa';
import type { SmsProvider } from './sms';

// Phone verification (docs/schema.md, section 6; docs/setup.md, decision 5): Telegram first, SMS
// as the fallback. Every attempt is a phone_verifications row. A number is stored on the user only
// when verified, by one transaction that also records the method and writes the audit log.
// Used by the web app (start, SMS code, status), the worker (Telegram bot) and the tests.

export const TELEGRAM_LINK_TTL_MS = 15 * 60_000;
export const SMS_CODE_TTL_MS = 10 * 60_000;
export const SMS_CODE_LENGTH = 6;
/** Wrong SMS codes before the attempt fails */
export const SMS_MAX_ATTEMPTS = 5;

export type FailureReason =
  | 'foreign_contact'
  | 'phone_in_use'
  | 'telegram_in_use'
  | 'too_many_attempts'
  | 'undeliverable';

export type CompleteResult = { ok: true } | { ok: false; reason: 'phone_in_use' | 'telegram_in_use' };

const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } };
  return (err?.cause?.code ?? err?.code) === UNIQUE_VIOLATION;
}

async function fail(
  db: Queryable,
  verificationId: string,
  reason: FailureReason,
  values: { phoneE164?: string; telegramUserId?: number } = {},
): Promise<void> {
  await db
    .update(phoneVerifications)
    .set({ status: 'failed', failureReason: reason, ...values })
    .where(and(eq(phoneVerifications.id, verificationId), eq(phoneVerifications.status, 'pending')));
}

/**
 * Marks the attempt verified and stores the number on the user, in one transaction. Refuses a
 * number (or Telegram account) that belongs to another account: numbers get recycled, so they are
 * never moved between accounts automatically (docs/schema.md, section 16).
 */
export async function completeVerification(
  db: Queryable,
  v: {
    verificationId: string;
    userId: string;
    phoneE164: string;
    method: 'telegram' | 'sms';
    telegramUserId?: number;
  },
): Promise<CompleteResult> {
  let refused: 'phone_in_use' | 'telegram_in_use' | null = null;
  try {
    await db.transaction(async (tx) => {
      const [phoneOwner] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.phoneE164, v.phoneE164), ne(users.id, v.userId)));
      if (phoneOwner) {
        refused = 'phone_in_use';
        return;
      }
      if (v.telegramUserId !== undefined) {
        const [telegramOwner] = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.telegramUserId, v.telegramUserId), ne(users.id, v.userId)));
        if (telegramOwner) {
          refused = 'telegram_in_use';
          return;
        }
      }

      const now = new Date();
      const [done] = await tx
        .update(phoneVerifications)
        .set({
          status: 'verified',
          phoneE164: v.phoneE164,
          verifiedAt: now,
          ...(v.telegramUserId !== undefined ? { telegramUserId: v.telegramUserId } : {}),
        })
        .where(
          and(
            eq(phoneVerifications.id, v.verificationId),
            eq(phoneVerifications.userId, v.userId),
            eq(phoneVerifications.status, 'pending'),
          ),
        )
        .returning({ id: phoneVerifications.id });
      if (!done) throw new Error('phone verification is no longer pending');

      await tx
        .update(users)
        .set({
          phoneE164: v.phoneE164,
          phoneVerifiedAt: now,
          phoneVerificationMethod: v.method,
          ...(v.telegramUserId !== undefined ? { telegramUserId: v.telegramUserId } : {}),
        })
        .where(eq(users.id, v.userId));

      await tx.insert(auditLog).values({
        actorType: 'user',
        actorUserId: v.userId,
        action: 'phone.verified',
        targetType: 'user',
        targetId: v.userId,
        data: { method: v.method, verificationId: v.verificationId },
      });
    });
  } catch (e) {
    // Two accounts finishing with the same number at the same moment: the UNIQUE constraint decides
    if (!isUniqueViolation(e)) throw e;
    const message = String((e as { cause?: { constraint_name?: string } }).cause?.constraint_name);
    refused = message.includes('telegram') ? 'telegram_in_use' : 'phone_in_use';
  }

  if (refused) {
    await fail(db, v.verificationId, refused, {
      phoneE164: v.phoneE164,
      ...(v.telegramUserId !== undefined ? { telegramUserId: v.telegramUserId } : {}),
    });
    return { ok: false, reason: refused };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Telegram
// ---------------------------------------------------------------------------------------------

/** Starts a Telegram verification. The token goes into the t.me link; only its hash is stored. */
export async function startTelegramVerification(
  db: Queryable,
  { userId, ip }: { userId: string; ip: string | null },
): Promise<{ verificationId: string; token: string; expiresAt: Date }> {
  const token = linkToken();
  const expiresAt = new Date(Date.now() + TELEGRAM_LINK_TTL_MS);
  const [row] = await db
    .insert(phoneVerifications)
    .values({
      userId,
      method: 'telegram',
      linkTokenHash: sha256(token),
      ipAddress: ip,
      expiresAt,
    })
    .returning({ id: phoneVerifications.id });
  return { verificationId: row!.id, token, expiresAt };
}

export type BindResult = { ok: true; verificationId: string } | { ok: false };

/**
 * `/start <token>` in the bot: ties the attempt to the Telegram account that opened the link.
 * Only the first Telegram account can claim it; the same account may open it again.
 */
export async function bindTelegramLink(
  db: Queryable,
  { token, telegramUserId }: { token: string; telegramUserId: number },
): Promise<BindResult> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return { ok: false };
  const [row] = await db
    .update(phoneVerifications)
    .set({ telegramUserId })
    .where(
      and(
        eq(phoneVerifications.linkTokenHash, sha256(token)),
        eq(phoneVerifications.method, 'telegram'),
        eq(phoneVerifications.status, 'pending'),
        gt(phoneVerifications.expiresAt, sql`now()`),
        sql`(${phoneVerifications.telegramUserId} IS NULL OR ${phoneVerifications.telegramUserId} = ${telegramUserId})`,
      ),
    )
    .returning({ id: phoneVerifications.id });
  return row ? { ok: true, verificationId: row.id } : { ok: false };
}

export type ContactResult =
  | { ok: true; phoneE164: string }
  | { ok: false; reason: 'no_pending' | 'invalid_number' | FailureReason };

/**
 * A contact shared in the bot. Accepted only when the contact is the sender's own
 * (contact.user_id === from.id): anyone can share someone else's contact card.
 */
export async function acceptTelegramContact(
  db: Queryable,
  c: { fromId: number; contactUserId: number | undefined; phoneE164: string | null },
): Promise<ContactResult> {
  const [row] = await db
    .select({ id: phoneVerifications.id, userId: phoneVerifications.userId })
    .from(phoneVerifications)
    .where(
      and(
        eq(phoneVerifications.method, 'telegram'),
        eq(phoneVerifications.status, 'pending'),
        eq(phoneVerifications.telegramUserId, c.fromId),
        gt(phoneVerifications.expiresAt, sql`now()`),
      ),
    )
    .orderBy(desc(phoneVerifications.createdAt))
    .limit(1);
  if (!row) return { ok: false, reason: 'no_pending' };

  if (c.contactUserId === undefined || c.contactUserId !== c.fromId) {
    await fail(db, row.id, 'foreign_contact');
    return { ok: false, reason: 'foreign_contact' };
  }
  if (!c.phoneE164) return { ok: false, reason: 'invalid_number' };

  const result = await completeVerification(db, {
    verificationId: row.id,
    userId: row.userId,
    phoneE164: c.phoneE164,
    method: 'telegram',
    telegramUserId: c.fromId,
  });
  return result.ok ? { ok: true, phoneE164: c.phoneE164 } : result;
}

// ---------------------------------------------------------------------------------------------
// SMS
// ---------------------------------------------------------------------------------------------

function smsCodeHash(secret: string, verificationId: string, code: string): Buffer {
  return hmacSha256(secret, `${verificationId}:${code}`);
}

export type StartSmsResult =
  | { ok: true; verificationId: string; expiresAt: Date }
  | { ok: false; reason: 'phone_in_use' | 'undeliverable' };

/** Sends a 6-digit code to a number already checked by parseSmsNumber(). */
export async function startSmsVerification(
  db: Queryable,
  sms: SmsProvider,
  v: { userId: string; phoneE164: string; ip: string | null; secret: string },
): Promise<StartSmsResult> {
  // Don't pay for an SMS to a number that would be refused anyway
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.phoneE164, v.phoneE164), ne(users.id, v.userId)));
  if (owner) return { ok: false, reason: 'phone_in_use' };

  const code = numericCode(SMS_CODE_LENGTH);
  const expiresAt = new Date(Date.now() + SMS_CODE_TTL_MS);
  const verificationId = (
    await db.execute<{ id: string }>(sql`SELECT uuidv7() AS id`)
  )[0]!.id;
  await db.insert(phoneVerifications).values({
    id: verificationId,
    userId: v.userId,
    method: 'sms',
    phoneE164: v.phoneE164,
    codeHash: smsCodeHash(v.secret, verificationId, code),
    smsProvider: sms.name,
    ipAddress: v.ip,
    expiresAt,
  });

  try {
    const sent = await sms.send(v.phoneE164, messages.sms.code(code));
    if (sent.messageId) {
      await db
        .update(phoneVerifications)
        .set({ providerMessageId: sent.messageId })
        .where(eq(phoneVerifications.id, verificationId));
    }
  } catch (e) {
    console.error('sms: send failed:', e instanceof Error ? e.message : e);
    await fail(db, verificationId, 'undeliverable');
    return { ok: false, reason: 'undeliverable' };
  }
  return { ok: true, verificationId, expiresAt };
}

export type CheckSmsResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'not_found' | 'expired' | 'wrong_code' | 'too_many_attempts' | 'phone_in_use';
      attemptsLeft?: number;
    };

/** Checks a typed SMS code. A code works once: afterwards the attempt is no longer pending. */
export async function checkSmsCode(
  db: Queryable,
  v: { userId: string; verificationId: string; code: string; secret: string },
): Promise<CheckSmsResult> {
  const outcome = await db.transaction(async (tx): Promise<CheckSmsResult | 'correct'> => {
    const [row] = await tx
      .select()
      .from(phoneVerifications)
      .where(
        and(
          eq(phoneVerifications.id, v.verificationId),
          eq(phoneVerifications.userId, v.userId),
          eq(phoneVerifications.method, 'sms'),
          eq(phoneVerifications.status, 'pending'),
        ),
      )
      .for('update');
    if (!row) return { ok: false, reason: 'not_found' };

    if (row.expiresAt.getTime() <= Date.now()) {
      await tx
        .update(phoneVerifications)
        .set({ status: 'expired' })
        .where(eq(phoneVerifications.id, row.id));
      return { ok: false, reason: 'expired' };
    }

    const expected = smsCodeHash(v.secret, row.id, v.code);
    if (row.codeHash && sameBytes(row.codeHash, expected)) return 'correct';

    const attempts = row.attempts + 1;
    const exhausted = attempts >= SMS_MAX_ATTEMPTS;
    await tx
      .update(phoneVerifications)
      .set({
        attempts,
        ...(exhausted ? { status: 'failed' as const, failureReason: 'too_many_attempts' } : {}),
      })
      .where(eq(phoneVerifications.id, row.id));
    return exhausted
      ? { ok: false, reason: 'too_many_attempts' }
      : { ok: false, reason: 'wrong_code', attemptsLeft: SMS_MAX_ATTEMPTS - attempts };
  });
  if (outcome !== 'correct') return outcome;

  const [row] = await db
    .select({ phoneE164: phoneVerifications.phoneE164 })
    .from(phoneVerifications)
    .where(eq(phoneVerifications.id, v.verificationId));
  const result = await completeVerification(db, {
    verificationId: v.verificationId,
    userId: v.userId,
    phoneE164: row!.phoneE164!,
    method: 'sms',
  });
  return result.ok ? result : { ok: false, reason: 'phone_in_use' };
}

// ---------------------------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------------------------

export type AttemptStatus = {
  status: 'pending' | 'verified' | 'failed' | 'expired';
  failureReason: string | null;
};

/** The status of one of the user's own attempts (the page polls this while the bot works). */
export async function attemptStatus(
  db: Queryable,
  userId: string,
  verificationId: string,
): Promise<AttemptStatus | null> {
  const [row] = await db
    .select({
      status: phoneVerifications.status,
      failureReason: phoneVerifications.failureReason,
      expiresAt: phoneVerifications.expiresAt,
    })
    .from(phoneVerifications)
    .where(and(eq(phoneVerifications.id, verificationId), eq(phoneVerifications.userId, userId)));
  if (!row) return null;
  const expired = row.status === 'pending' && row.expiresAt.getTime() <= Date.now();
  return { status: expired ? 'expired' : row.status, failureReason: row.failureReason };
}
