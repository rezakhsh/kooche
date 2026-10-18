import { appDb } from '../../../../../db/drizzle';
import { webEnv } from '../../../../../lib/env';
import { buildIcs } from '../../../../../modules/events/ics';
import { publicEvent } from '../../../../../modules/events/queries';
import { eventPath } from '../../../../../modules/events/slug';

// "Add to calendar": /e/{title}/{token}/calendar answers an .ics file with the event's dates that
// haven't ended. Only for events anyone may see.

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = /^[0-9a-hjkmnp-tv-z]{10}$/.test(token) ? await publicEvent(appDb(), token) : null;
  const now = new Date();
  const dates = data?.dates.filter((d) => d.endsAt > now) ?? [];
  if (!data || data.listing.status !== 'active' || dates.length === 0) return new Response('Not found', { status: 404 });
  const { listing: l, details: d, cityLocal } = data;
  const env = webEnv();
  const place = l.postalCode && l.placeName ? `${l.postalCode} ${l.placeName}` : cityLocal;
  const body = buildIcs({
    token: l.publicToken,
    title: l.title,
    description: l.description,
    url: `${env.APP_URL}${eventPath(l.title, l.publicToken)}`,
    location: d.attendance === 'online' ? null : [d.venueName, d.streetAddress, place].filter(Boolean).join(', ') || null,
    cancelled: d.scheduleStatus === 'cancelled',
    dates,
    updatedAt: l.updatedAt,
    sequence: l.revision,
    host: new URL(env.APP_URL).host,
  });
  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="event-${l.publicToken}.ics"`,
      'Cache-Control': 'private, max-age=300',
    },
  });
}
