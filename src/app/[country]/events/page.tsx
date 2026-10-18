import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { EventCard } from '../../../components/event-card';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { messages } from '../../../messages/fa';
import { DEFAULT_TIME_ZONE } from '../../../modules/events/events';
import { eventPriceText } from '../../../modules/events/format';
import { WHEN, cityBySlug, eventCities, upcomingEvents, whenWindow, type When } from '../../../modules/events/queries';
import { EVENT_ROOT_SLUG, cachedCatalog } from '../../../modules/listings/catalog';
import { activeCountries } from '../../../modules/listings/queries';
import { imageUrl } from '../../../modules/media/server';
import { RememberCountry } from '../remember-country';

// The events of a country, /germany/events: soonest first, with "today / this weekend / this
// week / this month", a city, the event type, online only and free only. Plain links and a GET
// form, so every filter works without JavaScript and has its own address.
// `?after=<starts_at>_<id>` continues after the last event of the previous page.

type Params = { country: string };
type Search = { when?: string; city?: string; type?: string; online?: string; free?: string; after?: string };

const cursor = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z_[0-9a-f-]{36}$/)
  .transform((s) => {
    const [at, id] = s.split('_');
    return { startsAt: new Date(at!), id: id! };
  });

async function find(slug: string) {
  return (await activeCountries(appDb())).find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }): Promise<Metadata> {
  const country = await find((await params).country);
  if (!country) return { title: messages.notFound.title, robots: { index: false } };
  const t = messages.events;
  const s = await searchParams;
  // Filtered views are for visitors; search engines get the plain list (and city lists later)
  const filtered = Object.keys(s).length > 0;
  return {
    title: `${t.title(country.nameFa)} | ${messages.site.name}`,
    description: t.description(country.nameFa),
    alternates: { canonical: `${webEnv().APP_URL}/${country.slug}/events` },
    robots: filtered ? { index: false } : undefined,
  };
}

export default async function CountryEventsPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const country = await find((await params).country);
  if (!country) notFound();
  const s = await searchParams;
  const db = appDb();
  const t = messages.events;
  const now = new Date();

  const when: When = WHEN.includes(s.when as When) ? (s.when as When) : 'all';
  const [catalog, cities] = await Promise.all([cachedCatalog(db), eventCities(db, country.code, now)]);
  const city = s.city ? await cityBySlug(db, country.code, s.city) : null;
  const types = (catalog.bySlug.get(EVENT_ROOT_SLUG)?.childIds ?? []).map((id) => catalog.byId.get(id)!).filter((c) => c.isActive);
  const type = s.type ? types.find((c) => c.slug === s.type) : undefined;
  const after = cursor.safeParse(s.after ?? '');
  const window = whenWindow(when, now, DEFAULT_TIME_ZONE);
  const page = await upcomingEvents(
    db,
    {
      countryCode: country.code,
      locationId: city?.id ?? null,
      categoryIds: type ? [type.id] : null,
      ...window,
      online: s.online === '1',
      free: s.free === '1',
      after: after.success ? after.data : null,
    },
    now,
  );

  const query = (patch: Partial<Search>) => {
    const q = new URLSearchParams();
    const merged: Search = { when: when === 'all' ? undefined : when, city: city?.slug, type: type?.slug, online: s.online === '1' ? '1' : undefined, free: s.free === '1' ? '1' : undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const str = q.toString();
    return `/${country.slug}/events${str ? `?${str}` : ''}`;
  };
  const selectClass = 'block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm';

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <RememberCountry slug={country.slug} />
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">{city ? t.cityTitle(city.nameFa, country.nameFa) : t.title(country.nameFa)}</h1>
        <div className="flex gap-4 text-sm">
          <Link href="/events/new" className="font-semibold text-brand-800 hover:underline">
            {t.post}
          </Link>
          <Link href="/my/events" className="text-brand-800 hover:underline">
            {t.mine}
          </Link>
        </div>
      </div>

      <nav className="mb-4 flex flex-wrap gap-2" aria-label={t.section}>
        {WHEN.map((w) => (
          <Link
            key={w}
            href={query({ when: w === 'all' ? undefined : w, after: undefined })}
            aria-current={w === when ? 'page' : undefined}
            className={`rounded-full border px-3 py-1 text-sm ${w === when ? 'border-brand-700 bg-brand-700 text-white' : 'border-neutral-300 hover:bg-neutral-50'}`}
          >
            {t.when[w]}
          </Link>
        ))}
      </nav>

      <form method="get" action={`/${country.slug}/events`} className="mb-6 grid grid-cols-2 items-end gap-3 sm:grid-cols-5">
        {when !== 'all' && <input type="hidden" name="when" value={when} />}
        <label className="block">
          <span className="mb-1 block text-xs text-neutral-600">{t.filters.city}</span>
          <select name="city" defaultValue={city?.slug ?? ''} className={selectClass}>
            <option value="">{t.filters.allCities}</option>
            {cities.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.nameFa} ({c.count.toLocaleString('fa-IR')})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-neutral-600">{t.filters.type}</span>
          <select name="type" defaultValue={type?.slug ?? ''} className={selectClass}>
            <option value="">{t.filters.allTypes}</option>
            {types.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.nameFa}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="online" value="1" defaultChecked={s.online === '1'} />
          {t.filters.online}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="free" value="1" defaultChecked={s.free === '1'} />
          {t.filters.free}
        </label>
        <button type="submit" className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50">
          {t.filters.apply}
        </button>
      </form>

      {page.items.length === 0 && (
        <div className="space-y-2 text-neutral-600">
          <p>{t.empty}</p>
          <p className="text-sm">
            {t.emptyHint}{' '}
            <Link href="/events/new" className="text-brand-800 hover:underline">
              {t.post}
            </Link>
          </p>
        </div>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {page.items.map((e) => {
          const currency = e.currency ? catalog.currencies.get(e.currency) : undefined;
          const where = e.attendance === 'online' ? t.card.online : [e.venueName, e.cityFa ?? e.placeName].filter(Boolean).join('، ');
          return (
            <li key={e.id}>
              <EventCard
                e={{
                  title: e.title,
                  publicToken: e.publicToken,
                  startsAt: e.startsAt,
                  timeZone: e.timeZone,
                  where: where || null,
                  price: eventPriceText(e.priceType, e.priceMinor !== null && currency ? { minor: e.priceMinor, currency: currency.code, minorUnit: currency.minorUnit } : null),
                  attendance: e.attendance,
                  scheduleStatus: e.scheduleStatus,
                  moreDates: e.dateCount - 1,
                  cover: e.coverKey ? imageUrl(e.coverKey, 'poster', 'webp') : null,
                }}
              />
            </li>
          );
        })}
      </ul>
      {page.next && (
        <div className="mt-6 flex justify-center">
          <Link
            href={query({ after: `${page.next.startsAt.toISOString()}_${page.next.id}` })}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            {t.more}
          </Link>
        </div>
      )}
    </main>
  );
}
