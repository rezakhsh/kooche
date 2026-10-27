import { and, count, eq, ne, sql } from 'drizzle-orm';
import Link from 'next/link';
import { Icon, type IconName } from '../../components/icons';
import { appDb } from '../../db/drizzle';
import { favorites, listings, orders, savedSearches, users } from '../../db/schema';
import { webEnv } from '../../lib/env';
import { formatMonth } from '../../lib/format';
import { messages } from '../../messages/fa';
import { notAnEvent } from '../../modules/listings/queries';
import { homeArea } from '../../modules/listings/neighbourhood';
import { myBusinesses } from '../../modules/organizations/organizations';
import { businessPlan } from '../../modules/payments/plans';
import { isPlaceholderName, sellerPath } from '../../modules/users/profile';
import { requireSession } from '../../modules/users/server';
import { signOut } from './actions';

export const metadata = { title: messages.account.title, robots: { index: false } };

// "Me" as a hub, not a settings list (wave 1, mockup final/account): who you are, what you have
// on Peydoo with counts, the business only when there is one, then one row into Settings
// (/account/settings), help, the legal pages and sign out.

export default async function AccountPage() {
  const { user } = await requireSession('/account');
  const db = appDb();
  const [[me], area, perStatus, [saved], [searches], [bought], businesses] = await Promise.all([
    db
      .select({ name: users.displayName, publicToken: users.publicToken, since: users.createdAt, phoneVerifiedAt: users.phoneVerifiedAt })
      .from(users)
      .where(eq(users.id, user.id)),
    homeArea(db, user.id),
    db
      .select({ status: listings.status, n: count() })
      .from(listings)
      .where(and(eq(listings.userId, user.id), ne(listings.status, 'deleted'), notAnEvent))
      .groupBy(listings.status),
    db.select({ n: count() }).from(favorites).where(eq(favorites.userId, user.id)),
    db.select({ n: count() }).from(savedSearches).where(eq(savedSearches.userId, user.id)),
    db.select({ n: count() }).from(orders).where(and(eq(orders.buyerUserId, user.id), sql`${orders.status} IN ('paid', 'refunded', 'partially_refunded')`)),
    myBusinesses(db, user.id),
  ]);
  const plans = await Promise.all(businesses.map((b) => businessPlan(db, b.id)));
  const t = messages.account;
  const fa = (n: number) => n.toLocaleString('fa-IR');
  const of = (s: string) => perStatus.find((r) => r.status === s)?.n ?? 0;
  const name = me && !isPlaceholderName(me.name) ? me.name : t.defaultDisplayName;
  const where = area ? [area.neighbourhood, area.city].filter(Boolean).join('، ') : null;
  const tiles: [IconName, string, string, string][] = [
    ['doc', t.myListings, t.listingsSummary(of('active') + of('pending_review'), of('draft')), '/my/listings'],
    ['heart', t.favorites, fa(saved?.n ?? 0), '/my/favorites'],
    ['bell', t.searches, fa(searches?.n ?? 0), '/my/searches'],
    ['card', t.orders, fa(bought?.n ?? 0), '/my/orders'],
  ];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-5 pb-24">
      <section className="flex items-center gap-4 rounded-2xl bg-brand-50 p-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-white text-2xl font-black text-brand-800" aria-hidden>
          {[...name.trim()][0]}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold">
            <Link href="/account/name" className="hover:underline">
              <bdi>{name}</bdi>
            </Link>
          </h1>
          <p className="text-sm text-neutral-700">{[t.memberSince(formatMonth(me?.since ?? new Date(), webEnv().APP_TIME_ZONE)), where].filter(Boolean).join('، ')}</p>
          {me?.phoneVerifiedAt ? (
            <p className="mt-1 flex items-center gap-1 text-xs font-bold text-brand-800">
              <Icon name="shield" className="size-3.5" />
              {t.phoneVerified}
            </p>
          ) : (
            <Link href="/account/phone" className="mt-1 flex items-center gap-1 text-xs font-bold text-saffron-800 hover:underline">
              <Icon name="phone" className="size-3.5" />
              {t.verifyPhone}
            </Link>
          )}
        </div>
        {me && (
          <Link href={sellerPath(me.publicToken)} className="flex h-10 shrink-0 items-center rounded-lg bg-white px-3 text-sm font-bold text-brand-800 hover:bg-brand-100">
            {t.myPage}
          </Link>
        )}
      </section>

      <h2 className="mt-6 mb-2 px-1 text-sm font-bold text-neutral-600">{t.activity}</h2>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {tiles.map(([icon, label, value, href]) => (
          <Link key={href} href={href} className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-3.5 hover:bg-neutral-50">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Icon name={icon} className="size-5" />
            </span>
            <b className="text-[15px]">{label}</b>
            <span className="text-xs text-neutral-600">{value}</span>
          </Link>
        ))}
      </div>

      {businesses.length > 0 && (
        <Group title={t.business}>
          {businesses.map((b, i) => (
            <Row
              key={b.id}
              href={`/b/${b.slug}/manage`}
              icon="store"
              label={businesses.length === 1 ? t.businessPanel : b.name}
              value={plans[i]!.code ? (messages.pro.planNames[plans[i]!.code!] ?? plans[i]!.code!) : t.noPlan}
            />
          ))}
        </Group>
      )}

      <Group>
        <Row href="/account/settings" icon="gear" label={t.settings} value={t.settingsHint} />
        <Row href="/help" icon="shield" label={t.help} />
        <Row href="/contact" icon="chat" label={t.support} />
        <Row href="/impressum" icon="doc" label={t.legal} />
      </Group>

      <form action={signOut} className="mt-6">
        <button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 font-bold text-neutral-800 hover:bg-neutral-50">
          <Icon name="logout" className="size-5" />
          {t.signOut}
        </button>
      </form>
    </main>
  );
}

function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      {title && <h2 className="mb-2 px-1 text-sm font-bold text-neutral-600">{title}</h2>}
      <ul className="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white">{children}</ul>
    </section>
  );
}

function Row({ href, icon, label, value }: { href: string; icon: IconName; label: string; value?: string }) {
  return (
    <li>
      <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-neutral-50">
        <Icon name={icon} className="size-5 text-neutral-600" />
        <span className="flex-1 text-[15px]">{label}</span>
        {value && <span className="min-w-0 truncate text-sm text-neutral-600">{value}</span>}
        <Icon name="chevronEnd" className="size-4 text-neutral-400" />
      </Link>
    </li>
  );
}
