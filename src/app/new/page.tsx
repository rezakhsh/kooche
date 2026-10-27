import Link from 'next/link';
import { Flag } from '../../components/flag';
import { categoryIcon, Icon } from '../../components/icons';
import { Alert, Card, LinkButton, PageShell } from '../../components/ui';
import { appDb } from '../../db/drizzle';
import { messages } from '../../messages/fa';
import { EVENT_ROOT_SLUG, ancestry, cachedCatalog, isEventCategory, isPostable, type CategoryNode } from '../../modules/listings/catalog';
import { normalizePersian } from '../../lib/normalize-persian';
import { CategorySearch, type Pickable } from './category-search';
import { canPostListing, loadActor } from '../../modules/users/permissions';
import { requireSession } from '../../modules/users/server';
import { postingCountry } from '../../modules/listings/posting-country';
import { activeCountries, savedPlace } from '../../modules/listings/queries';
import { myBusinesses } from '../../modules/organizations/organizations';
import { chosenCountry } from '../country-choice';
import { pickCategory } from './actions';

export const metadata = { title: messages.post.title, robots: { index: false } };

// Step 1 of posting: the category, over the seeded tree. Works without JavaScript: parents are
// links one level down, a leaf is a button that starts the draft. Wave 1 (mockup final/post1):
// the steps' header and a search over the category names with suggestions above the tree.

export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; listing?: string; error?: string; q?: string }>;
}) {
  const { user } = await requireSession('/new');
  const t = messages.post;
  const allowed = canPostListing(await loadActor(appDb(), user.id));
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
  const [catalog, countries, chosen, saved, businesses] = await Promise.all([cachedCatalog(db), activeCountries(db), chosenCountry(db), savedPlace(db, user.id), myBusinesses(db, user.id)]);
  // Business-only categories open for members of a business (roadmap step 6)
  const member = businesses.length > 0;
  // The country a new listing goes into (decided Oct 17, 2026); changing it happens on the home page
  const code = postingCountry({ listingCountry: null, chosen: chosen?.code ?? null, saved: saved?.place.countryCode ?? null, open: countries.map((c) => c.code) });
  const country = countries.find((c) => c.code === code);
  const parent = params.c ? catalog.bySlug.get(params.c) : undefined;
  const ids = parent?.isActive ? parent.childIds : catalog.rootIds;
  const items = ids.map((id) => catalog.byId.get(id)!).filter((c) => c.isActive);
  const keep = params.listing ? `&listing=${encodeURIComponent(params.listing)}` : '';
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
  const pickable: Pickable[] = [...catalog.byId.values()]
    .filter((c) => c.childIds.length === 0 && isPostable(catalog, c.id) && !isEventCategory(catalog, c.id) && (!c.businessOnly || member))
    .map((c) => {
      const chain = ancestry(catalog, c.id);
      const parentFa = chain.slice(0, -1).map((p) => p.nameFa).join('، ');
      return { slug: c.slug, nameFa: c.nameFa, parentFa, search: normalizePersian(`${c.nameFa} ${parentFa}`) };
    });
  const steps: readonly string[] = messages.form.steps;

  return (
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
        <h1 className="text-2xl font-extrabold">{params.listing ? t.title : t.whatHeading}</h1>
        {!params.listing &&
          (country ? (
            <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
              <Flag code={country.code} />
              <span>{t.inCountry(country.nameFa)}</span>
              <Link href="/?choose" className="ms-auto font-medium text-brand-800 hover:underline">
                {messages.form.changeCountry}
              </Link>
            </div>
          ) : (
            <Alert tone="info">
              {messages.form.chooseCountryFirst}{' '}
              <Link href="/?choose" className="font-bold underline">
                {messages.form.changeCountry}
              </Link>
            </Alert>
          ))}
        {error && <Alert tone="error">{error}</Alert>}
        {!params.listing && !parent && <CategorySearch all={pickable} initial={params.q ?? ''} />}
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
              <CategoryRow category={c} keep={keep} listingId={params.listing} root={!parent} member={member} />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

function CategoryRow({ category, keep, listingId, root, member }: { category: CategoryNode; keep: string; listingId?: string; root: boolean; member: boolean }) {
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
      <Link href={closed ? '/business' : `/new/${category.slug}`} className={row}>
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
