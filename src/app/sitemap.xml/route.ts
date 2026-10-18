import { sitemapResponse } from '../sitemaps/serve';

// /sitemap.xml: the sitemap index, listing one file per country and its listing files

export const dynamic = 'force-dynamic';

export function GET(): Promise<Response> {
  return sitemapResponse('index');
}
