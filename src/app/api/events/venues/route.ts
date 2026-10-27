import { appDb } from '../../../../db/drizzle';
import { hit, type Limit } from '../../../../lib/rate-limit';
import { valkey } from '../../../../lib/valkey';
import { venueSuggestions } from '../../../../modules/events/queries';
import { currentSession } from '../../../../modules/users/server';

// Venues for the event posting steps (wave 1, mockup final/post-event2): GET ?c=DE&q=Heim.
// Signed-in only (the posting form is), 60 a minute per account. Venues are public on event pages.

export const dynamic = 'force-dynamic';

const LIMIT: Limit = { name: 'event-venues:user', max: 60, windowSeconds: 60 };

export async function GET(request: Request): Promise<Response> {
  const session = await currentSession();
  if (!session) return Response.json({ venues: [] }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const country = (params.get('c') ?? '').toUpperCase();
  const q = (params.get('q') ?? '').slice(0, 60);
  if (!/^[A-Z]{2}$/.test(country)) return Response.json({ venues: [] }, { status: 400 });
  if (!(await hit(valkey(), [[LIMIT, session.user.id]]).catch(() => ({ ok: true }))).ok) return Response.json({ venues: [] }, { status: 429 });
  const venues = await venueSuggestions(appDb(), country, q);
  return Response.json({ venues }, { headers: { 'Cache-Control': 'private, no-store' } });
}
