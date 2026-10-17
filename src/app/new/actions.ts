'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { appDb } from '../../db/drizzle';
import { hit } from '../../lib/rate-limit';
import { valkey } from '../../lib/valkey';
import { LISTING_LIMITS } from '../../modules/listings/limits';
import { changeDraftCategory, createDraft } from '../../modules/listings/listings';
import { requireSession } from '../../modules/users/server';

const pickSchema = z.object({ categoryId: z.uuid(), listingId: z.uuid().optional() });

/** A leaf was picked: start a draft (or move the draft being changed) and open its form */
export async function pickCategory(form: FormData): Promise<void> {
  const { user } = await requireSession('/new');
  const parsed = pickSchema.safeParse({
    categoryId: form.get('categoryId'),
    listingId: form.get('listingId') || undefined,
  });
  if (!parsed.success) redirect('/new');
  const { categoryId, listingId } = parsed.data;

  if (listingId) {
    const r = await changeDraftCategory(appDb(), { userId: user.id, listingId, categoryId });
    redirect(r.ok ? `/my/listings/${listingId}` : `/new?listing=${listingId}&error=${r.reason}`);
  }

  const limited = await hit(valkey(), [[LISTING_LIMITS.draftsPerUserDay, user.id]]);
  if (!limited.ok) redirect('/new?error=too_many');
  const r = await createDraft(appDb(), { userId: user.id, categoryId });
  redirect(r.ok ? `/my/listings/${r.listingId}` : `/new?error=${r.reason}`);
}
