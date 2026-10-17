'use server';

import { appDb } from '../../../db/drizzle';
import { messages } from '../../../messages/fa';
import { clearSavedPlace, setSavedPlace } from '../../../modules/listings/places';
import { requireSession } from '../../../modules/users/server';

export type PlaceState = { errors?: Record<string, string>; notice?: string; error?: string } | undefined;

const str = (v: FormDataEntryValue | null, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

export async function savePlaceAction(_: PlaceState, form: FormData): Promise<PlaceState> {
  const { user } = await requireSession('/account/place');
  const t = messages.form.errors;
  if (form.get('intent') === 'remove') {
    await clearSavedPlace(appDb(), user.id);
    return { notice: messages.account.placeRemoved };
  }
  const r = await setSavedPlace(appDb(), user.id, {
    countryCode: str(form.get('countryCode'), 2),
    placeValue: str(form.get('placeValue'), 40),
    place: str(form.get('place'), 200),
    district: str(form.get('district'), 500),
  });
  if (r.ok) return { notice: messages.account.placeSaved };
  return {
    error: messages.form.fixErrors,
    errors: Object.fromEntries(Object.entries(r.errors).map(([k, code]) => [k, t[code] ?? t.invalid])),
  };
}
