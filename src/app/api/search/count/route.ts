import { appDb } from '../../../../db/drizzle';
import { clientIp } from '../../../../lib/client-ip';
import { webEnv } from '../../../../lib/env';
import { hit, type Limit } from '../../../../lib/rate-limit';
import { valkey } from '../../../../lib/valkey';
import { COUNT_CAP } from '../../../../modules/search/browse';
import { countForForm } from '../../../../modules/search/form-count';
import type { RawParams } from '../../../../modules/search/filters';

// The filter sheet's live count (src/modules/search/form-count.ts): GET with the browse page's
// path in `p` and the form's fields as they are. No session, nothing personal, nothing stored.
// 120 a minute per IP; Cloudflare never stores /api/.

export const dynamic = 'force-dynamic';

const COUNT_LIMIT: Limit = { name: 'search-count:ip', max: 120, windowSeconds: 60 };

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': status === 200 ? 'private, max-age=30' : 'no-store' } });

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const path = params.get('p') ?? '';
  if (path.length > 200) return json({ count: null }, 400);
  const ip = clientIp(request.headers);
  if (ip && !(await hit(valkey(), [[COUNT_LIMIT, ip]]).catch(() => ({ ok: true }))).ok) return json({ count: null }, 429);
  // A Map, then entries: a key like "__proto__" stays a key (and is refused by the parser)
  const fields = new Map<string, string[]>();
  for (const [k, v] of params) {
    if (k === 'p' || v === '') continue;
    fields.set(k, [...(fields.get(k) ?? []), v]);
  }
  const raw: RawParams = Object.fromEntries([...fields].map(([k, v]) => [k, v.length === 1 ? v[0] : v]));
  const count = await countForForm(appDb(), path, raw, webEnv().AUTH_SECRET).catch(() => null);
  if (count === null) return json({ count: null }, 404);
  return json({ count, capped: count > COUNT_CAP });
}
