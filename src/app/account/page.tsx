import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '../../components/icons';
import { Button, PageShell, Pill } from '../../components/ui';
import { appDb } from '../../db/drizzle';
import { messages } from '../../messages/fa';
import { placeLabel } from '../../modules/listings/places';
import { savedPlace } from '../../modules/listings/queries';
import { chatNoticesOn, savedSearchAlertsOn } from '../../modules/users/notification-prefs';
import { loadActor } from '../../modules/users/permissions';
import { eq } from 'drizzle-orm';
import { users } from '../../db/schema';
import { isPlaceholderName, sellerPath } from '../../modules/users/profile';
import { requireSession } from '../../modules/users/server';
import { signOut } from './actions';

export const metadata = { title: messages.account.title, robots: { index: false } };

// The account: one list of settings, each with its current value (approved Oct 17, 2026)

export default async function AccountPage() {
  const { user } = await requireSession('/account');
  const db = appDb();
  const [actor, saved, [prefs]] = await Promise.all([
    loadActor(db, user.id),
    savedPlace(db, user.id),
    db
      .select({ prefs: users.notificationPrefs, name: users.displayName, publicToken: users.publicToken })
      .from(users)
      .where(eq(users.id, user.id)),
  ]);
  const t = messages.account;
  return (
    <PageShell title={t.title}>
      <div className="space-y-6">
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200">
          <Row
            href="/account/name"
            icon="user"
            label={t.name}
            value={prefs && !isPlaceholderName(prefs.name) ? <bdi dir="auto">{prefs.name}</bdi> : <Pill tone="warning">{t.nameNotSet}</Pill>}
          />
          <Row icon="mail" label={t.email} value={<bdi dir="ltr">{user.email}</bdi>} />
          <Row
            href="/account/phone"
            icon="phone"
            label={t.phone}
            value={actor?.phoneVerifiedAt ? <Pill tone="success">{t.verified}</Pill> : <Pill tone="warning">{t.notVerified}</Pill>}
          />
          <Row href="/account/place" icon="pin" label={t.place} value={saved ? <bdi dir="auto">{placeLabel(saved.place)}</bdi> : t.placeNotSet} />
          <Row href="/account/notifications" icon="bell" label={t.notifications} value={chatNoticesOn(prefs?.prefs) || savedSearchAlertsOn(prefs?.prefs) ? t.notificationsOn : t.notificationsOff} />
          <Row href="/my/listings" icon="doc" label={t.myListings} />
          <Row href="/my/favorites" icon="heart" label={messages.favorites.title} />
          <Row href="/my/orders" icon="card" label={messages.orders.title} />
          <Row href="/business" icon="store" label={messages.business.mine} />
          <Row href="/my/searches" icon="bell" label={messages.savedSearches.title} />
          <Row href="/account/devices" icon="devices" label={t.devices} />
          {prefs && <Row href={sellerPath(prefs.publicToken)} icon="store" label={t.publicPage} />}
          <Row href="/account/data" icon="shield" label={t.myData} />
        </ul>
        <form action={signOut}>
          <Button type="submit" variant="secondary" className="w-full">
            <Icon name="logout" className="size-4" />
            {t.signOut}
          </Button>
        </form>
      </div>
    </PageShell>
  );
}

function Row({ href, icon, label, value }: { href?: string; icon: IconName; label: string; value?: ReactNode }) {
  const inner = (
    <>
      <Icon name={icon} className="size-5 text-neutral-500" />
      <span className="font-medium">{label}</span>
      <span className="ms-auto flex min-w-0 items-center gap-1 truncate text-sm text-neutral-500">
        {value}
        {href && <Icon name="chevronEnd" className="size-4 text-neutral-400" />}
      </span>
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-neutral-50">
          {inner}
        </Link>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3.5">{inner}</div>
      )}
    </li>
  );
}
