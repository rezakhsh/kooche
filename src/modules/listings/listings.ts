import { and, eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db, Queryable } from '../../db/drizzle';
import { countries, listingImages, listings, users, type PRICE_TYPES } from '../../db/schema';
import type { Point } from '../../db/types';
import { distanceMeters, snapToGrid } from '../../lib/geo';
import { normalizePersian } from '../../lib/normalize-persian';
import { publicToken } from '../../lib/tokens';
import { messages } from '../../messages/fa';
import { reviewPolicy } from '../moderation/policy';
import { canPostListing, loadActor, type Denied } from '../users/permissions';
import { keepRetired, validateAttributes, type AttributeErrorCode } from './attributes';
import { cachedCatalog, effectiveAttributes, isPostable, type Catalog, type CategoryNode } from './catalog';
import { LISTING_OUTBOX, recordChange } from './events';
import { MAX_AREA_DISTANCE_M, nearestPostalPlace, placeByValue, resolvePlace, type Place } from './places';
import { MAX_PRICE_MINOR, parseAmount } from './price';

// Posting and managing listings (docs/schema.md, section 8). Every function takes the owner's
// user id and finds the listing with `user_id = owner` in the same query, so nobody else's
// listing is ever touched: another user's listing simply isn't found. Every status change writes
// listing_events and an outbox event in the same transaction (./events.ts).

type Listing = typeof listings.$inferSelect;
type PriceType = (typeof PRICE_TYPES)[number];

/** At most 10 photos per listing (decided Oct 17, 2026), fewer where a category says so */
export const MAX_IMAGES_PER_LISTING = 10;
/** Listing duration, renewable with one tap (decided Oct 17, 2026); categories may set their own */
export const RENEW_WINDOW_DAYS = 3;
const MIN_TITLE = 3;
const MAX_TITLE = 90;
const MIN_DESCRIPTION = 10;
const MAX_DESCRIPTION = 5000;
const MAX_DISTRICT = 60;
const MAX_DISPLAY_NAME = 50;

const DAY_MS = 86_400_000;

/** Statuses whose content the owner may edit */
const EDITABLE = new Set<Listing['status']>(['draft', 'active', 'paused', 'expired', 'rejected']);

export function maxImages(category: CategoryNode | undefined): number {
  return Math.min(MAX_IMAGES_PER_LISTING, category?.maxImages ?? MAX_IMAGES_PER_LISTING);
}

/** Price types a category allows (categories.price_mode) */
export function priceTypesFor(mode: CategoryNode['priceMode']): readonly PriceType[] {
  if (mode === 'none') return [];
  const base: PriceType[] = ['fixed', 'negotiable', 'free', 'exchange'];
  return mode === 'optional' ? [...base, 'on_request'] : base;
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/** What the posting form sends, already read from FormData (src/app/my/listings/actions.ts) */
export const listingInputSchema = z.object({
  kind: z.enum(['offer', 'wanted']).default('offer'),
  title: z.string().max(500).default(''),
  description: z.string().max(20_000).default(''),
  attributes: z.record(z.string(), z.unknown()).default({}),
  priceType: z.enum(['fixed', 'negotiable', 'free', 'exchange', 'on_request']).default('fixed'),
  amount: z.string().max(40).default(''),
  /** The listing's country (ISO code). Its default currency is the listing's currency. */
  countryCode: z.string().max(2).default(''),
  /** A suggestion the seller picked (`p:<postal place id>` or `c:<city id>`), if any */
  placeValue: z.string().max(40).default(''),
  /** What is in the place field: a postal code or a town, resolved here when nothing was picked */
  place: z.string().max(200).default(''),
  district: z.string().max(500).default(''),
  /** "Use my location": already snapped by the browser; snapped again here */
  area: z.object({ lat: z.number(), lng: z.number() }).nullable().default(null),
  /** Save this place on the account for the next listings */
  rememberPlace: z.boolean().default(false),
  allowPhoneContact: z.boolean().default(false),
  shippingOffered: z.boolean().default(false),
  /** Asked only while the account still has the placeholder name */
  displayName: z.string().max(500).optional(),
});
export type ListingInput = z.infer<typeof listingInputSchema>;

export type FieldError =
  | 'required'
  | 'too_short'
  | 'too_long'
  | 'invalid'
  | 'not_allowed'
  | 'too_far'
  | 'not_found'
  | 'ambiguous'
  | AttributeErrorCode;
/** Field name (`title`, `amount`, `attr.fuel`…) → error code */
export type FieldErrors = Record<string, FieldError>;

type Prepared = {
  values: {
    kind: Listing['kind'];
    title: string;
    titleNormalized: string;
    description: string;
    descriptionNormalized: string;
    attributes: Record<string, unknown>;
    priceType: PriceType;
    priceMinor: number | null;
    currency: string | null;
    countryCode: string | null;
    locationId: string | null;
    postalCode: string | null;
    placeName: string | null;
    district: string | null;
    districtNormalized: string | null;
    point: Point | null;
    locationPrecision: Listing['locationPrecision'];
    allowPhoneContact: boolean;
    shippingOffered: boolean;
  };
  displayName: string | null;
  /** The place as resolved, for "remember for my next listings" */
  place: Place | null;
};

const clean = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim();
/** Keeps line breaks (at most one empty line in a row), trims each line */
const cleanText = (s: string) =>
  s
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[^\S\n]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/**
 * Checks the input against the category and turns it into column values. `publish` applies every
 * rule for a listing that is or goes live; `draft` only the limits the database has, so a draft
 * can be saved half-finished (docs/schema.md, decision 9).
 */
async function prepare(
  tx: Queryable,
  catalog: Catalog,
  category: CategoryNode,
  current: Listing,
  input: ListingInput,
  mode: 'draft' | 'publish',
  needsName: boolean,
): Promise<{ ok: true; prepared: Prepared } | { ok: false; errors: FieldErrors }> {
  const errors: FieldErrors = {};
  const publish = mode === 'publish';

  const title = clean(input.title);
  if (title.length > MAX_TITLE) errors.title = 'too_long';
  else if (publish && title.length === 0) errors.title = 'required';
  else if (publish && title.length < MIN_TITLE) errors.title = 'too_short';

  const description = cleanText(input.description);
  if (description.length > MAX_DESCRIPTION) errors.description = 'too_long';
  else if (publish && description.length === 0) errors.description = 'required';
  else if (publish && description.length < MIN_DESCRIPTION) errors.description = 'too_short';

  // Attributes: the category's own and inherited definitions; retired fields keep their values
  const defs = effectiveAttributes(catalog, category.id);
  const attrs = validateAttributes(defs, input.attributes, mode);
  if (!attrs.ok) for (const [k, code] of Object.entries(attrs.errors)) errors[`attr.${k}`] = code;
  const attributes = {
    ...keepRetired(defs, current.attributes as Record<string, unknown>),
    ...(attrs.ok ? attrs.value : {}),
  };

  // Location (decided Oct 17, 2026): a country, then a postal code or town from our own data, or
  // the browser's position. The point is never the seller's exact position: the browser location
  // snapped to the ~500 m grid (here again), else the centre of the postal-code area, else the
  // city centre. The listing joins the city its postal code leads to.
  let country: { code: string; defaultCurrency: string } | undefined;
  if (input.countryCode) {
    [country] = await tx
      .select({ code: countries.code, defaultCurrency: countries.defaultCurrency })
      .from(countries)
      .where(and(eq(countries.code, input.countryCode.toUpperCase()), eq(countries.isActive, true)));
    if (!country) errors.countryCode = 'invalid';
  } else if (publish) {
    errors.countryCode = 'required';
  }

  let snapped: Point | null = null;
  if (input.area) {
    try {
      snapped = snapToGrid(input.area);
    } catch {
      errors.area = 'invalid';
    }
  }

  let place: Place | null = null;
  if (country) {
    const text = clean(input.place);
    const picked = input.placeValue ? await placeByValue(tx, country.code, input.placeValue) : null;
    if (picked) place = picked;
    else if (text) {
      const r = await resolvePlace(tx, country.code, text);
      if (typeof r === 'string') errors.place = r;
      else place = r;
    } else if (snapped) {
      place = await nearestPostalPlace(tx, country.code, snapped);
      if (!place) errors.area = 'too_far';
    }
    if (place && snapped && distanceMeters(snapped, place.center) > MAX_AREA_DISTANCE_M) errors.area = 'too_far';
    if (!place && publish && !errors.place && !errors.area) errors.place = 'required';
  }

  const countryCode: string | null = country?.code ?? null;
  let locationId: string | null = null;
  let postalCode: string | null = null;
  let placeName: string | null = null;
  let point: Point | null = null;
  let locationPrecision: Listing['locationPrecision'] = null;
  if (place && !errors.area) {
    locationId = place.locationId;
    if (place.kind === 'postal') {
      postalCode = place.postalCode;
      placeName = place.placeName;
    }
    point = snapped ?? place.center;
    locationPrecision = snapped ? 'area' : place.kind === 'postal' ? 'postal_code' : 'city';
  }

  // Price: the allowed types depend on the category; fixed and negotiable need an amount. The
  // currency is always the country's (decided Oct 17, 2026), never the seller's choice.
  const allowed = priceTypesFor(category.priceMode);
  let priceType: PriceType = input.priceType;
  let priceMinor: number | null = null;
  let currency: string | null = null;
  if (allowed.length === 0) {
    // No price in this category (jobs, volunteering): stored as "on request", never shown
    priceType = 'on_request';
  } else if (!allowed.includes(priceType)) {
    errors.priceType = 'not_allowed';
  } else if (priceType === 'fixed' || priceType === 'negotiable') {
    const cur = country ? catalog.currencies.get(country.defaultCurrency) : undefined;
    if (input.amount.trim() === '') {
      if (publish) errors.amount = 'required';
    } else if (!cur) {
      // An amount needs a country to know its currency
      errors.countryCode ??= 'required';
    } else {
      const minor = parseAmount(input.amount, cur.minorUnit);
      if (minor === null || minor > MAX_PRICE_MINOR) errors.amount = 'invalid';
      else {
        priceMinor = minor;
        currency = cur.code;
      }
    }
  }

  const district = clean(input.district);
  if (district.length > MAX_DISTRICT) errors.district = 'too_long';

  let displayName: string | null = null;
  if (needsName) {
    const name = clean(input.displayName ?? '');
    if (name.length > MAX_DISPLAY_NAME) errors.displayName = 'too_long';
    else if (publish && name.length < 2) errors.displayName = name ? 'too_short' : 'required';
    else if (name) displayName = name;
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    prepared: {
      values: {
        kind: input.kind,
        title,
        titleNormalized: normalizePersian(title),
        description,
        descriptionNormalized: normalizePersian(description),
        attributes,
        priceType,
        priceMinor,
        currency,
        countryCode,
        locationId,
        postalCode,
        placeName,
        district: district || null,
        districtNormalized: district ? normalizePersian(district) : null,
        point,
        locationPrecision,
        allowPhoneContact: input.allowPhoneContact,
        shippingOffered: input.shippingOffered,
      },
      displayName,
      place,
    },
  };
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export type Refusal = Denied | 'not_found' | 'not_allowed' | 'category_not_postable' | 'business_only';
export type Refused = { ok: false; reason: Refusal };

/** The owner's listing, locked for the rest of the transaction. Deleted ones are not found. */
async function lockOwn(tx: Queryable, userId: string, listingId: string): Promise<Listing | null> {
  const [row] = await tx
    .select()
    .from(listings)
    .where(and(eq(listings.id, listingId), eq(listings.userId, userId), ne(listings.status, 'deleted')))
    .for('update');
  return row ?? null;
}

/** Columns of the account's saved place (users.home_*) for a place and district */
export function savedPlaceColumns(place: Place, district: string | null) {
  return {
    homeLocationId: place.locationId,
    homePostalCode: place.kind === 'postal' ? place.postalCode : null,
    homePlaceName: place.kind === 'postal' ? place.placeName : null,
    homeDistrict: district,
  };
}

async function needsDisplayName(tx: Queryable, userId: string): Promise<boolean> {
  const [u] = await tx.select({ name: users.displayName }).from(users).where(eq(users.id, userId));
  return u?.name === messages.account.defaultDisplayName;
}

/** Starts a listing in a category: a draft, so photos can be uploaded before it is published */
export async function createDraft(
  db: Db,
  { userId, categoryId }: { userId: string; categoryId: string },
): Promise<{ ok: true; listingId: string } | Refused> {
  const catalog = await cachedCatalog(db);
  return db.transaction(async (tx) => {
    const allowed = canPostListing(await loadActor(tx, userId));
    if (!allowed.ok) return allowed;
    if (!isPostable(catalog, categoryId)) return { ok: false, reason: 'category_not_postable' };
    // Business-only categories need organizations, which come later
    if (catalog.byId.get(categoryId)!.businessOnly) return { ok: false, reason: 'business_only' };

    for (let attempt = 0; ; attempt++) {
      const [row] = await tx
        .insert(listings)
        .values({ publicToken: publicToken(), userId, categoryId })
        .onConflictDoNothing({ target: listings.publicToken })
        .returning({ id: listings.id });
      if (row) {
        await recordChange(tx, {
          listingId: row.id,
          event: 'created',
          outbox: LISTING_OUTBOX.created,
          actorType: 'user',
          actorUserId: userId,
          from: null,
          to: 'draft',
          revision: 1,
        });
        return { ok: true, listingId: row.id };
      }
      if (attempt >= 3) throw new Error('Could not generate a unique listing token');
    }
  });
}

/** A draft can still move to another category; its attribute values are checked again on save */
export async function changeDraftCategory(
  db: Db,
  { userId, listingId, categoryId }: { userId: string; listingId: string; categoryId: string },
): Promise<{ ok: true } | Refused> {
  const catalog = await cachedCatalog(db);
  return db.transaction(async (tx) => {
    const listing = await lockOwn(tx, userId, listingId);
    if (!listing) return { ok: false, reason: 'not_found' };
    if (listing.status !== 'draft') return { ok: false, reason: 'not_allowed' };
    if (!isPostable(catalog, categoryId)) return { ok: false, reason: 'category_not_postable' };
    if (catalog.byId.get(categoryId)!.businessOnly) return { ok: false, reason: 'business_only' };
    const keys = new Set(effectiveAttributes(catalog, categoryId).map((d) => d.key));
    const attributes = Object.fromEntries(
      Object.entries(listing.attributes as Record<string, unknown>).filter(([k]) => keys.has(k)),
    );
    await tx.update(listings).set({ categoryId, attributes }).where(eq(listings.id, listing.id));
    return { ok: true };
  });
}

export type SaveResult =
  | { ok: true; status: Listing['status']; publicToken: string }
  | Refused
  | { ok: false; reason: 'invalid'; errors: FieldErrors };

const CONTENT_FIELDS = [
  'kind',
  'title',
  'description',
  'attributes',
  'priceType',
  'priceMinor',
  'currency',
  'locationId',
  'postalCode',
  'placeName',
  'district',
  'point',
  'locationPrecision',
  'allowPhoneContact',
  'shippingOffered',
] as const;

/** JSON with object keys sorted: jsonb hands keys back in its own order */
function canonical(v: unknown): string {
  return JSON.stringify(v ?? null, (_, x) =>
    x && typeof x === 'object' && !Array.isArray(x) && !(x instanceof Date)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1)))
      : x,
  );
}

function changedFields(before: Listing, after: Prepared['values']): Record<string, [unknown, unknown]> {
  const diff: Record<string, [unknown, unknown]> = {};
  for (const f of CONTENT_FIELDS) {
    const a = before[f];
    const b = after[f];
    if (canonical(a) !== canonical(b)) diff[f] = [a ?? null, b ?? null];
  }
  return diff;
}

/**
 * Saves the posting form. A draft is saved as it is (`save`) or published (`publish`). A listing
 * that is already out (active, paused, expired) is always checked fully and stays in its status;
 * an edit of an active listing stays live and goes through the same post-checks (decided
 * Oct 17, 2026). A rejected listing is sent again with `publish` and is checked before it goes
 * live again.
 */
export async function saveListing(
  db: Db,
  opts: { userId: string; listingId: string; input: ListingInput; intent: 'save' | 'publish'; now?: Date },
): Promise<SaveResult> {
  const catalog = await cachedCatalog(db);
  const now = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    const allowed = canPostListing(await loadActor(tx, opts.userId));
    if (!allowed.ok) return allowed;
    const listing = await lockOwn(tx, opts.userId, opts.listingId);
    if (!listing) return { ok: false, reason: 'not_found' };
    if (!EDITABLE.has(listing.status)) return { ok: false, reason: 'not_allowed' };
    const category = listing.categoryId ? catalog.byId.get(listing.categoryId) : undefined;
    if (!category) return { ok: false, reason: 'category_not_postable' };
    const goingOut = opts.intent === 'publish' && (listing.status === 'draft' || listing.status === 'rejected');
    if (goingOut && (!isPostable(catalog, category.id) || category.businessOnly)) {
      return { ok: false, reason: 'category_not_postable' };
    }

    const mode = listing.status === 'draft' && !goingOut ? 'draft' : 'publish';
    const needsName = await needsDisplayName(tx, opts.userId);
    const result = await prepare(tx, catalog, category, listing, opts.input, mode, needsName);
    if (!result.ok) return { ok: false, reason: 'invalid', errors: result.errors };
    const { values, displayName, place } = result.prepared;

    if (displayName) {
      await tx
        .update(users)
        .set({ displayName, displayNameNormalized: normalizePersian(displayName) })
        .where(eq(users.id, opts.userId));
    }
    // "Remember for my next listings": the postal code, place and district, never the position
    if (opts.input.rememberPlace && place) await tx.update(users).set(savedPlaceColumns(place, values.district)).where(eq(users.id, opts.userId));

    const diff = changedFields(listing, values);
    const changed = Object.keys(diff).length > 0;
    // Drafts aren't public: no history or outbox until they are published
    const revision = listing.status !== 'draft' && changed ? listing.revision + 1 : listing.revision;
    let status = listing.status;
    const dates: Partial<Listing> = {};

    if (goingOut) {
      const policy = reviewPolicy({
        categoryId: category.id,
        userId: opts.userId,
        resubmission: listing.status === 'rejected',
      });
      if (policy === 'publish') {
        status = 'active';
        dates.publishedAt = listing.publishedAt ?? now;
        dates.rankedAt = listing.rankedAt ?? now;
        dates.expiresAt = new Date(now.getTime() + category.listingDurationDays * DAY_MS);
      } else {
        status = 'pending_review';
      }
      dates.statusChangedAt = now;
    }

    await tx
      .update(listings)
      .set({ ...values, ...dates, status, revision })
      .where(eq(listings.id, listing.id));

    if (listing.status !== 'draft' && changed) {
      await recordChange(tx, {
        listingId: listing.id,
        event: 'edited',
        // The post-checks run on every edit of a listing that is out
        outbox: goingOut ? null : LISTING_OUTBOX.updated,
        actorType: 'user',
        actorUserId: opts.userId,
        from: listing.status,
        to: listing.status,
        revision,
        data: diff,
      });
    }
    if (goingOut) {
      await recordChange(tx, {
        listingId: listing.id,
        event: status === 'active' ? 'published' : 'submitted',
        outbox: status === 'active' ? LISTING_OUTBOX.published : LISTING_OUTBOX.submitted,
        actorType: 'user',
        actorUserId: opts.userId,
        from: listing.status,
        to: status,
        revision,
      });
    }
    return { ok: true, status, publicToken: listing.publicToken };
  });
}

export type StatusAction = 'pause' | 'resume' | 'sold' | 'renew' | 'delete';

/** Whether an action is offered for a listing in this state (also used by "my listings") */
export function canApply(action: StatusAction, l: Pick<Listing, 'status' | 'expiresAt'>, now = new Date()): boolean {
  switch (action) {
    case 'pause':
      return l.status === 'active';
    case 'resume':
      return l.status === 'paused';
    case 'sold':
      return l.status === 'active' || l.status === 'paused';
    case 'renew':
      return (
        l.status === 'expired' ||
        (l.status === 'active' && !!l.expiresAt && l.expiresAt.getTime() - now.getTime() <= RENEW_WINDOW_DAYS * DAY_MS)
      );
    case 'delete':
      return l.status !== 'deleted';
  }
}

/**
 * Pause, resume, mark sold, renew or delete (soft) one of the owner's listings. Renewing sets a
 * fresh duration from now and doesn't touch ranked_at: only publication and paid bumps move a
 * listing up (docs/schema.md, decision 16.1). Resuming a paused listing whose time ran out while
 * it was paused renews it too.
 */
export async function changeListingStatus(
  db: Db,
  opts: { userId: string; listingId: string; action: StatusAction; now?: Date },
): Promise<{ ok: true; status: Listing['status'] } | Refused> {
  const catalog = await cachedCatalog(db);
  const now = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    const actor = await loadActor(tx, opts.userId);
    // Going (back) out needs a verified phone like posting; taking a listing down only a session
    const needsPhone = opts.action === 'renew' || opts.action === 'resume';
    const allowed = needsPhone
      ? canPostListing(actor)
      : actor && actor.status === 'active'
        ? ({ ok: true } as const)
        : ({ ok: false, reason: actor ? 'account_disabled' : 'sign_in_required' } as const);
    if (!allowed.ok) return allowed;

    const listing = await lockOwn(tx, opts.userId, opts.listingId);
    if (!listing) return { ok: false, reason: 'not_found' };
    if (!canApply(opts.action, listing, now)) return { ok: false, reason: 'not_allowed' };
    const duration = (catalog.byId.get(listing.categoryId ?? '')?.listingDurationDays ?? 30) * DAY_MS;
    const freshExpiry = new Date(now.getTime() + duration);

    const set: Partial<Listing> = { statusChangedAt: now };
    let event: 'paused' | 'resumed' | 'sold' | 'renewed' | 'deleted';
    let to: Listing['status'];
    let data: Record<string, unknown> = {};
    switch (opts.action) {
      case 'pause':
        [event, to] = ['paused', 'paused'];
        break;
      case 'resume':
        [event, to] = ['resumed', 'active'];
        if (!listing.expiresAt || listing.expiresAt <= now) {
          set.expiresAt = freshExpiry;
          data = { expires_at: [listing.expiresAt, freshExpiry] };
        }
        break;
      case 'sold':
        [event, to] = ['sold', 'sold'];
        break;
      case 'renew':
        [event, to] = ['renewed', 'active'];
        set.expiresAt = freshExpiry;
        data = { expires_at: [listing.expiresAt, freshExpiry] };
        break;
      case 'delete':
        [event, to] = ['deleted', 'deleted'];
        set.deletedAt = now;
        break;
    }
    // A draft never published has no dates; it can only be deleted, which needs none
    await tx.update(listings).set({ ...set, status: to }).where(eq(listings.id, listing.id));
    await recordChange(tx, {
      listingId: listing.id,
      event,
      outbox: LISTING_OUTBOX[event],
      actorType: 'user',
      actorUserId: opts.userId,
      from: listing.status,
      to,
      revision: listing.revision,
      data,
    });
    return { ok: true, status: to };
  });
}

// ---------------------------------------------------------------------------
// Worker: expiry
// ---------------------------------------------------------------------------

const EXPIRE_BATCH = 500;
const MAX_EXPIRE_BATCHES = 100;

/**
 * Expires active listings whose time is up, in batches, each listing with its history row and
 * outbox event in the same statement. Runs as classifieds_worker every 15 minutes. Returns the
 * number expired.
 */
export async function expireDueListings(db: Queryable, now: Date = new Date()): Promise<number> {
  let total = 0;
  for (let i = 0; i < MAX_EXPIRE_BATCHES; i++) {
    const rows = await db.execute<{ id: string }>(sql`
      WITH due AS (
        SELECT id FROM listings
        WHERE status = 'active' AND expires_at <= ${now.toISOString()}::timestamptz
        ORDER BY expires_at
        LIMIT ${EXPIRE_BATCH}
        FOR UPDATE SKIP LOCKED
      ), expired AS (
        UPDATE listings l SET status = 'expired', status_changed_at = ${now.toISOString()}::timestamptz
        FROM due WHERE l.id = due.id
        RETURNING l.id, l.revision
      ), history AS (
        INSERT INTO listing_events (listing_id, event_type, actor_type, from_status, to_status, revision)
        SELECT id, 'expired', 'system', 'active', 'expired', revision FROM expired
      )
      INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
      SELECT ${LISTING_OUTBOX.expired}, 'listing', id,
             jsonb_build_object('revision', revision, 'from', 'active', 'to', 'expired')
      FROM expired
      RETURNING aggregate_id AS id
    `);
    total += rows.length;
    if (rows.length < EXPIRE_BATCH) break;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** The owner's listing for the edit form, with its images in order */
export async function ownListing(db: Queryable, userId: string, listingId: string) {
  const [listing] = await db
    .select()
    .from(listings)
    .where(and(eq(listings.id, listingId), eq(listings.userId, userId), ne(listings.status, 'deleted')));
  if (!listing) return null;
  const images = await db
    .select()
    .from(listingImages)
    .where(eq(listingImages.listingId, listing.id))
    .orderBy(listingImages.position);
  return { listing, images };
}
