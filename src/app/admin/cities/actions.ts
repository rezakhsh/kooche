'use server';

import { redirect } from 'next/navigation';
import { appDb } from '../../../db/drizzle';
import { purgeEnv, webEnv } from '../../../lib/env';
import { purgeUrls } from '../../../modules/admin/purge';
import { adminHref, requireStaffAction } from '../../../modules/admin/server';
import { changeCityLaunch, openCountry, type LaunchChange } from '../../../modules/launch/waitlist';
import { setCountryMode, type CountryMode } from '../../../modules/launch/countries';
import { liftPause, pauseCategory } from '../../../modules/launch/pauses';
import { COUNTRY_MODES } from '../../../db/schema';
import { browsePath } from '../../../modules/search/paths';

// Countries and cities (round 12): the owner opens a city or the whole country, moves a city to
// the waitlist with its goal, or changes the goal. Every change is in audit_log; the changed
// cities' pages are purged from Cloudflare at once (else they follow within 60 seconds).

const uuid = (v: FormDataEntryValue | null) => (typeof v === 'string' && /^[0-9a-f-]{36}$/.test(v) ? v : null);

async function purge(country: string, slugs: string[]): Promise<void> {
  try {
    const env = purgeEnv();
    const appUrl = webEnv().APP_URL;
    await purgeUrls(env.CLOUDFLARE_ZONE_ID, env.CLOUDFLARE_PURGE_TOKEN, [browsePath(country, null, null), ...slugs.map((s) => browsePath(country, s, null))].slice(0, 30).map((p) => `${appUrl}${p}`));
  } catch (e) {
    console.error('cities: cache purge skipped:', e instanceof Error ? e.message : e);
  }
}

export async function cityLaunchAction(form: FormData): Promise<void> {
  const staff = await requireStaffAction('cities.manage');
  const id = uuid(form.get('cityId'));
  const country = String(form.get('country') ?? '').slice(0, 2);
  const kind = form.get('change');
  const goal = Number(form.get('goal'));
  const change: LaunchChange | null =
    kind === 'open' ? { kind: 'open' } : kind === 'later' ? { kind: 'later' } : kind === 'waitlist' ? { kind: 'waitlist', goal } : kind === 'goal' ? { kind: 'goal', goal } : null;
  if (!id || !change) redirect(adminHref(`/cities?country=${country}`));
  const r = await appDb().transaction((tx) => changeCityLaunch(tx, staff.ctx, id, change));
  if (r) await purge(r.country, r.slugs);
  redirect(adminHref(`/cities?country=${country}&${r ? 'done=1' : 'error=1'}`));
}

export async function openCountryAction(form: FormData): Promise<void> {
  const staff = await requireStaffAction('cities.manage');
  const code = String(form.get('country') ?? '');
  if (!/^[A-Z]{2}$/.test(code)) redirect(adminHref('/cities'));
  await appDb().transaction((tx) => openCountry(tx, staff.ctx, code));
  redirect(adminHref(`/cities?country=${code}&done=1`));
}

/**
 * A country's mode (src/modules/launch/countries.ts). Opening or hiding a country needs the «مطمئنم»
 * tick; its pages are purged from Cloudflare at once.
 */
export async function countryModeAction(form: FormData): Promise<void> {
  const staff = await requireStaffAction('cities.manage');
  const code = String(form.get('country') ?? '');
  const mode = String(form.get('mode') ?? '') as CountryMode;
  if (!/^[A-Z]{2}$/.test(code) || !COUNTRY_MODES.includes(mode)) redirect(adminHref('/cities'));
  if ((mode === 'open' || mode === 'hidden') && form.get('sure') !== 'on') redirect(adminHref(`/cities?country=${code}&mode=sure`));
  const r = await appDb().transaction((tx) => setCountryMode(tx, staff.ctx, code, { mode, opensOn: String(form.get('opensOn') ?? '') }));
  if (r?.slug) await purge(r.slug, r.citySlugs);
  redirect(adminHref(`/cities?country=${code}&done=1`));
}

/** Emergency pause: a category in the country or one city, 1–30 days, with a reason (src/modules/launch/pauses.ts) */
export async function pauseAction(form: FormData): Promise<void> {
  const staff = await requireStaffAction('cities.manage');
  const code = String(form.get('country') ?? '');
  const categoryId = uuid(form.get('categoryId'));
  if (!/^[A-Z]{2}$/.test(code) || !categoryId) redirect(adminHref(`/cities?country=${code}&pause=invalid`));
  const r = await appDb().transaction((tx) =>
    pauseCategory(tx, staff.ctx, { categoryId, countryCode: code, locationId: uuid(form.get('cityId')), days: Number(form.get('days')), reason: String(form.get('reason') ?? '') }),
  );
  redirect(adminHref(`/cities?country=${code}&${r === 'ok' ? 'done=1' : 'pause=invalid'}`));
}

export async function liftPauseAction(form: FormData): Promise<void> {
  const staff = await requireStaffAction('cities.manage');
  const code = String(form.get('country') ?? '').slice(0, 2);
  const id = uuid(form.get('pauseId'));
  if (id) await appDb().transaction((tx) => liftPause(tx, staff.ctx, id));
  redirect(adminHref(`/cities?country=${code}&done=1`));
}
