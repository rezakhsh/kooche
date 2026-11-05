import { notFound, redirect } from 'next/navigation';
import { appDb } from '../../../db/drizzle';
import { messages } from '../../../messages/fa';
import { cachedCatalog, isEventCategory, isPostable, openToPoster } from '../../../modules/listings/catalog';
import { canPostListing, loadActor } from '../../../modules/users/permissions';
import { requireSession } from '../../../modules/users/server';
import { ListingEditor } from '../../my/listings/[id]/editor';
import { NoScriptSteps } from '../../my/listings/[id]/no-script-steps';
import { PostingBar } from '../posting-bar';
import { editorData } from '../../my/listings/editor-data';
import { chosenCountry } from '../../country-choice';
import { myBusinesses } from '../../../modules/organizations/organizations';
import { isClosedIn } from '../../../modules/listings/country-rules';

export const metadata = { title: messages.post.title, robots: { index: false } };

// Step 2 of posting: the empty form of a category. Nothing is stored until the seller goes on or
// adds a photo, so browsing categories leaves no drafts behind.

export default async function NewInCategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ kind?: string }> }) {
  const { slug } = await params;
  // «دنبالش هستم» chosen from the cross-border panel (wave 2 part 5)
  const kind = (await searchParams).kind === 'wanted' ? 'wanted' : 'offer';
  const { user } = await requireSession(`/new/${encodeURIComponent(slug)}`);
  const db = appDb();
  if (!canPostListing(await loadActor(db, user.id)).ok) redirect('/new');
  const catalog = await cachedCatalog(db);
  const category = catalog.bySlug.get(slug);
  if (!category || !isPostable(catalog, category.id)) notFound();
  // Business-only categories are for members of a business; the form then offers only their
  // businesses (design check, Oct 31, 2026: everyone was sent back, members too)
  if (!openToPoster(category, (await myBusinesses(db, user.id)).length > 0)) redirect('/new?error=business_only');
  if (isEventCategory(catalog, category.id)) redirect(`/events/new?type=${category.slug}`);

  const editor = await editorData(db, user.id, category.id, null, [], (await chosenCountry(db))?.code ?? null, kind);
  // Closed by the posting country's law (src/modules/listings/country-rules.ts: Turkey's housing and cars)
  if (editor.form.country && isClosedIn(catalog, category.id, editor.form.country.code)) redirect('/new?error=closed_in_country');
  // Steps 2–4 of posting (wave 1, src/app/my/listings/[id]/steps.ts); each step has its heading
  return (
    <>
    <PostingBar category={editor.form.categoryPath.join('، ')} changeHref="/new" />
    <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-10 sm:px-6 lg:max-w-5xl">
      <NoScriptSteps />
      <div>
        <ListingEditor {...editor} />
      </div>
    </main>
    </>
  );
}
