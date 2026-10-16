import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { users } from '../src/db/schema';
import {
  canFavorite,
  canPostListing,
  canSendMessage,
  loadActor,
} from '../src/modules/users/permissions';
import { appDb } from './accounts';
import { db, makeUser, rollback } from './db';

// Decided Oct 16, 2026: posting a listing and sending a message need a verified phone number;
// browsing and favorites don't.

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
