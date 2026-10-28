'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';
import { COUNTRY_COOKIE_MAX_AGE, THEME_COOKIE } from './country-cookie-name';
import { THEMES } from './theme';

/**
 * The appearance switch (Settings › Appearance and the footer). Works without JavaScript too: the
 * form posts to the page it is on, which comes back in the new colours. "Automatic" removes the
 * cookie. Setting a cookie in an action makes Next.js render the current page again.
 */
export async function chooseThemeAction(form: FormData): Promise<void> {
  const theme = z.enum(THEMES).catch('auto').parse(form.get('theme'));
  const jar = await cookies();
  if (theme === 'auto') jar.delete(THEME_COOKIE);
  else jar.set(THEME_COOKIE, theme, { path: '/', maxAge: COUNTRY_COOKIE_MAX_AGE, sameSite: 'lax', secure: true, httpOnly: true });
}
