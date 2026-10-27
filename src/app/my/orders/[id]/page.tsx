import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, Card, LinkButton, PageShell, Pill } from '../../../../components/ui';
import { appDb } from '../../../../db/drizzle';
import { webEnv } from '../../../../lib/env';
import { formatDateTime } from '../../../../lib/format';
import { messages } from '../../../../messages/fa';
import { formatPrice } from '../../../../modules/listings/price';
import { listingPath } from '../../../../modules/listings/slug';
import { invoiceUrl } from '../../../../modules/payments/notices';
import { ownOrder } from '../../../../modules/payments/orders';
import { canWithdraw, WITHDRAWAL_DAYS, withdrawalOf } from '../../../../modules/payments/withdrawals';
import { paymentGateway } from '../../../../modules/payments/server';
import { requireSession } from '../../../../modules/users/server';

// Where Stripe's Checkout sends the buyer back. It only shows the order: the worker marks it paid
// from Stripe's webhook, usually within seconds, and until then the page reloads itself every
// three seconds (a meta refresh, so it works without JavaScript).

export const metadata = { title: messages.orders.order, robots: { index: false } };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ withdrawn?: string; error?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const { user } = await requireSession(`/my/orders/${id}`);
  const order = await ownOrder(appDb(), user.id, id);
  if (!order) notFound();
  const t = messages.orders;
  const zone = webEnv().APP_TIME_ZONE;
  const waiting = order.status === 'pending';
  const paidLike = order.status === 'paid' || order.status === 'partially_refunded';
  // The invoice's page at Stripe (view and download), read when the order is paid
  const invoice = paidLike ? await invoiceUrl(paymentGateway(), order.providerInvoiceId) : null;
  // The withdrawal button (§ 356a BGB) for 14 days, or what became of the withdrawal
  const w = t.withdraw;
  const withdrawable = canWithdraw(order);
  const withdrawal = order.withdrawnAt ? await withdrawalOf(appDb(), order.id) : null;
  const error = query.error && query.error in w.errors ? w.errors[query.error as keyof typeof w.errors] : null;

  return (
    <PageShell title={t.order} wide>
      {waiting && <meta httpEquiv="refresh" content="3" />}
      <div className="space-y-4">
        {waiting && (
          <Alert tone="info">
            {t.waiting} {t.waitingHint}
          </Alert>
        )}
        {paidLike && (
          <Alert tone="success">
            {t.paid} {t.paidHint}
          </Alert>
        )}
        {(order.status === 'failed' || order.status === 'expired') && <Alert tone="error">{t.failedHint}</Alert>}
        {query.withdrawn && <Alert tone="success">{w.done}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        {withdrawal && (
          <Alert tone="info">
            {w.received(formatDateTime(withdrawal.createdAt, zone))}{' '}
            {withdrawal.status === 'received' ? w.processing : withdrawal.status === 'refunded' ? w.refunded(formatPrice(withdrawal.refundMinor ?? 0, withdrawal.currency, 2)) : w.noRefund}
          </Alert>
        )}
        <Card className="space-y-2">
          <p className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold">{order.productName}</span>
            <Pill tone={paidLike ? 'success' : waiting ? 'warning' : 'neutral'}>{t.status[order.status]}</Pill>
          </p>
          <p className="text-lg font-extrabold text-brand-700">{formatPrice(order.totalMinor, order.currency, 2)}</p>
          <p className="text-xs text-neutral-500">{formatDateTime(order.paidAt ?? order.createdAt, zone)}</p>
          {order.listingTitle && (
            <p className="text-sm">
              {t.listing}:{' '}
              <Link href={listingPath(order.listingTitle, order.listingToken!)} className="text-brand-800 hover:underline">
                {order.listingTitle}
              </Link>
            </p>
          )}
        </Card>
        <div className="flex flex-wrap gap-2">
          {order.listingTitle && (
            <LinkButton href={listingPath(order.listingTitle, order.listingToken!)} variant="secondary">
              {t.backToListing}
            </LinkButton>
          )}
          {invoice && (
            <LinkButton href={invoice} target="_blank" rel="noopener noreferrer" variant="secondary">
              {messages.email.paymentNotice.invoice}
            </LinkButton>
          )}
          <LinkButton href="/my/orders" variant="secondary">
            {t.title}
          </LinkButton>
        </div>
        {withdrawable && (
          <div className="space-y-2 border-t border-neutral-200 pt-4">
            <p className="text-xs text-neutral-500">{w.hint(formatDateTime(new Date(order.paidAt!.getTime() + WITHDRAWAL_DAYS * 86_400_000), zone))}</p>
            <LinkButton href={`/my/orders/${order.id}/withdraw`} variant="danger">
              {w.button}
            </LinkButton>
          </div>
        )}
      </div>
    </PageShell>
  );
}
