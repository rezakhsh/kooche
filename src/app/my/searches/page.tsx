import { BrowseLink as Link } from '../../../components/browse-link';
import { eq } from 'drizzle-orm';
import { Icon } from '../../../components/icons';
import { Sheet } from '../../../components/sheet';
import { Alert } from '../../../components/ui';
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
    <main className="mx-auto w-full max-w-3xl px-4 pt-5 pb-24">
      <h1 className="text-2xl font-extrabold">{t.title}</h1>
      <div className="mt-4 space-y-3 empty:hidden">
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
      </div>
      {rows.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl bg-neutral-50 px-6 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-white text-brand-700">
            <Icon name="bell" className="size-7" />
          </span>
          <p className="max-w-sm text-sm leading-7 text-neutral-700">{t.empty}</p>
          <Link href="/" className="flex h-11 items-center rounded-xl bg-brand-700 px-4 text-sm font-bold text-white hover:bg-brand-800">
            {t.browse}
          </Link>
        </div>
      )}
      {rows.length > 0 && <p className="mt-2 text-xs leading-6 text-neutral-600">{t.frequencyHint}</p>}
      <ul className="mt-3 space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-2xl border border-neutral-200 p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon name="search" className="size-5" />
              </span>
              <Link href={r.href} className="min-w-0 flex-1 text-[15px] font-bold break-words hover:underline">
                {r.name}
              </Link>
              <Sheet
                title={r.name}
                closeLabel={t.close}
                summaryLabel={t.moreLabel(r.name)}
                summaryClassName="flex size-10 items-center justify-center rounded-lg border border-neutral-300 hover:bg-neutral-50"
                summary={<Icon name="more" className="size-5" />}
              >
                <form action={renameSavedSearchAction} className="space-y-2 pb-4">
                  <input type="hidden" name="id" value={r.id} />
                  <label htmlFor={`name-${r.id}`} className="block text-sm font-bold">
                    {t.name}
                  </label>
                  <div className="flex gap-2">
                    <input
                      id={`name-${r.id}`}
                      name="name"
                      defaultValue={r.name}
                      maxLength={NAME_MAX}
                      required
                      aria-describedby={`name-hint-${r.id}`}
                      className="block h-12 w-full min-w-0 rounded-xl border border-neutral-300 px-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                    />
                    <button type="submit" className="h-12 shrink-0 rounded-xl border border-neutral-300 px-4 text-sm font-bold hover:bg-neutral-50">
                      {t.rename}
                    </button>
                  </div>
                  <p id={`name-hint-${r.id}`} className="text-xs text-neutral-600">
                    {t.nameHint}
                  </p>
                </form>
                <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
                  <li>
                    <Link href={r.href} className="flex h-14 items-center gap-3 text-base">
                      <Icon name="search" className="size-5" />
                      {t.open}
                    </Link>
                  </li>
                  <li>
                    <form action={deleteSavedSearchAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className="flex h-14 w-full items-center gap-3 text-start text-base text-red-700">
                        <Icon name="trash" className="size-5" />
                        {t.delete}
                      </button>
                    </form>
                  </li>
                </ul>
              </Sheet>
            </div>
            <form action={setFrequencyAction} className="mt-3">
              <input type="hidden" name="id" value={r.id} />
              <p className="mb-1.5 text-xs font-bold text-neutral-600">{t.frequency}</p>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-neutral-100 p-1 text-center text-sm">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f}
                    type="submit"
                    name="frequency"
                    value={f}
                    aria-pressed={r.frequency === f}
                    className={`flex min-h-10 items-center justify-center rounded-lg px-1 ${r.frequency === f ? 'bg-white font-bold text-neutral-900 shadow-sm' : 'text-neutral-700 hover:bg-white/60'}`}
                  >
                    {t.frequencies[f]}
                  </button>
                ))}
              </div>
            </form>
          </li>
        ))}
      </ul>
      {rows.length >= SAVED_SEARCHES_PER_USER && <p className="mt-4 text-sm text-neutral-600">{t.limit}</p>}
    </main>
  );
}
