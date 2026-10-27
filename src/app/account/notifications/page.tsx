import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { AppBar } from '../../../components/app-bar';
import { Switch } from '../../../components/switch';
import { Alert, Button } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { users } from '../../../db/schema';
import { valkey } from '../../../lib/valkey';
import { ltr, messages } from '../../../messages/fa';
import { homeArea } from '../../../modules/listings/neighbourhood';
import { isUnreachableMarked } from '../../../modules/notifications/telegram-reach';
import { bundleOn, NOTICE_KINDS, noticeSwitches, quietHoursOn } from '../../../modules/users/notification-prefs';
import { requireSession } from '../../../modules/users/server';
import { saveNotificationsAction } from './actions';
import { AutoSave } from './auto-save';

export const metadata = { title: messages.notifications.title, robots: { index: false } };

// Notification settings (wave 1, mockup final/notifications): each kind with a Telegram and an
// email switch, quiet hours (nothing from 22 to 8 in the person's time; it arrives in the
// morning) and bundling (saved searches once a day in one message). WhatsApp is never a channel
// (the owner's decision: messages we start there cost money). Switches save at once; without
// JavaScript a save button shows. The Telegram column works once the bot can reach the person.

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const { user } = await requireSession('/account/notifications');
  const db = appDb();
  const [[row], area] = await Promise.all([
    db.select({ prefs: users.notificationPrefs, telegramUserId: users.telegramUserId, email: users.email }).from(users).where(eq(users.id, user.id)),
    homeArea(db, user.id),
  ]);
  const t = messages.notifications;
  const tg = row?.telegramUserId ?? null;
  const blocked = tg !== null && (await isUnreachableMarked(valkey(), tg).catch(() => false));
  const telegramReady = tg !== null && !blocked;
  const prefs = row?.prefs;

  return (
    <>
      <AppBar title={t.title} back="/account/settings" backLabel={messages.account.back} />
      <main className="mx-auto w-full max-w-xl px-4 pt-5 pb-10">
        {saved && (
          <div className="mb-4">
            <Alert tone="success">{t.saved}</Alert>
          </div>
        )}
        <AutoSave action={saveNotificationsAction}>
          <div className="overflow-hidden rounded-2xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-xs text-neutral-600">
                <tr>
                  <th className="p-3 text-start font-normal">
                    <span className="sr-only">{t.kindHeading}</span>
                  </th>
                  <th className="p-2 font-bold">{t.telegram}</th>
                  <th className="p-2 font-bold">{t.email}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {NOTICE_KINDS.map((k) => {
                  const on = noticeSwitches(prefs, k, telegramReady);
                  return (
                    <tr key={k}>
                      <td className="p-3 text-[13px] leading-6">
                        {t.kinds[k]}
                      </td>
                      <td className="p-2 text-center">
                        {telegramReady ? (
                          <Switch name={`${k}.telegram`} defaultChecked={on.telegram} label={t.switchLabel(t.kinds[k], t.telegram)} />
                        ) : (
                          <>
                            {/* Kept as it is until the bot can reach the person */}
                            {on.telegram && <input type="hidden" name={`${k}.telegram`} value="on" />}
                            <Switch name={`${k}.telegram.off`} defaultChecked={false} disabled label={t.switchLabel(t.kinds[k], t.telegram)} />
                          </>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <Switch name={`${k}.email`} defaultChecked={on.email} label={t.switchLabel(t.kinds[k], t.email)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <label className="mt-4 block rounded-2xl border border-neutral-200 p-4">
            <span className="flex items-center justify-between gap-3 text-sm">
              <b>{t.quiet}</b>
              <Switch name="quiet" defaultChecked={quietHoursOn(prefs)} label={t.quiet} />
            </span>
            <span className="mt-1 block text-xs leading-6 text-neutral-600">{t.quietHint(area?.city ?? t.defaultCity)}</span>
          </label>
          <label className="mt-4 block rounded-2xl border border-neutral-200 p-4">
            <span className="flex items-center justify-between gap-3 text-sm">
              <b>{t.bundle}</b>
              <Switch name="bundle" defaultChecked={bundleOn(prefs)} label={t.bundle} />
            </span>
            <span className="mt-1 block text-xs leading-6 text-neutral-600">{t.bundleHint}</span>
          </label>
          <noscript>
            <Button type="submit" className="mt-4 w-full">
              {t.save}
            </Button>
          </noscript>
        </AutoSave>
        <p className="mt-4 text-xs leading-6 text-neutral-600">
          {telegramReady ? (
            t.botConnected
          ) : (
            <>
              {tg === null ? t.botNotConnected : t.botBlocked}{' '}
              <Link href="/account/phone" className="font-bold text-brand-800 underline">
                {t.connectBot}
              </Link>
            </>
          )}
        </p>
        <p className="mt-1 text-xs leading-6 text-neutral-600">{t.emailTo(ltr(row!.email))}</p>
      </main>
    </>
  );
}
