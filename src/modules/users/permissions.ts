import { eq } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { users } from '../../db/schema';
import { activeSanctions, restrictsMessaging, restrictsPosting, type SanctionType } from '../moderation/sanctions';

// Who may do what (decided Oct 16, 2026): browsing and favorites need no verification; posting a
// listing and sending a chat message need a verified phone number. The posting and chat features
// must call these before they write anything. Sanctions (user_sanctions) join here with moderation.

export type Actor = {
  id: string;
  status: 'active' | 'deactivated' | 'deleted';
  phoneVerifiedAt: Date | null;
  /** The verified number, for posting across borders (../listings/zones.ts) */
  phoneE164?: string | null;
  /** For the new-account limits (./new-account.ts) */
  createdAt: Date;
  /** Active sanctions (user_sanctions, set by moderators); none when left out */
  restrictions?: readonly SanctionType[];
};

export type Denied = 'sign_in_required' | 'account_disabled' | 'phone_required' | 'restricted';
export type Decision = { ok: true } | { ok: false; reason: Denied };

export async function loadActor(db: Queryable, userId: string | null | undefined): Promise<Actor | null> {
  if (!userId) return null;
  const [actor] = await db
    .select({ id: users.id, status: users.status, phoneVerifiedAt: users.phoneVerifiedAt, phoneE164: users.phoneE164, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId));
  if (!actor) return null;
  return { ...actor, restrictions: await activeSanctions(db, userId) };
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

/** Posting a listing, an event or a business: a verified phone and no posting restriction */
export function canPostListing(actor: Actor | null): Decision {
  const base = verified(actor);
  if (!base.ok) return base;
  return restrictsPosting(actor!.restrictions ?? []) ? { ok: false, reason: 'restricted' } : { ok: true };
}

/** Sending a chat message or seeing a phone number: a verified phone and no messaging restriction */
export function canSendMessage(actor: Actor | null): Decision {
  const base = verified(actor);
  if (!base.ok) return base;
  return restrictsMessaging(actor!.restrictions ?? []) ? { ok: false, reason: 'restricted' } : { ok: true };
}
export const canFavorite = signedIn;
