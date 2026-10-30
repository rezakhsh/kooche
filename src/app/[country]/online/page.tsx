import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { FavoriteButton } from '../../../components/favorite-button';
import { Flag } from '../../../components/flag';
import { Icon } from '../../../components/icons';
import { ListingCard } from '../../../components/listing-card';
import { SearchBox } from '../../../components/search-box';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { messages } from '../../../messages/fa';
import { eventRowOf } from '../../../modules/events/card';
import { upcomingEvents, type EventFilter } from '../../../modules/events/queries';
import { eventPath } from '../../../modules/events/slug';
import { cardOf } from '../../../modules/listings/card';
import { cachedCatalog, subtreeIds } from '../../../modules/listings/catalog';
import { savedAmong } from '../../../modules/listings/favorites';
import { onlineCounts, onlineListings, ONLINE_SECTIONS, sectionIds, type OnlineSection } from '../../../modules/listings/online';
import { activeCountries } from '../../../modules/listings/queries';
import { countryNameFa, zoneOf } from '../../../modules/listings/zones';
import { cleanKeyword } from '../../../modules/search/filters';
import { browsePath } from '../../../modules/search/paths';
import { currentSession, viewerSeesTest } from '../../../modules/users/server';

// «آنلاین از همه‌جا» (wave 2 part 6, src/modules/listings/online.ts): /austria/online, an open
// country's online events, online services and lessons from every open country, and remote jobs
// from its zone. Styled like the starter page (mockup final/us-starter): section heads with «همه»,
// event rows with the date on saffron, listings as rows; one section at a time with ?type=, a
// category of it with ?c=, words with ?q=, the next page with ?after=. No mockup: the owner
// approved the part on Oct 30, 2026.

const t = messages.online;
const OVERVIEW = 4;

type Props = { params: Promise<{ country: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

const countryOf = cache(async (slug: string) => (await activeCountries(appDb())).find((c) => c.slug === slug) ?? null);

function read(raw: Record<string, string | string[] | undefined>) {
  const type = one(raw.type);
  const after = one(raw.after);
  const event = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)_([0-9a-f-]{36})$/.exec(after);
  return {
    section: (ONLINE_SECTIONS as readonly string[]).includes(type) ? (type as OnlineSection) : null,
    q: cleanKeyword(one(raw.q)),
    c: one(raw.c) || null,
    after: after || null,
    eventAfter: event && !Number.isNaN(Date.parse(event[1]!)) ? { startsAt: new Date(event[1]!), id: event[2]! } : null,
  };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const country = await countryOf((await params).country);
  if (!country) return {};
  const s = read(await searchParams);
  return {
    title: `${t.metaTitle(country.nameFa)} | ${messages.site.name}`,
    description: t.description(country.nameFa),
    alternates: { canonical: `${webEnv().APP_URL}/${country.slug}/online` },
    robots: s.section || s.q || s.c || s.after ? { index: false, follow: true } : undefined,
  };
}

function SectionHead({ title, href }: { title: string; href?: string }) {
  return (
    <h2 className="mt-7 flex items-center justify-between text-lg font-extrabold">
      {title}
      {href && (
        <Link href={href} className="flex min-h-11 items-center text-sm font-bold text-brand-800 hover:underline">
          {t.all}
        </Link>
      )}
    </h2>
  );
}

export default async function OnlinePage({ params, searchParams }: Props) {
  const country = await countryOf((await params).country);
  if (!country) notFound();
  const s = read(await searchParams);
  const db = appDb();
  const env = webEnv();
  const catalog = await cachedCatalog(db);
  const withTest = await viewerSeesTest();
  const now = new Date();
  const path = `/${country.slug}/online`;
  const href = (patch: { type?: OnlineSection | null; c?: string | null; after?: string | null }) => {
    const v = { type: s.section, q: s.q, c: s.c, after: null as string | null, ...patch };
    const query = new URLSearchParams(Object.entries(v).filter((e): e is [string, string] => !!e[1])).toString();
    return `${path}${query ? `?${query}` : ''}`;
  };

  // ?c= narrows services or jobs to a category of theirs (the category pages' links)
  const category = s.c ? catalog.bySlug.get(s.c) : undefined;
  const categorySection = category ? (['services', 'jobs'] as const).find((x) => sectionIds(catalog, x).includes(category.id)) : undefined;
  const section: OnlineSection | null = categorySection ?? s.section;
  const filter = { countryCode: country.code, keyword: s.q, categoryIds: category && categorySection ? subtreeIds(catalog, category.id) : null, withTest };
  const eventFilter: EventFilter = { countryCode: country.code, onlineElsewhere: 'also', online: true, text: s.q, from: now, to: null, withTest, after: s.eventAfter };
  const size = section ? undefined : OVERVIEW;
  const [counts, events, services, jobs] = await Promise.all([
    onlineCounts(db, catalog, { ...filter, categoryIds: null }, now),
    !section || section === 'events' ? upcomingEvents(db, eventFilter, now, size) : null,
    !section || section === 'services' ? onlineListings(db, catalog, 'services', { ...filter, after: s.after }, size) : null,
    !section || section === 'jobs' ? onlineListings(db, catalog, 'jobs', { ...filter, after: s.after }, size) : null,
  ]);
  const total = counts.events + counts.services + counts.jobs;
  const session = await currentSession();
  const listed = [...(services?.items ?? []), ...(jobs?.items ?? [])];
  const saved = session ? await savedAmong(db, session.user.id, [...listed.map((l) => l.id), ...(events?.items ?? []).map((e) => e.id)]) : new Set<string>();
  const here = href({ after: s.after });
  const zone = zoneOf(country.code);
  const zoneName = (messages.post.border.zones[zone] ?? messages.post.border.zoneOf(country.nameFa)).name;

  const listingRows = (items: typeof listed) => (
    <ul className="flex flex-col">
      {items.map((l) => {
        const card = { ...cardOf(catalog, l, env.APP_TIME_ZONE), country: l.countryCode && l.countryCode !== country.code ? { code: l.countryCode, nameFa: countryNameFa(l.countryCode) } : null };
        return (
          <li key={l.id}>
            <ListingCard card={card} view="list" favorite={<FavoriteButton token={l.publicToken} saved={saved.has(l.id)} back={here} />} />
          </li>
        );
      })}
    </ul>
  );
  const more = (next: string | null) =>
    next && (
      <div className="mt-6 flex justify-center">
        <Link href={href({ after: next })} className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-bold hover:bg-neutral-50">
          {t.more}
        </Link>
      </div>
    );
  const part = (d: Date, timeZone: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { timeZone, ...o }).format(d);
  const chip = (on: boolean) =>
    `flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm ${on ? 'border-brand-300 bg-brand-50 font-bold text-brand-800' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'}`;
  const empty = (section ? counts[section] : total) === 0;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-24">
      <section className="pt-6 lg:pt-10">
        <Link href={browsePath(country.slug, null, null)} className="flex w-fit items-center gap-2 text-sm font-bold text-brand-800 hover:underline">
          <Flag code={country.code} className="h-4 w-6" />
          {country.nameFa}
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-[26px] font-black leading-[1.5] lg:text-4xl">
          <Icon name="globe" className="size-7 shrink-0 text-brand-700 lg:size-9" />
          {t.title}
        </h1>
        <p className="mt-1 max-w-2xl text-[15px] leading-8 text-neutral-700">{t.intro(zoneName)}</p>
        <SearchBox
          action={path}
          q={s.q}
          placeholder={t.search}
          hidden={[...(s.section ? [['type', s.section] as [string, string]] : []), ...(s.c ? [['c', s.c] as [string, string]] : [])]}
          id="online-q"
          country={country.slug}
          plain
          className="mt-4 max-w-xl"
        />
        <nav aria-label={t.title} className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          <Link href={href({ type: null, c: null })} aria-current={!section ? 'page' : undefined} className={chip(!section)}>
            {t.chips.all}
          </Link>
          {ONLINE_SECTIONS.map((x) => (
            <Link key={x} href={href({ type: x, c: null })} aria-current={section === x ? 'page' : undefined} className={chip(section === x)}>
              {t.chips[x]}
              <span className="text-xs font-normal text-neutral-600">{counts[x].toLocaleString('fa-IR')}</span>
            </Link>
          ))}
          {category && categorySection && (
            <Link href={href({ type: categorySection, c: null })} aria-label={t.clearCategory(category.nameFa)} className={chip(true)}>
              {category.nameFa}
              <Icon name="close" className="size-3.5" />
            </Link>
          )}
        </nav>
      </section>

      <div className="lg:grid lg:grid-cols-[1fr_20rem] lg:gap-8">
        <div>
          {empty && (
            <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 px-6 py-10 text-center text-neutral-600">
              <Icon name="globe" className="mx-auto mb-3 size-8 text-neutral-400" />
              <p>{s.q ? t.emptySearch(s.q) : t.empty}</p>
            </div>
          )}

          {events && events.items.length > 0 && (
            <>
              <SectionHead title={t.sections.events} href={section ? undefined : href({ type: 'events' })} />
              <ul className="mt-3 space-y-2">
                {events.items.map((e) => {
                  const r = eventRowOf(catalog, e, { saved, season: null, countryCode: country.code });
                  return (
                    <li key={e.id}>
                      <Link href={eventPath(e.title, e.publicToken)} className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3 hover:border-brand-300">
                        <span className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-saffron-50 py-1.5 text-saffron-800">
                          <span className="text-xs">{part(e.startsAt, e.timeZone, { weekday: 'long' })}</span>
                          <b className="text-sm">{part(e.startsAt, e.timeZone, { day: 'numeric', month: 'short' })}</b>
                        </span>
                        <span className="min-w-0 flex-1">
                          <b className="block text-sm leading-6">{e.title}</b>
                          <span className="flex items-center gap-1.5 text-xs text-neutral-600">
                            {e.countryCode !== country.code && <Flag code={e.countryCode} className="h-3 w-4.5 shrink-0" />}
                            <span>{[messages.events.list.at(r.time), r.where, r.price].filter(Boolean).join('، ')}</span>
                          </span>
                        </span>
                        <Icon name="chevronEnd" className="size-4 text-neutral-400" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {section === 'events' && events.next && more(`${events.next.startsAt.toISOString()}_${events.next.id}`)}
            </>
          )}

          {services && services.items.length > 0 && (
            <>
              <SectionHead title={category && categorySection === 'services' ? category.nameFa : t.sections.services} href={section ? undefined : href({ type: 'services' })} />
              <div className="mt-1">{listingRows(services.items)}</div>
              {section && more(services.next)}
            </>
          )}

          {jobs && jobs.items.length > 0 && (
            <>
              <SectionHead title={category && categorySection === 'jobs' ? category.nameFa : t.sections.jobs} href={section ? undefined : href({ type: 'jobs' })} />
              <div className="mt-1">{listingRows(jobs.items)}</div>
              {section && more(jobs.next)}
            </>
          )}
        </div>

        <aside>
          <div className="mt-6 rounded-2xl bg-saffron-50 p-4 lg:mt-7">
            <h2 className="font-extrabold">{t.postTitle}</h2>
            <p className="mt-1 text-sm leading-7 text-neutral-700">{t.postText}</p>
            <Link href="/new?c=services" className="mt-3 flex h-11 items-center justify-center rounded-xl bg-brand-700 text-sm font-bold text-white hover:bg-brand-800">
              {t.post}
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
