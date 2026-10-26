import { and, desc, eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { auditLog, phoneVerifications, users } from '../src/db/schema';
import {
  acceptTelegramContact,
  attemptStatus,
  bindTelegramLink,
  checkSmsCode,
  SMS_MAX_ATTEMPTS,
  startSmsVerification,
  startTelegramVerification,
} from '../src/modules/users/phone';
import { checkVerifiedNumber, parseSmsNumber, telegramNumberToE164 } from '../src/modules/users/phone-number';
import { messages } from '../src/messages/fa';
import {
  type BotApi,
  type ReplyMarkup,
  handleUpdate,
} from '../src/modules/users/telegram-bot';
import { db, publicToken } from './db';
import { MemorySms, appDb, redis, workerDb } from './accounts';
import { normalizePersian } from '../src/lib/normalize-persian';

// Phone verification: Telegram (as the worker role, like the bot) and SMS (as the app role).

const SECRET = 'phone-code-secret-phone-code-secret-0123';
let telegramIds = 7_000_000_000;

async function newUser() {
  const token = publicToken();
  const [user] = await db
    .insert(users)
    .values({
      publicToken: token,
      email: `phone-${token}@example.test`,
      displayName: 'کاربر',
      displayNameNormalized: normalizePersian('کاربر'),
    })
    .returning();
  return user!;
}

/** A random German mobile number */
function mobile(): string {
  return `+49151${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
}

async function userRow(id: string) {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row!;
}

async function attemptRow(id: string) {
  const [row] = await db.select().from(phoneVerifications).where(eq(phoneVerifications.id, id));
  return row!;
}

/** Start on the web, open the link in Telegram: a pending attempt bound to a Telegram account */
async function boundAttempt(existingUserId?: string, tgId = ++telegramIds) {
  const userId = existingUserId ?? (await newUser()).id;
  const { token, verificationId } = await startTelegramVerification(appDb, { userId, ip: '203.0.113.9' });
  expect(await bindTelegramLink(workerDb, { token, telegramUserId: tgId })).toEqual({
    ok: true,
    verificationId,
  });
  return { userId, tgId, token, verificationId };
}

beforeEach(async () => {
  await redis.flushdb();
});

describe('Telegram verification', () => {
  it('verifies the sender’s own number and records the method', async () => {
    const { userId, tgId, verificationId } = await boundAttempt();
    const phone = mobile();
    const result = await acceptTelegramContact(workerDb, {
      fromId: tgId,
      contactUserId: tgId,
      phoneE164: phone,
    });
    expect(result).toEqual({ ok: true, phoneE164: phone });

    const user = await userRow(userId);
    expect(user.phoneE164).toBe(phone);
    expect(user.phoneVerificationMethod).toBe('telegram');
    expect(user.phoneVerifiedAt).toBeInstanceOf(Date);
    expect(user.telegramUserId).toBe(tgId);

    const attempt = await attemptRow(verificationId);
    expect(attempt).toMatchObject({ status: 'verified', phoneE164: phone, telegramUserId: tgId, numberCountry: 'DE' });
    expect(await attemptStatus(appDb, userId, verificationId)).toEqual({
      status: 'verified',
      failureReason: null,
    });

    const [audit] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.targetId, userId), eq(auditLog.action, 'phone.verified')));
    expect(audit!.data).toEqual({ method: 'telegram', verificationId });
  });

  it('rejects a contact that belongs to someone else', async () => {
    const { userId, tgId, verificationId } = await boundAttempt();
    const result = await acceptTelegramContact(workerDb, {
      fromId: tgId,
      contactUserId: tgId + 1,
      phoneE164: mobile(),
    });
    expect(result).toEqual({ ok: false, reason: 'foreign_contact' });
    expect(await attemptRow(verificationId)).toMatchObject({
      status: 'failed',
      failureReason: 'foreign_contact',
    });
    expect((await userRow(userId)).phoneE164).toBeNull();
  });

  it('rejects a contact card without a Telegram account (typed-in contact)', async () => {
    const { userId, tgId } = await boundAttempt();
    const result = await acceptTelegramContact(workerDb, {
      fromId: tgId,
      contactUserId: undefined,
      phoneE164: mobile(),
    });
    expect(result).toEqual({ ok: false, reason: 'foreign_contact' });
    expect((await userRow(userId)).phoneE164).toBeNull();
  });

  it('lets only the first Telegram account use a link', async () => {
    const { token, tgId } = await boundAttempt();
    expect(await bindTelegramLink(workerDb, { token, telegramUserId: tgId + 1 })).toEqual({ ok: false });
    // The same account may open it again
    expect((await bindTelegramLink(workerDb, { token, telegramUserId: tgId })).ok).toBe(true);
  });

  it('refuses an expired link and an unknown token', async () => {
    const user = await newUser();
    const { token, verificationId } = await startTelegramVerification(appDb, { userId: user.id, ip: null });
    await db
      .update(phoneVerifications)
      .set({ expiresAt: sql`now() - interval '1 second'` })
      .where(eq(phoneVerifications.id, verificationId));
    expect(await bindTelegramLink(workerDb, { token, telegramUserId: ++telegramIds })).toEqual({ ok: false });
    expect(
      await bindTelegramLink(workerDb, { token: 'x'.repeat(32), telegramUserId: telegramIds }),
    ).toEqual({ ok: false });
    expect((await attemptStatus(appDb, user.id, verificationId))?.status).toBe('expired');
  });

  it('refuses a contact when no link was opened', async () => {
    const id = ++telegramIds;
    expect(
      await acceptTelegramContact(workerDb, { fromId: id, contactUserId: id, phoneE164: mobile() }),
    ).toEqual({ ok: false, reason: 'no_pending' });
  });

  it('refuses a number that already belongs to another account', async () => {
    const phone = mobile();
    const first = await boundAttempt();
    await acceptTelegramContact(workerDb, { fromId: first.tgId, contactUserId: first.tgId, phoneE164: phone });

    const second = await boundAttempt();
    const result = await acceptTelegramContact(workerDb, {
      fromId: second.tgId,
      contactUserId: second.tgId,
      phoneE164: phone,
    });
    expect(result).toEqual({ ok: false, reason: 'phone_in_use' });
    expect(await attemptRow(second.verificationId)).toMatchObject({
      status: 'failed',
      failureReason: 'phone_in_use',
    });
    expect((await userRow(second.userId)).phoneE164).toBeNull();
    expect((await userRow(first.userId)).phoneE164).toBe(phone);
  });

  it('refuses a Telegram account already linked to another user', async () => {
    const first = await boundAttempt();
    await acceptTelegramContact(workerDb, {
      fromId: first.tgId,
      contactUserId: first.tgId,
      phoneE164: mobile(),
    });
    const second = await boundAttempt(undefined, first.tgId);
    const result = await acceptTelegramContact(workerDb, {
      fromId: first.tgId,
      contactUserId: first.tgId,
      phoneE164: mobile(),
    });
    expect(result).toEqual({ ok: false, reason: 'telegram_in_use' });
    expect((await userRow(second.userId)).phoneE164).toBeNull();
  });

  it('a user can verify again to change the number', async () => {
    const first = await boundAttempt();
    await acceptTelegramContact(workerDb, { fromId: first.tgId, contactUserId: first.tgId, phoneE164: mobile() });
    const again = await boundAttempt(first.userId, first.tgId);
    const newPhone = mobile();
    expect(
      await acceptTelegramContact(workerDb, { fromId: again.tgId, contactUserId: again.tgId, phoneE164: newPhone }),
    ).toEqual({ ok: true, phoneE164: newPhone });
    expect((await userRow(first.userId)).phoneE164).toBe(newPhone);
  });

  it('refuses an Iranian number, keeping only its country', async () => {
    const { userId, tgId, verificationId } = await boundAttempt();
    const result = await acceptTelegramContact(workerDb, {
      fromId: tgId,
      contactUserId: tgId,
      phoneE164: '+989121234567',
    });
    expect(result).toEqual({ ok: false, reason: 'country_not_allowed', country: 'IR' });
    expect(await attemptRow(verificationId)).toMatchObject({
      status: 'failed',
      failureReason: 'country_not_allowed',
      numberCountry: 'IR',
      phoneE164: null,
    });
    expect(await userRow(userId)).toMatchObject({ phoneE164: null, telegramUserId: null });
    expect(await attemptStatus(appDb, userId, verificationId)).toEqual({
      status: 'failed',
      failureReason: 'country_not_allowed',
    });
  });

  it('refuses an anonymous +888 number', async () => {
    const { userId, tgId, verificationId } = await boundAttempt();
    const result = await acceptTelegramContact(workerDb, {
      fromId: tgId,
      contactUserId: tgId,
      phoneE164: '+88804123456',
    });
    expect(result).toEqual({ ok: false, reason: 'no_country', country: null });
    expect(await attemptRow(verificationId)).toMatchObject({
      status: 'failed',
      failureReason: 'no_country',
      numberCountry: null,
      phoneE164: null,
    });
    expect((await userRow(userId)).phoneE164).toBeNull();
  });

  it('refuses a country outside the list and accepts Turkey', async () => {
    const china = await boundAttempt();
    expect(
      await acceptTelegramContact(workerDb, { fromId: china.tgId, contactUserId: china.tgId, phoneE164: '+8613812345678' }),
    ).toEqual({ ok: false, reason: 'country_not_allowed', country: 'CN' });

    const turkey = await boundAttempt();
    const phone = `+90532${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
    expect(
      await acceptTelegramContact(workerDb, { fromId: turkey.tgId, contactUserId: turkey.tgId, phoneE164: phone }),
    ).toEqual({ ok: true, phoneE164: phone });
    expect(await attemptRow(turkey.verificationId)).toMatchObject({ status: 'verified', numberCountry: 'TR' });
  });

  it('checks messenger-verified numbers against the country list', () => {
    expect(checkVerifiedNumber('+491701234567')).toEqual({ ok: true, e164: '+491701234567', country: 'DE' });
    // A landline is fine: the messenger verified it
    expect(checkVerifiedNumber('+49301234567')).toMatchObject({ ok: true, country: 'DE' });
    expect(checkVerifiedNumber('+14165550123')).toMatchObject({ ok: true, country: 'CA' });
    expect(checkVerifiedNumber('+989121234567')).toEqual({ ok: false, reason: 'country_not_allowed', country: 'IR' });
    expect(checkVerifiedNumber('+88804123456')).toEqual({ ok: false, reason: 'no_country', country: null });
    expect(checkVerifiedNumber('+8613812345678')).toEqual({ ok: false, reason: 'country_not_allowed', country: 'CN' });
    expect(checkVerifiedNumber('12345')).toEqual({ ok: false, reason: 'invalid', country: null });
  });

  it('turns Telegram’s number format into E.164', () => {
    expect(telegramNumberToE164('491701234567')).toBe('+491701234567');
    expect(telegramNumberToE164('+989121234567')).toBe('+989121234567');
    expect(telegramNumberToE164('12')).toBeNull();
  });
});

describe('Telegram bot', () => {
  class FakeApi implements BotApi {
    readonly sent: Array<{ chatId: number; text: string; markup?: ReplyMarkup }> = [];
    async sendMessage(chatId: number, text: string, markup?: ReplyMarkup) {
      this.sent.push({ chatId, text, markup });
    }
  }

  const message = (fromId: number, extra: object) => ({
    update_id: 1,
    message: { message_id: 1, from: { id: fromId }, chat: { id: fromId, type: 'private' }, ...extra },
  });

  it('asks for the contact after /start and verifies the shared number', async () => {
    const user = await newUser();
    const { token } = await startTelegramVerification(appDb, { userId: user.id, ip: null });
    const tgId = ++telegramIds;
    const api = new FakeApi();

    await handleUpdate(workerDb, redis, api, message(tgId, { text: `/start ${token}` }));
    expect(api.sent[0]!.markup).toMatchObject({ keyboard: [[{ request_contact: true }]] });

    const phone = mobile();
    await handleUpdate(
      workerDb,
      redis,
      api,
      message(tgId, { contact: { phone_number: phone.slice(1), user_id: tgId } }),
    );
    expect(api.sent[1]!.markup).toEqual({ remove_keyboard: true });
    expect((await userRow(user.id)).phoneE164).toBe(phone);
  });

  it('rejects a forwarded contact of another person', async () => {
    const user = await newUser();
    const { token } = await startTelegramVerification(appDb, { userId: user.id, ip: null });
    const tgId = ++telegramIds;
    const api = new FakeApi();
    await handleUpdate(workerDb, redis, api, message(tgId, { text: `/start ${token}` }));
    await handleUpdate(
      workerDb,
      redis,
      api,
      message(tgId, { contact: { phone_number: '491709999999', user_id: 12345 } }),
    );
    expect(api.sent[1]!.text).toContain('مال حساب تلگرام خودتان نیست');
    expect((await userRow(user.id)).phoneE164).toBeNull();
  });

  it('answers an Iranian number with the Iran text, never "sanctions"', async () => {
    const user = await newUser();
    const { token } = await startTelegramVerification(appDb, { userId: user.id, ip: null });
    const tgId = ++telegramIds;
    const api = new FakeApi();
    await handleUpdate(workerDb, redis, api, message(tgId, { text: `/start ${token}` }));
    await handleUpdate(workerDb, redis, api, message(tgId, { contact: { phone_number: '989121234567', user_id: tgId } }));
    expect(api.sent[1]!.text).toBe(messages.bot.iranNumber);
    expect(api.sent[1]!.text).not.toContain('تحریم');
    expect(api.sent[1]!.markup).toEqual({ remove_keyboard: true });
    expect((await userRow(user.id)).phoneE164).toBeNull();
  });

  it('answers +888 and other countries with their own texts', async () => {
    const api = new FakeApi();
    for (const phone of ['88804123456', '8613812345678']) {
      const user = await newUser();
      const { token } = await startTelegramVerification(appDb, { userId: user.id, ip: null });
      const tgId = ++telegramIds;
      await handleUpdate(workerDb, redis, api, message(tgId, { text: `/start ${token}` }));
      await handleUpdate(workerDb, redis, api, message(tgId, { contact: { phone_number: phone, user_id: tgId } }));
    }
    expect(api.sent[1]!.text).toBe(messages.bot.noCountry);
    expect(api.sent[3]!.text).toBe(messages.bot.countryNotAllowed);
  });

  it('ignores groups and bots', async () => {
    const api = new FakeApi();
    await handleUpdate(workerDb, redis, api, {
      update_id: 1,
      message: { message_id: 1, from: { id: 1 }, chat: { id: -100, type: 'group' }, text: '/start x' },
    });
    await handleUpdate(workerDb, redis, api, {
      update_id: 2,
      message: { message_id: 1, from: { id: 2, is_bot: true }, chat: { id: 2, type: 'private' }, text: 'hi' },
    });
    expect(api.sent).toHaveLength(0);
  });
});

describe('SMS verification', () => {
  async function started(phone = mobile()) {
    const user = await newUser();
    const sms = new MemorySms();
    const result = await startSmsVerification(appDb, sms, {
      userId: user.id,
      phoneE164: phone,
      numberCountry: 'DE',
      ip: '203.0.113.9',
      secret: SECRET,
    });
    if (!result.ok) throw new Error(result.reason);
    return { user, sms, phone, verificationId: result.verificationId, code: sms.lastCode() };
  }

  it('verifies with the right code and records the method', async () => {
    const { user, phone, verificationId, code, sms } = await started();
    expect(sms.sent[0]!.to).toBe(phone);
    const attempt = await attemptRow(verificationId);
    expect(attempt.codeHash).not.toBeNull();
    expect(attempt.providerMessageId).toBe('m-1');

    expect(await checkSmsCode(appDb, { userId: user.id, verificationId, code, secret: SECRET })).toEqual({
      ok: true,
    });
    const row = await userRow(user.id);
    expect(row.phoneE164).toBe(phone);
    expect(row.phoneVerificationMethod).toBe('sms');
    expect(row.telegramUserId).toBeNull();
    expect((await attemptRow(verificationId)).numberCountry).toBe('DE');
  });

  it("refuses a code that was already used", async () => {
    const { user, verificationId, code } = await started();
    await checkSmsCode(appDb, { userId: user.id, verificationId, code, secret: SECRET });
    expect(await checkSmsCode(appDb, { userId: user.id, verificationId, code, secret: SECRET })).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('refuses an expired code', async () => {
    const { user, verificationId, code } = await started();
    await db
      .update(phoneVerifications)
      .set({ expiresAt: sql`now() - interval '1 second'` })
      .where(eq(phoneVerifications.id, verificationId));
    expect(await checkSmsCode(appDb, { userId: user.id, verificationId, code, secret: SECRET })).toEqual({
      ok: false,
      reason: 'expired',
    });
    expect((await userRow(user.id)).phoneE164).toBeNull();
  });

  it(`fails after ${SMS_MAX_ATTEMPTS} wrong codes`, async () => {
    const { user, verificationId, code } = await started();
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 1; i < SMS_MAX_ATTEMPTS; i++) {
      expect(
        await checkSmsCode(appDb, { userId: user.id, verificationId, code: wrong, secret: SECRET }),
      ).toEqual({ ok: false, reason: 'wrong_code', attemptsLeft: SMS_MAX_ATTEMPTS - i });
    }
    expect(
      await checkSmsCode(appDb, { userId: user.id, verificationId, code: wrong, secret: SECRET }),
    ).toEqual({ ok: false, reason: 'too_many_attempts' });
    expect(await checkSmsCode(appDb, { userId: user.id, verificationId, code, secret: SECRET })).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it("can't use another user's attempt", async () => {
    const { verificationId, code } = await started();
    const other = await newUser();
    expect(await checkSmsCode(appDb, { userId: other.id, verificationId, code, secret: SECRET })).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('sends nothing to a number another account already has', async () => {
    const first = await started();
    await checkSmsCode(appDb, {
      userId: first.user.id,
      verificationId: first.verificationId,
      code: first.code,
      secret: SECRET,
    });
    const user = await newUser();
    const sms = new MemorySms();
    expect(
      await startSmsVerification(appDb, sms, { userId: user.id, phoneE164: first.phone, numberCountry: 'DE', ip: null, secret: SECRET }),
    ).toEqual({ ok: false, reason: 'phone_in_use' });
    expect(sms.sent).toHaveLength(0);
  });

  it('marks the attempt undeliverable when the provider fails', async () => {
    const user = await newUser();
    const broken = { name: 'broken', send: async () => Promise.reject(new Error('down')) };
    const result = await startSmsVerification(appDb, broken, {
      userId: user.id,
      phoneE164: mobile(),
      numberCountry: 'DE',
      ip: null,
      secret: SECRET,
    });
    expect(result).toEqual({ ok: false, reason: 'undeliverable' });
    const [row] = await db
      .select()
      .from(phoneVerifications)
      .where(eq(phoneVerifications.userId, user.id))
      .orderBy(desc(phoneVerifications.createdAt));
    expect(row).toMatchObject({ status: 'failed', failureReason: 'undeliverable' });
  });

  it('parses typed numbers and refuses countries outside the list', () => {
    expect(parseSmsNumber('۰۱۵۱ ۲۳۴۵ ۶۷۸۹')).toMatchObject({ ok: true, e164: '+4915123456789', country: 'DE' });
    expect(parseSmsNumber('0043 664 1234567')).toMatchObject({ ok: true, country: 'AT' });
    expect(parseSmsNumber('+98 912 123 4567')).toEqual({ ok: false, reason: 'country_not_supported' });
    expect(parseSmsNumber('+49 30 1234567')).toEqual({ ok: false, reason: 'not_mobile' });
    expect(parseSmsNumber('12')).toEqual({ ok: false, reason: 'invalid' });
  });
});
