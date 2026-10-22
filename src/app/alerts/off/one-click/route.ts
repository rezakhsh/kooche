import { appDb } from '../../../../db/drizzle';
import { unsubscribeByToken } from '../../../../modules/search/saved';

// RFC 8058 one-click unsubscribe: mail apps post `List-Unsubscribe=One-Click` here, with the
// token in the address (the List-Unsubscribe header of alert emails). POST only, so opening the
// address changes nothing. The answer is the same whether the token was known or not.

export async function POST(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get('t') ?? '';
  await unsubscribeByToken(appDb(), token);
  return new Response(null, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
