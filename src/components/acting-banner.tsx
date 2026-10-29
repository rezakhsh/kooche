import { cookies } from 'next/headers';
import { messages } from '../messages/fa';
import { ACTING_BLOCKED_COOKIE } from '../modules/admin/acting-cookies';
import { currentActing, currentSession } from '../modules/users/server';
import { allowActingChangesAction, endActingAction } from '../app/acting-actions';
import { Icon } from './icons';

// The staff banner while an admin is signed in as a user (src/modules/admin/acting.ts; mockup
// final/viewas-banner): whose account, read only or changes allowed, the minutes left, «اجازهٔ
// تغییر» with its reason, and «پایان». On every page, so it is never mistaken for a normal visit.

export async function ActingBanner() {
  const acting = await currentActing();
  if (!acting) return null;
  const session = await currentSession();
  const t = messages.acting;
  const blocked = (await cookies()).has(ACTING_BLOCKED_COOKIE);
  const minutes = Math.max(1, Math.ceil((acting.until.getTime() - Date.now()) / 60_000));
  const button = 'flex h-8 shrink-0 items-center rounded-lg px-3 text-xs font-bold';
  return (
    <div data-acting className="bg-saffron-500 text-ink">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 text-sm font-bold sm:px-6">
        <Icon name="shield" className="size-4 shrink-0" />
        {/* On phones the mode and the minutes left get their own line */}
        <span className="min-w-0 flex-1">
          <span className="block truncate sm:inline">{t.banner(session?.user.name ?? '')}</span>
          <span className="block text-xs font-medium sm:inline sm:text-sm">
            <span className="hidden sm:inline">، </span>
            {acting.writable ? t.writable : t.readOnly} · {t.minutes(minutes)}
          </span>
        </span>
        <form action={endActingAction}>
          <button type="submit" className={`${button} bg-ink text-snow hover:opacity-90`}>{t.end}</button>
        </form>
      </div>
      {(blocked || !acting.writable) && (
        <div className="mx-auto max-w-6xl px-4 pb-2 text-xs sm:px-6">
          {blocked && <p className="font-bold">{t.blocked}</p>}
          {!acting.writable && (
            <details>
              <summary className="cursor-pointer font-bold underline">{t.allow}</summary>
              <form action={allowActingChangesAction} className="mt-2 flex flex-wrap items-center gap-2">
                <input name="reason" required minLength={5} maxLength={500} placeholder={t.allowReason} className="h-9 min-w-0 flex-1 basis-56 rounded-lg border border-ink/30 bg-snow px-3 text-sm text-ink" />
                <button type="submit" className={`${button} h-9 bg-ink text-snow`}>{t.allowButton}</button>
              </form>
              <p className="mt-1">{t.allowHint}</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
