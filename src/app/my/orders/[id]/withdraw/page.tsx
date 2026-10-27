import { notFound, redirect } from 'next/navigation';
import { Button, Card, LinkButton, PageShell } from '../../../../../components/ui';
import { appDb } from '../../../../../db/drizzle';
import { webEnv } from '../../../../../lib/env';
import { formatDateTime } from '../../../../../lib/format';
import { messages } from '../../../../../messages/fa';
import { formatPrice } from '../../../../../modules/listings/price';
import { ownOrder } from '../../../../../modules/payments/orders';
import { canWithdraw } from '../../../../../modules/payments/withdrawals';
import { requireSession } from '../../../../../modules/users/server';
import { withdrawAction } from '../../actions';

// The withdrawal's second step (§ 356a BGB): the contract, the account and where the receipt
// goes, then «تأیید انصراف (Widerruf bestätigen)». The first step is the button on /my/orders.

export const metadata = { title: messages.orders.withdraw.title, robots: { index: false } };

export default async function WithdrawPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const back = `/my/orders/${id}`;
  const { user } = await requireSession(`${back}/withdraw`);
  const order = await ownOrder(appDb(), user.id, id);
  if (!order) notFound();
  if (!canWithdraw(order)) redirect(order.withdrawnAt ? back : `${back}?error=not_allowed`);
  const t = messages.orders.withdraw;
  const zone = webEnv().APP_TIME_ZONE;

  return (
    <PageShell title={t.title}>
      <form action={withdrawAction} className="space-y-4">
        <input type="hidden" name="orderId" value={order.id} />
        <p className="text-sm leading-7 text-neutral-700">{t.intro}</p>
        <Card>
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-neutral-500">{t.contract}</dt>
            <dd className="font-bold">
              {order.productName}
              {order.listingTitle && <span className="font-normal text-neutral-600"> ({order.listingTitle})</span>}
              <span className="ms-2 tabular-nums">{formatPrice(order.totalMinor, order.currency, 2)}</span>
            </dd>
            <dt className="text-neutral-500">{t.paidOn}</dt>
            <dd>{formatDateTime(order.paidAt!, zone)}</dd>
            <dt className="text-neutral-500">{t.account}</dt>
            <dd>{order.buyerName}</dd>
            <dt className="text-neutral-500">{t.receiptTo}</dt>
            <dd dir="ltr" className="text-end">
              {order.buyerEmail}
            </dd>
          </dl>
        </Card>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="danger">
            {t.confirm}
          </Button>
          <LinkButton href={back} variant="secondary">
            {t.back}
          </LinkButton>
        </div>
      </form>
    </PageShell>
  );
}
