import Link from 'next/link';
import { PageShell, Pill } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { formatDate } from '../../../lib/format';
import { messages } from '../../../messages/fa';
import { formatPrice } from '../../../modules/listings/price';
import { ownOrders } from '../../../modules/payments/orders';
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
  return (
    <PageShell title={t.title} wide>
      {rows.length === 0 && <p className="text-neutral-600">{t.empty}</p>}
      <ul className="divide-y divide-neutral-200">
        {rows.map((o) => (
          <li key={o.id}>
            <Link href={`/my/orders/${o.id}`} className="flex items-center gap-3 py-3 hover:bg-neutral-50">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{o.productName}</span>
                <span className="block truncate text-xs text-neutral-500">
                  {o.listingTitle} · {t.on(formatDate(o.createdAt, zone))}
                </span>
              </span>
              <span className="shrink-0 text-end">
                <span className="block text-sm font-extrabold">{formatPrice(o.totalMinor, o.currency, 2)}</span>
                <Pill tone={TONE[o.status]}>{t.status[o.status]}</Pill>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
