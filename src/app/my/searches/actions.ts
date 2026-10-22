'use server';

import { redirect } from 'next/navigation';
import { appDb } from '../../../db/drizzle';
import { hit } from '../../../lib/rate-limit';
import { valkey } from '../../../lib/valkey';
import { messages } from '../../../messages/fa';
import { cachedCatalog } from '../../../modules/listings/catalog';
import { deleteSavedSearch, frequencySchema, nameSchema, resolveTarget, saveSearch, SAVES_PER_HOUR, updateSavedSearch } from '../../../modules/search/saved';
import { currentSession, requireSession, safeNext } from '../../../modules/users/server';

export type SaveSearchState = { saved: boolean; message?: string; error?: string };

const SAVE_LIMIT = { name: 'saved-search:user:1h', max: SAVES_PER_HOUR, windowSeconds: 3_600 };

/**
 * «ذخیره این جستجو» on browse pages. The form posts the page's path and canonical query; they are
 * read back exactly like the page reads them, so nothing else can be saved. Logged out, the
 * visitor signs in and comes back to the same page (no cookie keeps the search meanwhile).
 */
export async function saveSearchAction(prev: SaveSearchState, form: FormData): Promise<SaveSearchState> {
  const t = messages.savedSearches;
  const path = safeNext(form.get('path'));
  const query = String(form.get('query') ?? '');
  const session = await currentSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`${path}${query}`)}`);
  if (!(await hit(valkey(), [[SAVE_LIMIT, session.user.id]])).ok) return { ...prev, error: t.rateLimited };
  const db = appDb();
  const target = await resolveTarget(db, await cachedCatalog(db), path, query);
  if (!target) return { ...prev, error: t.invalid };
  const r = await saveSearch(db, session.user.id, target);
  if (r.ok) return { saved: true, message: t.savedNotice };
  return { ...prev, error: r.reason === 'limit' ? t.limit : r.reason === 'near_not_saveable' ? t.nearNotSaveable : t.invalid };
}

export async function renameSavedSearchAction(form: FormData): Promise<void> {
  const { user } = await requireSession('/my/searches');
  const name = nameSchema.safeParse(form.get('name'));
  const ok = name.success && (await updateSavedSearch(appDb(), user.id, String(form.get('id') ?? ''), { name: name.data }));
  redirect(ok ? '/my/searches?done=updated' : '/my/searches');
}

export async function setFrequencyAction(form: FormData): Promise<void> {
  const { user } = await requireSession('/my/searches');
  const frequency = frequencySchema.safeParse(form.get('frequency'));
  const ok = frequency.success && (await updateSavedSearch(appDb(), user.id, String(form.get('id') ?? ''), { frequency: frequency.data }));
  redirect(ok ? '/my/searches?done=updated' : '/my/searches');
}

export async function deleteSavedSearchAction(form: FormData): Promise<void> {
  const { user } = await requireSession('/my/searches');
  const ok = await deleteSavedSearch(appDb(), user.id, String(form.get('id') ?? ''));
  redirect(ok ? '/my/searches?done=deleted' : '/my/searches');
}
