import Link from 'next/link';
import { Icon } from '../../../components/icons';
import { formatDate, formatMonth } from '../../../lib/format';
import { messages } from '../../../messages/fa';
import { formatPrice } from '../../../modules/listings/price';
import { browseQuery, isFiltered, without, type AttributeFilter, type BrowseState } from '../../../modules/search/filters';
import type { Browse } from './resolve';

// The active filters as removable chips above the results: each is a link to the same page
// without that filter, so they work without JavaScript.

type Chip = { label: string; href: string };

function dateText(iso: string, month: boolean): string {
  return month ? formatMonth(new Date(`${iso}-15T12:00:00Z`), 'UTC') : formatDate(new Date(`${iso}T12:00:00Z`), 'UTC');
}

export function filterChips(b: Browse): Chip[] {
  const t = messages.browse.chip;
  const { state, ctx, country, path } = b;
  const cur = country.currency;
  const money = (n: number) => formatPrice(n, cur.code, cur.minorUnit);
  const href = (s: BrowseState) => `${path}${browseQuery(s, ctx.minorUnit)}`;
  const chips: Chip[] = [];

  if (state.q) chips.push({ label: messages.search.chip(state.q), href: href(without(state, 'q')) });
  if (b.place?.kind === 'near') chips.push({ label: t.near(b.place.radiusKm), href: href(without(state, 'place')) });
  if (b.place?.kind === 'postal') {
    chips.push({
      label: b.place.radiusKm ? t.postalRadius(b.place.code, b.place.label, b.place.radiusKm) : t.postal(b.place.code, b.place.label),
      href: href(without(state, 'place')),
    });
  }
  if (state.price) {
    const { min, max } = state.price;
    const label = min !== null && max !== null ? t.priceRange(money(min), money(max)) : min !== null ? t.priceMin(money(min)) : t.priceMax(money(max!));
    chips.push({ label, href: href(without(state, 'price')) });
  }
  if (state.ship) chips.push({ label: messages.browse.shipping, href: href(without(state, 'ship')) });

  const defs = new Map(ctx.defs.map((d) => [d.key, d]));
  for (const f of state.attributes) {
    const def = defs.get(f.key);
    if (!def) continue;
    const range = (a: string | null, b2: string | null) =>
      a !== null && b2 !== null ? t.range(def.labelFa, a, b2) : a !== null ? t.rangeMin(def.labelFa, a) : t.rangeMax(def.labelFa, b2!);
    const one = (f2: AttributeFilter, label: string, value?: string) => chips.push({ label, href: href(without(state, value === undefined ? { key: f2.key } : { key: f2.key, value }, ctx.defs)) });
    switch (f.type) {
      case 'select':
      case 'multi_select':
        for (const v of f.values) one(f, `${def.labelFa}: ${def.options.find((o) => o.value === v)?.labelFa ?? v}`, v);
        break;
      case 'boolean':
        one(f, def.labelFa);
        break;
      case 'number': {
        // Years and other four-digit numbers read better without a thousands separator
        const grouping = !(def.validation.integer && (def.validation.max ?? Infinity) <= 9999);
        const fmt = (n: number | null) => (n === null ? null : f.money ? money(n) : `${n.toLocaleString('fa-IR', { useGrouping: grouping })}${def.unitFa ? ` ${def.unitFa}` : ''}`);
        one(f, range(fmt(f.min), fmt(f.max)));
        break;
      }
      case 'date': {
        const fmt = (s: string | null) => (s === null ? null : dateText(s, !!def.validation.month));
        one(f, range(fmt(f.from), fmt(f.to)));
        break;
      }
    }
  }
  return chips;
}

export function ActiveFilters({ b }: { b: Browse }) {
  const t = messages.browse;
  const chips = filterChips(b);
  if (chips.length === 0) return null;
  return (
    <div aria-label={t.activeFilters} role="group" className="mb-4 flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <Link
          key={c.href + c.label}
          href={c.href}
          aria-label={t.removeFilter(c.label)}
          className="flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 py-1 ps-3 pe-2 text-xs font-bold text-brand-800 hover:border-brand-400"
        >
          {c.label}
          <Icon name="close" className="size-3.5" />
        </Link>
      ))}
      {(chips.length > 1 || isFiltered(b.state)) && (
        <Link href={`${b.path}${browseQuery(without(b.state, 'all'), b.ctx.minorUnit)}`} className="text-xs text-neutral-600 underline-offset-2 hover:underline">
          {t.clearAll}
        </Link>
      )}
    </div>
  );
}
