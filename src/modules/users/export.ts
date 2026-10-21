import { sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { exportChatData, type ChatExport } from '../chat/export';
import { listingPath } from '../listings/slug';
import { imageUrl } from '../media/server';
import { sellerPath } from './profile';

// "Download my data" (GDPR art. 15 and 20), approved Oct 21, 2026: everything we keep about the
// signed-in user, as one JSON file, built when asked (a direct download, not a job: one account's
// data is small). Only their own rows; of other people, only what they already see on the site
// (a display name, a public page). Never another person's email or phone, never messages withheld
// from the user. Photo links work while the listing exists.

type Row = Record<string, unknown>;

const iso = (v: unknown) => (v === null || v === undefined ? null : new Date(v as string).toISOString());

export type UserExport = {
  exportedAt: string;
  account: Row;
  devices: Row[];
  listings: Row[];
  favorites: Row[];
  savedSearches: Row[];
  blocked: Row[];
  reports: Row[];
  orders: Row[];
  chats: ChatExport;
  activity: Row[];
};

export async function exportUserData(db: Queryable, userId: string, appUrl: string, now = new Date()): Promise<UserExport> {
  const [account] = await db.execute<Row>(sql`
    SELECT u.email, u.display_name, u.public_token, u.phone_e164, u.phone_verified_at, u.phone_verification_method,
           u.telegram_user_id IS NOT NULL AS telegram_linked, u.status, u.created_at, u.home_postal_code,
           u.home_place_name, u.home_district, c.name_fa AS home_city, u.notification_prefs
    FROM users u LEFT JOIN locations c ON c.id = u.home_location_id
    WHERE u.id = ${userId}
  `);
  if (!account) throw new Error('exportUserData: no such user');

  const devices = await db.execute<Row>(sql`
    SELECT created_at, updated_at AS last_active_at, expires_at, ip_address, user_agent
    FROM sessions WHERE user_id = ${userId} ORDER BY created_at
  `);

  // Every listing and event that still exists, deleted ones included until they are purged
  const listingRows = await db.execute<Row>(sql`
    SELECT l.id, l.public_token, l.kind, l.status, l.title, l.description, c.slug AS category, l.price_type,
           l.price_minor, l.currency, l.attributes, l.country_code, ci.name_fa AS city, l.postal_code, l.place_name,
           l.district, l.shipping_offered, l.allow_phone_contact, l.created_at, l.published_at, l.expires_at,
           l.deleted_at, e.listing_id IS NOT NULL AS is_event, e.attendance, e.venue_name, e.street_address,
           e.online_url, e.ticket_url, e.organizer_name, e.time_zone
    FROM listings l
    LEFT JOIN categories c ON c.id = l.category_id
    LEFT JOIN locations ci ON ci.id = l.location_id
    LEFT JOIN event_details e ON e.listing_id = l.id
    WHERE l.user_id = ${userId}
    ORDER BY l.created_at
  `);
  const ids = listingRows.map((l) => l.id as string);
  const idList = ids.length ? sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `) : null;
  const [history, images, dates] = idList
    ? await Promise.all([
        db.execute<Row>(sql`
          SELECT listing_id, event_type, from_status, to_status, data, created_at FROM listing_events
          WHERE listing_id IN (${idList}) ORDER BY created_at, id
        `),
        db.execute<Row>(sql`
          SELECT listing_id, storage_key, position FROM listing_images
          WHERE listing_id IN (${idList}) AND status = 'ready' ORDER BY listing_id, position
        `),
        db.execute<Row>(sql`
          SELECT listing_id, starts_at, ends_at FROM event_dates WHERE listing_id IN (${idList}) ORDER BY starts_at
        `),
      ])
    : [[], [], []];
  const byListing = <T extends Row>(rows: Iterable<T>) => {
    const m = new Map<string, T[]>();
    for (const r of rows) m.set(r.listing_id as string, [...(m.get(r.listing_id as string) ?? []), r]);
    return m;
  };
  const historyOf = byListing(history);
  const imagesOf = byListing(images);
  const datesOf = byListing(dates);

  const listings = listingRows.map(({ id, is_event, attendance, venue_name, street_address, online_url, ticket_url, organizer_name, time_zone, ...l }) => ({
    ...l,
    url: l.status === 'deleted' ? null : `${appUrl}${listingPath(l.title as string, l.public_token as string)}`,
    created_at: iso(l.created_at),
    published_at: iso(l.published_at),
    expires_at: iso(l.expires_at),
    deleted_at: iso(l.deleted_at),
    photos: (imagesOf.get(id as string) ?? []).map((i) => imageUrl(i.storage_key as string, 'full', 'webp')).filter(Boolean),
    history: (historyOf.get(id as string) ?? []).map(({ listing_id: _l, ...h }) => ({ ...h, created_at: iso(h.created_at) })),
    ...(is_event
      ? {
          event: {
            attendance,
            venue_name,
            street_address,
            online_url,
            ticket_url,
            organizer_name,
            time_zone,
            dates: (datesOf.get(id as string) ?? []).map((d) => ({ starts_at: iso(d.starts_at), ends_at: iso(d.ends_at) })),
          },
        }
      : {}),
  }));

  const favorites = await db.execute<Row>(sql`
    SELECT l.title, l.public_token, l.status, f.created_at
    FROM favorites f JOIN listings l ON l.id = f.listing_id
    WHERE f.user_id = ${userId} ORDER BY f.created_at
  `);
  const savedSearches = await db.execute<Row>(sql`
    SELECT name, filters, country_code, created_at FROM saved_searches WHERE user_id = ${userId} ORDER BY created_at
  `);
  // Of the people they blocked, only what anyone sees: the name and the public page
  const blocked = await db.execute<Row>(sql`
    SELECT u.display_name, u.public_token, u.status, b.created_at
    FROM user_blocks b JOIN users u ON u.id = b.blocked_user_id
    WHERE b.blocker_user_id = ${userId} ORDER BY b.created_at
  `);
  const reports = await db.execute<Row>(sql`
    SELECT r.reason_code, r.details, r.status, r.created_at, l.title AS listing_title
    FROM reports r LEFT JOIN listings l ON l.id = r.listing_id
    WHERE r.reporter_user_id = ${userId} ORDER BY r.created_at
  `);
  const orders = await db.execute<Row>(sql`
    SELECT o.status, o.currency, o.subtotal_minor, o.discount_minor, o.tax_minor, o.total_minor, o.created_at, p.code AS product
    FROM orders o JOIN products p ON p.id = o.product_id
    WHERE o.buyer_user_id = ${userId} ORDER BY o.created_at
  `);
  const activity = await db.execute<Row>(sql`
    SELECT action, target_type, ip_address, user_agent, created_at FROM audit_log
    WHERE actor_user_id = ${userId} ORDER BY created_at, id
  `);

  return {
    exportedAt: now.toISOString(),
    account: {
      ...account,
      public_page: `${appUrl}${sellerPath(account.public_token as string)}`,
      phone_verified_at: iso(account.phone_verified_at),
      created_at: iso(account.created_at),
    },
    devices: devices.map((d) => ({ ...d, created_at: iso(d.created_at), last_active_at: iso(d.last_active_at), expires_at: iso(d.expires_at) })),
    listings,
    favorites: favorites.map(({ public_token, ...f }) => ({ ...f, url: `${appUrl}${listingPath(f.title as string, public_token as string)}`, created_at: iso(f.created_at) })),
    savedSearches: savedSearches.map((s) => ({ ...s, created_at: iso(s.created_at) })),
    blocked: blocked.map(({ public_token, ...b }) => ({ ...b, public_page: b.status === 'active' ? `${appUrl}${sellerPath(public_token as string)}` : null, created_at: iso(b.created_at) })),
    reports: reports.map((r) => ({ ...r, created_at: iso(r.created_at) })),
    orders: orders.map((o) => ({ ...o, created_at: iso(o.created_at) })),
    chats: await exportChatData(db, userId),
    activity: activity.map((a) => ({ ...a, created_at: iso(a.created_at) })),
  };
}
