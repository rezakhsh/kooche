import { eq } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { users } from '../../db/schema';
import { activeSanctions, restrictsMessaging, restrictsPosting, type SanctionType } from '../moderation/sanctions';
import { isMessagesOnlyNumber } from './phone-number';

// Who may do what (decided Oct 16, 2026; Iranian numbers, owner, Nov 4, 2026): browsing and
// favorites need no verification; sending a chat message needs a verified phone number, in every
// country (no exception by the visitor's country: many use a VPN); posting a listing, an event or a
// business and seeing a seller's number need a verified number that isn't Iranian. A +98 number is
// accepted only through Telegram, for messages only (./phone-number.ts, MESSAGES_ONLY_COUNTRIES).
// The posting and chat features must call these before they write anything. Sanctions
// (user_sanctions) join here with moderation.

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

/** `local_number_required`: the verified number is good for messages only (+98) */
export type Denied = 'sign_in_required' | 'account_disabled' | 'phone_required' | 'local_number_required' | 'restricted';
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

/** A verified number that may also post: not one of the messages-only countries (Iran) */
function localNumber(actor: Actor | null): Decision {
  const base = verified(actor);
  if (!base.ok) return base;
  return isMessagesOnlyNumber(actor!.phoneE164) ? { ok: false, reason: 'local_number_required' } : { ok: true };
}

/** Posting a listing, an event or a business: a verified non-Iranian number and no posting restriction */
export function canPostListing(actor: Actor | null): Decision {
  const base = localNumber(actor);
  if (!base.ok) return base;
  return restrictsPosting(actor!.restrictions ?? []) ? { ok: false, reason: 'restricted' } : { ok: true };
}

/**
 * Sending a chat message: a verified number (an Iranian one too) and no messaging restriction, from
 * any country. Replaces the Oct 30, 2026 exception that let email accounts write from Iran.
 */
export function canSendMessage(actor: Actor | null): Decision {
  const base = verified(actor);
  if (!base.ok) return base;
  return restrictsMessaging(actor!.restrictions ?? []) ? { ok: false, reason: 'restricted' } : { ok: true };
}

/** Seeing a seller's phone number: as posting, a verified non-Iranian number, and no messaging restriction */
export function canSeePhone(actor: Actor | null): Decision {
  const base = localNumber(actor);
  if (!base.ok) return base;
  return restrictsMessaging(actor!.restrictions ?? []) ? { ok: false, reason: 'restricted' } : { ok: true };
}
export const canFavorite = signedIn;
