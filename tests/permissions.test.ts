import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { users } from '../src/db/schema';
import { checkVerifiedNumber, isMessagesOnlyNumber } from '../src/modules/users/phone-number';
import {
  canFavorite,
  canPostListing,
  canSeePhone,
  canSendMessage,
  loadActor,
  type Actor,
} from '../src/modules/users/permissions';
import { appDb } from './accounts';
import { db, makeUser, rollback } from './db';

// Decided Oct 16, 2026: posting a listing and sending a message need a verified phone number;
// browsing and favorites don't. Nov 4, 2026 (owner): a +98 number, verified through Telegram only,
// is good for messages only; no exception by the visitor's country any more.

describe('permissions', () => {
  it('an unverified user can favorite but not post or message', async () => {
    await rollback(async (tx) => {
      const user = await makeUser(tx);
      const actor = await loadActor(tx, user.id);
      expect(canFavorite(actor)).toEqual({ ok: true });
      expect(canPostListing(actor)).toEqual({ ok: false, reason: 'phone_required' });
      expect(canSendMessage(actor)).toEqual({ ok: false, reason: 'phone_required' });
    });
  });

  it('a verified user can post and message', async () => {
    await rollback(async (tx) => {
      const user = await makeUser(tx, {
        phoneE164: '+4915100000001',
        phoneVerifiedAt: new Date(),
        phoneVerificationMethod: 'telegram',
      });
      const actor = await loadActor(tx, user.id);
      expect(canPostListing(actor)).toEqual({ ok: true });
      expect(canSendMessage(actor)).toEqual({ ok: true });
    });
  });

  it('signed-out visitors must sign in', async () => {
    expect(await loadActor(appDb, null)).toBeNull();
    expect(canFavorite(null)).toEqual({ ok: false, reason: 'sign_in_required' });
    expect(canPostListing(null)).toEqual({ ok: false, reason: 'sign_in_required' });
    expect(canSendMessage(null)).toEqual({ ok: false, reason: 'sign_in_required' });
  });

  it('a deactivated account can do nothing, verified or not', async () => {
    await rollback(async (tx) => {
      const user = await makeUser(tx, {
        phoneE164: '+4915100000002',
        phoneVerifiedAt: new Date(),
        phoneVerificationMethod: 'sms',
      });
      await tx.update(users).set({ status: 'deactivated' }).where(eq(users.id, user.id));
      const actor = await loadActor(tx, user.id);
      expect(canPostListing(actor)).toEqual({ ok: false, reason: 'account_disabled' });
      expect(canSendMessage(actor)).toEqual({ ok: false, reason: 'account_disabled' });
      expect(canFavorite(actor)).toEqual({ ok: false, reason: 'account_disabled' });
    });
  });

  it('reads the user as the app role', async () => {
    const [any] = await db.select({ id: users.id }).from(users).limit(1);
    if (any) expect((await loadActor(appDb, any.id))?.id).toBe(any.id);
  });
});

describe('Iranian numbers: messages only (owner, Nov 4, 2026)', () => {
  const at = (phoneE164: string | null, more: Partial<Actor> = {}): Actor => ({
    id: '00000000-0000-7000-8000-000000000001',
    status: 'active',
    phoneE164,
    phoneVerifiedAt: phoneE164 ? new Date() : null,
    createdAt: new Date(Date.now() - 30 * 86_400_000),
    ...more,
  });

  it('signed in without a number: nothing but favorites, wherever the visitor is', () => {
    const a = at(null);
    expect(canFavorite(a)).toEqual({ ok: true });
    expect(canSendMessage(a)).toEqual({ ok: false, reason: 'phone_required' });
    expect(canPostListing(a)).toEqual({ ok: false, reason: 'phone_required' });
    expect(canSeePhone(a)).toEqual({ ok: false, reason: 'phone_required' });
  });

  it('a +98 number may message, never post or see numbers', () => {
    const a = at('+989121234567');
    expect(canSendMessage(a)).toEqual({ ok: true });
    expect(canPostListing(a)).toEqual({ ok: false, reason: 'local_number_required' });
    expect(canSeePhone(a)).toEqual({ ok: false, reason: 'local_number_required' });
  });

  it('a German number: everything, as before', () => {
    const a = at('+4915112345678');
    expect(canSendMessage(a)).toEqual({ ok: true });
    expect(canPostListing(a)).toEqual({ ok: true });
    expect(canSeePhone(a)).toEqual({ ok: true });
  });

  it('restrictions win over any number', () => {
    expect(canSendMessage(at('+989121234567', { restrictions: ['messaging_restricted'] }))).toEqual({ ok: false, reason: 'restricted' });
    expect(canSeePhone(at('+4915112345678', { restrictions: ['messaging_restricted'] }))).toEqual({ ok: false, reason: 'restricted' });
    expect(canPostListing(at('+4915112345678', { restrictions: ['posting_restricted'] }))).toEqual({ ok: false, reason: 'restricted' });
    expect(canSendMessage(at('+4915112345678', { status: 'deactivated' }))).toEqual({ ok: false, reason: 'account_disabled' });
  });

  it('+98 passes only where a channel asks for messages-only numbers (Telegram); WhatsApp and the rest refuse it', () => {
    expect(checkVerifiedNumber('+989121234567')).toEqual({ ok: false, reason: 'country_not_allowed', country: 'IR' });
    expect(checkVerifiedNumber('+989121234567', { messagesOnly: true })).toEqual({ ok: true, e164: '+989121234567', country: 'IR' });
    expect(checkVerifiedNumber('+88812345678', { messagesOnly: true })).toMatchObject({ ok: false, reason: 'no_country' });
    expect(checkVerifiedNumber('+8613800138000', { messagesOnly: true })).toMatchObject({ ok: false, reason: 'country_not_allowed', country: 'CN' });
    expect(isMessagesOnlyNumber('+989121234567')).toBe(true);
    expect(isMessagesOnlyNumber('+4915112345678')).toBe(false);
    expect(isMessagesOnlyNumber(null)).toBe(false);
  });
});
