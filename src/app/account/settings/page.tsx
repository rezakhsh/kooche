import { eq } from 'drizzle-orm';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AppBar } from '../../../components/app-bar';
import { Icon, type IconName } from '../../../components/icons';
import { appDb } from '../../../db/drizzle';
import { users } from '../../../db/schema';
import { messages } from '../../../messages/fa';
import { placeLabel } from '../../../modules/listings/places';
import { savedPlace } from '../../../modules/listings/queries';
import { chatNoticesOn, savedSearchAlertsOn } from '../../../modules/users/notification-prefs';
import { isPlaceholderName } from '../../../modules/users/profile';
import { requireSession } from '../../../modules/users/server';

export const metadata = { title: messages.account.settings, robots: { index: false } };

// Settings, one row from the account hub (wave 1): the account, notifications, security and
// devices, privacy and data, each with its current value. Appearance joins in part 10.

export default async function SettingsPage() {
  const { user } = await requireSession('/account/settings');
  const db = appDb();
  const [saved, [me]] = await Promise.all([
    savedPlace(db, user.id),
    db.select({ prefs: users.notificationPrefs, name: users.displayName, phoneVerifiedAt: users.phoneVerifiedAt }).from(users).where(eq(users.id, user.id)),
  ]);
  const t = messages.account;
  const warn = (text: string) => <span className="font-bold text-saffron-800">{text}</span>;
  return (
    <>
      <AppBar title={t.settings} back="/account" backLabel={t.back} />
      <main className="mx-auto w-full max-w-2xl px-4 pt-5 pb-10">
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <Row href="/account/name" icon="user" label={t.name} value={me && !isPlaceholderName(me.name) ? <bdi>{me.name}</bdi> : warn(t.nameNotSet)} />
          <Row icon="mail" label={t.email} value={<bdi dir="ltr">{user.email}</bdi>} />
          <Row href="/account/phone" icon="phone" label={t.phone} value={me?.phoneVerifiedAt ? t.verified : warn(t.notVerified)} />
          <Row href="/account/place" icon="pin" label={t.place} value={saved ? <bdi>{placeLabel(saved.place)}</bdi> : t.placeNotSet} />
          <Row href="/account/notifications" icon="bell" label={t.notifications} value={chatNoticesOn(me?.prefs) || savedSearchAlertsOn(me?.prefs) ? t.notificationsOn : t.notificationsOff} />
          <Row href="/account/devices" icon="devices" label={t.devices} />
          <Row href="/account/notices" icon="flag" label={messages.notices.title} />
          <Row href="/account/data" icon="shield" label={t.myData} />
        </ul>
      </main>
    </>
  );
}

function Row({ href, icon, label, value }: { href?: string; icon: IconName; label: string; value?: ReactNode }) {
  const inner = (
    <>
      <Icon name={icon} className="size-5 text-neutral-600" />
      <span className="flex-1 text-[15px]">{label}</span>
      {value && <span className="min-w-0 truncate text-sm text-neutral-600">{value}</span>}
      {href && <Icon name="chevronEnd" className="size-4 text-neutral-400" />}
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-neutral-50">
          {inner}
        </Link>
      ) : (
        <div className="flex min-h-14 items-center gap-3 px-4 py-2">{inner}</div>
      )}
    </li>
  );
}
