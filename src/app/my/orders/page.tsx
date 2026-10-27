import Link from 'next/link';
import { Icon } from '../../../components/icons';
import { Pill } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { formatDate } from '../../../lib/format';
import { messages } from '../../../messages/fa';
import { formatPrice } from '../../../modules/listings/price';
import { ownOrders } from '../../../modules/payments/orders';
import { canWithdraw } from '../../../modules/payments/withdrawals';
import { requireSession } from '../../../modules/users/server';

// «خریدهای من»: the user's own purchases of bumps and featured (roadmap step 6). Invoices come by
// email from Stripe; businesses see theirs in the Customer Portal.

export const metadata = { title: messages.orders.title, robots: { index: false } };

const TONE = { paid: 'success', pending: 'warning', failed: 'danger', expired: 'neutral', refunded: 'neutral', partially_refunded: 'neutral' } as const;

export default async function OrdersPage() {
  const { user } = await requireSession('/my/orders');
  const rows = await ownOrders(appDb(), user.id);
  const t = messages.orders;
  const zone = webEnv().APP_TIME_ZONE;
  // Wave 1 (no mockup; designed like «آگهی‌های من»): a row per purchase with its status and amount
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-5 pb-24">
      <h1 className="text-2xl font-extrabold">{t.title}</h1>
      {rows.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl bg-neutral-50 px-6 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-white text-brand-700">
            <Icon name="card" className="size-7" />
          </span>
          <p className="max-w-sm text-sm leading-7 text-neutral-700">{t.empty}</p>
        </div>
      )}
      <ul className="mt-2">
        {rows.map((o) => (
          <li key={o.id} className="border-b border-neutral-200 py-3">
            <Link href={`/my/orders/${o.id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-neutral-50">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon name="arrow-up" className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold">{o.productName}</span>
                <span className="block truncate text-xs text-neutral-600">
                  {o.listingTitle ? `${o.listingTitle}، ` : ''}
                  {t.on(formatDate(o.createdAt, zone))}
                </span>
              </span>
              <span className="shrink-0 text-end">
                <span className="block text-sm font-extrabold">{formatPrice(o.totalMinor, o.currency, 2)}</span>
                <Pill tone={TONE[o.status]}>{t.status[o.status]}</Pill>
              </span>
              <Icon name="chevronEnd" className="size-4 text-neutral-400" />
            </Link>
            {/* The withdrawal button's first step (§ 356a BGB), for 14 days after paying */}
            {canWithdraw(o) && (
              <Link href={`/my/orders/${o.id}/withdraw`} className="ms-13 mt-1 inline-block text-xs font-bold text-red-700 underline">
                {t.withdraw.button}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
