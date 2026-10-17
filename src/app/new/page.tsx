import Link from 'next/link';
import { Alert, Card, LinkButton, PageShell } from '../../components/ui';
import { appDb } from '../../db/drizzle';
import { messages } from '../../messages/fa';
import { cachedCatalog, type CategoryNode } from '../../modules/listings/catalog';
import { canPostListing, loadActor } from '../../modules/users/permissions';
import { requireSession } from '../../modules/users/server';
import { pickCategory } from './actions';

export const metadata = { title: messages.post.title, robots: { index: false } };

// Step 1 of posting: the category, over the seeded tree. Works without JavaScript: parents are
// links one level down, a leaf is a button that starts the draft.

export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; listing?: string; error?: string }>;
}) {
  const { user } = await requireSession('/new');
  const t = messages.post;
  const allowed = canPostListing(await loadActor(appDb(), user.id));
  if (!allowed.ok) {
    return (
      <PageShell title={t.title}>
        <Card className="space-y-4">
          <p className="leading-relaxed text-neutral-700">
            {allowed.reason === 'phone_required' ? t.phoneRequired : t.accountDisabled}
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
  const catalog = await cachedCatalog(appDb());
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

  return (
    <PageShell title={t.title}>
      <div className="space-y-4">
        <p className="text-neutral-600">{t.pickCategory}</p>
        {error && <Alert tone="error">{error}</Alert>}
        {parent && (
          <div className="flex items-center gap-2 text-sm">
            <Link href={up ? `/new?c=${up.slug}${keep}` : `/new?${keep.slice(1)}`} className="text-emerald-800 hover:underline">
              → {up ? up.nameFa : t.all}
            </Link>
            <span className="text-neutral-400">/</span>
            <span className="font-semibold">{parent.nameFa}</span>
          </div>
        )}
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200">
          {items.map((c) => (
            <li key={c.id}>
              <CategoryRow category={c} keep={keep} listingId={params.listing} />
            </li>
          ))}
        </ul>
      </div>
    </PageShell>
  );
}

function CategoryRow({ category, keep, listingId }: { category: CategoryNode; keep: string; listingId?: string }) {
  const row = 'flex w-full items-center justify-between gap-3 px-4 py-4 text-start hover:bg-neutral-50';
  if (category.childIds.length > 0) {
    return (
      <Link href={`/new?c=${category.slug}${keep}`} className={row}>
        <span>{category.nameFa}</span>
        <span aria-hidden className="text-neutral-400">
          ‹
        </span>
      </Link>
    );
  }
  return (
    <form action={pickCategory}>
      <input type="hidden" name="categoryId" value={category.id} />
      {listingId && <input type="hidden" name="listingId" value={listingId} />}
      <button type="submit" className={row} disabled={category.businessOnly}>
        <span>{category.nameFa}</span>
        {category.businessOnly && <span className="text-xs text-neutral-500">{messages.post.businessOnly}</span>}
      </button>
    </form>
  );
}
