'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';
import { LEGAL_SEEN_COOKIE } from '../modules/legal/notices';

/**
 * «بستن» on the line about a coming terms change (src/components/legal-change-banner.tsx): that
 * notice's line stays closed in this browser. Setting a cookie in an action makes Next.js render
 * the current page again, so it works without JavaScript too.
 */
export async function dismissLegalBannerAction(form: FormData): Promise<void> {
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return;
  (await cookies()).set(LEGAL_SEEN_COOKIE, id.data, { path: '/', maxAge: 60 * 86_400, sameSite: 'lax', secure: true, httpOnly: true });
}
