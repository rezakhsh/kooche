'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { appDb } from '../../../db/drizzle';
import { hit } from '../../../lib/rate-limit';
import { valkey } from '../../../lib/valkey';
import { messages } from '../../../messages/fa';
import { attributesFromForm } from '../../../modules/listings/attributes';
import { cachedCatalog, effectiveAttributes } from '../../../modules/listings/catalog';
import { LISTING_LIMITS } from '../../../modules/listings/limits';
import {
  changeListingStatus,
  createDraft,
  listingInputSchema,
  ownListing,
  saveListing,
  type FieldErrors,
  type StatusAction,
} from '../../../modules/listings/listings';
import { listingPath } from '../../../modules/listings/slug';
import { confirmUpload, moveImage, removeImage, requestUpload } from '../../../modules/media/images';
import { storage } from '../../../modules/media/server';
import { photoView, type PhotoView } from './photo-view';
import { requireSession } from '../../../modules/users/server';

/** `listingId`: the draft this save created, so the editor uses it from now on */
export type SaveState = { errors?: FieldErrors; error?: string; notice?: string; listingId?: string } | undefined;

const uuid = z.uuid();

function refusal(reason: string): string {
  const t = messages;
  switch (reason) {
    case 'phone_required':
      return t.post.phoneRequired;
    case 'account_disabled':
      return t.post.accountDisabled;
    case 'not_allowed':
      return t.form.notEditable;
    case 'category_not_postable':
    case 'business_only':
      return t.post.categoryNotPostable;
    default:
      return t.genericError;
  }
}

function number(v: FormDataEntryValue | null): number | null {
  const n = typeof v === 'string' && v !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Starts a draft in a category (rate-limited). Called only when there is something to keep: the
 * first save or the first photo. Opening a category creates nothing.
 */
async function startDraft(userId: string, categoryId: unknown): Promise<{ ok: true; listingId: string } | { ok: false; error: string }> {
  const id = uuid.safeParse(categoryId);
  if (!id.success) return { ok: false, error: messages.genericError };
  const limited = await hit(valkey(), [[LISTING_LIMITS.draftsPerUserDay, userId]]);
  if (!limited.ok) return { ok: false, error: messages.post.tooManyDrafts };
  const r = await createDraft(appDb(), { userId, categoryId: id.data });
  return r.ok ? r : { ok: false, error: refusal(r.reason) };
}

/** The photo editor's first photo on a listing that isn't saved yet */
export async function startDraftAction(categoryId: string): Promise<{ ok: true; listingId: string } | { ok: false; error: string }> {
  const { user } = await requireSession('/new');
  return startDraft(user.id, categoryId);
}

/**
 * The posting form. `intent` (the button pressed) is `save` or `publish`. Without `listingId`
 * (a new listing nobody saved yet) it first starts the draft in `categoryId`.
 */
export async function saveListingAction(_: SaveState, form: FormData): Promise<SaveState> {
  const { user } = await requireSession('/my/listings');
  let listingId = String(form.get('listingId') ?? '');
  let created: string | undefined;
  if (!listingId) {
    const draft = await startDraft(user.id, form.get('categoryId'));
    if (!draft.ok) return { error: draft.error };
    listingId = created = draft.listingId;
  }
  if (!uuid.safeParse(listingId).success) return { error: messages.genericError };
  const own = await ownListing(appDb(), user.id, listingId);
  if (!own?.listing.categoryId) return { error: messages.genericError };

  const catalog = await cachedCatalog(appDb());
  const defs = effectiveAttributes(catalog, own.listing.categoryId);
  const lat = number(form.get('areaLat'));
  const lng = number(form.get('areaLng'));
  const parsed = listingInputSchema.safeParse({
    kind: form.get('kind') ?? undefined,
    title: form.get('title') ?? undefined,
    description: form.get('description') ?? undefined,
    attributes: attributesFromForm(defs, form),
    priceType: form.get('priceType') ?? undefined,
    amount: form.get('amount') ?? undefined,
    countryCode: form.get('countryCode') ?? undefined,
    placeValue: form.get('placeValue') ?? undefined,
    place: form.get('place') ?? undefined,
    district: form.get('district') ?? undefined,
    area: lat !== null && lng !== null ? { lat, lng } : null,
    rememberPlace: form.get('rememberPlace') === 'on',
    allowPhoneContact: form.get('allowPhoneContact') === 'on',
    shippingOffered: form.get('shippingOffered') === 'on',
    displayName: typeof form.get('displayName') === 'string' ? String(form.get('displayName')) : undefined,
  });
  if (!parsed.success) return { error: messages.form.fixErrors, listingId: created };

  const intent = form.get('intent') === 'publish' ? 'publish' : 'save';
  const r = await saveListing(appDb(), { userId: user.id, listingId, input: parsed.data, intent });
  if (!r.ok) {
    if (r.reason === 'invalid') return { errors: r.errors, error: messages.form.fixErrors, listingId: created };
    return { error: refusal(r.reason), listingId: created };
  }
  if (intent === 'publish' && r.status === 'active' && own.listing.status === 'draft') {
    redirect(`${listingPath(parsed.data.title, r.publicToken)}?published=1`);
  }
  const t = messages.form;
  return { notice: r.status === 'pending_review' ? t.submitted : t.saved, listingId: created };
}

const statusSchema = z.object({
  listingId: z.uuid(),
  action: z.enum(['pause', 'resume', 'sold', 'renew', 'delete']),
});

/** The buttons on "my listings" */
export async function listingStatusAction(form: FormData): Promise<void> {
  const { user } = await requireSession('/my/listings');
  const parsed = statusSchema.safeParse({ listingId: form.get('listingId'), action: form.get('action') });
  if (!parsed.success) redirect('/my/listings');
  const r = await changeListingStatus(appDb(), {
    userId: user.id,
    listingId: parsed.data.listingId,
    action: parsed.data.action as StatusAction,
  });
  redirect(r.ok ? `/my/listings?done=${parsed.data.action}` : `/my/listings?error=${r.reason}`);
}

// ---------------------------------------------------------------------------
// Photos (called from the photo editor in the browser)
// ---------------------------------------------------------------------------

export type UploadTicket = { ok: true; imageId: string; url: string; headers: Record<string, string> } | { ok: false; error: string };

const uploadSchema = z.object({ listingId: z.uuid(), contentType: z.string().max(100), size: z.number().int() });

export async function requestUploadAction(input: { listingId: string; contentType: string; size: number }): Promise<UploadTicket> {
  const { user } = await requireSession('/my/listings');
  const parsed = uploadSchema.safeParse(input);
  const t = messages.form;
  if (!parsed.success) return { ok: false, error: t.photoUploadFailed };
  const store = storage();
  if (!store) return { ok: false, error: t.photosUnavailable };
  const limited = await hit(valkey(), [[LISTING_LIMITS.uploadsPerUserHour, user.id]]);
  if (!limited.ok) return { ok: false, error: messages.rateLimited(Math.ceil(limited.retryAfterSeconds / 60)) };

  const r = await requestUpload(appDb(), store, { userId: user.id, ...parsed.data });
  if (!r.ok) {
    const error = {
      bad_type: t.photoBadType,
      too_large: t.photoTooLarge,
      too_many: t.photoTooMany,
    }[r.reason as 'bad_type' | 'too_large' | 'too_many'];
    return { ok: false, error: error ?? refusal(r.reason) };
  }
  return { ok: true, imageId: r.imageId, url: r.upload.url, headers: r.upload.headers };
}

export async function confirmUploadAction(imageId: string): Promise<boolean> {
  const { user } = await requireSession('/my/listings');
  if (!uuid.safeParse(imageId).success) return false;
  return (await confirmUpload(appDb(), { userId: user.id, imageId })).ok;
}

export async function removeImageAction(imageId: string): Promise<boolean> {
  const { user } = await requireSession('/my/listings');
  if (!uuid.safeParse(imageId).success) return false;
  return (await removeImage(appDb(), { userId: user.id, imageId })).ok;
}

export async function moveImageAction(imageId: string, to: 'first' | 'earlier' | 'later'): Promise<boolean> {
  const { user } = await requireSession('/my/listings');
  if (!uuid.safeParse(imageId).success || !['first', 'earlier', 'later'].includes(to)) return false;
  return (await moveImage(appDb(), { userId: user.id, imageId, to })).ok;
}

/** The listing's photos in order, for the editor's refresh while photos are being processed */
export async function photosAction(listingId: string): Promise<PhotoView[]> {
  const { user } = await requireSession('/my/listings');
  if (!uuid.safeParse(listingId).success) return [];
  const own = await ownListing(appDb(), user.id, listingId);
  return own ? own.images.map(photoView) : [];
}
