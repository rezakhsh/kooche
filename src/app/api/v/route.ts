import { z } from 'zod';
import { appDb } from '../../../db/drizzle';
import { clientIp, visitorCountry } from '../../../lib/client-ip';
import { webEnv } from '../../../lib/env';
import { hit } from '../../../lib/rate-limit';
import { valkey } from '../../../lib/valkey';
import { VIEW_AS_HEADER } from '../../../modules/admin/view-as';
import { countVisit, liveRefCodes } from '../../../modules/stats/visits';

// One page view from src/components/visit-beacon.tsx (src/modules/stats/visits.ts). Only from our
// own pages; a staff member viewing as a country isn't a visitor. Always 204, so a page never waits.

export const dynamic = 'force-dynamic';

const body = z.object({ p: z.string().max(300), l: z.boolean(), r: z.string().max(500).nullable(), q: z.string().max(40).nullable() });
const PER_IP = { name: 'visit:ip:1h', max: 600, windowSeconds: 3600 };

let codes: { at: number; set: Promise<Set<string>> } | null = null;
function refCodesCached(): Promise<Set<string>> {
  if (!codes || Date.now() - codes.at > 5 * 60_000) codes = { at: Date.now(), set: liveRefCodes(appDb()) };
  return codes.set;
}

export async function POST(request: Request): Promise<Response> {
  const done = new Response(null, { status: 204 });
  const env = webEnv();
  const site = new URL(env.APP_URL);
  const origin = request.headers.get('origin');
  if (origin && origin !== site.origin) return done;
  if (request.headers.get('sec-fetch-site') === 'cross-site' || request.headers.has(VIEW_AS_HEADER)) return done;
  const text = await request.text().catch(() => '');
  if (text.length > 2_000) return done;
  let parsed;
  try {
    parsed = body.safeParse(JSON.parse(text));
  } catch {
    return done;
  }
  if (!parsed.success) return done;
  const ip = clientIp(request.headers);
  const redis = valkey();
  try {
    if (ip && !(await hit(redis, [[PER_IP, ip]])).ok) return done;
    const ref = parsed.data.q && (await refCodesCached()).has(parsed.data.q.toLowerCase()) ? parsed.data.q.toLowerCase() : null;
    await countVisit(redis, {
      path: parsed.data.p,
      landing: parsed.data.l,
      referrer: parsed.data.r,
      ref,
      ip,
      userAgent: request.headers.get('user-agent'),
      country: visitorCountry(request.headers),
      ownHost: site.hostname,
    });
  } catch (e) {
    // Counting never breaks a page
    console.error('visits: not counted:', e instanceof Error ? e.message : e);
  }
  return done;
}
