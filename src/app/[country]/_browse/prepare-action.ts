'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { appDb } from '../../../db/drizzle';
import { preparingCountries } from '../../../modules/launch/country-page';
import { COUNTRY_COOKIE, COUNTRY_COOKIE_MAX_AGE } from '../../country-cookie-name';

// «آماده کردن آگهی» and «ثبت کسب‌وکار» on a country's page before it opens (prestart, wave 2
// part 8): chooses the country for posting (the `country` cookie, src/app/country-choice.ts) and
// goes on to the posting or new-business page. Any other country is ignored.

export async function prepareInAction(form: FormData): Promise<void> {
  const slug = String(form.get('country') ?? '');
  const country = (await preparingCountries(appDb())).find((c) => c.slug === slug);
  if (country) {
    (await cookies()).set(COUNTRY_COOKIE, country.slug, { path: '/', maxAge: COUNTRY_COOKIE_MAX_AGE, sameSite: 'lax', secure: true });
  }
  redirect(form.get('what') === 'business' ? '/business/new' : '/new');
}
