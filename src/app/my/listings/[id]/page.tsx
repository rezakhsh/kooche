import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { Alert, PageShell } from '../../../../components/ui';
import { appDb } from '../../../../db/drizzle';
import { users } from '../../../../db/schema';
import { messages } from '../../../../messages/fa';
import { ancestry, cachedCatalog, effectiveAttributes } from '../../../../modules/listings/catalog';
import { maxImages, ownListing, priceTypesFor } from '../../../../modules/listings/listings';
import { amountInputValue } from '../../../../modules/listings/price';
import { activeCities, takeDownStatement } from '../../../../modules/listings/queries';
import { listingPath } from '../../../../modules/listings/slug';
import { storage } from '../../../../modules/media/server';
import { requireSession } from '../../../../modules/users/server';
import { photoView } from '../photo-view';
import { ListingForm, type FormProps } from './form';
import { PhotoEditor } from './photos';

export const metadata = { title: messages.form.editTitle, robots: { index: false } };

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireSession(`/my/listings/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const db = appDb();
  const own = await ownListing(db, user.id, id);
  if (!own?.listing.categoryId) notFound();
  const { listing, images } = own;
  const categoryId = listing.categoryId!;
  const t = messages.form;

  const [catalog, cities, [me]] = await Promise.all([
    cachedCatalog(db),
    activeCities(db),
    db.select({ displayName: users.displayName }).from(users).where(eq(users.id, user.id)),
  ]);
  const category = catalog.byId.get(categoryId)!;
  const defs = effectiveAttributes(catalog, category.id).filter((d) => d.isActive);
  const currency = listing.currency ? catalog.currencies.get(listing.currency) : undefined;
  const statement = listing.status === 'rejected' ? await takeDownStatement(db, listing.id) : null;
  const editable = ['draft', 'active', 'paused', 'expired', 'rejected'].includes(listing.status);
  const city = cities.find((c) => c.id === listing.locationId);

  const props: FormProps = {
    listingId: listing.id,
    status: listing.status,
    categoryPath: ancestry(catalog, category.id).map((c) => c.nameFa),
    defs,
    priceTypes: [...priceTypesFor(category.priceMode)],
    currencies: [...catalog.currencies.values()].map((c) => ({ code: c.code, label: `${c.nameFa} (${c.symbol})` })),
    cities: cities.map((c) => ({ id: c.id, label: c.regionFa ? `${c.nameFa}، ${c.regionFa}` : c.nameFa, currency: c.defaultCurrency })),
    needsName: me?.displayName === messages.account.defaultDisplayName,
    values: {
      kind: listing.kind,
      title: listing.title,
      description: listing.description,
      attributes: listing.attributes as Record<string, unknown>,
      priceType: listing.priceType,
      amount: listing.priceMinor !== null && currency ? amountInputValue(listing.priceMinor, currency.minorUnit) : '',
      currency: listing.currency ?? city?.defaultCurrency ?? cities[0]?.defaultCurrency ?? 'EUR',
      locationId: listing.locationId ?? '',
      district: listing.district ?? '',
      area: listing.locationPrecision === 'area' && listing.point ? listing.point : null,
      allowPhoneContact: listing.allowPhoneContact,
      shippingOffered: listing.shippingOffered,
    },
  };

  return (
    <PageShell title={listing.status === 'draft' ? t.draftTitle : t.editTitle}>
      <div className="space-y-6">
        {listing.status === 'rejected' && (
          <Alert tone="error">
            {t.rejectedNotice}
            {statement && (
              <>
                <br />
                <span className="font-semibold">{t.reason}</span> {statement}
              </>
            )}
          </Alert>
        )}
        {listing.status === 'active' && <Alert tone="info">{t.liveNotice}</Alert>}
        {!editable && <Alert tone="error">{t.notEditable}</Alert>}
        {listing.status !== 'draft' && (
          <Link href={listingPath(listing.title, listing.publicToken)} className="text-sm text-emerald-800 hover:underline">
            {t.view} ←
          </Link>
        )}
        {editable && (
          <>
            <PhotoEditor
              listingId={listing.id}
              max={maxImages(category)}
              initial={images.map(photoView)}
              enabled={storage() !== null}
            />
            <ListingForm {...props} />
          </>
        )}
      </div>
    </PageShell>
  );
}
