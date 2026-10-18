import type { MetadataRoute } from 'next';
import { webEnv } from '../lib/env';

// robots.txt. Staging (SEARCH_INDEXING off) shuts everything out, next to the X-Robots-Tag that
// src/proxy.ts sends. Production lets crawlers in, except personal pages, and names the sitemap.

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const env = webEnv();
  if (env.SEARCH_INDEXING !== 'on') return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/my/', '/account', '/chat', '/login', '/new', '/events/new'] },
    sitemap: `${env.APP_URL}/sitemap.xml`,
  };
}
