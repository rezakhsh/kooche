import { notFound, redirect } from 'next/navigation';
import { PageShell } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { messages } from '../../../messages/fa';
import { cachedCatalog, isEventCategory, isPostable } from '../../../modules/listings/catalog';
import { canPostListing, loadActor } from '../../../modules/users/permissions';
import { requireSession } from '../../../modules/users/server';
import { ListingEditor } from '../../my/listings/[id]/editor';
import { editorData } from '../../my/listings/editor-data';
import { chosenCountry } from '../../country-choice';

export const metadata = { title: messages.post.title, robots: { index: false } };

// Step 2 of posting: the empty form of a category. Nothing is stored until the seller saves or
// adds a photo, so browsing categories leaves no drafts behind.

export default async function NewInCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user } = await requireSession(`/new/${encodeURIComponent(slug)}`);
  const db = appDb();
  if (!canPostListing(await loadActor(db, user.id)).ok) redirect('/new');
  const catalog = await cachedCatalog(db);
  const category = catalog.bySlug.get(slug);
  if (!category || !isPostable(catalog, category.id)) notFound();
  if (category.businessOnly) redirect('/new?error=business_only');
  if (isEventCategory(catalog, category.id)) redirect(`/events/new?type=${category.slug}`);

  const editor = await editorData(db, user.id, category.id, null, [], (await chosenCountry(db))?.code ?? null);
  return (
    <PageShell title={messages.form.draftTitle} wide>
      <div className="space-y-6">
        <ListingEditor {...editor} />
      </div>
    </PageShell>
  );
}
