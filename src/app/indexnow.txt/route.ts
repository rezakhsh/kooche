import { webEnv } from '../../lib/env';
import { indexNowConfig } from '../../modules/search/indexnow';

// /indexnow.txt: the IndexNow key, which the engines fetch (the worker's calls name this address as
// keyLocation) to check the calls are ours (src/modules/search/indexnow.ts). 404 while
// SEARCH_INDEXING is off (staging) or INDEXNOW_KEY is unset.

export const dynamic = 'force-dynamic';

export function GET(): Response {
  const cfg = indexNowConfig(webEnv());
  if (!cfg) return new Response('Not found', { status: 404 });
  return new Response(cfg.key, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // The same for everyone and rarely changed
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
