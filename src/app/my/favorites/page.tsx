import Link from 'next/link';
import { Icon } from '../../../components/icons';
import { Pill } from '../../../components/ui';
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
// away stay, dimmed, as "no longer available"; their page is linked while it still opens. Wave 1
// (no mockup; designed like «آگهی‌های من»): price first as on the cards, the filled heart to
// remove, and an empty state that leads to the listings.

export const metadata = { title: messages.favorites.title, robots: { index: false } };

export default async function MyFavoritesPage({ searchParams }: { searchParams: Promise<{ after?: string }> }) {
  const { user } = await requireSession('/my/favorites');
  const { after } = await searchParams;
  const db = appDb();
  const [page, catalog] = await Promise.all([myFavorites(db, user.id, after ?? null), cachedCatalog(db)]);
  const t = messages.favorites;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-5 pb-24">
      <h1 className="text-2xl font-extrabold">{t.title}</h1>
      {page.items.length === 0 && !after && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl bg-neutral-50 px-6 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-white text-red-600">
            <Icon name="heart" className="size-7" />
          </span>
          <p className="max-w-sm text-sm leading-7 text-neutral-700">{t.empty}</p>
          <Link href="/" className="flex h-11 items-center rounded-xl bg-brand-700 px-4 text-sm font-bold text-white hover:bg-brand-800">
            {t.browse}
          </Link>
        </div>
      )}
      <ul className="mt-2">
        {page.items.map((l) => {
          const currency = l.currency ? catalog.currencies.get(l.currency) : undefined;
          const price = l.priceMinor !== null && currency ? formatPrice(l.priceMinor, currency.code, currency.minorUnit) : l.categoryId && catalog.byId.get(l.categoryId)?.priceMode === 'none' ? null : messages.priceType[l.priceType];
          const place = placeParts({ ...l, cityLocal: null }, messages.country.near);
          const thumb = l.coverKey ? imageUrl(l.coverKey, 'thumb', 'webp') : null;
          const href = listingPath(l.title, l.publicToken);
          return (
            <li key={l.id} className={`flex gap-3 border-b border-neutral-200 py-3.5 ${l.available ? '' : 'opacity-70'}`}>
              <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-neutral-100 lg:size-24">
                {thumb ? (
                  <img src={thumb} alt="" width={96} height={96} className={`size-full object-cover ${l.available ? '' : 'grayscale'}`} />
                ) : (
                  <div className="flex size-full items-center justify-center text-neutral-400">
                    <Icon name="image" className="size-7" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                {l.available && price && <p className="text-base font-extrabold text-brand-800">{price}</p>}
                {l.linkable ? (
                  <Link href={href} className="block truncate text-[15px] font-bold hover:underline">
                    {l.title}
                  </Link>
                ) : (
                  <p className="truncate text-[15px] font-bold text-neutral-600">{l.title}</p>
                )}
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                  {!l.available && <Pill tone="neutral">{t.gone}</Pill>}
                  {(l.neighbourhood || place.local || place.city) && (
                    <span className="flex items-center gap-1">
                      <Icon name="pin" className="size-3" />
                      {l.neighbourhood ?? (place.local ? <bdi dir="ltr">{place.local}</bdi> : place.city)}
                    </span>
                  )}
                </p>
              </div>
              <form action={removeFromFavorites} className="shrink-0 self-center">
                <input type="hidden" name="token" value={l.publicToken} />
                <button type="submit" className="flex size-11 items-center justify-center rounded-full text-red-600 hover:bg-red-50" aria-label={`${t.remove}: ${l.title}`} title={t.remove}>
                  <Icon name="heart" className="size-6 fill-current" />
                </button>
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
    </main>
  );
}
