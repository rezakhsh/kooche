import { eq } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { users } from '../../db/schema';

// Who may do what (decided Oct 16, 2026): browsing and favorites need no verification; posting a
// listing and sending a chat message need a verified phone number. The posting and chat features
// must call these before they write anything. Sanctions (user_sanctions) join here with moderation.

export type Actor = {
  id: string;
  status: 'active' | 'deactivated' | 'deleted';
  phoneVerifiedAt: Date | null;
};

export type Denied = 'sign_in_required' | 'account_disabled' | 'phone_required';
export type Decision = { ok: true } | { ok: false; reason: Denied };

export async function loadActor(db: Queryable, userId: string | null | undefined): Promise<Actor | null> {
  if (!userId) return null;
  const [actor] = await db
    .select({ id: users.id, status: users.status, phoneVerifiedAt: users.phoneVerifiedAt })
    .from(users)
    .where(eq(users.id, userId));
  return actor ?? null;
}

function signedIn(actor: Actor | null): Decision {
  if (!actor) return { ok: false, reason: 'sign_in_required' };
  if (actor.status !== 'active') return { ok: false, reason: 'account_disabled' };
  return { ok: true };
}

function verified(actor: Actor | null): Decision {
  const base = signedIn(actor);
  if (!base.ok) return base;
  return actor!.phoneVerifiedAt ? { ok: true } : { ok: false, reason: 'phone_required' };
}

export const canPostListing = verified;
export const canSendMessage = verified;
export const canFavorite = signedIn;
