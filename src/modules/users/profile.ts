import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import type { Queryable } from '../../db/drizzle';
import { listings, locations, users } from '../../db/schema';
import { foldLatin } from '../../lib/fold-latin';
import { normalizePersian } from '../../lib/normalize-persian';
import { hit, type Limit } from '../../lib/rate-limit';
import { messages } from '../../messages/fa';
import { upcomingEvents, type EventCardRow } from '../events/queries';
import { coverKeys } from '../listings/queries';
import { cardColumns, decodeCursor, encodeCursor, PAGE_SIZE, type BrowseItem } from '../search/browse';

// The name others see (seller box, chat, the seller page), set on /account/name or when
// publishing the first listing. Accounts start as «کاربر» (src/modules/users/auth.ts).

export const MAX_DISPLAY_NAME = 50;
const MIN_DISPLAY_NAME = 2;

/**
 * Parts a name may not contain, compared without spaces or ZWNJ on the normalized and folded
 * text: the brand, staff and support (against impersonation), and the deleted-account name.
 */
const RESERVED = ['پیدو', 'پشتیبانی', 'مدیرسایت', 'کاربرحذفشده', 'peydoo', 'admin', 'support'];

export type DisplayNameError = 'required' | 'too_short' | 'too_long' | 'reserved';

/** Spaces collapsed and trimmed, as in the other text fields */
const clean = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim();

function compact(s: string): string {
  return foldLatin(normalizePersian(s)).replace(/[\s‌]+/g, '');
}

export function checkDisplayName(raw: string): { ok: true; name: string } | { ok: false; error: DisplayNameError } {
  const name = clean(raw);
  if (!name) return { ok: false, error: 'required' };
  if ([...name].length > MAX_DISPLAY_NAME) return { ok: false, error: 'too_long' };
  if ([...name].length < MIN_DISPLAY_NAME) return { ok: false, error: 'too_short' };
  const c = compact(name);
  if (RESERVED.some((r) => c.includes(r))) return { ok: false, error: 'reserved' };
  return { ok: true, name };
}

/** Whether the account still has the placeholder name it was created with */
export function isPlaceholderName(name: string): boolean {
  return name === messages.account.defaultDisplayName;
}

export const RENAME_LIMIT: Limit = { name: 'rename:user:1d', max: 10, windowSeconds: 86_400 };

export const displayNameInput = z.object({ displayName: z.string().max(500) });

export type RenameResult = { ok: true; name: string } | { ok: false; error: DisplayNameError | 'rate_limited' };

/** Sets the signed-in user's own name. The user id comes from the session, never from the form. */
export async function setDisplayName(db: Queryable, redis: Redis, userId: string, raw: string): Promise<RenameResult> {
  const checked = checkDisplayName(raw);
  if (!checked.ok) return checked;
  const limited = await hit(redis, [[RENAME_LIMIT, userId]]);
  if (!limited.ok) return { ok: false, error: 'rate_limited' };
  await db
    .update(users)
    .set({ displayName: checked.name, displayNameNormalized: normalizePersian(checked.name) })
    .where(eq(users.id, userId));
  return checked;
}

// The public seller page, /u/{token} (approved Oct 21, 2026). Only what the seller box on a
// listing already shows: the name, the month the account was made and whether the phone is
// verified, plus their active listings and upcoming events. Never the email, the phone number or
// an internal id; listings posted for an organization belong to its own page later.

const TOKEN = /^[0-9a-hjkmnp-tv-z]{10}$/;

export function sellerPath(publicToken: string): string {
  return `/u/${publicToken}`;
}

export type SellerProfile = {
  name: string;
  memberSince: Date;
  phoneVerified: boolean;
  /** The viewer is this seller */
  isOwner: boolean;
  listings: BrowseItem[];
  /** Cursor of the next page of listings, or null */
  next: string | null;
  events: EventCardRow[];
};

/** Null for an unknown token and for deactivated or deleted accounts */
export async function sellerProfile(
  db: Queryable,
  token: string,
  opts: { viewerId?: string | null; after?: string | null; now?: Date } = {},
): Promise<SellerProfile | null> {
  if (!TOKEN.test(token)) return null;
  const [seller] = await db
    .select({
      id: users.id,
      name: users.displayName,
      createdAt: users.createdAt,
      phoneVerified: sql<boolean>`${users.phoneVerifiedAt} IS NOT NULL`,
    })
    .from(users)
    .where(and(eq(users.publicToken, token), eq(users.status, 'active')));
  if (!seller) return null;

  const after = decodeCursor(opts.after ?? null, 'newest');
  const rows = await db
    // The cursor needs microseconds, which a Date loses
    .select({ ...cardColumns, cursorKey: sql<string>`to_char(${listings.rankedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')` })
    .from(listings)
    .leftJoin(locations, eq(locations.id, listings.locationId))
    .where(
      and(
        eq(listings.userId, seller.id),
        eq(listings.status, 'active'),
        isNull(listings.organizationId),
        sql`NOT EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = ${listings.id})`,
        after ? sql`(${listings.rankedAt}, ${listings.id}) < (${after.key}::timestamptz, ${after.id}::uuid)` : undefined,
      ),
    )
    .orderBy(desc(listings.rankedAt), desc(listings.id))
    .limit(PAGE_SIZE + 1);
  const page = rows.slice(0, PAGE_SIZE);
  const covers = await coverKeys(db, page.map((r) => r.id));
  const last = page.at(-1);
  // Events only on the first page; a seller rarely has more than a page of them
  const events = after ? [] : (await upcomingEvents(db, { sellerId: seller.id, from: opts.now ?? new Date(), to: null }, opts.now)).items;

  return {
    name: seller.name,
    memberSince: seller.createdAt,
    phoneVerified: seller.phoneVerified,
    isOwner: !!opts.viewerId && opts.viewerId === seller.id,
    listings: page.map(({ cursorKey: _k, ...r }) => ({ ...r, coverKey: covers.get(r.id) ?? null, distanceKm: null })),
    next: rows.length > PAGE_SIZE && last ? encodeCursor(last.cursorKey, last.id) : null,
    events,
  };
}
