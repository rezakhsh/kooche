import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { EventRow, FeaturedEvent, type EventRowData } from '../../../components/event-row';
import { Icon } from '../../../components/icons';
import { Sheet } from '../../../components/sheet';
import { DateInput } from '../../../components/date-input';
import { appDb } from '../../../db/drizzle';
import { users } from '../../../db/schema';
import { webEnv } from '../../../lib/env';
import { messages } from '../../../messages/fa';
import { eventRowOf } from '../../../modules/events/card';
import { QUICK_WHEN, isFiltered, readEventsQuery, stateQuery, type EventsQuery, type EventsState } from '../../../modules/events/list-params';
import { cheapMinor, eventTypes, eventsPlace, placeFilter, type EventsPlace } from '../../../modules/events/list-place';
import { countEvents, eventCities, eventDays, upcomingEvents, type EventCardRow } from '../../../modules/events/queries';
import { currentSeason, type ActiveSeason } from '../../../modules/events/seasons';
import { addDays, dayNumber, localParts, type LocalDate } from '../../../modules/events/time';
import { cachedCatalog } from '../../../modules/listings/catalog';
import { savedAmong } from '../../../modules/listings/favorites';
import { formatPrice } from '../../../modules/listings/price';
import { featuredEventIds } from '../../../modules/payments/plans';
import { eventsPath } from '../../../modules/search/paths';
import { eventsCityOf, noticesOn } from '../../../modules/users/notification-prefs';
import { currentSession } from '../../../modules/users/server';
import { weeklyEventsAction } from '../../events/follow-actions';
import { FilterSubmit } from '../_browse/filter-submit';
import { RememberCountry } from '../remember-country';

// The events of a city, /germany/berlin/events, or of a country, /germany/events (wave 1, mockups
// final/events and events-filters): the season's strip when one is near (Yalda, Nowruz), 14 days
// with a dot where something is on, type chips that apply at once, free and online, the paid
// «ویژه» slot, then the events by week with their upright posters, and «خبرم کن» for the weekly
// message. The sheet holds the rest (how far, when, price, language, who it suits). A city's list
// includes the country's online events. Every filter is a link or a GET form with its own address
// (src/modules/events/list-params.ts), so it all works without JavaScript.

export type EventsParams = { country: string; place?: string };
export type EventsSearch = EventsQuery;

const DAYS = 14;
/** The sheet's «نمایش بیش از ۵۰۰ رویداد» */
const COUNT_CAP = 500;

export async function eventsMetadata(params: Promise<EventsParams>, searchParams: Promise<EventsSearch>): Promise<Metadata> {
  const p = await params;
  const found = await eventsPlace(appDb(), p.country, p.place ? decodeURIComponent(p.place) : null);
  if (!found) return { title: messages.notFound.title, robots: { index: false } };
  const { country, city } = found;
  const t = messages.events;
  // Filtered views are for visitors; search engines get the plain country and city lists
  const filtered = isFiltered(readEventsQuery(await searchParams, new Date(), found.timeZone));
  return {
    title: `${city ? t.cityTitle(city.nameFa, country.nameFa) : t.title(country.nameFa)} | ${messages.site.name}`,
    description: city ? t.cityDescription(city.nameFa, country.nameFa) : t.description(country.nameFa),
    alternates: { canonical: `${webEnv().APP_URL}${eventsPath(country.slug, city?.slug ?? null)}` },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

const chipClass = (on: boolean, tone: '' | 'brand' = '') =>
  `flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap ${
    on ? 'border-neutral-900 bg-neutral-900 text-white' : tone === 'brand' ? 'border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100' : 'border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50'
  }`;

const isoDay = (d: LocalDate) => `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;

/** Monday of the week a date falls in, at the venue */
function mondayOf(date: Date, timeZone: string): LocalDate {
  const p = localParts(date, timeZone);
  const day = { y: p.y, m: p.m, d: p.d };
  return addDays(day, -((dayNumber(day) + 3) % 7));
}

export async function EventsList({ params, searchParams }: { params: Promise<EventsParams>; searchParams: Promise<EventsSearch> }) {
  const p = await params;
  const q = await searchParams;
  const db = appDb();
  const place = await eventsPlace(db, p.country, p.place ? decodeURIComponent(p.place) : null);
  if (!place) notFound();
  const { country, city } = place;
  const path = eventsPath(country.slug, city?.slug ?? null);
  const now = new Date();
  const s = readEventsQuery(q, now, place.timeZone);
  // Old addresses with ?city=, and the sheet's «کل آلمان», move to the right path
  const oldCity = typeof q.city === 'string' ? q.city : undefined;
  if (oldCity !== undefined || (city && q.range === 'country')) {
    const rest = stateQuery({ ...s, near: false }).toString();
    redirect(`${eventsPath(country.slug, oldCity || null)}${rest ? `?${rest}` : ''}`);
  }

  const t = messages.events.list;
  const catalog = await cachedCatalog(db);
  const types = eventTypes(catalog);
  const filter = placeFilter(catalog, place, s, now);
  const season = currentSeason(now, place.timeZone);
  const session = await currentSession();
  const [page, total, days, cities, seasonCount, featuredIds, me] = await Promise.all([
    upcomingEvents(db, filter, now),
    countEvents(db, { ...filter, after: null }, now, COUNT_CAP + 1),
    eventDays(db, { ...filter, after: null, season: s.season }, place.timeZone, DAYS, now),
    city ? Promise.resolve([]) : eventCities(db, country.code, now),
    season && !s.after && !s.season ? countEvents(db, { countryCode: country.code, locationId: city?.id ?? null, from: now, to: null, season }, now) : Promise.resolve(0),
    s.after ? Promise.resolve([]) : featuredEventIds(db, country.code, city?.id ?? null, now),
    session ? db.select({ prefs: users.notificationPrefs, home: users.homeLocationId }).from(users).where(eq(users.id, session.user.id)).then((r) => r[0] ?? null) : Promise.resolve(null),
  ]);
  const featuredRows = featuredIds.length
    ? (await upcomingEvents(db, { countryCode: country.code, locationId: city?.id ?? null, from: now, to: null, listingIds: featuredIds }, now)).items.slice(0, 3)
    : [];
  const ids = [...page.items, ...featuredRows].map((e) => e.id);
  const saved = session ? await savedAmong(db, session.user.id, ids) : new Set<string>();
  const row = (e: EventCardRow): EventRowData => eventRowOf(catalog, e, { saved, season });
  const back = `${path}${stateQuery(s).toString() ? `?${stateQuery(s)}` : ''}`;
  const href = (patch: Parameters<typeof stateQuery>[1]) => {
    const str = stateQuery(s, patch).toString();
    return `${path}${str ? `?${str}` : ''}`;
  };
  const placeName = city?.nameFa ?? country.nameFa;
  // «خبرم کن»: on when the weekly message is on for this city (or the saved place's, by default)
  const weeklyCity = city?.id ?? null;
  const weeklyOn = !!me && noticesOn(me.prefs, 'events') && (!weeklyCity || (eventsCityOf(me.prefs) ?? me.home) === weeklyCity);

  // By week, Monday to Sunday at the venue
  const thisMonday = dayNumber(mondayOf(now, place.timeZone));
  const groups: { key: number; label: string; items: EventCardRow[] }[] = [];
  for (const e of page.items) {
    const monday = mondayOf(e.startsAt, place.timeZone);
    const key = dayNumber(monday);
    let g = groups.at(-1);
    if (!g || g.key !== key) {
      const f = (d: LocalDate) => new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(d.y, d.m - 1, d.d, 12)));
      const label = key <= thisMonday ? t.thisWeek : key === thisMonday + 7 ? t.nextWeek : t.weekOf(f(monday), f(addDays(monday, 6)));
      g = { key, label, items: [] };
      groups.push(g);
    }
    g.items.push(e);
  }

  const today = (() => {
    const lp = localParts(now, place.timeZone);
    return { y: lp.y, m: lp.m, d: lp.d };
  })();
  const strip = Array.from({ length: DAYS }, (_, i) => addDays(today, i));
  const gday = (d: LocalDate, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { timeZone: 'UTC', ...o }).format(new Date(Date.UTC(d.y, d.m - 1, d.d, 12)));

  return (
    <main className="mx-auto w-full max-w-6xl pb-4 lg:px-6 lg:pt-6">
      <RememberCountry slug={country.slug} />
      <div className="flex items-center gap-2 px-4 pt-4 lg:px-0 lg:pt-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold lg:text-3xl">{t.heading(placeName)}</h1>
          <p className="text-sm text-neutral-600">{t.lead}</p>
        </div>
        <Link href="/events/new" className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-brand-700 px-3.5 text-sm font-bold text-white hover:bg-brand-800">
          <Icon name="plus" className="size-4" />
          {messages.events.post}
        </Link>
      </div>

      {season && seasonCount > 0 && <SeasonStrip season={season} count={seasonCount} place={placeName} href={href({ season: season.key, day: null, when: null })} />}
      {s.season && (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-2xl bg-[#5b1a1f] px-3 py-2 text-sm text-[#fff6e6] lg:mx-0">
          <Icon name="moon" className="size-5" />
          <b className="flex-1">{messages.events.seasons.strip(messages.events.seasons.names[s.season.key]!)}</b>
          <Link href={href({ season: null })} className="flex size-9 items-center justify-center rounded-full hover:bg-white/10" aria-label={t.clear}>
            <Icon name="close" className="size-4" />
          </Link>
        </div>
      )}

      {!city && cities.length > 0 && (
        <nav aria-label={t.cities} className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-4 lg:px-0">
          {cities.map((c) => (
            <Link key={c.id} href={`${eventsPath(country.slug, c.slug)}${stateQuery(s).toString() ? `?${stateQuery(s)}` : ''}`} className={chipClass(false)}>
              <Icon name="pin" className="size-4" />
              {c.nameFa}
              <span className="text-xs text-neutral-500">{c.count.toLocaleString('fa-IR')}</span>
            </Link>
          ))}
        </nav>
      )}

      <nav aria-label={t.days} className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-4 lg:px-0">
        {strip.map((d, i) => {
          const day = isoDay(d);
          const on = s.day === day;
          const has = days.has(day);
          return (
            <Link
              key={day}
              href={href({ day: on ? null : day, when: null })}
              aria-current={on ? 'date' : undefined}
              className={`flex w-14 shrink-0 flex-col items-center rounded-2xl border py-2 ${on ? 'border-neutral-900 bg-neutral-900 text-white' : i === 0 && !s.day ? 'border-neutral-900' : 'border-neutral-200 hover:bg-neutral-50'}`}
            >
              <span className={`text-xs ${on ? '' : 'text-neutral-600'}`}>{i === 0 ? t.today : i === 1 ? t.tomorrow : gday(d, { weekday: 'long' })}</span>
              <b className="text-lg leading-7">{gday(d, { day: 'numeric' })}</b>
              <span className={`text-xs ${on ? '' : 'text-neutral-600'}`}>{gday(d, { month: 'short' })}</span>
              <i className={`mt-1 size-1.5 rounded-full ${has ? (on ? 'bg-white' : 'bg-saffron-500') : 'bg-transparent'}`} />
              {has && <span className="sr-only">{t.hasEvents}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4 lg:px-0">
        <FilterSheet place={place} s={s} path={path} count={Math.min(total, COUNT_CAP)} capped={total > COUNT_CAP} types={types} />
        <Link href={href({ types: [] })} className={chipClass(s.types.length === 0)}>
          {t.all}
        </Link>
        {types.map((c) => {
          const on = s.types.includes(c.slug);
          return (
            <Link key={c.id} href={href({ types: on ? s.types.filter((x) => x !== c.slug) : [c.slug] })} aria-pressed={on} className={chipClass(on)}>
              {c.nameFa}
            </Link>
          );
        })}
        <Link href={href({ free: !s.free, cheap: false })} aria-pressed={s.free} className={chipClass(s.free, 'brand')}>
          {t.free}
        </Link>
        <Link href={href({ attendance: s.attendance === 'online' ? null : 'online' })} aria-pressed={s.attendance === 'online'} className={chipClass(s.attendance === 'online')}>
          <Icon name="globe" className="size-4" />
          {t.online}
        </Link>
      </div>

      {featuredRows.length > 0 && (
        <section className="mt-5 px-4 lg:px-0" aria-labelledby="featured-events">
          <div className="flex items-baseline justify-between">
            <h2 id="featured-events" className="text-lg font-extrabold">
              {t.featured}
            </h2>
            <span className="text-xs text-neutral-600">{t.featuredLabel}</span>
          </div>
          <div className="mt-2 grid gap-3 lg:grid-cols-2">
            {featuredRows.map((e) => (
              <FeaturedEvent key={e.id} e={row(e)} />
            ))}
          </div>
        </section>
      )}

      {page.items.length === 0 ? (
        <div className="mx-4 mt-6 flex flex-col items-center gap-3 rounded-3xl bg-neutral-50 px-6 py-10 text-center lg:mx-0">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-white text-brand-700">
            <Icon name="calendar" className="size-7" />
          </span>
          <p className="max-w-sm text-sm leading-7 text-neutral-700">{s.day ? t.emptyDay : t.empty}</p>
          <p className="max-w-sm text-xs leading-6 text-neutral-600">{messages.events.emptyHint}</p>
          {isFiltered(s) && (
            <Link href={path} className="flex h-11 items-center rounded-xl border border-neutral-300 bg-white px-4 text-sm font-bold hover:bg-neutral-50">
              {t.clear}
            </Link>
          )}
        </div>
      ) : (
        <div className="px-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8 lg:px-0">
          {groups.map((g) => (
            <section key={g.key} className="mt-6">
              <h2 className="sticky top-[61px] z-10 bg-white py-1 text-base font-extrabold">{g.label}</h2>
              <div className="divide-y divide-neutral-200">
                {g.items.map((e) => (
                  <EventRow key={e.id} e={row(e)} back={back} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {page.next && (
        <div className="mt-6 flex justify-center">
          <Link
            href={`${href({})}${stateQuery(s).toString() ? '&' : '?'}after=${page.next.startsAt.toISOString()}_${page.next.id}`}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            {messages.events.more}
          </Link>
        </div>
      )}

      <WeeklyBox on={weeklyOn} cityId={weeklyCity} place={placeName} back={back} justChanged={q.weekly === 'on' || q.weekly === 'off'} />
    </main>
  );
}

function SeasonStrip({ season, count, place, href }: { season: ActiveSeason; count: number; place: string; href: string }) {
  const t = messages.events.seasons;
  const date = `${new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { weekday: 'long', timeZone: 'UTC' }).format(season.day)} ${new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(season.day)}`;
  const jalali = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(season.day);
  return (
    <Link href={href} className="mx-4 mt-4 flex items-center gap-3 overflow-hidden rounded-2xl bg-[#5b1a1f] p-3 text-[#fff6e6] hover:bg-[#6b2128] lg:mx-0">
      {/* A drawn tile, not a photo: the longest night's moon on the season's red */}
      <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#8a2a2f] to-[#3a0f13] text-[#f4c56a]">
        <Icon name="moon" className="size-8" />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block">{t.strip(t.names[season.key]!)}</b>
        <span className="text-xs opacity-90">{t.line(t.days[season.key]!, date, jalali, count, place)}</span>
      </span>
      <Icon name="chevronEnd" className="size-5" />
    </Link>
  );
}

function Pills({ name, options, checked, type = 'checkbox' }: { name: string; options: [string, string][]; checked: (v: string) => boolean; type?: 'checkbox' | 'radio' }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([value, label]) => (
        <label key={value} className="cursor-pointer">
          <input type={type} name={name} value={value} defaultChecked={checked(value)} className="peer sr-only" />
          <span className="flex h-10 items-center rounded-full border border-neutral-300 px-3.5 text-sm peer-checked:border-2 peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:font-bold peer-checked:text-brand-800 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600/40">
            {label}
          </span>
        </label>
      ))}
    </div>
  );
}

function Segments({ name, options, value }: { name: string; options: [string, string][]; value: string }) {
  return (
    <div className="flex gap-1 rounded-xl bg-neutral-100 p-1">
      {options.map(([v, label]) => (
        <label key={v} className="flex-1 cursor-pointer">
          <input type="radio" name={name} value={v} defaultChecked={v === value} className="peer sr-only" />
          <span className="flex h-10 items-center justify-center rounded-lg px-1 text-center text-sm text-neutral-700 peer-checked:bg-white peer-checked:font-bold peer-checked:text-neutral-900 peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600/40">
            {label}
          </span>
        </label>
      ))}
    </div>
  );
}

const H = ({ children }: { children: ReactNode }) => <p className="mt-5 mb-1.5 text-sm font-bold first:mt-0">{children}</p>;

function FilterSheet({ place, s, path, count, capped, types }: { place: EventsPlace; s: EventsState; path: string; count: number; capped: boolean; types: { id: string; slug: string; nameFa: string }[] }) {
  const t = messages.events.sheet;
  const w = t.whenOptions;
  const cheap = formatPrice(cheapMinor(place), place.country.currency.code, place.country.currency.minorUnit);
  return (
    <Sheet
      summary={
        <>
          <Icon name="sliders" className="size-4" />
          {messages.events.list.filters}
        </>
      }
      summaryClassName={chipClass(false, 'brand')}
      title={t.title}
      closeLabel={t.close}
    >
      <form method="get" action={path} className="text-sm">
        {s.season && <input type="hidden" name="season" value={s.season.key} />}
        {place.city && (
          <>
            <H>{t.where}</H>
            <Segments
              name="range"
              value={s.near ? 'near' : ''}
              options={[
                ['', t.onlyCity(place.city.nameFa)],
                ['near', t.near],
                ['country', t.country(place.country.nameFa)],
              ]}
            />
            <p className="mt-1 text-xs text-neutral-600">{t.countryHint(place.country.nameFa)}</p>
          </>
        )}
        <H>{t.when}</H>
        <div className="group">
          <div className="flex flex-wrap gap-2">
            {QUICK_WHEN.map((v) => (
              <label key={v} className="cursor-pointer">
                <input type="radio" name="when" value={v} defaultChecked={s.when === v} className="peer sr-only" />
                <span className="flex h-10 items-center rounded-full border border-neutral-300 px-3.5 peer-checked:border-2 peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:font-bold peer-checked:text-brand-800 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600/40">
                  {w[v]}
                </span>
              </label>
            ))}
            <label className="cursor-pointer">
              <input type="radio" name="when" value="date" data-pick-date defaultChecked={!!s.day} className="peer sr-only" />
              <span className="flex h-10 items-center rounded-full border border-neutral-300 px-3.5 peer-checked:border-2 peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:font-bold peer-checked:text-brand-800 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600/40">
                {t.pickDate}
              </span>
            </label>
          </div>
          <div className="mt-2 hidden group-has-[[data-pick-date]:checked]:block">
            <DateInput label={t.date} name="day" defaultValue={s.day ?? ''} years={{ before: 0, after: 1 }} showDay />
          </div>
        </div>
        <H>{t.type}</H>
        <Pills name="type" options={types.map((c) => [c.slug, c.nameFa])} checked={(v) => s.types.includes(v)} />
        <H>{t.price}</H>
        <Segments
          name="price"
          value={s.free ? 'free' : s.cheap ? 'cheap' : ''}
          options={[
            ['', t.priceOptions.all],
            ['free', t.priceOptions.free],
            ['cheap', t.priceOptions.cheap(cheap)],
          ]}
        />
        <H>{t.language}</H>
        <Pills name="lang" options={(['fa', 'de', 'en'] as const).map((l) => [l, messages.events.languages[l]])} checked={(v) => s.languages.includes(v)} />
        <H>{t.suits}</H>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['family', t.suitsOptions.family, s.family],
              ['adults', t.suitsOptions.adults, s.adults],
              ['stepfree', t.suitsOptions.stepFree, s.stepFree],
            ] as const
          ).map(([name, label, on]) => (
            <label key={name} className="cursor-pointer">
              <input type="checkbox" name={name} value="1" defaultChecked={on} className="peer sr-only" />
              <span className="flex h-10 items-center rounded-full border border-neutral-300 px-3.5 peer-checked:border-2 peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:font-bold peer-checked:text-brand-800 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600/40">
                {label}
              </span>
            </label>
          ))}
        </div>
        <H>{t.attendance}</H>
        <Segments
          name="attendance"
          value={s.attendance ?? ''}
          options={[
            ['', t.attendanceOptions.all],
            ['in_person', t.attendanceOptions.in_person],
            ['online', t.attendanceOptions.online],
          ]}
        />
        <div className="sticky bottom-0 -mx-4 mt-5 flex items-center gap-3 border-t border-neutral-200 bg-white px-4 pt-3">
          <Link href={s.season ? `${path}?season=${s.season.key}` : path} className="px-2 text-sm font-medium text-neutral-700 hover:underline">
            {t.clear}
          </Link>
          <FilterSubmit path={path} count={count} capped={capped} of="events" />
        </div>
      </form>
    </Sheet>
  );
}

function WeeklyBox({ on, cityId, place, back, justChanged }: { on: boolean; cityId: string | null; place: string; back: string; justChanged: boolean }) {
  const t = messages.events.list;
  return (
    <form id="weekly" action={weeklyEventsAction} className="mx-4 mt-6 flex items-center gap-3 rounded-2xl bg-brand-50 p-4 lg:mx-0">
      {cityId && <input type="hidden" name="cityId" value={cityId} />}
      <input type="hidden" name="back" value={back.replace(/[?&]weekly=(on|off)/, '')} />
      <input type="hidden" name="intent" value={on ? 'off' : 'on'} />
      <span className="text-brand-700">
        <Icon name={on ? 'check' : 'bell'} className="size-6" />
      </span>
      {on ? (
        <span className="flex-1 text-sm" role={justChanged ? 'status' : undefined}>
          {t.alertOn(place)}{' '}
          <Link href="/account/notifications" className="font-bold text-brand-800 underline">
            {t.alertChange}
          </Link>
        </span>
      ) : (
        <span className="flex-1 text-sm">
          <b className="block">{t.alertTitle}</b>
          {t.alertLead}
        </span>
      )}
      <button type="submit" className={on ? 'flex h-10 items-center rounded-lg border border-brand-300 bg-white px-3 text-sm font-bold text-brand-800' : 'flex h-10 items-center rounded-lg bg-brand-700 px-3 text-sm font-bold text-white hover:bg-brand-800'}>
        {on ? t.alertOff : t.alertButton}
      </button>
    </form>
  );
}
