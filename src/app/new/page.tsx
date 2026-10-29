import Link from 'next/link';
import { Flag } from '../../components/flag';
import { categoryIcon, Icon } from '../../components/icons';
import { Alert, Card, LinkButton, PageShell } from '../../components/ui';
import { appDb } from '../../db/drizzle';
import { messages } from '../../messages/fa';
import { EVENT_ROOT_SLUG, ancestry, cachedCatalog, isEventCategory, isPostable, type CategoryNode } from '../../modules/listings/catalog';
import { normalizePersian } from '../../lib/normalize-persian';
import { CategorySearch, type Pickable } from './category-search';
import { PostingBar } from './posting-bar';
import { cachedCategoryCounts } from '../../modules/search/browse';
import { canPostListing, loadActor } from '../../modules/users/permissions';
import { requireSession } from '../../modules/users/server';
import { postingCountry } from '../../modules/listings/posting-country';
import { savedPlace } from '../../modules/listings/queries';
import { myBusinesses } from '../../modules/organizations/organizations';
import { chosenPostingCountry } from '../country-choice';
import { pickCategory } from './actions';
import { preparingCountries } from '../../modules/launch/country-page';
import { numberCountry, zoneOf, countryNameFa } from '../../modules/listings/zones';
import { SERVICE_ROOTS } from '../../modules/organizations/limits';
import type { IconName } from '../../components/icons';

export const metadata = { title: messages.post.title, robots: { index: false } };

// Step 1 of posting: the category, over the seeded tree. Works without JavaScript: parents are
// links one level down, a leaf is a button that starts the draft. Wave 1 (mockup final/post1):
// the steps' header and a search over the category names with suggestions above the tree.

export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; listing?: string; error?: string; q?: string; kind?: string; all?: string }>;
}) {
  const { user } = await requireSession('/new');
  const t = messages.post;
  const actor = await loadActor(appDb(), user.id);
  const allowed = canPostListing(actor);
  if (!allowed.ok) {
    return (
      <PageShell title={t.title}>
        <Card className="space-y-4">
          <p className="leading-relaxed text-neutral-700">
            {allowed.reason === 'phone_required' ? t.phoneRequired : allowed.reason === 'restricted' ? messages.post.restricted : t.accountDisabled}
          </p>
          {allowed.reason === 'phone_required' && (
            <LinkButton href="/account/phone" className="w-full">
              {t.verifyPhone}
            </LinkButton>
          )}
        </Card>
      </PageShell>
    );
  }

  const params = await searchParams;
  const db = appDb();
  const [catalog, countries, chosen, saved, businesses] = await Promise.all([cachedCatalog(db), preparingCountries(db), chosenPostingCountry(db), savedPlace(db, user.id), myBusinesses(db, user.id)]);
  // Business-only categories open for members of a business (roadmap step 6)
  const member = businesses.length > 0;
  // The country a new listing goes into (decided Oct 17, 2026); changing it happens on the home page
  const code = postingCountry({ listingCountry: null, chosen: chosen?.code ?? null, saved: saved?.place.countryCode ?? null, countries });
  const country = countries.find((c) => c.code === code);
  const parent = params.c ? catalog.bySlug.get(params.c) : undefined;
  const ids = parent?.isActive ? parent.childIds : catalog.rootIds;
  const items = ids.map((id) => catalog.byId.get(id)!).filter((c) => c.isActive);
  // A wanted post (the cross-border panel's first row): the form opens on «دنبالش هستم»
  const wanted = params.kind === 'wanted' && !params.listing;
  const keep = params.listing ? `&listing=${encodeURIComponent(params.listing)}` : wanted ? '&kind=wanted' : '';
  // Posting across borders (wave 2 part 5, mockup final/post-crossborder): a number from another
  // zone than the country's sees what is open to it instead of the whole tree at first
  const from = numberCountry(actor?.phoneE164);
  const crossZone = !!country && !!from && zoneOf(from) !== zoneOf(country.code);
  const showBorder = crossZone && !params.listing && !parent && !wanted && !params.all;
  const root = parent ? ancestry(catalog, parent.id)[0]?.slug : undefined;
  const up = parent?.parentId ? catalog.byId.get(parent.parentId) : undefined;
  const error =
    params.error === 'too_many'
      ? t.tooManyDrafts
      : params.error === 'business_only'
        ? t.businessOnly
        : params.error
          ? t.categoryNotPostable
          : null;

  // Every leaf one can post in, for the search (events have their own form)
  // With how many listings each has in the country, the busiest first (mockup final/post1)
  const counts = country ? await cachedCategoryCounts(db, country.code, null) : new Map<string, number>();
  const pickable: Pickable[] = [...catalog.byId.values()]
    .filter((c) => c.childIds.length === 0 && isPostable(catalog, c.id) && !isEventCategory(catalog, c.id) && (!c.businessOnly || member))
    .map((c) => {
      const chain = ancestry(catalog, c.id);
      const parentFa = chain.slice(0, -1).map((p) => p.nameFa).join('، ');
      const n = counts.get(c.id) ?? 0;
      return { slug: c.slug, nameFa: c.nameFa, parentFa, where: country ? t.countIn(parentFa, n, country.nameFa) : t.inParent(parentFa), n, search: normalizePersian(`${c.nameFa} ${parentFa}`) };
    })
    .sort((a, b) => b.n - a.n);
  const steps: readonly string[] = messages.form.steps;

  return (
    <>
    <PostingBar closeHref={params.listing ? `/my/listings/${params.listing}` : '/my/listings'} />
    <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-10 sm:px-6">
      <div className="space-y-4">
        {!params.listing && (
          <div>
            <ol className="grid grid-cols-4 gap-1.5" aria-hidden>
              {steps.map((n, i) => (
                <li key={n} className={`h-1.5 rounded-full ${i < 1 ? 'bg-brand-700' : 'bg-neutral-200'}`} />
              ))}
            </ol>
            <p className="mt-2 text-xs font-bold text-brand-800">{messages.form.stepOf(1, steps.length, steps[0]!)}</p>
          </div>
        )}
        <div>
          <h1 className="text-2xl font-extrabold">{params.listing ? t.title : t.whatHeading}</h1>
          {!params.listing && country && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-600">
              <Flag code={country.code} className="h-3.5 w-5" />
              {country.mode === 'open' ? t.publishedIn(country.nameFa) : t.preparedFor(country.nameFa)}{' '}
              <Link href="/?choose" className="font-bold text-brand-800 hover:underline">
                {messages.form.change}
              </Link>
            </p>
          )}
          {!params.listing && !member && (
            <Link href="/business/compare" className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-brand-800 hover:underline">
              <Icon name="store" className="size-4" />
              {messages.business.compare.link}
            </Link>
          )}
        </div>
        {!params.listing && !country && (
          <Alert tone="info">
            {messages.form.chooseCountryFirst}{' '}
            <Link href="/?choose" className="font-bold underline">
              {messages.form.changeCountry}
            </Link>
          </Alert>
        )}
        {error && <Alert tone="error">{error}</Alert>}
        {showBorder && country && from ? (
          <BorderPanel from={from} country={country} verifiedBusiness={businesses.some((b) => b.verificationStatus === 'verified')} />
        ) : (
          <>
        {wanted && <Alert tone="info">{t.border.wantedMode}</Alert>}
        {crossZone && root && (SERVICE_ROOTS as readonly string[]).includes(root) && <Alert tone="info">{t.border.onlineMode}</Alert>}
        {!params.listing && !parent && <CategorySearch all={pickable} initial={params.q ?? ''} query={wanted ? '?kind=wanted' : ''} />}
        <p className="pt-2 text-sm font-bold text-neutral-700">{parent ? t.pickCategory : t.allCategories}</p>
        {parent && (
          <div className="flex items-center gap-2 text-sm">
            <Link href={up ? `/new?c=${up.slug}${keep}` : `/new?${keep.slice(1)}`} className="flex items-center gap-1 text-brand-800 hover:underline">
              <Icon name="chevronStart" className="size-4" />
              {up ? up.nameFa : t.all}
            </Link>
            <span className="text-neutral-400">/</span>
            <span className="font-semibold">{parent.nameFa}</span>
          </div>
        )}
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200">
          {items.map((c) => (
            <li key={c.id}>
              <CategoryRow category={c} keep={keep} listingId={params.listing} root={!parent} member={member} wanted={wanted} />
            </li>
          ))}
        </ul>
          </>
        )}
      </div>
    </main>
    </>
  );
}

function CategoryRow({ category, keep, listingId, root, member, wanted }: { category: CategoryNode; keep: string; listingId?: string; root: boolean; member: boolean; wanted: boolean }) {
  const closed = category.businessOnly && !member;
  const row = 'flex min-h-14 w-full items-center gap-3 px-4 py-3 text-start text-[15px] hover:bg-neutral-50';
  const icon = root && (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
      <Icon name={categoryIcon(category.slug)} className="size-5" />
    </span>
  );
  // Events have their own form (src/app/events/new); a listing can't move into them
  if (category.path.split('.')[0] === EVENT_ROOT_SLUG) {
    if (listingId) return null;
    return (
      <Link href="/events/new" className={row}>
        {icon}
        <span>{category.nameFa}</span>
        <Icon name="chevronEnd" className="ms-auto size-4 text-neutral-400" />
      </Link>
    );
  }
  if (category.childIds.length > 0) {
    return (
      <Link href={`/new?c=${category.slug}${keep}`} className={row}>
        {icon}
        <span>{category.nameFa}</span>
        <Icon name="chevronEnd" className="ms-auto size-4 text-neutral-400" />
      </Link>
    );
  }
  // Picking a category only opens its empty form; changing an existing draft's category moves it
  if (!listingId) {
    return (
      <Link href={closed ? '/business' : `/new/${category.slug}${wanted ? '?kind=wanted' : ''}`} className={row}>
        {icon}
        <span>{category.nameFa}</span>
        {category.businessOnly && <span className="ms-auto text-xs text-neutral-500">{messages.post.businessOnly}</span>}
      </Link>
    );
  }
  return (
    <form action={pickCategory}>
      <input type="hidden" name="categoryId" value={category.id} />
      {listingId && <input type="hidden" name="listingId" value={listingId} />}
      <button type="submit" className={row} disabled={closed}>
        {icon}
        <span>{category.nameFa}</span>
        {category.businessOnly && <span className="ms-auto text-xs text-neutral-500">{messages.post.businessOnly}</span>}
      </button>
    </form>
  );
}

/** What a number from another zone may post here, what waits for a number from the zone (mockup final/post-crossborder) */
function BorderPanel({ from, country, verifiedBusiness }: { from: string; country: { code: string; nameFa: string }; verifiedBusiness: boolean }) {
  const t = messages.post.border;
  const zone = zoneOf(country.code);
  const z = t.zones[zone] ?? t.zoneOf(country.nameFa);
  const open: [IconName, string, string, string][] = [
    ['search', t.wanted, t.wantedHint(country.nameFa), '/new?kind=wanted'],
    ['calendar', t.event, t.eventHint, '/events/new'],
    ['wrench', t.online, t.onlineHint, '/new?c=services'],
    // A member of a verified business posts anything as the business
    ['store', t.business, t.businessHint, verifiedBusiness ? '/new?all=1' : '/business'],
  ];
  const locked: IconName[] = ['building', 'car', 'sofa', 'briefcase'];
  return (
    <>
      <section className="rounded-2xl bg-brand-50 p-4">
        <p className="flex items-center gap-2 text-sm font-extrabold text-brand-900">
          <Flag code={from} className="h-3.5 w-5" />
          {t.numberFrom(countryNameFa(from))}
        </p>
        <p className="mt-1 text-sm leading-7 text-neutral-800">{t.note(z.name, z.number)}</p>
      </section>
      <ul className="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200">
        {open.map(([icon, title, hint, href]) => (
          <li key={href}>
            <Link href={href} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-neutral-50">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon name={icon} className="size-5" />
              </span>
              <span className="flex-1">
                <b className="block text-[15px]">{title}</b>
                <span className="text-xs text-neutral-600">{hint}</span>
              </span>
              <Icon name="chevronEnd" className="size-5 text-neutral-400" />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 -mb-2 flex items-center gap-1.5 text-sm font-bold text-neutral-600">
        <Icon name="lock" className="size-4" />
        {z.locked}
      </p>
      <ul className="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
        {t.locked.map((title, i) => (
          <li key={title} className="flex min-h-14 items-center gap-3 px-4 text-neutral-600">
            <span className="flex size-9 items-center justify-center rounded-xl bg-white">
              <Icon name={locked[i]!} className="size-5" />
            </span>
            <span className="flex-1 text-[15px]">{title}</span>
            <Icon name="lock" className="size-4" />
          </li>
        ))}
      </ul>
      <Link href="/account/phone" className="flex h-12 items-center justify-center gap-2 rounded-xl border border-neutral-300 font-bold text-neutral-800 hover:bg-neutral-50">
        <Icon name="phone" className="size-5" />
        {t.otherNumber}
      </Link>
    </>
  );
}
