import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { Alert, PageShell } from '../../../../components/ui';
import { appDb } from '../../../../db/drizzle';
import { messages } from '../../../../messages/fa';
import { isEventListing } from '../../../../modules/events/queries';
import { ownListing } from '../../../../modules/listings/listings';
import { takeDownStatement } from '../../../../modules/listings/queries';
import { listingPath } from '../../../../modules/listings/slug';
import { requireSession } from '../../../../modules/users/server';
import { chosenCountry } from '../../../country-choice';
import { editorData } from '../editor-data';
import { ListingEditor } from './editor';

export const metadata = { title: messages.form.editTitle, robots: { index: false } };

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireSession(`/my/listings/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const db = appDb();
  const own = await ownListing(db, user.id, id);
  if (!own?.listing.categoryId) notFound();
  if (await isEventListing(db, own.listing.id)) redirect(`/my/events/${own.listing.id}`);
  const { listing, images } = own;
  const categoryId = listing.categoryId!;
  const t = messages.form;

  const statement = listing.status === 'rejected' ? await takeDownStatement(db, listing.id) : null;
  const editable = ['draft', 'active', 'paused', 'expired', 'rejected'].includes(listing.status);
  const editor = editable ? await editorData(db, user.id, categoryId, listing, images, (await chosenCountry(db))?.code ?? null) : null;

  return (
    <PageShell title={listing.status === 'draft' ? t.draftTitle : t.editTitle} wide>
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
          <Link href={listingPath(listing.title, listing.publicToken)} className="text-sm text-brand-800 hover:underline">
            {t.view} ←
          </Link>
        )}
        {editor && <ListingEditor {...editor} />}
      </div>
    </PageShell>
  );
}
