import { BrowseLink as Link } from '../../../components/browse-link';
import { eq } from 'drizzle-orm';
import { Icon } from '../../../components/icons';
import { Alert, Button, LinkButton, PageShell } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { users } from '../../../db/schema';
import { messages } from '../../../messages/fa';
import { cachedCatalog } from '../../../modules/listings/catalog';
import { listSavedSearches, NAME_MAX, SAVED_SEARCHES_PER_USER } from '../../../modules/search/saved';
import { savedSearchAlertsOn } from '../../../modules/users/notification-prefs';
import { requireSession } from '../../../modules/users/server';
import { deleteSavedSearchAction, renameSavedSearchAction, setFrequencyAction } from './actions';

// Saved searches (approved Oct 22, 2026): open, rename, choose how alerts arrive, delete. Plain
// forms with server actions, so everything works without JavaScript. Only the user's own rows
// are ever read or changed (src/modules/search/saved.ts checks the owner on every write).

export const metadata = { title: messages.savedSearches.title, robots: { index: false } };

const FREQUENCIES = ['instant', 'daily', 'off'] as const;

export default async function MySearchesPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const { user } = await requireSession('/my/searches');
  const { done } = await searchParams;
  const db = appDb();
  const [rows, [prefs]] = await Promise.all([
    listSavedSearches(db, await cachedCatalog(db), user.id),
    db.select({ prefs: users.notificationPrefs }).from(users).where(eq(users.id, user.id)),
  ]);
  const t = messages.savedSearches;
  const alertsOn = savedSearchAlertsOn(prefs?.prefs);

  return (
    <PageShell title={t.title}>
      <div className="space-y-4">
        {done === 'updated' && <Alert tone="success">{t.updated}</Alert>}
        {done === 'deleted' && <Alert tone="success">{t.deleted}</Alert>}
        {!alertsOn && rows.length > 0 && (
          <Alert tone="info">
            {t.alertsOff}{' '}
            <Link href="/account/notifications" className="font-bold underline">
              {t.alertsSettings}
            </Link>
          </Alert>
        )}
        {rows.length === 0 && (
          <div className="space-y-4 text-neutral-600">
            <p>{t.empty}</p>
            <LinkButton href="/" variant="secondary">
              {t.browse}
            </LinkButton>
          </div>
        )}
        {rows.length > 0 && <p className="text-xs text-neutral-500">{t.frequencyHint}</p>}
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="space-y-3 rounded-2xl border border-neutral-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <Link href={r.href} className="min-w-0 font-bold break-words hover:underline">
                  {r.name}
                </Link>
                <Link href={r.href} className="flex shrink-0 items-center gap-1 text-sm text-brand-700 hover:underline">
                  <Icon name="search" className="size-4" />
                  {t.open}
                </Link>
              </div>
              <form action={setFrequencyAction} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={r.id} />
                <span className="text-xs font-bold text-neutral-600">{t.frequency}</span>
                {FREQUENCIES.map((f) => (
                  <button
                    key={f}
                    type="submit"
                    name="frequency"
                    value={f}
                    aria-pressed={r.frequency === f}
                    className={`rounded-full border px-3 py-1 text-xs ${r.frequency === f ? 'border-brand-700 bg-brand-50 font-bold text-brand-800' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'}`}
                  >
                    {t.frequencies[f]}
                  </button>
                ))}
              </form>
              <details className="text-sm">
                <summary className="cursor-pointer text-neutral-600">{t.name}</summary>
                <form action={renameSavedSearchAction} className="mt-2 flex gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <label htmlFor={`name-${r.id}`} className="sr-only">
                    {t.name}
                  </label>
                  <input
                    id={`name-${r.id}`}
                    name="name"
                    defaultValue={r.name}
                    maxLength={NAME_MAX}
                    required
                    aria-describedby={`name-hint-${r.id}`}
                    className="block w-full min-w-0 rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
                  />
                  <Button type="submit" variant="secondary" className="shrink-0 py-2">
                    {t.rename}
                  </Button>
                </form>
                <p id={`name-hint-${r.id}`} className="mt-1 text-xs text-neutral-500">
                  {t.nameHint}
                </p>
              </details>
              <form action={deleteSavedSearchAction}>
                <input type="hidden" name="id" value={r.id} />
                <Button type="submit" variant="danger" className="py-2">
                  {t.delete}
                </Button>
              </form>
            </li>
          ))}
        </ul>
        {rows.length >= SAVED_SEARCHES_PER_USER && <p className="text-sm text-neutral-600">{t.limit}</p>}
      </div>
    </PageShell>
  );
}
