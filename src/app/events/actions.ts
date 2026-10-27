'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { appDb } from '../../db/drizzle';
import { dateFromForm } from '../../lib/date-parts';
import { hit } from '../../lib/rate-limit';
import { valkey } from '../../lib/valkey';
import { messages } from '../../messages/fa';
import { NEW_ACCOUNT_EVENTS_PER_DAY, cancelEvent, copyEvent, createEventDraft, saveEvent } from '../../modules/events/events';
import { eventInputSchema } from '../../modules/events/input';
import { ownEvent } from '../../modules/events/queries';
import { eventPath } from '../../modules/events/slug';
import { cachedCatalog, isEventCategory } from '../../modules/listings/catalog';
import { LISTING_LIMITS } from '../../modules/listings/limits';
import { changeDraftCategory, changeListingStatus, listingInputSchema, type FieldErrors } from '../../modules/listings/listings';
import { postingCountry } from '../../modules/listings/posting-country';
import { activeCountries, savedPlace } from '../../modules/listings/queries';
import { checkTurnstile } from '../../modules/security/server';
import { requireSession } from '../../modules/users/server';
import { chosenCountry } from '../country-choice';

// The event form and the buttons on "my events". The listing part of the form has the same
// field names as the listing form; the event's own fields are read here too.

/**
 * `missing`: after «ادامه» (intent `next`), what publishing would still refuse (the posting steps);
 * `at` tells one answer from the next.
 */
export type EventSaveState = { errors?: FieldErrors; missing?: FieldErrors; error?: string; notice?: string; listingId?: string; at?: number } | undefined;

const uuid = z.uuid();

function refusal(reason: string): string {
  switch (reason) {
    case 'phone_required':
      return messages.post.phoneRequired;
    case 'account_disabled':
      return messages.post.accountDisabled;
    case 'restricted':
      return messages.post.restricted;
    case 'not_allowed':
      return messages.events.form.ended;
    case 'category_not_postable':
    case 'business_only':
      return messages.post.categoryNotPostable;
    case 'too_many_events':
      return messages.events.form.tooManyEvents;
    case 'new_account_limit':
      return messages.events.form.newAccountEvents(NEW_ACCOUNT_EVENTS_PER_DAY);
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
  // The country is decided here, never taken from the form (decided Oct 17, 2026), as for listings
  const [chosen, saved, open] = await Promise.all([chosenCountry(appDb()), savedPlace(appDb(), user.id), activeCountries(appDb())]);
  const country = (listingCountry: string | null) =>
    postingCountry({ listingCountry, chosen: chosen?.code ?? null, saved: saved?.place.countryCode ?? null, open: open.map((c) => c.code) });
  if (!listingId && !country(null)) return { error: messages.form.chooseCountryFirst };
  // Publishing needs Turnstile, checked before anything is written (docs/setup.md, "Bot protection")
  const publishing = form.get('intent') === 'publish';
  if (publishing && !listingId) {
    const notHuman = await checkTurnstile(form, 'publish-event');
    if (notHuman) return { error: notHuman };
  }
  if (!listingId) {
    const draft = await startDraft(user.id, form.get('categoryId'));
    if (!draft.ok) return { error: draft.error, errors: form.get('categoryId') ? undefined : { categoryId: 'required' } };
    listingId = created = draft.listingId;
  }
  if (!uuid.safeParse(listingId).success) return { error: messages.genericError };
  const db = appDb();
  const own = await ownEvent(db, user.id, listingId);
  if (!own) return { error: messages.genericError, listingId: created };
  if (publishing && !created && (own.listing.status === 'draft' || own.listing.status === 'rejected')) {
    const notHuman = await checkTurnstile(form, 'publish-event');
    if (notHuman) return { error: notHuman };
  }
  const countryCode = country(own.listing.countryCode);
  if (!countryCode) return { error: messages.form.chooseCountryFirst, listingId: created };
  const sent = (str(form, 'countryCode') ?? '').toUpperCase();
  if (sent && sent !== countryCode) return { errors: { countryCode: 'locked' }, error: messages.form.fixErrors, listingId: created };

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
    countryCode,
    placeValue: str(form, 'placeValue'),
    place: str(form, 'place'),
    area: lat !== null && lng !== null ? { lat, lng } : null,
    rememberPlace: false,
    allowPhoneContact: form.get('allowPhoneContact') === 'on',
    displayName: str(form, 'displayName'),
    organizationId: form.get('organizationId') ?? '',
  });
  // «چند روز پشت سر هم» is one date over several days; the last day counts only then
  const repeatMode = str(form, 'repeatMode') ?? str(form, 'repeat');
  const names = form.getAll('performerName').map(String);
  const roles = form.getAll('performerRole').map(String);
  const eventInput = eventInputSchema.safeParse({
    startDate: dateFromForm(form, 'startDate'),
    startTime: str(form, 'startTime'),
    endDate: repeatMode === 'days' || !form.has('repeatMode') ? dateFromForm(form, 'endDate') : undefined,
    endTime: str(form, 'endTime'),
    repeat: repeatMode === 'weekly' || repeatMode === 'monthly' ? repeatMode : undefined,
    repeatUntil: repeatMode === 'weekly' || repeatMode === 'monthly' ? dateFromForm(form, 'repeatUntil') : undefined,
    attendance: str(form, 'attendance') || undefined,
    venueName: str(form, 'venueName'),
    streetAddress: str(form, 'streetAddress'),
    onlineUrl: str(form, 'onlineUrl'),
    ticketUrl: str(form, 'ticketUrl'),
    organizerName: str(form, 'organizerName'),
    languages: form.getAll('languages').map(String),
    minAge: str(form, 'minAge'),
    scheduleStatus: str(form, 'scheduleStatus') || undefined,
    seating: str(form, 'seating') ?? '',
    stepFree: str(form, 'stepFree') ?? '',
    doorSales: str(form, 'doorSales') ?? '',
    refundNote: str(form, 'refundNote'),
    performers: names.map((name, i) => ({ name, role: roles[i] ?? '' })),
  });
  if (!listingInput.success || !eventInput.success) return { error: messages.form.fixErrors, listingId: created, at: Date.now() };

  const intent = publishing ? 'publish' : 'save';
  const next = form.get('intent') === 'next';
  const r = await saveEvent(db, { userId: user.id, listingId, input: listingInput.data, event: eventInput.data, intent, check: next });
  if (!r.ok) {
    if (r.reason === 'invalid') return { errors: r.errors, error: messages.form.fixErrors, listingId: created, at: Date.now() };
    return { error: refusal(r.reason), listingId: created, at: Date.now() };
  }
  if (next) return { missing: r.missing ?? {}, listingId: created, at: Date.now() };
  if (intent === 'publish' && r.status === 'active' && own.listing.status === 'draft') {
    redirect(`${eventPath(listingInput.data.title, r.publicToken)}?published=1`);
  }
  return { notice: r.status === 'pending_review' ? messages.form.submitted : messages.form.saved, listingId: created, at: Date.now() };
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
