import Link from 'next/link';
import { Button } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { admin, faDigits } from '../../../messages/fa';
import { freshListings } from '../../../modules/admin/queue';
import { adminHref, requireStaff } from '../../../modules/admin/server';
import { formatPrice } from '../../../modules/listings/price';
import { cachedCatalog } from '../../../modules/listings/catalog';
import { imageUrl } from '../../../modules/media/server';
import { approveFreshAction } from '../moderation-actions';
import { Flag } from '../../../components/flag';
import { countryNameFa } from '../../../modules/listings/zones';
import { AdminTitle, Ago } from '../ui';

// The quick look at new listings from accounts under 7 days and from numbers of another zone (wave 2
// part 5): the moderation routine, list B, until the AI review takes this over.

export default async function FreshPage() {
  await requireStaff('listing.moderate');
  const db = appDb();
  const [rows, catalog] = await Promise.all([freshListings(db), cachedCatalog(db)]);
  const t = admin.fresh;
  return (
    <>
      <AdminTitle title={t.title} intro={t.intro} />
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-neutral-600">{t.empty}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const cover = r.cover ? imageUrl(r.cover, 'card', 'webp') : null;
            const cur = r.currency ? catalog.currencies.get(r.currency) : undefined;
            return (
              <li key={r.id} className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200">
                <div className="aspect-[4/3] bg-neutral-100">{cover && <img src={cover} alt="" className="size-full object-cover" loading="lazy" />}</div>
                <div className="flex flex-1 flex-col gap-1 p-3 text-sm">
                  <p className="truncate font-bold"><bdi dir="auto">{r.title}</bdi></p>
                  {r.price_minor !== null && cur && <p>{formatPrice(Number(r.price_minor), cur.code, cur.minorUnit)}</p>}
                  <p className="text-xs text-neutral-500">
                    <bdi>{r.seller}</bdi>، {t.sellerAge('')}<Ago date={new Date(r.seller_since)} />، {admin.item.code} {faDigits(String(r.ref_number))}
                  </p>
                  <p className="text-xs text-neutral-500"><Ago date={new Date(r.published_at)} /></p>
                  {r.other_zone && (
                    <p className="flex items-center gap-1 self-start rounded-full bg-saffron-50 px-2.5 text-xs font-bold leading-7 text-saffron-800">
                      <Flag code={r.other_zone} className="h-3 w-4" />
                      {t.otherZone(countryNameFa(r.other_zone))}
                    </p>
                  )}
                  <div className="mt-auto flex gap-2 pt-2">
                    <form action={approveFreshAction} className="flex-1">
                      <input type="hidden" name="id" value={r.id} />
                      <Button type="submit" variant="secondary" className="w-full">{t.ok}</Button>
                    </form>
                    <Link href={adminHref(`/items/listing/${r.id}`)} prefetch={false} className="inline-flex flex-1 items-center justify-center rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white hover:bg-brand-800">
                      {t.review}
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
