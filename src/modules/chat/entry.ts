import type { Queryable } from '../../db/drizzle';
import { messages } from '../../messages/fa';
import { canSendMessage, loadActor } from '../users/permissions';
import { conversationIdForListing } from './queries';

// The chat button on a listing or event page: where it leads for this visitor.

export type ChatEntry = { href: string; label: string };

export async function chatEntry(
  db: Queryable,
  opts: { userId: string | null; listing: { id: string; publicToken: string }; returnTo: string; fromIran?: boolean },
): Promise<ChatEntry> {
  const t = messages.listing;
  if (!opts.userId) return { href: `/login?next=${encodeURIComponent(opts.returnTo)}`, label: t.contactSignIn };
  const existing = await conversationIdForListing(db, opts.userId, opts.listing.id);
  if (existing) return { href: `/chat/${existing}`, label: t.contactOpen };
  const allowed = canSendMessage(await loadActor(db, opts.userId), { fromIran: opts.fromIran });
  if (!allowed.ok && allowed.reason === 'phone_required') return { href: '/account/phone', label: t.contactPhone };
  return { href: `/chat/new?l=${opts.listing.publicToken}`, label: t.contact };
}
