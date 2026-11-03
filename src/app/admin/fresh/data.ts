import type { Queryable } from '../../../db/drizzle';
import { formatAgo, formatDate } from '../../../lib/format';
import { admin, faDigits, messages } from '../../../messages/fa';
import { freshListings } from '../../../modules/admin/queue';
import { decidesOwn, type StaffRole } from '../../../modules/admin/access';
import { riskyParts } from '../../../modules/admin/risky';
import { adminHref } from '../../../modules/admin/server';
import { eventPath } from '../../../modules/events/slug';
import { rentUnit } from '../../../modules/listings/card';
import { ancestry, cachedCatalog } from '../../../modules/listings/catalog';
import { formatPrice } from '../../../modules/listings/price';
import { listingPath } from '../../../modules/listings/slug';
import { countryNameFa } from '../../../modules/listings/zones';
import { imageUrl } from '../../../modules/media/server';
import { typicalPrice } from '../../../modules/search/browse';
import type { FreshCard } from './cards';

// The cards of «آگهی‌های تازه» as plain data (Nov 3, 2026, mockup after-wave2/fresh-review-2): the
// suspicious ones first, then the oldest, 20 at a time; «۲۰ آگهی دیگر» asks for the next ones
// without the ids already on the screen, so a decided or shown card never comes twice.

export const FRESH_PAGE = 20;

const RESTRICTING = new Set(['reject', 'remove', 'hide', 'warn', 'sanction', 'escalate']);

/** `viewer`: who is looking; their own listings get a note instead of the buttons, unless they are the owner */
export async function freshCards(db: Queryable, opts: { skip?: string[]; timeZone: string; viewer: { userId: string; role: StaffRole } }) {
  const [rows, catalog] = await Promise.all([freshListings(db), cachedCatalog(db)]);
  const t = admin.fresh;
  const it = admin.item;

  // Much cheaper than the middle of similar listings is a classic sign (as on the item page); one
  // query per category and place, not per listing
  const typical = new Map<string, Promise<{ low: number; high: number } | null>>();
  const cheaper = await Promise.all(
    rows.map(async (r) => {
      const price = r.price_minor === null ? null : Number(r.price_minor);
      if (!price || !r.category_id || !r.country_code || (r.price_type !== 'fixed' && r.price_type !== 'negotiable')) return null;
      const key = `${r.country_code}:${r.category_id}:${r.location_id ?? ''}`;
      if (!typical.has(key)) typical.set(key, typicalPrice(db, { countryCode: r.country_code, categoryIds: [r.category_id], locationId: r.location_id }).catch(() => null));
      const range = await typical.get(key)!;
      if (!range || price >= range.low) return null;
      const pct = Math.round((1 - price / ((range.low + range.high) / 2)) * 100);
      return pct > 0 ? pct : null;
    }),
  );

  const all = rows.map((r, n) => {
    const title = riskyParts(r.title);
    const description = r.description ? riskyParts(r.description) : null;
    const risky = [...title, ...(description ?? [])].some((p) => p.risky);
    const flagged = r.last_decided_by !== 'staff' && r.last_decision === 'escalate';
    const why = [
      r.decisions_against > 0 && t.why.decisions(r.decisions_against),
      r.reports_against > 0 && t.why.reports(r.reports_against),
      r.sanction_type && t.why.sanction,
      !r.phone_verified && t.why.phone,
      flagged && t.why.flagged,
      risky && t.why.risky,
      cheaper[n] && t.why.cheaper(cheaper[n]!),
      r.same_text > 0 && t.why.sameText,
    ].filter((x): x is string => typeof x === 'string');
    const cur = r.currency ? catalog.currencies.get(r.currency) : undefined;
    const price = r.price_minor === null ? null : Number(r.price_minor);
    const unit = rentUnit(catalog, r.category_id, price);
    const sanction = r.sanction_type ? (admin.decide.ops[r.sanction_type] ?? r.sanction_type) : null;
    const card: FreshCard = {
      id: r.id,
      own: r.seller_id === opts.viewer.userId && !decidesOwn(opts.viewer.role),
      title,
      titleText: r.title,
      description,
      risky,
      why,
      site: r.is_event ? eventPath(r.title, r.token) : listingPath(r.title, r.token),
      reviewHref: adminHref(`/items/listing/${r.id}`),
      sellerHref: adminHref(`/items/user/${r.seller_id}`),
      seller: r.seller,
      sellerSince: formatAgo(new Date(r.seller_since), opts.timeZone),
      sellerOthers: t.sellerOthers(r.seller_others),
      published: formatAgo(new Date(r.published_at), opts.timeZone),
      categories: r.category_id ? ancestry(catalog, r.category_id).map((c) => c.nameFa).join(' › ') : null,
      price:
        price !== null && cur
          ? `${formatPrice(price, cur.code, cur.minorUnit)}${unit ? ` ${unit}` : ''}`
          : r.price_type && r.price_type !== 'fixed'
            ? ((messages.priceType as Record<string, string>)[r.price_type] ?? null)
            : null,
      place: [r.district, r.place_name ?? r.city].filter(Boolean).join('، ') || null,
      code: `${it.code} ${faDigits(String(r.ref_number))}`,
      tags: [
        ...(cheaper[n] ? [{ text: it.cheaper(cheaper[n]!), tone: 'danger' as const }] : []),
        ...(r.same_text > 0 ? [{ text: it.sameText(r.same_text), tone: 'saffron' as const }] : []),
        ...(r.images.length === 0 ? [{ text: it.noPhotos, tone: 'neutral' as const }] : []),
        ...(r.is_event ? [{ text: it.kinds.event!, tone: 'brand' as const }] : []),
      ],
      otherZone: r.other_zone ? { code: r.other_zone, text: t.otherZone(countryNameFa(r.other_zone)) } : null,
      history: [
        { label: it.sellerFacts.decisions, value: r.decisions_against ? faDigits(String(r.decisions_against)) : it.noneYet, red: r.decisions_against > 0 },
        { label: it.sellerFacts.reports, value: r.reports_against ? faDigits(String(r.reports_against)) : it.noneYet, red: r.reports_against > 0 },
        { label: it.sellerFacts.sameText, value: it.sameText(r.same_text), red: r.same_text > 0 },
        {
          label: t.listingDecisions,
          value: r.last_decision
            ? `${it.decisionNames[r.last_decision] ?? r.last_decision} (${r.last_decided_by === 'staff' ? t.byStaff : it.by[r.last_decided_by as 'ai' | 'rule']})`
            : t.noDecision,
          red: !!r.last_decision && RESTRICTING.has(r.last_decision),
        },
        ...(sanction
          ? [{ label: t.sanctionNow, value: r.sanction_ends ? t.until(sanction, formatDate(new Date(r.sanction_ends), opts.timeZone)) : sanction, red: true }]
          : []),
      ],
      photos: r.images.map((k) => ({ thumb: imageUrl(k, 'card', 'webp'), full: imageUrl(k, 'full', 'webp') })),
    };
    return card;
  });

  // Suspicious first; within each group the oldest first, as the query returns them
  const sorted = [...all.filter((c) => c.why.length > 0), ...all.filter((c) => c.why.length === 0)];
  const skip = new Set(opts.skip ?? []);
  return {
    total: all.length,
    suspicious: all.filter((c) => c.why.length > 0).length,
    cards: sorted.filter((c) => !skip.has(c.id)).slice(0, FRESH_PAGE),
  };
}
