import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Icon } from '../../../components/icons';
import { Alert, LinkButton } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { messages } from '../../../messages/fa';
import { conversationIdForListing } from '../../../modules/chat/queries';
import { eventPath } from '../../../modules/events/slug';
import { isEventListing } from '../../../modules/events/queries';
import { coverKeys, publicListing } from '../../../modules/listings/queries';
import { listingPath } from '../../../modules/listings/slug';
import { imageUrl } from '../../../modules/media/server';
import { canSendMessage, loadActor } from '../../../modules/users/permissions';
import { requireSession } from '../../../modules/users/server';
import { Composer } from '../composer';

export const metadata = { title: messages.chat.newTitle, robots: { index: false } };

// "Chat with seller": the listing and a first message. Nothing is stored until it is sent (the
// conversation is created with its first message), and an existing conversation opens instead.

export default async function NewConversationPage({ searchParams }: { searchParams: Promise<{ l?: string }> }) {
  const { l: token } = await searchParams;
  if (!token || !/^[0-9a-hjkmnp-tv-z]{10}$/.test(token)) notFound();
  const { user } = await requireSession(`/chat/new?l=${token}`);
  const db = appDb();
  const data = await publicListing(db, token);
  if (!data || data.listing.status === 'draft') notFound();
  const l = data.listing;
  const isEvent = await isEventListing(db, l.id);
  const href = isEvent ? eventPath(l.title, l.publicToken) : listingPath(l.title, l.publicToken);
  if (l.userId === user.id) redirect(href);
  const existing = await conversationIdForListing(db, user.id, l.id);
  if (existing) redirect(`/chat/${existing}`);

  const t = messages.chat;
  const allowed = canSendMessage(await loadActor(db, user.id));
  const cover = (await coverKeys(db, [l.id])).get(l.id);
  const coverUrl = cover ? imageUrl(cover, 'thumb', 'webp') : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="mb-4 text-2xl font-extrabold">{t.newTitle}</h1>
      <Link href={href} className="mb-4 flex items-center gap-3 rounded-2xl border border-neutral-200 p-3 hover:bg-neutral-50">
        <span className="size-16 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
          {coverUrl ? <img src={coverUrl} alt="" width={64} height={64} className="size-full object-cover" /> : <Icon name="image" className="m-5 size-6 text-neutral-400" />}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-bold">{l.title}</span>
          <span className="block text-sm text-neutral-600">{data.seller.displayName}</span>
        </span>
      </Link>
      {l.status !== 'active' ? (
        <Alert tone="info">{messages.listing.contactUnavailable}</Alert>
      ) : !allowed.ok ? (
        <div className="space-y-3">
          <Alert tone="info">{t.errors[allowed.reason]}</Alert>
          {allowed.reason === 'phone_required' && <LinkButton href="/account/phone">{t.readOnly.phoneLink}</LinkButton>}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-200">
          <p className="px-4 pt-4 text-sm text-neutral-700">{t.newIntro(data.seller.displayName)}</p>
          <p className="mx-4 mt-3 flex items-start gap-2 rounded-xl bg-saffron-50 px-3 py-2 text-xs leading-relaxed text-saffron-800">
            <Icon name="shield" className="mt-0.5 size-4 shrink-0" />
            {t.tip}
          </p>
          <div className="mt-3">
            <Composer hidden={{ listingToken: l.publicToken }} quickReplies={t.quickReplies} autoFocus />
          </div>
        </div>
      )}
    </main>
  );
}
