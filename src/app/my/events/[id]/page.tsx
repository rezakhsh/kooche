import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { TakeDownReason } from '../../../../components/take-down-reason';
import { Alert, PageShell } from '../../../../components/ui';
import { appDb } from '../../../../db/drizzle';
import { listingImages } from '../../../../db/schema';
import { messages } from '../../../../messages/fa';
import { ownEvent } from '../../../../modules/events/queries';
import { eventPath } from '../../../../modules/events/slug';
import { takeDownStatement } from '../../../../modules/listings/queries';
import { requireSession } from '../../../../modules/users/server';
import { EventEditor } from '../../../events/editor';
import { chosenCountry } from '../../../country-choice';
import { eventEditorData } from '../../../events/editor-data';

export const metadata = { title: messages.events.form.editTitle, robots: { index: false } };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireSession(`/my/events/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const db = appDb();
  const own = await ownEvent(db, user.id, id);
  if (!own) notFound();
  const { listing } = own;
  const t = messages.form;

  const statement = listing.status === 'rejected' ? await takeDownStatement(db, listing.id) : null;
  // An event that has ended is copied ("post again"), not edited
  const editable = ['draft', 'active', 'paused', 'rejected'].includes(listing.status);
  const images = editable
    ? await db
        .select({ id: listingImages.id, status: listingImages.status, storageKey: listingImages.storageKey })
        .from(listingImages)
        .where(eq(listingImages.listingId, listing.id))
        .orderBy(listingImages.position)
    : [];
  const editor = editable ? await eventEditorData(db, user.id, { ...own, images }, { countryCode: (await chosenCountry(db))?.code ?? null, typeSlug: null }) : null;

  return (
    <PageShell title={listing.status === 'draft' ? messages.events.form.newTitle : messages.events.form.editTitle}>
      <div className="space-y-6">
        {listing.status === 'rejected' && (
          <TakeDownReason notice={t.rejectedNotice} reason={statement} />
        )}
        {listing.status === 'active' && <Alert tone="info">{t.liveNotice}</Alert>}
        {!editable && <Alert tone="error">{messages.events.form.ended}</Alert>}
        {listing.status !== 'draft' && (
          <Link href={eventPath(listing.title, listing.publicToken)} className="text-sm text-brand-800 hover:underline">
            {t.view} ←
          </Link>
        )}
        {editor && <EventEditor {...editor} />}
      </div>
    </PageShell>
  );
}
