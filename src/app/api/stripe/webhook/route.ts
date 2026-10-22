import { appDb } from '../../../../db/drizzle';
import { paymentGateway } from '../../../../modules/payments/server';
import { receiveWebhook } from '../../../../modules/payments/webhook';

// POST /api/stripe/webhook: Stripe's events (docs/setup.md, "Payments"). The signature is checked
// on the raw body; a valid event is stored once and handed to the worker, which applies it. This
// route never changes an order, a payment or an entitlement itself.

/** Stripe's events are a few kilobytes; anything far larger isn't one */
const MAX_BODY = 512 * 1024;

export async function POST(request: Request): Promise<Response> {
  const gateway = paymentGateway();
  if (!gateway) return new Response(null, { status: 404 });
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY) return new Response(null, { status: 413 });
  const body = await request.text();
  if (body.length > MAX_BODY) return new Response(null, { status: 413 });
  const outcome = await receiveWebhook(appDb(), gateway, body, request.headers.get('stripe-signature'));
  // Never details: the sender learns only whether the event was taken
  return new Response(null, { status: outcome === 'invalid' ? 400 : 200, headers: { 'Cache-Control': 'no-store' } });
}
