import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { phoneVerifications, users } from '../src/db/schema';
import { qrPath } from '../src/lib/qr';
import { messages } from '../src/messages/fa';
import { incomingMessages, sameVerifyToken, validSignature } from '../src/modules/notifications/whatsapp-api';
import { attemptStatus } from '../src/modules/users/phone';
import {
  acceptWhatsAppMessage,
  codeInText,
  handleWhatsAppMessages,
  replyText,
  startWhatsAppVerification,
  whatsAppCode,
  whatsAppLink,
} from '../src/modules/users/whatsapp';
import { normalizePersian } from '../src/lib/normalize-persian';
import { appDb, redis } from './accounts';
import { db, publicToken } from './db';

// Phone verification with WhatsApp: the user sends a code, Meta's webhook brings the sender's number
// (as the web app, like the webhook route).

async function newUser() {
  const token = publicToken();
  const [user] = await db
    .insert(users)
    .values({ publicToken: token, email: `wa-${token}@example.test`, displayName: 'کاربر', displayNameNormalized: normalizePersian('کاربر') })
    .returning();
  return user!;
}

/** A random German mobile number as Meta gives it: digits, no + */
const sender = () => `49151${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
let messageIds = 0;
const incoming = (from: string, text: string) => ({ id: `wamid.test${Date.now()}${++messageIds}`, from, text });

async function attemptRow(id: string) {
  const [row] = await db.select().from(phoneVerifications).where(eq(phoneVerifications.id, id));
  return row!;
}
async function userRow(id: string) {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row!;
}

describe('WhatsApp verification', () => {
  it('makes readable one-time codes and a ready message', () => {
    const code = whatsAppCode();
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
    const link = whatsAppLink('4915757983317', code);
    expect(link.startsWith('https://wa.me/4915757983317?text=')).toBe(true);
    expect(decodeURIComponent(link.split('text=')[1]!)).toBe(messages.phone.whatsapp.prefill(code));
  });

  it('finds the code in an edited message too', () => {
    expect(codeInText('سلام پیدو! کد تأیید شماره‌ام: 7KQ4-M2XW')).toBe('7KQ4-M2XW');
    expect(codeInText('7kq4m2xw')).toBe('7KQ4-M2XW');
    // Persian digits, as some keyboards type them
    expect(codeInText('کد: ۷KQ۴-M۲XW')).toBe('7KQ4-M2XW');
    expect(codeInText('hello')).toBeNull();
    expect(codeInText('ABCDEFGHJK')).toBeNull();
  });

  it('verifies the sender’s number, records the method and names the account', async () => {
    const user = await newUser();
    const { verificationId, code } = await startWhatsAppVerification(appDb, { userId: user.id, ip: null });
    const row = await attemptRow(verificationId);
    expect(row).toMatchObject({ method: 'whatsapp', status: 'pending', phoneE164: null });
    // Only the hash is stored
    expect(row.linkTokenHash?.toString('utf8')).not.toContain(code.replace('-', ''));

    const from = sender();
    const result = await acceptWhatsAppMessage(appDb, { from, text: messages.phone.whatsapp.prefill(code) });
    expect(result).toEqual({ ok: true, account: `w•••@example.test` });
    expect(await userRow(user.id)).toMatchObject({ phoneE164: `+${from}`, phoneVerificationMethod: 'whatsapp', telegramUserId: null });
    expect(await attemptRow(verificationId)).toMatchObject({ status: 'verified', phoneE164: `+${from}`, numberCountry: 'DE' });
    expect(await attemptStatus(appDb, user.id, verificationId)).toEqual({ status: 'verified', failureReason: null });
    expect(replyText(result)).toContain('w•••@example.test');
  });

  it('takes a code once, and never after it expired', async () => {
    const user = await newUser();
    const { code } = await startWhatsAppVerification(appDb, { userId: user.id, ip: null });
    expect((await acceptWhatsAppMessage(appDb, { from: sender(), text: code })).ok).toBe(true);
    expect(await acceptWhatsAppMessage(appDb, { from: sender(), text: code })).toEqual({ ok: false, reason: 'unknown_code' });

    const late = await startWhatsAppVerification(appDb, { userId: (await newUser()).id, ip: null });
    await db.update(phoneVerifications).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(phoneVerifications.id, late.verificationId));
    expect(await acceptWhatsAppMessage(appDb, { from: sender(), text: late.code })).toEqual({ ok: false, reason: 'unknown_code' });
    expect(await acceptWhatsAppMessage(appDb, { from: sender(), text: 'ZZZZ-ZZZZ' })).toEqual({ ok: false, reason: 'unknown_code' });
  });

  it('refuses an Iranian number, keeping only its country, and says so without "sanctions"', async () => {
    const user = await newUser();
    const { verificationId, code } = await startWhatsAppVerification(appDb, { userId: user.id, ip: null });
    const result = await acceptWhatsAppMessage(appDb, { from: '989121234567', text: code });
    expect(result).toEqual({ ok: false, reason: 'country_not_allowed', country: 'IR' });
    expect(await attemptRow(verificationId)).toMatchObject({ status: 'failed', failureReason: 'country_not_allowed', numberCountry: 'IR', phoneE164: null });
    expect((await userRow(user.id)).phoneE164).toBeNull();
    expect(await attemptStatus(appDb, user.id, verificationId)).toEqual({ status: 'failed', failureReason: 'country_not_allowed', iran: true });
    const reply = replyText(result);
    expect(reply).toBe(messages.whatsappReplies.iranNumber);
    expect(reply).not.toMatch(/تحریم/);
  });

  it('refuses countries outside the list and a number another account has', async () => {
    const a = await startWhatsAppVerification(appDb, { userId: (await newUser()).id, ip: null });
    // China isn't one of Peydoo's countries
    expect(await acceptWhatsAppMessage(appDb, { from: '8613812345678', text: a.code })).toEqual({ ok: false, reason: 'country_not_allowed', country: 'CN' });

    const from = sender();
    const first = await startWhatsAppVerification(appDb, { userId: (await newUser()).id, ip: null });
    expect((await acceptWhatsAppMessage(appDb, { from, text: first.code })).ok).toBe(true);
    const other = await newUser();
    const second = await startWhatsAppVerification(appDb, { userId: other.id, ip: null });
    expect(await acceptWhatsAppMessage(appDb, { from, text: second.code })).toEqual({ ok: false, reason: 'phone_in_use' });
    expect((await userRow(other.id)).phoneE164).toBeNull();
  });

  it('answers a message without a code with the help text', async () => {
    const result = await acceptWhatsAppMessage(appDb, { from: sender(), text: 'سلام، این آگهی هنوز هست؟' });
    expect(result).toEqual({ ok: false, reason: 'no_code' });
    expect(replyText(result)).toBe(messages.whatsappReplies.help);
  });

  it('handles a message Meta delivers twice once, caps replies per number, and keeps no number in Valkey', async () => {
    const user = await newUser();
    const { code } = await startWhatsAppVerification(appDb, { userId: user.id, ip: null });
    const from = sender();
    const m = incoming(from, code);
    expect(await handleWhatsAppMessages(appDb, redis, [m, m])).toEqual([{ to: from, text: expect.stringContaining('✅') }]);

    const flood = sender();
    const replies = await handleWhatsAppMessages(appDb, redis, Array.from({ length: 12 }, () => incoming(flood, 'hi')));
    expect(replies).toHaveLength(10);
    const keys = await redis.keys('*whatsapp*');
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.some((k) => k.includes(flood) || k.includes(from))).toBe(false);
  });
});

describe('WhatsApp webhook', () => {
  const secret = '0123456789abcdef0123456789abcdef';
  const sign = (body: string) => `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`;

  it('accepts only Meta’s signature over the raw body', () => {
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    expect(validSignature(body, sign(body), secret)).toBe(true);
    expect(validSignature(`${body} `, sign(body), secret)).toBe(false);
    expect(validSignature(body, sign(body).replace('sha256=', ''), secret)).toBe(false);
    expect(validSignature(body, null, secret)).toBe(false);
    expect(validSignature(body, 'sha256=zz', secret)).toBe(false);
  });

  it('checks the handshake token', () => {
    expect(sameVerifyToken('test-verify-token-0', 'test-verify-token-0')).toBe(true);
    expect(sameVerifyToken('test-verify-token-1', 'test-verify-token-0')).toBe(false);
    expect(sameVerifyToken('short', 'test-verify-token-0')).toBe(false);
    expect(sameVerifyToken(null, 'test-verify-token-0')).toBe(false);
  });

  it('reads the users’ messages and skips statuses and other objects', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                contacts: [{ wa_id: '4917632258332' }],
                messages: [
                  { id: 'wamid.1', from: '4917632258332', type: 'text', text: { body: 'VERIFY 7KQ4-M2XW' } },
                  { id: 'wamid.2', from: '4917632258332', type: 'image', image: { id: 'x' } },
                  // A business-scoped id without a number: nothing to verify
                  { id: 'wamid.3', type: 'text', text: { body: 'hi' } },
                ],
              },
            },
            { field: 'messages', value: { statuses: [{ id: 'wamid.0', status: 'read' }] } },
          ],
        },
      ],
    };
    expect(incomingMessages(payload)).toEqual([
      { id: 'wamid.1', from: '4917632258332', text: 'VERIFY 7KQ4-M2XW' },
      { id: 'wamid.2', from: '4917632258332', text: '' },
    ]);
    expect(incomingMessages({ ...payload, object: 'page' })).toEqual([]);
    expect(incomingMessages('nonsense')).toEqual([]);
  });

  it('draws the link as a QR code', () => {
    const qr = qrPath(whatsAppLink('4915757983317', 'ABCD-EFGH'));
    expect(qr.size).toBeGreaterThanOrEqual(21);
    expect(qr.d).toMatch(/^M\d+ \d+h\d+v1h-\d+z/);
  });
});
