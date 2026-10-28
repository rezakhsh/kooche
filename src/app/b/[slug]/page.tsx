import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { EventRow } from '../../../components/event-row';
import { FavoriteButton } from '../../../components/favorite-button';
import { Icon, type IconName } from '../../../components/icons';
import { ListingCard } from '../../../components/listing-card';
import { OutlineMap } from '../../../components/outline-map';
import { ReportLink } from '../../../components/report-link';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { formatMonth } from '../../../lib/format';
import { messages } from '../../../messages/fa';
import { isFollowing } from '../../../modules/events/follows';
import { eventRowOf } from '../../../modules/events/card';
import { upcomingEvents } from '../../../modules/events/queries';
import { cardOf } from '../../../modules/listings/card';
import { cachedCatalog } from '../../../modules/listings/catalog';
import { savedAmong } from '../../../modules/listings/favorites';
import { imageUrl } from '../../../modules/media/server';
import { hoursJsonLd, openState, validHours, WEEKDAYS } from '../../../modules/organizations/hours';
import { businessBySlug, legalComplete, roleIn } from '../../../modules/organizations/organizations';
import { businessListingCards } from '../../../modules/organizations/queries';
import { foundingBadge } from '../../../modules/payments/founding';
import { featuredListingIds } from '../../../modules/payments/plans';
import { currentSession } from '../../../modules/users/server';
import { followAction } from '../../events/follow-actions';

// A business's public page, /b/{slug} (wave 1, mockup final/business-page): cover, logo, the
// verified and founding badges, one line, languages, «الان باز است» from its hours, message / call /
// route, its listings, events and «دربارهٔ ما» as tabs, follow, and the legal details German law
// asks of traders (§5 DDG) folded at the bottom, in German. Businesses are public, so the page is
// indexable (while SEARCH_INDEXING is on) and its address is exact, unlike a private seller's.

type Params = { slug: string };
type Search = { tab?: string; followed?: string; follow?: string };
type Tab = 'listings' | 'events' | 'about';

const load = cache(async (slug: string) => businessBySlug(appDb(), slug));
const faDigits = (s: string) => s.replace(/\d/g, (c) => '۰۱۲۳۴۵۶۷۸۹'[Number(c)]!);

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const found = await load(slug);
  if (!found) return { title: messages.notFound.title, robots: { index: false } };
  const t = messages.business.page;
  return {
    title: t.title(found.org.name),
    description: (found.org.tagline ?? found.org.description).slice(0, 160) || t.description(found.org.name, found.cityFa ?? ''),
    alternates: { canonical: `${webEnv().APP_URL}/b/${found.org.slug}` },
  };
}

export default async function BusinessPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const found = await load(slug);
  if (!found) notFound();
  const { org, cityFa, cityLocal, neighbourhood } = found;
  const db = appDb();
  const env = webEnv();
  const t = messages.business;
  const p = t.profile;
  const now = new Date();
  const timeZone = found.timeZone ?? env.APP_TIME_ZONE;
  const session = await currentSession();
  const [catalog, items, events, member] = await Promise.all([
    cachedCatalog(db),
    businessListingCards(db, org.id),
    upcomingEvents(db, { organizationId: org.id, from: now, to: null }, now, 20).then((r) => r.items),
    session ? roleIn(db, session.user.id, org.id) : Promise.resolve(null),
  ]);
  const [saved, featured, following] = await Promise.all([
    session ? savedAmong(db, session.user.id, [...items.map((l) => l.id), ...events.map((e) => e.id)]) : Promise.resolve(new Set<string>()),
    featuredListingIds(db, items.map((l) => l.id)),
    session && !member ? isFollowing(db, session.user.id, org.id) : Promise.resolve(false),
  ]);

  const path = `/b/${org.slug}`;
  const hours = validHours(org.openingHours) ? org.openingHours : null;
  const open = hours ? openState(hours, timeZone, now) : null;
  const openLine = !open
    ? null
    : open.open
      ? p.openUntil(faDigits(open.until))
      : open.next
        ? open.next.today
          ? p.opensToday(faDigits(open.next.at))
          : p.opensOn(t.days[open.next.day]!, faDigits(open.next.at))
        : p.closedNow;
  const street = org.addressLine1 ? [org.addressLine1, org.addressLine2].filter(Boolean).join(', ') : null;
  const addressLatin = street ? [street, [org.postalCode, cityLocal].filter(Boolean).join(' ')].filter(Boolean).join(', ') : null;
  const verified = org.verificationStatus === 'verified';
  const legal = legalComplete(org);
  const logo = org.logoKey ? imageUrl(org.logoKey, 'thumb', 'webp') : null;
  const tab: Tab = sp.tab === 'events' || sp.tab === 'about' || sp.tab === 'listings' ? sp.tab : items.length || !events.length ? 'listings' : 'events';
  const chips = [[neighbourhood, cityFa].filter(Boolean).join('، '), org.languages.map((l) => t.languages[l]).join('، '), p.memberSince(formatMonth(org.createdAt, env.APP_TIME_ZONE))].filter(Boolean);

  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: org.name,
    legalName: org.legalName ?? undefined,
    description: org.tagline ?? undefined,
    url: `${env.APP_URL}${path}`,
    logo: logo ?? undefined,
    email: org.email ?? undefined,
    telephone: org.phoneE164 ?? undefined,
    address: street ? { '@type': 'PostalAddress', streetAddress: street, postalCode: org.postalCode ?? undefined, addressLocality: cityLocal ?? undefined, addressCountry: org.countryCode } : undefined,
    openingHoursSpecification: hours ? hoursJsonLd(hours) : undefined,
    sameAs: [org.instagram && `https://www.instagram.com/${org.instagram}`, org.telegram && `https://t.me/${org.telegram}`].filter(Boolean),
  };

  const actions: { icon: IconName; label: string; href: string; external?: boolean }[] = [
    ...(org.phoneE164 ? [{ icon: 'phone' as const, label: p.call, href: `tel:${org.phoneE164}` }] : []),
    ...(addressLatin ? [{ icon: 'pin' as const, label: p.route, href: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressLatin)}`, external: true }] : []),
  ];
  const tabHref = (x: Tab) => `${path}${x === 'listings' ? '' : `?tab=${x}`}#tabs`;

  const contactRows: { icon: IconName; text: string; href?: string; ltr?: boolean }[] = [
    ...(street ? [{ icon: 'pin' as const, text: [street, [org.postalCode, cityLocal].filter(Boolean).join(' ')].join(', '), ltr: true }] : []),
    ...(org.phoneE164 ? [{ icon: 'phone' as const, text: org.phoneE164, href: `tel:${org.phoneE164}`, ltr: true }] : []),
    ...(org.email ? [{ icon: 'mail' as const, text: org.email, href: `mailto:${org.email}`, ltr: true }] : []),
    ...(org.website ? [{ icon: 'globe' as const, text: org.website.replace(/^https:\/\//, ''), href: org.website, ltr: true }] : []),
    ...(org.instagram ? [{ icon: 'camera' as const, text: `@${org.instagram}`, href: `https://www.instagram.com/${org.instagram}`, ltr: true }] : []),
    ...(org.telegram ? [{ icon: 'send' as const, text: `@${org.telegram}`, href: `https://t.me/${org.telegram}`, ltr: true }] : []),
  ];

  return (
    <main data-soft-page className="mx-auto w-full max-w-4xl pb-10">
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="h-28 bg-gradient-to-l from-brand-800 to-brand-600 lg:mt-6 lg:h-40 lg:rounded-3xl" aria-hidden />
      <div className="px-4 lg:px-6">
        <div className="-mt-10 flex items-end gap-3">
          <span className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-white text-2xl font-black text-brand-800 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo ? <img src={logo} alt="" className="size-full object-cover" /> : org.name.trim().charAt(0)}
          </span>
          {member ? (
            <Link href={`${path}/manage`} className="ms-auto flex h-10 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-bold text-neutral-800 hover:bg-neutral-50">
              <Icon name="gear" className="size-4" />
              {t.page.manage}
            </Link>
          ) : (
            <form action={followAction} className="ms-auto">
              <input type="hidden" name="organizationId" value={org.id} />
              <input type="hidden" name="intent" value={following ? 'unfollow' : 'follow'} />
              <input type="hidden" name="back" value={path} />
              <button
                type="submit"
                aria-pressed={following}
                title={p.followHint}
                className={`flex h-10 items-center gap-1 rounded-lg border px-3 text-sm font-bold ${following ? 'border-neutral-300 bg-white text-neutral-800' : 'border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100'}`}
              >
                {following && <Icon name="check" className="size-4" />}
                {following ? p.following : p.follow}
              </button>
            </form>
          )}
        </div>
        {sp.followed === '1' && (
          <p role="status" className="mt-2 text-end text-xs text-brand-800">
            {p.followHint}
          </p>
        )}
        {sp.follow === 'limit' && <p className="mt-2 text-end text-xs text-red-700">{messages.events.follow.limit}</p>}

        <h1 className="mt-3 flex flex-wrap items-center gap-1.5 text-2xl font-extrabold">
          <bdi>{org.name}</bdi>
          {verified && (
            <span title={p.verifiedHint} className="inline-flex">
              <Icon name="verified" className="size-6 text-brand-700" />
              <span className="sr-only">{t.verified}</span>
            </span>
          )}
          {foundingBadge(org) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-saffron-50 px-2.5 text-xs leading-6 font-bold text-saffron-800" title={t.foundingBadgeTitle}>
              <Icon name="star" className="size-3.5" />
              {t.foundingBadge}
            </span>
          )}
        </h1>
        {(org.tagline || org.businessType) && <p className="text-sm text-neutral-700">{org.tagline ?? t.types[org.businessType!]}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          {chips.map((x) => (
            <span key={x} className="rounded-full bg-neutral-100 px-2.5 leading-7">
              {x}
            </span>
          ))}
          {org.servesOnline && <span className="rounded-full bg-neutral-100 px-2.5 leading-7">{p.online}</span>}
          {openLine && <span className={`rounded-full px-2.5 leading-7 font-bold ${open?.open ? 'bg-green-50 text-green-800' : 'bg-neutral-100 text-neutral-700'}`}>{openLine}</span>}
        </div>

        {/* Message, call, route. A chat always belongs to a listing (as on Kleinanzeigen): one live
            listing opens its chat, several ask which one, none leaves the button out (wave 1) */}
        {!member && (items.length > 0 || actions.length > 0) && (
          <div className={`mt-4 grid gap-2 ${['grid-cols-1', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3'][actions.length + (items.length ? 1 : 0)]}`}>
            {items.length === 1 ? (
              <Link href={`/chat/new?l=${items[0]!.publicToken}`} className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-700 text-sm font-bold text-white hover:bg-brand-800">
                <Icon name="chat" className="size-4" />
                {p.message}
              </Link>
            ) : items.length > 1 ? (
              <details className="group relative">
                <summary className="flex h-12 cursor-pointer list-none items-center justify-center gap-1.5 rounded-xl bg-brand-700 text-sm font-bold text-white hover:bg-brand-800 [&::-webkit-details-marker]:hidden">
                  <Icon name="chat" className="size-4" />
                  {p.message}
                </summary>
                <div className="absolute start-0 top-14 z-20 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-neutral-200 bg-white p-2 shadow-lg">
                  <p className="px-2 pt-1 pb-2 text-xs font-bold text-neutral-600">{p.messagePick}</p>
                  <ul className="max-h-72 overflow-y-auto">
                    {items.slice(0, 12).map((l) => (
                      <li key={l.id}>
                        <Link href={`/chat/new?l=${l.publicToken}`} className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm hover:bg-neutral-50">
                          <Icon name="chat" className="size-4 shrink-0 text-brand-700" />
                          <span className="truncate">{l.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            ) : null}
            {actions.map((a) => (
              <a key={a.label} href={a.href} {...(a.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-neutral-300 bg-white text-sm font-bold text-neutral-800 hover:bg-neutral-50">
                <Icon name={a.icon} className="size-4" />
                {a.label}
              </a>
            ))}
          </div>
        )}

        <nav id="tabs" aria-label={org.name} className="mt-6 flex gap-5 overflow-x-auto border-b border-neutral-200 text-sm">
          {(['listings', 'events', 'about'] as const).map((x) => (
            <Link
              key={x}
              href={tabHref(x)}
              scroll={false}
              aria-current={tab === x ? 'page' : undefined}
              className={`shrink-0 pb-2 ${tab === x ? 'border-b-2 border-brand-700 font-bold text-brand-800' : 'text-neutral-600 hover:text-neutral-900'}`}
            >
              {x === 'listings' ? p.tabs.listings(items.length) : p.tabs[x]}
            </Link>
          ))}
        </nav>

        {tab === 'listings' &&
          (items.length === 0 ? (
            <p className="mt-4 text-neutral-600">{t.page.noListings}</p>
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
              {items.map((l) => (
                <li key={l.id}>
                  <ListingCard
                    card={(() => {
                      const card = cardOf(catalog, l, env.APP_TIME_ZONE);
                      return { ...card, featured: featured.has(l.id), tile: card.tile ? { ...card.tile, sub: org.name } : null };
                    })()}
                    view="grid"
                    favorite={member ? undefined : <FavoriteButton token={l.publicToken} saved={saved.has(l.id)} back={path} />}
                  />
                </li>
              ))}
            </ul>
          ))}

        {tab === 'events' &&
          (events.length === 0 ? (
            <p className="mt-4 text-neutral-600">{p.noEvents}</p>
          ) : (
            <div className="mt-1 divide-y divide-neutral-200">
              {events.map((e) => (
                <EventRow key={e.id} e={eventRowOf(catalog, e, { saved, season: null })} back={`${path}?tab=events`} />
              ))}
            </div>
          ))}

        {tab === 'about' && (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_20rem]">
            <div className="min-w-0 space-y-4">
              {org.description && (
                <p className="leading-8 whitespace-pre-line text-neutral-800" dir="auto">
                  {org.description}
                </p>
              )}
              {hours && (
                <section className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <h2 className="mb-2 font-extrabold">{p.hours}</h2>
                  <dl className="divide-y divide-neutral-100 text-sm">
                    {WEEKDAYS.map((d) => (
                      <div key={d} className="flex justify-between py-2">
                        <dt>{t.days[d]}</dt>
                        <dd className={hours[d] ? 'font-bold' : 'text-neutral-500'}>{hours[d] ? hours[d]!.map(([a, b]) => faDigits(`${a}–${b}`)).join('، ') : t.wizard.closed}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
            </div>
            {contactRows.length > 0 && (
              <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
                <h2 className="font-extrabold">{p.contact}</h2>
                {contactRows.map((r) => (
                  <p key={r.text} className="flex items-start gap-2">
                    <Icon name={r.icon} className="mt-0.5 size-4 shrink-0 text-neutral-500" />
                    {r.href ? (
                      <a href={r.href} {...(r.href.startsWith('https:') ? { target: '_blank', rel: 'noopener noreferrer nofollow ugc' } : {})} dir={r.ltr ? 'ltr' : undefined} className="break-all text-brand-800 hover:underline">
                        {r.text}
                      </a>
                    ) : (
                      <bdi dir="ltr">{r.text}</bdi>
                    )}
                  </p>
                ))}
                {street && org.point && <OutlineMap countryCode={org.countryCode} point={org.point} label={t.page.address} />}
              </section>
            )}
          </div>
        )}

        {legal && (
          <details className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-bold">{p.imprint}</summary>
            <div lang="de" dir="ltr" className="mt-3 space-y-1 text-start text-sm text-neutral-800">
              <p className="font-bold">
                {org.legalName}
                {org.legalForm && !org.legalName?.includes(org.legalForm) ? ` (${org.legalForm})` : ''}
              </p>
              <p>{org.addressLine1}</p>
              {org.addressLine2 && <p>{org.addressLine2}</p>}
              <p>{[org.postalCode, cityLocal].filter(Boolean).join(' ')}</p>
              <p>{org.countryCode === 'AT' ? 'Österreich' : 'Deutschland'}</p>
              {org.representativeName && <p>Vertreten durch: {org.representativeName}</p>}
              {org.email && <p>E-Mail: {org.email}</p>}
              {org.phoneE164 && <p>Telefon: {org.phoneE164}</p>}
              {org.registerCourt && org.registrationNumber && (
                <p>
                  Registergericht: {org.registerCourt}, {org.registrationNumber}
                </p>
              )}
              {org.vatId && <p>USt-IdNr.: {org.vatId}</p>}
              {org.imprintExtra && <p className="whitespace-pre-line">{org.imprintExtra}</p>}
            </div>
          </details>
        )}
        {!member && (
          <div className="mt-4">
            <ReportLink kind="business" id={org.slug} label={messages.report.button.business} />
          </div>
        )}
      </div>
    </main>
  );
}
