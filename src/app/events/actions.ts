'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { appDb } from '../../db/drizzle';
import { hit } from '../../lib/rate-limit';
import { valkey } from '../../lib/valkey';
import { messages } from '../../messages/fa';
import { cancelEvent, copyEvent, createEventDraft, saveEvent } from '../../modules/events/events';
import { eventInputSchema } from '../../modules/events/input';
import { ownEvent } from '../../modules/events/queries';
import { eventPath } from '../../modules/events/slug';
import { cachedCatalog, isEventCategory } from '../../modules/listings/catalog';
import { LISTING_LIMITS } from '../../modules/listings/limits';
import { changeDraftCategory, changeListingStatus, listingInputSchema, type FieldErrors } from '../../modules/listings/listings';
import { requireSession } from '../../modules/users/server';

// The event form and the buttons on "my events". The listing part of the form has the same
// field names as the listing form; the event's own fields are read here too.

export type EventSaveState = { errors?: FieldErrors; error?: string; notice?: string; listingId?: string } | undefined;

const uuid = z.uuid();

function refusal(reason: string): string {
  switch (reason) {
    case 'phone_required':
      return messages.post.phoneRequired;
    case 'account_disabled':
      return messages.post.accountDisabled;
    case 'not_allowed':
      return messages.events.form.ended;
    case 'category_not_postable':
    case 'business_only':
      return messages.post.categoryNotPostable;
    case 'too_many_events':
      return messages.events.form.tooManyEvents;
    default:
      return messages.genericError;
  }
}

function number(v: FormDataEntryValue | null): number | null {
  const n = typeof v === 'string' && v !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

const str = (form: FormData, name: string) => (typeof form.get(name) === 'string' ? String(form.get(name)) : undefined);

/** Starts the event's draft in an event type (rate-limited like listing drafts) */
async function startDraft(userId: string, categoryId: unknown): Promise<{ ok: true; listingId: string } | { ok: false; error: string }> {
  const id = uuid.safeParse(categoryId);
  if (!id.success) return { ok: false, error: messages.genericError };
  const catalog = await cachedCatalog(appDb());
  if (!isEventCategory(catalog, id.data)) return { ok: false, error: messages.post.categoryNotPostable };
  const limited = await hit(valkey(), [[LISTING_LIMITS.draftsPerUserDay, userId]]);
  if (!limited.ok) return { ok: false, error: messages.post.tooManyDrafts };
  const r = await createEventDraft(appDb(), { userId, categoryId: id.data });
  return r.ok ? r : { ok: false, error: refusal(r.reason) };
}

/** The photo editor's first photo on an event that isn't saved yet */
export async function startEventDraftAction(categoryId: string): Promise<{ ok: true; listingId: string } | { ok: false; error: string }> {
  const { user } = await requireSession('/events/new');
  return startDraft(user.id, categoryId);
}

export async function saveEventAction(_: EventSaveState, form: FormData): Promise<EventSaveState> {
  const { user } = await requireSession('/my/events');
  let listingId = String(form.get('listingId') ?? '');
  let created: string | undefined;
  if (!listingId) {
    const draft = await startDraft(user.id, form.get('categoryId'));
    if (!draft.ok) return { error: draft.error, errors: form.get('categoryId') ? undefined : { categoryId: 'required' } };
    listingId = created = draft.listingId;
  }
  if (!uuid.safeParse(listingId).success) return { error: messages.genericError };
  const db = appDb();
  const own = await ownEvent(db, user.id, listingId);
  if (!own) return { error: messages.genericError, listingId: created };

  // A draft may still change its type
  const categoryId = String(form.get('categoryId') ?? '');
  if (own.listing.status === 'draft' && uuid.safeParse(categoryId).success && categoryId !== own.listing.categoryId) {
    const moved = await changeDraftCategory(db, { userId: user.id, listingId, categoryId });
    if (!moved.ok) return { error: refusal(moved.reason), listingId: created };
  }

  const lat = number(form.get('areaLat'));
  const lng = number(form.get('areaLng'));
  const listingInput = listingInputSchema.safeParse({
    title: str(form, 'title'),
    description: str(form, 'description'),
    priceType: str(form, 'priceType'),
    amount: str(form, 'amount'),
    countryCode: str(form, 'countryCode'),
    placeValue: str(form, 'placeValue'),
    place: str(form, 'place'),
    area: lat !== null && lng !== null ? { lat, lng } : null,
    rememberPlace: false,
    allowPhoneContact: form.get('allowPhoneContact') === 'on',
    displayName: str(form, 'displayName'),
  });
  const eventInput = eventInputSchema.safeParse({
    startDate: str(form, 'startDate'),
    startTime: str(form, 'startTime'),
    endDate: str(form, 'endDate'),
    endTime: str(form, 'endTime'),
    repeat: str(form, 'repeat') || undefined,
    repeatUntil: str(form, 'repeatUntil'),
    attendance: str(form, 'attendance') || undefined,
    venueName: str(form, 'venueName'),
    streetAddress: str(form, 'streetAddress'),
    onlineUrl: str(form, 'onlineUrl'),
    ticketUrl: str(form, 'ticketUrl'),
    organizerName: str(form, 'organizerName'),
    languages: form.getAll('languages').map(String),
    minAge: str(form, 'minAge'),
    scheduleStatus: str(form, 'scheduleStatus') || undefined,
  });
  if (!listingInput.success || !eventInput.success) return { error: messages.form.fixErrors, listingId: created };

  const intent = form.get('intent') === 'publish' ? 'publish' : 'save';
  const r = await saveEvent(db, { userId: user.id, listingId, input: listingInput.data, event: eventInput.data, intent });
  if (!r.ok) {
    if (r.reason === 'invalid') return { errors: r.errors, error: messages.form.fixErrors, listingId: created };
    return { error: refusal(r.reason), listingId: created };
  }
  if (intent === 'publish' && r.status === 'active' && own.listing.status === 'draft') {
    redirect(`${eventPath(listingInput.data.title, r.publicToken)}?published=1`);
  }
  return { notice: r.status === 'pending_review' ? messages.form.submitted : messages.form.saved, listingId: created };
}

const statusSchema = z.object({
  listingId: z.uuid(),
  action: z.enum(['pause', 'resume', 'delete', 'cancel', 'copy']),
});

/** The buttons on "my events" */
export async function eventStatusAction(form: FormData): Promise<void> {
  const { user } = await requireSession('/my/events');
  const parsed = statusSchema.safeParse({ listingId: form.get('listingId'), action: form.get('action') });
  if (!parsed.success) redirect('/my/events');
  const { listingId, action } = parsed.data;
  const db = appDb();
  // Only the owner's events: ownEvent finds nothing for anyone else
  if (!(await ownEvent(db, user.id, listingId))) redirect('/my/events?error=not_found');
  if (action === 'copy') {
    const r = await copyEvent(db, { userId: user.id, listingId });
    redirect(r.ok ? `/my/events/${r.listingId}` : `/my/events?error=${r.reason}`);
  }
  const r =
    action === 'cancel'
      ? await cancelEvent(db, { userId: user.id, listingId })
      : await changeListingStatus(db, { userId: user.id, listingId, action });
  redirect(r.ok ? `/my/events?done=${action}` : `/my/events?error=${r.reason}`);
}
