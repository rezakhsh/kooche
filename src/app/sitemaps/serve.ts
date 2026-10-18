import { appDb } from '../../db/drizzle';
import { webEnv } from '../../lib/env';
import { readSitemap } from '../../modules/search/sitemap';

// Serves a sitemap the worker stored (src/modules/search/sitemap.ts). Not while SEARCH_INDEXING
// is off (staging): robots.txt disallows everything there, and these answer 404.

export async function sitemapResponse(name: string): Promise<Response> {
  if (webEnv().SEARCH_INDEXING !== 'on') return new Response('Not found', { status: 404 });
  const body = await readSitemap(appDb(), name);
  if (body === null) return new Response('Not found', { status: 404 });
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // No nonce and nothing personal in them, so shared caches may keep them for an hour
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
