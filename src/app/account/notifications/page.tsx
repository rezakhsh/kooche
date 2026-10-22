import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { Alert, Button, PageShell } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { users } from '../../../db/schema';
import { valkey } from '../../../lib/valkey';
import { messages } from '../../../messages/fa';
import { isUnreachableMarked } from '../../../modules/notifications/telegram-reach';
import { chatNoticesOn, savedSearchAlertsOn } from '../../../modules/users/notification-prefs';
import { requireSession } from '../../../modules/users/server';
import { saveNotificationsAction } from './actions';

export const metadata = { title: messages.notifications.title, robots: { index: false } };

// Chat notices (approved Oct 18, 2026) and saved-search alerts (Oct 22, 2026) on or off, and how
// they reach the user: through the Telegram bot when the account is linked to it and the bot
// isn't blocked, else by email.

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const { user } = await requireSession('/account/notifications');
  const [row] = await appDb()
    .select({ prefs: users.notificationPrefs, telegramUserId: users.telegramUserId, email: users.email })
    .from(users)
    .where(eq(users.id, user.id));
  const t = messages.notifications;
  const on = chatNoticesOn(row?.prefs);
  const tg = row?.telegramUserId ?? null;
  const blocked = tg !== null && (await isUnreachableMarked(valkey(), tg).catch(() => false));
  const via = tg === null ? t.viaEmail(row!.email) : blocked ? t.viaEmailBlocked(row!.email) : t.viaTelegram;

  return (
    <PageShell title={t.title}>
      <form action={saveNotificationsAction} className="space-y-5">
        {saved && <Alert tone="success">{t.saved}</Alert>}
        <label className="flex items-start gap-3 rounded-2xl border border-neutral-200 p-4">
          <input type="checkbox" name="chat" defaultChecked={on} className="mt-1 size-5" />
          <span className="space-y-1">
            <span className="block font-medium">{t.chat}</span>
            <span className="block text-sm text-neutral-600">{t.rule}</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-2xl border border-neutral-200 p-4">
          <input type="checkbox" name="savedSearches" defaultChecked={savedSearchAlertsOn(row?.prefs)} className="mt-1 size-5" />
          <span className="space-y-1">
            <span className="block font-medium">{t.savedSearches}</span>
            <span className="block text-sm text-neutral-600">
              {t.savedSearchesRule}{' '}
              <Link href="/my/searches" className="text-brand-700 underline">
                {t.manageSearches}
              </Link>
            </span>
          </span>
        </label>
        <p className="text-sm leading-relaxed text-neutral-600">{via}</p>
        <Button type="submit" className="w-full">
          {t.save}
        </Button>
      </form>
    </PageShell>
  );
}
