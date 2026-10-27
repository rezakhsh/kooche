import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { AppBar } from '../../../components/app-bar';
import { Switch } from '../../../components/switch';
import { Alert, Button } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { users } from '../../../db/schema';
import { valkey } from '../../../lib/valkey';
import { ltr, messages } from '../../../messages/fa';
import { isUnreachableMarked } from '../../../modules/notifications/telegram-reach';
import { chatNoticesOn, savedSearchAlertsOn } from '../../../modules/users/notification-prefs';
import { requireSession } from '../../../modules/users/server';
import { saveNotificationsAction } from './actions';
import { AutoSave } from './auto-save';

export const metadata = { title: messages.notifications.title, robots: { index: false } };

// Chat notices (approved Oct 18, 2026) and saved-search alerts (Oct 22, 2026) on or off, and how
// they reach the user: through the Telegram bot when the account is linked to it and the bot
// isn't blocked, else by email. Wave 1 (mockup final/notifications): rows with switches that save
// at once. The mockup's per-channel columns, quiet hours and bundling are kept for later
// (docs/roadmap.md).

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const { user } = await requireSession('/account/notifications');
  const [row] = await appDb()
    .select({ prefs: users.notificationPrefs, telegramUserId: users.telegramUserId, email: users.email })
    .from(users)
    .where(eq(users.id, user.id));
  const t = messages.notifications;
  const tg = row?.telegramUserId ?? null;
  const blocked = tg !== null && (await isUnreachableMarked(valkey(), tg).catch(() => false));
  const via = tg === null ? t.viaEmail(ltr(row!.email)) : blocked ? t.viaEmailBlocked(ltr(row!.email)) : t.viaTelegram;
  const rows = [
    { name: 'chat', label: t.chatShort, on: chatNoticesOn(row?.prefs), hint: t.rule, link: null },
    { name: 'savedSearches', label: t.savedSearchesShort, on: savedSearchAlertsOn(row?.prefs), hint: t.savedSearchesRule, link: true },
  ];

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
          <div className="space-y-4">
            {rows.map((r) => (
              <div key={r.name} className="rounded-2xl border border-neutral-200 p-4">
                <label className="flex items-center justify-between gap-3 text-sm">
                  <b>{r.label}</b>
                  <Switch name={r.name} defaultChecked={r.on} label={r.label} />
                </label>
                <p className="mt-1 text-xs leading-6 text-neutral-600">
                  {r.hint}{' '}
                  {r.link && (
                    <Link href="/my/searches" className="font-bold text-brand-800 hover:underline">
                      {t.manageSearches}
                    </Link>
                  )}
                </p>
              </div>
            ))}
          </div>
          <noscript>
            <Button type="submit" className="mt-4 w-full">
              {t.save}
            </Button>
          </noscript>
        </AutoSave>
        <p className="mt-4 text-xs leading-6 text-neutral-600">{via}</p>
      </main>
    </>
  );
}
