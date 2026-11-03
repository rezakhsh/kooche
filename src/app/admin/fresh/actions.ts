'use server';

import { z } from 'zod';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { requireStaff } from '../../../modules/admin/server';
import { freshCards } from './data';

/** «۲۰ آگهی دیگر» on the review of new listings: the next cards, without those already on the screen */
export async function moreFreshAction(skip: string[]) {
  await requireStaff('listing.moderate');
  const ids = z.array(z.string().uuid()).max(5_000).safeParse(skip);
  if (!ids.success) return null;
  return freshCards(appDb(), { skip: ids.data, timeZone: webEnv().APP_TIME_ZONE });
}
