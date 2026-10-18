import Link from 'next/link';
import { Icon } from '../../../components/icons';
import { Button, LinkButton, PageShell, Pill } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { messages } from '../../../messages/fa';
import { cachedCatalog } from '../../../modules/listings/catalog';
import { myFavorites } from '../../../modules/listings/favorites';
import { placeParts } from '../../../modules/listings/place-text';
import { formatPrice } from '../../../modules/listings/price';
import { listingPath } from '../../../modules/listings/slug';
import { imageUrl } from '../../../modules/media/server';
import { requireSession } from '../../../modules/users/server';
import { removeFromFavorites } from './actions';

// "My favorites" (approved Oct 18, 2026): newest saved first, 24 at a time. Listings that went
// away stay, dimmed, as "no longer available"; their page is linked while it still opens.

export const metadata = { title: messages.favorites.title, robots: { index: false } };

export default async function MyFavoritesPage({ searchParams }: { searchParams: Promise<{ after?: string }> }) {
  const { user } = await requireSession('/my/favorites');
  const { after } = await searchParams;
  const db = appDb();
  const [page, catalog] = await Promise.all([myFavorites(db, user.id, after ?? null), cachedCatalog(db)]);
  const t = messages.favorites;

  return (
    <PageShell title={t.title} wide>
      {page.items.length === 0 && !after && (
        <div className="space-y-4 text-neutral-600">
          <p>{t.empty}</p>
          <LinkButton href="/" variant="secondary">
            {t.browse}
          </LinkButton>
        </div>
      )}
      <ul className="divide-y divide-neutral-200">
        {page.items.map((l) => {
          const currency = l.currency ? catalog.currencies.get(l.currency) : undefined;
          const price = l.priceMinor !== null && currency ? formatPrice(l.priceMinor, currency.code, currency.minorUnit) : l.categoryId && catalog.byId.get(l.categoryId)?.priceMode === 'none' ? null : messages.priceType[l.priceType];
          const place = placeParts({ ...l, cityLocal: null }, messages.country.near);
          const thumb = l.coverKey ? imageUrl(l.coverKey, 'thumb', 'webp') : null;
          const href = listingPath(l.title, l.publicToken);
          return (
            <li key={l.id} className={`flex gap-3 py-4 ${l.available ? '' : 'opacity-70'}`}>
              <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-neutral-100 sm:size-24">
                {thumb ? (
                  <img src={thumb} alt="" width={96} height={96} className={`size-full object-cover ${l.available ? '' : 'grayscale'}`} />
                ) : (
                  <div className="flex size-full items-center justify-center text-neutral-400">
                    <Icon name="image" className="size-7" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                {l.linkable ? (
                  <Link href={href} className="block truncate font-bold hover:underline">
                    {l.title}
                  </Link>
                ) : (
                  <p className="truncate font-bold text-neutral-600">{l.title}</p>
                )}
                {l.available && price && <p className="text-sm font-extrabold text-brand-700">{price}</p>}
                <p className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  {!l.available && <Pill tone="neutral">{t.gone}</Pill>}
                  {(place.local || place.city) && (
                    <span className="flex items-center gap-1">
                      <Icon name="pin" className="size-3" />
                      {place.local ? <bdi dir="ltr">{place.local}</bdi> : place.city}
                    </span>
                  )}
                </p>
              </div>
              <form action={removeFromFavorites} className="shrink-0 self-center">
                <input type="hidden" name="token" value={l.publicToken} />
                <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs" aria-label={`${t.remove}: ${l.title}`}>
                  <Icon name="heart" className="size-4 fill-current text-red-600" />
                  <span className="hidden sm:inline">{t.remove}</span>
                </Button>
              </form>
            </li>
          );
        })}
      </ul>
      {page.next && (
        <div className="mt-6 flex justify-center">
          <Link href={`/my/favorites?after=${encodeURIComponent(page.next)}`} className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-bold hover:bg-neutral-50">
            {t.more}
          </Link>
        </div>
      )}
    </PageShell>
  );
}
