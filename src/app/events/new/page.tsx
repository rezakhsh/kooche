import { Card, LinkButton, PageShell } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { messages } from '../../../messages/fa';
import { canPostEvent } from '../../../modules/events/events';
import { requireSession } from '../../../modules/users/server';
import { chosenCountry } from '../../country-choice';
import { EventEditor } from '../editor';
import { eventEditorData } from '../editor-data';

export const metadata = { title: messages.events.form.newTitle, robots: { index: false } };

// The empty event form. Nothing is stored until the organizer saves or adds a photo. Posting an
// event needs a verified phone, like a listing (decided Oct 18, 2026).

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { user } = await requireSession('/events/new');
  const db = appDb();
  const allowed = await canPostEvent(db, user.id);
  if (!allowed.ok) {
    const t = messages.post;
    return (
      <PageShell title={messages.events.form.newTitle}>
        <Card className="space-y-4">
          <p className="leading-relaxed text-neutral-700">{allowed.reason === 'phone_required' ? t.phoneRequired : allowed.reason === 'restricted' ? messages.post.restricted : t.accountDisabled}</p>
          {allowed.reason === 'phone_required' && (
            <LinkButton href="/account/phone" className="w-full">
              {t.verifyPhone}
            </LinkButton>
          )}
        </Card>
      </PageShell>
    );
  }
  const { type } = await searchParams;
  const editor = await eventEditorData(db, user.id, null, {
    countryCode: (await chosenCountry(db))?.code ?? null,
    typeSlug: typeof type === 'string' ? type : null,
  });
  return (
    <PageShell title={messages.events.form.newTitle}>
      <div className="space-y-6">
        <EventEditor {...editor} />
      </div>
    </PageShell>
  );
}
