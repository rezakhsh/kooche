'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { appDb } from '../../db/drizzle';
import { changeDraftCategory } from '../../modules/listings/listings';
import { requireSession } from '../../modules/users/server';

const pickSchema = z.object({ categoryId: z.uuid(), listingId: z.uuid() });

/** Moves a draft to another category (from its form's "change category") */
export async function pickCategory(form: FormData): Promise<void> {
  const { user } = await requireSession('/new');
  const parsed = pickSchema.safeParse({
    categoryId: form.get('categoryId'),
    listingId: form.get('listingId'),
  });
  if (!parsed.success) redirect('/new');
  const { categoryId, listingId } = parsed.data;
  const r = await changeDraftCategory(appDb(), { userId: user.id, listingId, categoryId });
  redirect(r.ok ? `/my/listings/${listingId}` : `/new?listing=${listingId}&error=${r.reason}`);
}
