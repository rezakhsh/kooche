import { z } from 'zod';
import { appDb } from '../../../db/drizzle';
import { webEnv } from '../../../lib/env';
import { hit } from '../../../lib/rate-limit';
import { valkey } from '../../../lib/valkey';
import { actingState } from '../../../modules/admin/acting';
import { viewAsCountry } from '../../../modules/admin/view-as';
import { auth } from '../../../modules/users/server';
import { deviceZoneSchema, saveDeviceTimeZone } from '../../../modules/users/time-zone';

// The signed-in device's time zone, from src/components/device-time-zone.tsx (owner, Nov 5, 2026;
// src/modules/users/time-zone.ts): once a browser session, saved only when it changed. Always 204
// and never an error the page could show: a bad or unknown zone is simply ignored. Not from an
// admin acting as the user (their own device's zone isn't the user's) nor while viewing as a
// country (no account then).

export const dynamic = 'force-dynamic';

const body = z.object({ tz: deviceZoneSchema });
const PER_USER = { name: 'tz:user:1h', max: 20, windowSeconds: 3600 };

export async function POST(request: Request): Promise<Response> {
  const done = new Response(null, { status: 204 });
  const site = new URL(webEnv().APP_URL);
  const origin = request.headers.get('origin');
  if (origin && origin !== site.origin) return done;
  if (request.headers.get('sec-fetch-site') === 'cross-site' || viewAsCountry(request.headers)) return done;
  const text = await request.text().catch(() => '');
  if (text.length > 200) return done;
  let parsed;
  try {
    parsed = body.safeParse(JSON.parse(text));
  } catch {
    return done;
  }
  if (!parsed.success) return done;
  try {
    const session = await auth().api.getSession({ headers: request.headers });
    if (!session) return done;
    const db = appDb();
    if (await actingState(db, session.session.id)) return done;
    if (!(await hit(valkey(), [[PER_USER, session.user.id]])).ok) return done;
    await saveDeviceTimeZone(db, session.user.id, parsed.data.tz);
  } catch (e) {
    // Never breaks a page; the saved place's zone still applies
    console.error('time-zone: not saved:', e instanceof Error ? e.message : e);
  }
  return done;
}
