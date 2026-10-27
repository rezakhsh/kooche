import { appDb } from '../../../../db/drizzle';
import { clientIp } from '../../../../lib/client-ip';
import { hit, type Limit } from '../../../../lib/rate-limit';
import { valkey } from '../../../../lib/valkey';
import { readEventsQuery, type EventsQuery } from '../../../../modules/events/list-params';
import { eventsPlace, placeFilter } from '../../../../modules/events/list-place';
import { countEvents } from '../../../../modules/events/queries';
import { cachedCatalog } from '../../../../modules/listings/catalog';

// The events filter sheet's live count, «نمایش ۴ رویداد» (wave 1, mockup final/events-filters):
// GET with the list's path in `p` (/germany/berlin/events) and the form's fields as they are. No
// session, nothing personal, nothing stored. 120 a minute per IP; Cloudflare never stores /api/.

export const dynamic = 'force-dynamic';

const COUNT_LIMIT: Limit = { name: 'event-count:ip', max: 120, windowSeconds: 60 };
const CAP = 500;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': status === 200 ? 'private, max-age=30' : 'no-store' } });

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const m = /^\/([a-z-]{2,40})(?:\/([^/]{1,80}))?\/events$/.exec(params.get('p') ?? '');
  if (!m) return json({ count: null }, 400);
  const ip = clientIp(request.headers);
  if (ip && !(await hit(valkey(), [[COUNT_LIMIT, ip]]).catch(() => ({ ok: true }))).ok) return json({ count: null }, 429);
  const db = appDb();
  const place = await eventsPlace(db, m[1]!, m[2] ? decodeURIComponent(m[2]) : null);
  if (!place) return json({ count: null }, 404);
  const query: EventsQuery = {};
  for (const [k, v] of params) {
    if (k === 'p' || v === '' || k === '__proto__') continue;
    const had = query[k];
    query[k] = had === undefined ? v : [...(Array.isArray(had) ? had : [had]), v];
  }
  const now = new Date();
  const filter = placeFilter(await cachedCatalog(db), place, readEventsQuery(query, now, place.timeZone), now);
  const count = await countEvents(db, filter, now, CAP + 1);
  return json({ count, capped: count > CAP });
}
