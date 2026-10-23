import { admin } from '../../messages/fa';
import { formatPrice } from '../../modules/listings/price';

// Charts of the overview, drawn on the server as inline SVG (no chart library, nothing for the CSP
// to allow). One series per chart, so no legend: the title names it. Time runs left to right even
// in the right-to-left page. Each day has a hover target with its value (<title>), and the numbers
// are also in a table for screen readers and copying.

const W = 300;
const H = 90;
const PAD = 4;

export type Point = { day: string; value: number };

/** "۲۵ مهر" from YYYY-MM-DD */
export function shortDay(day: string): string {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
}

export function formatValue(v: number, money: boolean): string {
  return money ? formatPrice(v, 'EUR', 2) : v.toLocaleString('fa-IR');
}

export function LineChart({ points, title, money = false }: { points: Point[]; title: string; money?: boolean }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const min = Math.min(0, ...points.map((p) => p.value));
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / Math.max(1, points.length - 1);
  const y = (v: number) => PAD + ((max - v) * (H - 2 * PAD)) / (max - min || 1);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join('');
  const area = `${line}L${x(points.length - 1).toFixed(1)} ${y(min).toFixed(1)}L${x(0).toFixed(1)} ${y(min).toFixed(1)}Z`;
  const total = points.reduce((s, p) => s + p.value, 0);
  const step = (W - 2 * PAD) / Math.max(1, points.length - 1);
  return (
    <figure className="rounded-2xl border border-neutral-200 p-4">
      <figcaption className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold">{title}</span>
        <span className="text-sm text-neutral-600 tabular-nums">{formatValue(total, money)}</span>
      </figcaption>
      <div dir="ltr">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" role="img" aria-label={title}>
          <line x1={PAD} x2={W - PAD} y1={y(min)} y2={y(min)} className="stroke-neutral-300" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <line x1={PAD} x2={W - PAD} y1={y(max)} y2={y(max)} className="stroke-neutral-100" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <path d={area} className="fill-brand-50" />
          <path d={line} fill="none" className="stroke-brand-700" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {points.map((p, i) => (
            <rect key={p.day} x={x(i) - step / 2} y={0} width={step} height={H} className="fill-transparent hover:fill-neutral-900/5">
              <title>{`${shortDay(p.day)}: ${formatValue(p.value, money)}`}</title>
            </rect>
          ))}
        </svg>
        <div className="mt-1 flex justify-between text-[11px] text-neutral-500">
          <span>{points[0] ? shortDay(points[0].day) : ''}</span>
          <span>{points.some((p) => p.value !== 0) ? admin.charts.max(formatValue(max, money)) : admin.charts.empty}</span>
          <span>{points.at(-1) ? shortDay(points.at(-1)!.day) : ''}</span>
        </div>
      </div>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-neutral-500">{admin.charts.table}</summary>
        <table className="mt-1 w-full">
          <tbody>
            {points.filter((p) => p.value !== 0).map((p) => (
              <tr key={p.day} className="border-t border-neutral-100">
                <td className="py-0.5">{shortDay(p.day)}</td>
                <td className="py-0.5 text-end tabular-nums">{formatValue(p.value, money)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** A horizontal bar inside a table cell: the value as text, the bar for comparison */
export function Bar({ value, max, ok }: { value: number; max: number; ok?: boolean }) {
  const pct = max > 0 && value > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-end tabular-nums">{value.toLocaleString('fa-IR')}</span>
      {/* SVG, not a style attribute: the CSP allows no inline styles. Drawn from the start side. */}
      <svg viewBox="0 0 100 8" preserveAspectRatio="none" className="h-2 flex-1 -scale-x-100" aria-hidden="true">
        <rect width={100} height={8} className="fill-neutral-100" />
        {pct > 0 && <rect width={pct} height={8} className={ok ? 'fill-brand-700' : 'fill-brand-300'} />}
      </svg>
    </div>
  );
}
