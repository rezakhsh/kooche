import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { TakeDownReason } from '../../../../components/take-down-reason';
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
import { NoScriptSteps } from './no-script-steps';

export const metadata = { title: messages.form.editTitle, robots: { index: false } };

export default async function EditListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ step?: string }> }) {
  const { id } = await params;
  const { step } = await searchParams;
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

  // A draft continues in steps (wave 1, ./steps.ts), at the step its address names
  if (listing.status === 'draft' && editor) {
    const initial = step === '3' ? 3 : step === '4' ? 4 : 2;
    return (
      <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-10 sm:px-6">
        <NoScriptSteps />
        <div className="space-y-6">
          <ListingEditor {...editor} initialStep={initial} />
        </div>
      </main>
    );
  }

  return (
    <PageShell title={listing.status === 'draft' ? t.draftTitle : t.editTitle} wide>
      <div className="space-y-6">
        {listing.status === 'rejected' && (
          <TakeDownReason notice={t.rejectedNotice} reason={statement} />
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
