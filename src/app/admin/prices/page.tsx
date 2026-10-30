import Link from 'next/link';
import { Alert, Button } from '../../../components/ui';
import { appDb } from '../../../db/drizzle';
import { admin } from '../../../messages/fa';
import { adminHref, requireStaff } from '../../../modules/admin/server';
import { bigChange, euros, priceList, type PriceRow } from '../../../modules/payments/prices';
import { AdminTitle, Panel } from '../ui';
import { askPriceAction, changePriceAction } from './actions';

// Admin › prices (wave 2 part 7; no mockup, in the admin pages' style): every product's euro
// price, a field for a new one, and a confirmation that says what changes for whom (a big change
// needs «مطمئنم»). src/modules/payments/prices.ts does the change.

const t = admin.prices;
type Search = { confirm?: string; amount?: string; done?: string; from?: string; to?: string; unchanged?: string; error?: string };

const slotOf = (r: Pick<PriceRow, 'code' | 'interval'>) => `${r.code}:${r.interval ?? 'once'}`;
const nameOf = (r: PriceRow) => (r.interval ? `${r.nameFa}، ${t.intervals[r.interval]}` : r.nameFa);

export default async function PricesPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireStaff('prices.manage');
  const sp = await searchParams;
  const rows = await priceList(appDb());
  const asked = rows.find((r) => slotOf(r) === sp.confirm);
  const amount = Number(sp.amount);
  const confirm = asked && Number.isInteger(amount) && amount > 0 ? { row: asked, amount } : null;
  const done = rows.find((r) => slotOf(r) === sp.done);

  return (
    <>
      <AdminTitle title={t.title} intro={t.intro} />
      {done && sp.from && sp.to && (
        <div className="mb-4">
          <Alert tone="success">{t.done(nameOf(done), euros(Number(sp.from)), euros(Number(sp.to)))}</Alert>
        </div>
      )}
      {sp.unchanged && <div className="mb-4"><Alert tone="info">{t.unchanged}</Alert></div>}
      {sp.error && t.errors[sp.error] && <div className="mb-4"><Alert tone="error">{t.errors[sp.error]}</Alert></div>}

      {confirm && (
        <section className="mb-4 rounded-2xl border border-saffron-100 bg-saffron-50 p-4">
          <h2 className="font-extrabold">{t.confirmTitle}</h2>
          <p className="mt-1 text-sm leading-7">{t.confirmText(nameOf(confirm.row), euros(confirm.row.amountMinor), euros(confirm.amount))}</p>
          {confirm.row.kind === 'subscription' && <p className="text-sm leading-7 text-neutral-700">{t.confirmSubs(euros(confirm.row.amountMinor))}</p>}
          <form action={changePriceAction} className="mt-3 space-y-3">
            <input type="hidden" name="slot" value={slotOf(confirm.row)} />
            <input type="hidden" name="amount" value={confirm.amount} />
            {bigChange(confirm.row.amountMinor, confirm.amount) && (
              <label className="flex gap-2 text-sm font-bold">
                <input type="checkbox" name="big" required className="mt-1 size-4 shrink-0 accent-brand-700" />
                {t.big}
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit">{t.confirm}</Button>
              <Link href={adminHref('/prices')} prefetch={false} className="inline-flex h-11 items-center rounded-xl border border-neutral-300 bg-white px-4 text-sm font-bold hover:bg-neutral-50">
                {t.cancel}
              </Link>
            </div>
          </form>
        </section>
      )}

      <Panel>
        {rows.length === 0 ? (
          <p className="text-sm text-neutral-500">{t.empty}</p>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {rows.map((r) => (
              <li key={slotOf(r)} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <span className="min-w-0 flex-1">
                  <b className="block text-sm">{nameOf(r)}</b>
                  <span className="text-sm font-extrabold text-brand-800">{euros(r.amountMinor)}</span>
                </span>
                <form action={askPriceAction} className="flex items-center gap-2">
                  <input type="hidden" name="slot" value={slotOf(r)} />
                  <label className="sr-only" htmlFor={`price-${slotOf(r)}`}>
                    {t.amount}
                  </label>
                  <input
                    id={`price-${slotOf(r)}`}
                    name="amount"
                    inputMode="decimal"
                    required
                    maxLength={9}
                    placeholder={(r.amountMinor / 100).toFixed(2)}
                    dir="ltr"
                    className="h-10 w-28 rounded-xl border border-neutral-300 bg-white px-3 text-sm"
                  />
                  <Button type="submit" variant="secondary">
                    {t.submit}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
