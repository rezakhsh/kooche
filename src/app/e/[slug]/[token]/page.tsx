import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache, type ReactNode } from 'react';
import { EventRow } from '../../../../components/event-row';
import { FavoriteButton } from '../../../../components/favorite-button';
import { Icon, type IconName } from '../../../../components/icons';
import { OutlineMap } from '../../../../components/outline-map';
import { ListingFooter } from '../../../../components/report-link';
import { StreetMap } from '../../../../components/street-map';
import { Alert } from '../../../../components/ui';
import { appDb } from '../../../../db/drizzle';
import { clientIp } from '../../../../lib/client-ip';
import { webEnv } from '../../../../lib/env';
import { valkey } from '../../../../lib/valkey';
import { messages } from '../../../../messages/fa';
import { eventRowOf } from '../../../../modules/events/card';
import { isFollowing, organizerFacts } from '../../../../modules/events/follows';
import { eventPriceShort, eventPriceText } from '../../../../modules/events/format';
import { publicEvent, upcomingEvents } from '../../../../modules/events/queries';
import { currentSeason } from '../../../../modules/events/seasons';
import { eventPath } from '../../../../modules/events/slug';
import { dayNumber, localParts } from '../../../../modules/events/time';
import { ancestry, cachedCatalog } from '../../../../modules/listings/catalog';
import { favoriteCounts, savedAmong } from '../../../../modules/listings/favorites';
import { amountInputValue } from '../../../../modules/listings/price';
import { activeCountries } from '../../../../modules/listings/queries';
import { countView } from '../../../../modules/listings/views';
import { streetMapView } from '../../../../modules/maps/street-map';
import { imageSources, imageUrl } from '../../../../modules/media/server';
import { chatEntry } from '../../../../modules/chat/entry';
import { eventsPath } from '../../../../modules/search/paths';
import { sellerPath } from '../../../../modules/users/profile';
import { currentSession, viewerSeesTest } from '../../../../modules/users/server';
import { followAction } from '../../../events/follow-actions';
import { BackButton, ShareButton } from '../../../v/[slug]/[token]/photo-bar';

// The event page, /e/{persian-title}/{token} (wave 1, mockup final/event). Phones: the poster whole
// (4:5) on a blurred copy of itself with back, share and ♡ over it, then the date, the place and
// the tickets as three rows with their actions (calendar, route, tickets), the other dates of a
// series, who is on stage, the details, the organiser with «دنبال کردن», the ticket-scam warning
// and similar events; «خرید بلیت» stays at the bottom. Computers: the poster on one side with a
// sticky ticket box under it, everything else beside it. Unlike a listing, the venue's address is
// public (people have to get there); the online link is shown only to signed-in visitors.
// schema.org Event markup lets search engines show the event in their event listings.

type Params = { slug: string; token: string };

const load = cache(async (token: string) => {
  const data = /^[0-9a-hjkmnp-tv-z]{10}$/.test(token) ? await publicEvent(appDb(), token) : null;
  // A test account's event is only for staff and test accounts
  return data?.testOwner && !(await viewerSeesTest()) ? null : data;
});

/** Statuses anyone may see; the rest only the owner (with a notice). An ended event is `expired`. */
const PUBLIC = new Set(['active', 'paused', 'expired']);

const STATUS: Record<string, string> = {
  scheduled: 'https://schema.org/EventScheduled',
  postponed: 'https://schema.org/EventPostponed',
  cancelled: 'https://schema.org/EventCancelled',
};
const MODE: Record<string, string> = {
  in_person: 'https://schema.org/OfflineEventAttendanceMode',
  online: 'https://schema.org/OnlineEventAttendanceMode',
  hybrid: 'https://schema.org/MixedEventAttendanceMode',
};

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { token } = await params;
  const data = await load(token);
  if (!data || !PUBLIC.has(data.listing.status)) return { title: messages.notFound.title, robots: { index: false } };
  const l = data.listing;
  const cover = data.images[0] ? imageUrl(data.images[0].key, 'full', 'webp') : null;
  return {
    title: `${l.title} | ${messages.site.name}`,
    description: l.description.slice(0, 160),
    alternates: { canonical: `${webEnv().APP_URL}${eventPath(l.title, l.publicToken)}` },
    // Ended and hidden events stay reachable for shared links, but out of search results
    robots: l.status === 'active' ? undefined : { index: false },
    openGraph: { title: l.title, description: l.description.slice(0, 160), images: cover ? [cover] : undefined, locale: 'fa_IR', type: 'website' },
  };
}

export default async function EventPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ published?: string; followed?: string; follow?: string }> }) {
  const { token } = await params;
  const data = await load(token);
  if (!data) notFound();
  const session = await currentSession();
  const isOwner = session?.user.id === data.listing.userId;
  if (!PUBLIC.has(data.listing.status) && !isOwner) notFound();

  const { listing: l, details: d, dates, images, seller, business, cityFa, cityLocal } = data;
  const env = webEnv();
  const t = messages.events.page;
  const v = messages.events.view;
  const now = new Date();
  const db = appDb();
  const [catalog, countries] = await Promise.all([cachedCatalog(db), activeCountries(db)]);
  const country = countries.find((c) => c.code === l.countryCode);
  const type = l.categoryId ? ancestry(catalog, l.categoryId).at(-1) : undefined;
  const currency = l.currency ? catalog.currencies.get(l.currency) : undefined;
  const price = eventPriceText(l.priceType, l.priceMinor !== null && currency ? { minor: l.priceMinor, currency: currency.code, minorUnit: currency.minorUnit } : null);
  // «از ۳۵ €» in the ticket box and the bottom bar; the row says «بلیت از ۳۵ €» (mockup final/event)
  const priceShort = eventPriceShort(l.priceType, l.priceMinor !== null && currency ? { minor: l.priceMinor, currency: currency.code, minorUnit: currency.minorUnit } : null);
  const upcoming = dates.filter((x) => x.endsAt > now);
  const next = upcoming[0] ?? dates.at(-1);
  const ended = l.status === 'expired' || upcoming.length === 0;
  const live = l.status === 'active' && !ended;
  const path = eventPath(l.title, l.publicToken);
  const url = `${env.APP_URL}${path}`;
  const inPerson = d.attendance !== 'online';
  const tz = d.timeZone;
  const free = l.priceType === 'free';
  const cityName = cityFa ?? cityLocal ?? '';
  const requestHeaders = await headers();
  const nonce = requestHeaders.get('x-nonce') ?? undefined;
  // A view for the seller's stats (src/modules/listings/views.ts); never the seller's own
  if (!isOwner && l.status === 'active') {
    await countView(valkey(), { listingId: l.id, ip: clientIp(requestHeaders), userAgent: requestHeaders.get('user-agent') }).catch(() => false);
  }
  const sp = await searchParams;

  const organizationId = business ? l.organizationId : null;
  const [chat, savedSet, going, facts, following, similar, mapView] = await Promise.all([
    isOwner || l.status !== 'active' ? Promise.resolve(null) : chatEntry(db, { userId: session?.user.id ?? null, listing: l, returnTo: path }),
    session && !isOwner ? savedAmong(db, session.user.id, [l.id]) : Promise.resolve(new Set<string>()),
    favoriteCounts(db, l.userId, [l.id]).then((m) => m.get(l.id) ?? 0),
    organizerFacts(db, { userId: l.userId, organizationId }),
    session && organizationId && !isOwner ? isFollowing(db, session.user.id, organizationId) : Promise.resolve(false),
    l.countryCode
      ? upcomingEvents(db, { countryCode: l.countryCode, locationId: l.locationId, categoryIds: l.categoryId ? [l.categoryId] : null, from: now, to: null, notId: l.id }, now, 3).then(async (r) =>
          r.items.length >= 2 ? r.items : (await upcomingEvents(db, { countryCode: l.countryCode!, locationId: l.locationId, from: now, to: null, notId: l.id }, now, 3)).items,
        )
      : Promise.resolve([]),
    // The venue is public: its pin where the organizer set one, otherwise the postal code's area
    d.attendance !== 'online'
      ? streetMapView(db, { countryCode: l.countryCode, postalCode: l.postalCode, placeName: l.placeName, point: l.point, pin: d.venuePin, precision: l.locationPrecision }, isOwner ? null : session?.user.id)
      : Promise.resolve(null),
  ]);
  const saved = savedSet.has(l.id);
  const similarSaved = session ? await savedAmong(db, session.user.id, similar.map((e) => e.id)) : new Set<string>();
  const season = currentSeason(now, tz);
  const organizer = d.organizerName ?? business?.name ?? seller.displayName;
  const organizerHref = business ? `/b/${business.slug}` : sellerPath(seller.publicToken);
  const verified = business?.verificationStatus === 'verified';

  // The date row: «یکشنبه، ۸ نوامبر ۲۰۲۶», «۱۴ روز دیگر», «ساعت ۲۰:۰۰ تا ۲۳:۰۰، به وقت برلین»
  const fmt = (o: Intl.DateTimeFormatOptions, date: Date) => new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { timeZone: tz, ...o }).format(date);
  const time = (date: Date) => new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(date);
  const fullDate = (date: Date) => `${fmt({ weekday: 'long' }, date)}، ${fmt({ day: 'numeric', month: 'long', year: 'numeric' }, date)}`;
  const dayMonth = (date: Date) => fmt({ day: 'numeric', month: 'long' }, date);
  const inDays = (() => {
    if (!next) return null;
    const a = localParts(now, tz);
    const b = localParts(next.startsAt, tz);
    const n = dayNumber(b) - dayNumber(a);
    return n >= 0 ? v.inDays(n) : null;
  })();
  const multiDay = next && next.endsAt.getTime() - next.startsAt.getTime() > 24 * 3_600_000;
  const timeLine = next
    ? v.time(time(next.startsAt), d.openEnd ? null : multiDay ? `${dayMonth(next.endsAt)}، ${time(next.endsAt)}` : time(next.endsAt), cityName)
    : '';
  const placeLine = [d.streetAddress, l.postalCode && l.placeName ? `${l.postalCode} ${l.placeName}` : cityLocal].filter(Boolean).join(', ');
  const addressText = [d.venueName, d.streetAddress, l.postalCode && l.placeName ? `${l.postalCode} ${l.placeName}` : cityLocal, country?.nameLocal].filter(Boolean).join(', ');
  const ticketLink = d.ticketUrl && d.scheduleStatus !== 'cancelled' ? d.ticketUrl : null;
  const buyLabel = free ? v.register : v.buy;
  const languages = d.languages.map((x) => messages.events.languages[x as keyof typeof messages.events.languages]).join('، ');
  const factRows: [string, string][] = [
    ...(languages ? [[v.facts.language, languages] as [string, string]] : []),
    [v.facts.age, d.minAge ? messages.events.age.min(d.minAge) : messages.events.age.all],
    ...(d.seating ? [[v.facts.seating, v.seating[d.seating]] as [string, string]] : []),
    ...(d.stepFree !== null && inPerson ? [[v.facts.access, v.stepFree[d.stepFree ? 'yes' : 'no']] as [string, string]] : []),
    ...(d.refundNote ? [[v.facts.refund, d.refundNote] as [string, string]] : []),
    ...(d.doorSales !== null && !free ? [[v.facts.door, v.door[d.doorSales ? 'yes' : 'no']] as [string, string]] : []),
  ];

  const jsonLd = next && {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: l.title,
    description: l.description,
    url,
    startDate: next.startsAt.toISOString(),
    ...(d.openEnd ? {} : { endDate: next.endsAt.toISOString() }),
    eventStatus: STATUS[d.scheduleStatus],
    eventAttendanceMode: MODE[d.attendance],
    image: images.map((i) => imageUrl(i.key, 'full', 'webp')).filter(Boolean),
    location: [
      ...(inPerson
        ? [
            {
              '@type': 'Place',
              name: d.venueName ?? cityLocal ?? undefined,
              address: {
                '@type': 'PostalAddress',
                streetAddress: d.streetAddress ?? undefined,
                postalCode: l.postalCode ?? undefined,
                addressLocality: l.placeName ?? cityLocal ?? undefined,
                addressCountry: l.countryCode ?? undefined,
              },
            },
          ]
        : []),
      ...(d.attendance !== 'in_person' ? [{ '@type': 'VirtualLocation', url }] : []),
    ],
    organizer: { '@type': business || d.organizerName ? 'Organization' : 'Person', name: organizer },
    ...(d.performers.length ? { performer: d.performers.map((p) => ({ '@type': 'Person', name: p.name })) } : {}),
    ...(d.languages.length ? { inLanguage: d.languages.filter((x) => x !== 'other') } : {}),
    ...(d.minAge ? { typicalAgeRange: `${d.minAge}-` } : {}),
    ...(currency && (free || l.priceMinor !== null)
      ? {
          offers: {
            '@type': 'Offer',
            url: d.ticketUrl ?? url,
            price: free ? '0' : amountInputValue(l.priceMinor!, currency.minorUnit),
            priceCurrency: currency.code,
            availability: 'https://schema.org/InStock',
            validFrom: (l.publishedAt ?? l.createdAt).toISOString(),
          },
        }
      : {}),
  };

  const [cover] = images;
  const posterSrc = cover ? imageSources(cover.key, 'full') : null;
  const blurSrc = cover ? imageUrl(cover.key, 'poster', 'webp') : null;

  // What the main button does: the organiser's ticket page, else a message to them
  const main: { href: string; label: string; external: boolean } | null = !live
    ? null
    : ticketLink
      ? { href: ticketLink, label: buyLabel, external: true }
      : chat
        ? { href: chat.href, label: v.message, external: false }
        : null;

  const rows: { icon: IconName; title: ReactNode; sub: ReactNode; action?: ReactNode }[] = [];
  if (next) {
    rows.push({
      icon: 'calendar',
      title: fullDate(next.startsAt),
      sub: (
        <>
          {inDays && !ended && <span className="me-1 rounded-full bg-saffron-100 px-2 whitespace-nowrap text-saffron-800">{inDays}</span>}
          {timeLine}
        </>
      ),
      action: live ? (
        <a href={`${path}/calendar`} className="text-sm font-bold text-brand-800 hover:underline">
          {v.calendar}
        </a>
      ) : undefined,
    });
  }
  if (inPerson) {
    rows.push({
      icon: 'pin',
      title: <bdi>{d.venueName ?? cityName}</bdi>,
      sub: placeLine ? <bdi dir="ltr">{placeLine}</bdi> : cityName,
      action:
        live && addressText ? (
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d.venuePin ? `${d.venuePin.lat},${d.venuePin.lng}` : addressText)}`} target="_blank" rel="noopener noreferrer nofollow" className="text-sm font-bold text-brand-800 hover:underline">
            {v.route}
          </a>
        ) : undefined,
    });
  }
  if (d.attendance !== 'in_person' && !ended) {
    rows.push({
      icon: 'globe',
      title: v.onlineOnly,
      sub: v.onlineHint,
      action: session ? (
        d.onlineUrl && (
          <a href={d.onlineUrl} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-sm font-bold text-brand-800 hover:underline">
            {v.join}
          </a>
        )
      ) : (
        <Link href={`/login?next=${encodeURIComponent(path)}`} className="text-sm font-bold text-brand-800 hover:underline">
          {v.join}
        </Link>
      ),
    });
  }
  if (price) {
    rows.push({
      icon: 'ticket',
      title: price,
      sub: ticketLink ? (free ? v.registerAt : v.soldAt) : free ? '' : v.noLink,
    });
  }

  const ticketBox = (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <p className="text-sm text-neutral-600">{t.tickets}</p>
      <p className="text-2xl font-black">{priceShort}</p>
      {isOwner ? (
        <OwnerTools listingId={l.id} active={l.status === 'active'} saved={going} />
      ) : (
        <>
          {main && <MainButton {...main} className="mt-3 h-12 w-full" />}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {l.status === 'active' && <FavoriteButton token={l.publicToken} saved={saved} back={path} variant="interest" />}
            <ShareBox title={l.title} />
          </div>
          {going >= 3 && <p className="mt-3 text-xs text-neutral-600">{v.going(going)}</p>}
        </>
      )}
    </div>
  );

  const organizerBox = (
    <section id="organizer" className="rounded-2xl border border-neutral-200 p-4">
      <div className="flex items-center gap-3">
        <Link href={organizerHref} className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-950 text-lg font-black text-snow">
          {facts.logoKey ? <img src={imageUrl(facts.logoKey, 'thumb', 'webp') ?? ''} alt="" className="size-full object-cover" /> : organizer.slice(0, 1)}
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={organizerHref} className="flex items-center gap-1 font-bold hover:underline">
            <span className="truncate">{organizer}</span>
            {verified && <Icon name="verified" className="size-4 shrink-0 text-brand-700" />}
          </Link>
          <p className="text-xs text-neutral-600">{verified ? v.organizerVerified(facts.events) : v.organizerEvents(facts.events)}</p>
        </div>
        {organizationId && !isOwner && (
          <form action={followAction}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="intent" value={following ? 'unfollow' : 'follow'} />
            <input type="hidden" name="back" value={path} />
            <button
              type="submit"
              aria-pressed={following}
              title={following ? v.unfollow : v.followHint}
              className={`flex h-10 items-center gap-1 rounded-lg border px-3 text-sm font-bold ${following ? 'border-neutral-300 bg-white text-neutral-800' : 'border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100'}`}
            >
              {following && <Icon name="check" className="size-4" />}
              {following ? v.following : v.follow}
            </button>
          </form>
        )}
      </div>
      {sp.followed === '1' && (
        <p role="status" className="mt-3 text-xs leading-6 text-brand-800">
          {v.followHint}
        </p>
      )}
      {sp.follow === 'limit' && <p className="mt-3 text-xs text-red-700">{messages.events.follow.limit}</p>}
    </section>
  );

  return (
    <main data-listing-page data-event-page className="mx-auto w-full max-w-6xl pb-28 lg:grid lg:grid-cols-[22rem_1fr] lg:gap-10 lg:px-6 lg:pt-8 lg:pb-10">
      {jsonLd && !ended && (
        <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      )}
      <div className="relative lg:sticky lg:top-20 lg:self-start">
        <div className="relative overflow-hidden bg-brand-950 lg:rounded-3xl">
          {blurSrc && <img src={blurSrc} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-2xl" />}
          <div className="relative mx-auto w-[72%] py-14 lg:w-full lg:py-0">
            {posterSrc ? (
              <picture>
                <source srcSet={posterSrc.avif} type="image/avif" />
                <img src={posterSrc.webp} alt={l.title} width={cover!.width ?? undefined} height={cover!.height ?? undefined} fetchPriority="high" className="w-full rounded-xl shadow-2xl lg:rounded-none" />
              </picture>
            ) : (
              <div className="flex aspect-[4/5] flex-col justify-between rounded-xl bg-brand-900 p-[8%] text-snow shadow-2xl lg:rounded-none">
                <span className="text-sm font-bold opacity-80">{type?.nameFa}</span>
                <span className="text-2xl font-black leading-[1.4]">{l.title}</span>
              </div>
            )}
          </div>
        </div>
        {images.length > 1 && (
          <ul className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-3 lg:px-0">
            {images.slice(1).map((img, i) => (
              <li key={img.id} className="shrink-0">
                <a href={imageUrl(img.key, 'full', 'webp') ?? '#'} target="_blank" rel="noopener">
                  <img src={imageUrl(img.key, 'thumb', 'webp') ?? ''} alt={messages.listing.photo(i + 2, images.length)} width={80} height={80} loading="lazy" className="size-20 rounded-xl object-cover" />
                </a>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 hidden lg:block">{ticketBox}</div>
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 p-3 lg:hidden">
          <BackButton fallback={country ? eventsPath(country.slug, null) : '/'} />
          <span className="ms-auto" />
          <span className="pointer-events-auto">
            <ShareButton title={l.title} />
          </span>
          {!isOwner && l.status === 'active' && <FavoriteButton token={l.publicToken} saved={saved} back={path} variant="photo" />}
        </div>
      </div>

      <div className="min-w-0 space-y-5 px-4 pt-4 lg:px-0 lg:pt-0">
        {sp.published && <Alert tone="success">{t.published}</Alert>}
        {!PUBLIC.has(l.status) && <Alert tone="info">{messages.listing.ownerPreview}</Alert>}
        {ended && <Alert tone="info">{t.ended}</Alert>}
        {!ended && d.scheduleStatus === 'cancelled' && <Alert tone="error">{t.cancelled}</Alert>}
        {!ended && d.scheduleStatus === 'postponed' && <Alert tone="info">{t.postponed}</Alert>}
        {l.status === 'paused' && <Alert tone="info">{t.paused}</Alert>}

        <div>
          <p className="text-sm font-bold text-brand-800">
            {country && type ? (
              <Link href={`${eventsPath(country.slug, null)}?type=${type.slug}`} className="hover:underline">
                {type.nameFa}
              </Link>
            ) : (
              type?.nameFa
            )}
            {cityName && `، ${cityName}`}
          </p>
          <h1 className="mt-1 text-2xl font-black leading-[1.5] lg:text-3xl">{l.title}</h1>
        </div>

        <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-3 p-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon name={r.icon} className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[15px]">{r.title}</b>
                {r.sub && <span className="block truncate text-xs text-neutral-600">{r.sub}</span>}
              </span>
              {r.action && <span className="shrink-0">{r.action}</span>}
            </li>
          ))}
        </ul>
        {mapView && inPerson && (
          <div>
            <StreetMap
              view={mapView}
              label={d.venueName ?? messages.map.section}
              // Taller with the visitor's place on it, so both fit closer in
              className={mapView.home ? 'aspect-[4/3] sm:aspect-[16/9]' : 'aspect-[16/9]'}
              fallback={l.countryCode ? <OutlineMap countryCode={l.countryCode} point={{ lng: mapView.center[0], lat: mapView.center[1] }} label={messages.map.section} /> : null}
            />
            {mapView.home && (
              <p className="mt-2 text-xs leading-6 text-neutral-600">{mapView.home.km < 1 ? messages.map.sameArea : messages.map.fromHome(messages.map.km(mapView.home.km))}</p>
            )}
          </div>
        )}

        {upcoming.length > 1 && (
          <section>
            <h2 className="mb-2 text-lg font-extrabold">{v.otherDates}</h2>
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {upcoming.slice(1, 9).map((x) => (
                <span key={x.startsAt.toISOString()} className="min-w-28 flex-1 shrink-0 rounded-2xl border border-neutral-200 p-3">
                  <b className="block">{dayMonth(x.startsAt)}</b>
                  <span className="text-xs text-neutral-600">
                    {fmt({ weekday: 'long' }, x.startsAt)}، {time(x.startsAt)}
                  </span>
                </span>
              ))}
            </div>
          </section>
        )}

        {d.performers.length > 0 && (
          <section>
            <h2 className="mb-2 text-lg font-extrabold">{v.performers}</h2>
            <div className="flex flex-wrap gap-2">
              {d.performers.map((p, i) => (
                <span key={i} className="flex items-center gap-2 rounded-full border border-neutral-200 py-1 ps-1 pe-3">
                  <span className="flex size-8 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-800">{p.name.slice(0, 1)}</span>
                  <span className="text-sm">
                    <b>{p.name}</b> {p.role && <span className="text-xs text-neutral-600">{p.role}</span>}
                  </span>
                </span>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-lg font-extrabold">{v.about}</h2>
          {l.description && <p className="text-base leading-8 whitespace-pre-line text-neutral-800">{l.description}</p>}
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {factRows.map(([k, val]) => (
              <div key={k} className="rounded-xl bg-neutral-50 p-3">
                <dt className="text-xs text-neutral-600">{k}</dt>
                <dd className="font-bold">{val}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="lg:hidden">{organizerBox}</div>
        {isOwner && <div className="lg:hidden">{ticketBox}</div>}
        {!free && (
          <p className="flex gap-2 rounded-xl bg-saffron-50 p-3 text-sm leading-7 text-saffron-800">
            <Icon name="alert" className="mt-1 size-5 shrink-0" />
            <span>{v.safety}</span>
          </p>
        )}
        <div className="hidden lg:block">{organizerBox}</div>

        {similar.length > 0 && (
          <section>
            <h2 className="mb-2 text-lg font-extrabold">{v.similar}</h2>
            <div className="divide-y divide-neutral-200">
              {similar.map((e) => (
                <EventRow key={e.id} e={eventRowOf(catalog, e, { saved: similarSaved, season })} back={path} />
              ))}
            </div>
          </section>
        )}

        <ListingFooter refNumber={l.refNumber} token={l.publicToken} isOwner={isOwner} isEvent />
      </div>

      {/* Phones: the date, the price and the main button, always in reach */}
      {!isOwner && live && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-neutral-200 bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden">
          <p className="min-w-0 flex-1">
            {next && (
              <span className="block truncate text-xs text-neutral-600">
                {dayMonth(next.startsAt)}، {time(next.startsAt)}
              </span>
            )}
            <b className="block truncate text-lg">{priceShort}</b>
          </p>
          <FavoriteButton token={l.publicToken} saved={saved} back={path} variant="bar" />
          {main && <MainButton {...main} className="h-12 px-5" />}
        </div>
      )}
    </main>
  );
}

function MainButton({ href, label, external, className }: { href: string; label: string; external: boolean; className: string }) {
  const cls = `flex items-center justify-center gap-2 rounded-xl bg-brand-700 font-bold text-white hover:bg-brand-800 ${className}`;
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc" className={cls}>
      {label}
      <Icon name="share" className="size-4" />
    </a>
  ) : (
    <Link href={href} className={cls}>
      <Icon name="chat" className="size-4" />
      {label}
    </Link>
  );
}

function ShareBox({ title }: { title: string }) {
  return <ShareButton title={title} label={messages.events.view.shareShort} />;
}

function OwnerTools({ listingId, active, saved }: { listingId: string; active: boolean; saved: number }) {
  return (
    <div className="mt-3 space-y-2">
      <Link href={`/my/events/${listingId}`} className="flex h-11 items-center justify-center rounded-xl border border-neutral-300 text-sm font-bold hover:bg-neutral-50">
        {messages.events.page.edit}
      </Link>
      {active && (
        <Link href={`/my/listings/${listingId}/promote`} className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-saffron-500 text-sm font-bold text-ink hover:bg-saffron-400">
          <Icon name="arrow-up" className="size-4" />
          {messages.promote.titleEvent}
        </Link>
      )}
      <p className="flex items-center gap-1.5 text-xs text-neutral-600" title={messages.favorites.countHint}>
        <Icon name="heart" className="size-4 text-red-600" />
        {messages.favorites.count(saved)}
      </p>
    </div>
  );
}
