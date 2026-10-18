import { sitemapResponse } from '../serve';

// /sitemaps/germany.xml, /sitemaps/germany-listings-1.xml

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }): Promise<Response> {
  const m = /^([a-z0-9-]{1,80})\.xml$/.exec((await params).file);
  // The index has its own address
  if (!m || m[1] === 'index') return new Response('Not found', { status: 404 });
  return sitemapResponse(m[1]!);
}
