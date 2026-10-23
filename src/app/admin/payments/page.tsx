import { Alert } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { admin } from '../../../messages/fa';
import { staffAudit } from '../../../modules/admin/audit';
import { recentOrders, stripeLink, subscriptionsList, unappliedWebhooks } from '../../../modules/admin/payments';
import { requireStaff } from '../../../modules/admin/server';
import { formatPrice } from '../../../modules/listings/price';
import { AdminTitle, Panel, When } from '../ui';

export default async function PaymentsPage() {
  const staff = await requireStaff('payments.view');
  const db = appDb();
  await db.transaction((tx) => staffAudit(tx, staff.ctx, 'staff.payments_viewed', null));
  const [orders, subs, pending] = await Promise.all([recentOrders(db), subscriptionsList(db), unappliedWebhooks(db)]);
  const live = webEnv().STRIPE_SECRET_KEY?.includes('_live_') ?? false;
  const t = admin.payments;
  const link = (id: string | null) => {
    const href = stripeLink(id, live);
    return href ? <a href={href} target="_blank" rel="noreferrer" className="text-brand-800 hover:underline">{t.stripe}</a> : null;
  };
  return (
    <>
      <AdminTitle title={t.title} intro={t.intro} />
      {pending > 0 && <div className="mb-4"><Alert tone="error">{t.webhooks(pending)}</Alert></div>}
      <Panel title={t.orders} className="mb-5">
        {orders.length === 0 ? (
          <p className="text-sm text-neutral-500">{t.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-xs text-neutral-500">
                <tr>
                  <th className="py-2 text-start font-medium">{t.when}</th>
                  <th className="py-2 text-start font-medium">{t.product}</th>
                  <th className="py-2 text-start font-medium">{t.buyer}</th>
                  <th className="py-2 text-start font-medium">{t.amount}</th>
                  <th className="py-2 text-start font-medium">{t.status}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2 pe-3 text-xs"><When date={new Date(o.created_at)} /></td>
                    <td className="py-2 pe-3">{o.product}</td>
                    <td className="py-2 pe-3"><bdi>{o.business ?? o.buyer ?? admin.common.none}</bdi></td>
                    <td className="py-2 pe-3 tabular-nums">{formatPrice(Number(o.total_minor), o.currency, 2)}</td>
                    <td className="py-2 pe-3">{t.orderStatus[o.status] ?? o.status}</td>
                    <td className="py-2 text-xs">{link(o.charge ?? o.checkout)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title={t.subscriptions}>
        {subs.length === 0 ? (
          <p className="text-sm text-neutral-500">{t.empty}</p>
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm">
            {subs.map((s) => (
              <li key={s.id} className="flex flex-wrap gap-x-3 gap-y-1 py-2">
                <bdi className="font-medium">{s.business ?? s.person}</bdi>
                <span>{s.plan}</span>
                <span className="text-neutral-600">{t.subscriptionStatus[s.status] ?? s.status}{s.cancel_at_period_end ? ` · ${t.cancelAtEnd}` : ''}</span>
                <span className="text-xs text-neutral-500">{t.periodEnd}: <When date={new Date(s.current_period_end)} /></span>
                <span className="text-xs">{link(s.provider_id)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
