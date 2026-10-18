import Link from 'next/link';
import { Alert, Button, Card, LinkButton, PageShell } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { messages } from '../../../messages/fa';
import { formatEventStart } from '../../../modules/events/format';
import { myEvents } from '../../../modules/events/queries';
import { eventPath } from '../../../modules/events/slug';
import { canApply } from '../../../modules/listings/listings';
import { imageUrl } from '../../../modules/media/server';
import { requireSession } from '../../../modules/users/server';
import { eventStatusAction } from '../../events/actions';

export const metadata = { title: messages.events.my.title, robots: { index: false } };

const STATUS_TONE: Record<string, string> = {
  active: 'bg-brand-50 text-brand-800',
  draft: 'bg-neutral-100 text-neutral-700',
  pending_review: 'bg-amber-50 text-amber-800',
  paused: 'bg-neutral-100 text-neutral-700',
  expired: 'bg-neutral-100 text-neutral-600',
  rejected: 'bg-red-50 text-red-800',
};

function ActionButton({ id, action, label, variant = 'secondary' }: { id: string; action: string; label: string; variant?: 'primary' | 'secondary' }) {
  return (
    <form action={eventStatusAction}>
      <input type="hidden" name="listingId" value={id} />
      <input type="hidden" name="action" value={action} />
      <Button type="submit" variant={variant} className="px-3 py-2">
        {label}
      </Button>
    </form>
  );
}

export default async function MyEventsPage({ searchParams }: { searchParams: Promise<{ done?: string; error?: string }> }) {
  const { user } = await requireSession('/my/events');
  const rows = await myEvents(appDb(), user.id);
  const params = await searchParams;
  const t = messages.events.my;
  const now = new Date();
  const done = params.done && params.done in t.done ? t.done[params.done as keyof typeof t.done] : null;

  return (
    <PageShell title={t.title}>
      <div className="space-y-4">
        <LinkButton href="/events/new" className="w-full">
          {messages.events.post}
        </LinkButton>
        {done && <Alert tone="success">{done}</Alert>}
        {params.error && <Alert tone="error">{messages.my.notAllowed}</Alert>}
        {rows.length === 0 && <p className="text-neutral-600">{t.empty}</p>}
        <ul className="space-y-3">
          {rows.map(({ listing: l, details: d, coverKey, firstStart }) => {
            const thumb = coverKey ? imageUrl(coverKey, 'thumb', 'webp') : null;
            const live = l.status === 'active' || l.status === 'paused';
            const editable = ['draft', 'active', 'paused', 'rejected'].includes(l.status);
            const ev = { ...l, isEvent: true };
            return (
              <li key={l.id}>
                <Card className="space-y-3">
                  <div className="flex gap-3">
                    <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                      {thumb && <img src={thumb} alt="" width={80} height={80} className="size-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      {l.status === 'draft' ? (
                        <p className="truncate font-semibold">{l.title || messages.my.untitled}</p>
                      ) : (
                        <Link href={eventPath(l.title, l.publicToken)} className="block truncate font-semibold hover:underline">
                          {l.title}
                        </Link>
                      )}
                      <div className="flex flex-wrap gap-1">
                        <span className={`inline-block rounded-md px-2 py-0.5 text-xs ${STATUS_TONE[l.status] ?? ''}`}>
                          {l.status === 'expired' ? messages.events.page.past : messages.status[l.status]}
                        </span>
                        {d.scheduleStatus !== 'scheduled' && (
                          <span className="inline-block rounded-md bg-red-50 px-2 py-0.5 text-xs text-red-800">{messages.events.scheduleStatus[d.scheduleStatus]}</span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500">
                        {firstStart ? t.next(formatEventStart(firstStart, d.timeZone)) : t.noDate}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editable && (
                      <LinkButton href={`/my/events/${l.id}`} variant="secondary" className="px-3 py-2">
                        {l.status === 'draft' ? messages.my.continue : messages.my.edit}
                      </LinkButton>
                    )}
                    {canApply('pause', ev, now) && <ActionButton id={l.id} action="pause" label={messages.my.pause} />}
                    {canApply('resume', ev, now) && <ActionButton id={l.id} action="resume" label={messages.my.resume} />}
                    {l.status !== 'draft' && <ActionButton id={l.id} action="copy" label={t.copy} variant={l.status === 'expired' ? 'primary' : 'secondary'} />}
                    {live && d.scheduleStatus !== 'cancelled' && (
                      <details className="group">
                        <summary className="inline-flex cursor-pointer list-none items-center rounded-xl border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
                          {t.cancel}
                        </summary>
                        <form action={eventStatusAction} className="mt-2 flex flex-wrap items-center gap-2">
                          <input type="hidden" name="listingId" value={l.id} />
                          <input type="hidden" name="action" value="cancel" />
                          <span className="text-sm">{t.cancelConfirm}</span>
                          <Button type="submit" variant="danger" className="px-3 py-2">
                            {t.cancelYes}
                          </Button>
                        </form>
                      </details>
                    )}
                    <details className="group">
                      <summary className="inline-flex cursor-pointer list-none items-center rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                        {messages.my.delete}
                      </summary>
                      <form action={eventStatusAction} className="mt-2 flex items-center gap-2">
                        <input type="hidden" name="listingId" value={l.id} />
                        <input type="hidden" name="action" value="delete" />
                        <span className="text-sm">{messages.my.deleteConfirm}</span>
                        <Button type="submit" variant="danger" className="px-3 py-2">
                          {messages.my.deleteYes}
                        </Button>
                      </form>
                    </details>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </div>
    </PageShell>
  );
}
