import { eq } from 'drizzle-orm';
import { SettingsGroup, SettingsRow, TaskPage } from '../../../components/settings';
import { appDb } from '../../../db/drizzle';
import { users } from '../../../db/schema';
import { valkey } from '../../../lib/valkey';
import { messages } from '../../../messages/fa';
import { isUnreachableMarked } from '../../../modules/notifications/telegram-reach';
import { placeLabel } from '../../../modules/listings/places';
import { savedPlace } from '../../../modules/listings/queries';
import { listDevices } from '../../../modules/users/devices';
import { NOTICE_KINDS, noticeChannels, quietHoursOn } from '../../../modules/users/notification-prefs';
import { maskPhone } from '../../../modules/users/phone-number';
import { isPlaceholderName } from '../../../modules/users/profile';
import { requireSession } from '../../../modules/users/server';

export const metadata = { title: messages.account.settings, robots: { index: false } };

// Settings, one row from the account hub (wave 1; no mockup, designed in the approved style):
// grouped like the hub's own rows (the account; notifications; security and devices; privacy and
// data), each row with its current value under its name, and what still needs doing in saffron.
// Appearance joins with dark mode (part 10).

export default async function SettingsPage() {
  const { user, session } = await requireSession('/account/settings');
  const db = appDb();
  const [saved, [me], devices] = await Promise.all([
    savedPlace(db, user.id),
    db
      .select({ prefs: users.notificationPrefs, name: users.displayName, phone: users.phoneE164, telegramUserId: users.telegramUserId })
      .from(users)
      .where(eq(users.id, user.id)),
    listDevices(db, user.id, session.id),
  ]);
  const t = messages.account;
  const s = t.settingsPage;
  const tg = me?.telegramUserId ?? null;
  const telegramReady = tg !== null && !(await isUnreachableMarked(valkey(), tg).catch(() => false));
  // «تلگرام و ایمیل، ساعت آرام روشن»: the channels any kind uses, and quiet hours
  const used = new Set(NOTICE_KINDS.flatMap((k) => noticeChannels(me?.prefs, k, telegramReady)));
  const channels = [used.has('telegram') && s.telegram, used.has('email') && s.email].filter(Boolean) as string[];
  const notices = channels.length ? `${channels.join(s.and)}${quietHoursOn(me?.prefs) ? s.quietOn : ''}` : t.notificationsOff;
  const named = me && !isPlaceholderName(me.name);

  return (
    <TaskPage title={t.settings} back="/account" backLabel={t.back}>
      <SettingsGroup title={s.account}>
        <SettingsRow href="/account/name" icon="user" label={t.name} value={named ? <bdi>{me.name}</bdi> : t.nameNotSet} tone={named ? 'normal' : 'warn'} />
        <SettingsRow icon="mail" label={t.email} value={<bdi dir="ltr">{user.email}</bdi>} />
        <SettingsRow
          href="/account/phone"
          icon="phone"
          label={t.phone}
          value={me?.phone ? <bdi dir="ltr">{maskPhone(me.phone)}</bdi> : s.phoneMissing}
          tone={me?.phone ? 'normal' : 'warn'}
        />
        <SettingsRow href="/account/place" icon="pin" label={t.place} value={saved ? <bdi>{placeLabel(saved.place)}</bdi> : t.placeNotSet} />
      </SettingsGroup>
      <SettingsGroup title={s.notices}>
        <SettingsRow href="/account/notifications" icon="bell" label={t.notifications} value={notices} />
      </SettingsGroup>
      <SettingsGroup title={s.security}>
        <SettingsRow href="/account/devices" icon="devices" label={t.devices} value={s.devices(devices.length)} />
      </SettingsGroup>
      <SettingsGroup title={s.privacy}>
        <SettingsRow href="/account/notices" icon="flag" label={messages.notices.title} value={s.noticesHint} />
        <SettingsRow href="/account/data" icon="download" label={s.myData} value={s.myDataHint} />
        <SettingsRow href="/account/delete" icon="trash" label={s.delete} tone="danger" />
      </SettingsGroup>
    </TaskPage>
  );
}
