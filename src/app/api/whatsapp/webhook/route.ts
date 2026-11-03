import { after } from 'next/server';
import { appDb } from '../../../../db/drizzle';
import { valkey } from '../../../../lib/valkey';
import { incomingMessages, sameVerifyToken, validSignature, whatsAppSender } from '../../../../modules/notifications/whatsapp-api';
import { whatsApp } from '../../../../modules/users/server';
import { handleWhatsAppMessages } from '../../../../modules/users/whatsapp';

// /api/whatsapp/webhook: Meta's calls for our WhatsApp Business number (docs/setup.md, "WhatsApp").
// GET is the handshake when the callback URL is saved; POST brings the users' messages, signed with
// the app secret over the raw body. Meta gets its 200 at once (it resends otherwise); our replies go
// out after the response (src/modules/users/whatsapp.ts). Nothing here is stored but the attempt.

export const dynamic = 'force-dynamic';

/** A webhook call is a few kilobytes; anything far larger isn't one */
const MAX_BODY = 256 * 1024;
const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request: Request): Promise<Response> {
  const config = whatsApp();
  const params = new URL(request.url).searchParams;
  if (!config || params.get('hub.mode') !== 'subscribe' || !sameVerifyToken(params.get('hub.verify_token'), config.verifyToken)) {
    return new Response(null, { status: 403, headers: NO_STORE });
  }
  return new Response(params.get('hub.challenge') ?? '', { status: 200, headers: { ...NO_STORE, 'Content-Type': 'text/plain' } });
}

export async function POST(request: Request): Promise<Response> {
  const config = whatsApp();
  if (!config) return new Response(null, { status: 404, headers: NO_STORE });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return new Response(null, { status: 413, headers: NO_STORE });
  const body = await request.text();
  if (body.length > MAX_BODY) return new Response(null, { status: 413, headers: NO_STORE });
  if (!validSignature(body, request.headers.get('x-hub-signature-256'), config.appSecret)) {
    return new Response(null, { status: 401, headers: NO_STORE });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400, headers: NO_STORE });
  }

  const replies = await handleWhatsAppMessages(appDb(), valkey(), incomingMessages(payload));
  if (replies.length > 0) {
    const send = whatsAppSender(config);
    after(async () => {
      for (const r of replies) {
        // A failed reply isn't retried: the verification itself is done, and the page shows it
        await send(r.to, r.text).catch((e) => console.error('whatsapp: reply failed:', e instanceof Error ? e.message : e));
      }
    });
  }
  return new Response(null, { status: 200, headers: NO_STORE });
}
