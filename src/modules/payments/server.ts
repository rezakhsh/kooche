import { webEnv } from '../../lib/env';
import { StripeGateway, type PaymentGateway } from './gateway';

// The web app's payment gateway, from its settings. null while payments are switched off
// (development without Stripe keys): the pages then say payments aren't available.

let gateway: PaymentGateway | null | undefined;

export function paymentGateway(): PaymentGateway | null {
  if (gateway !== undefined) return gateway;
  const env = webEnv();
  gateway = env.STRIPE_SECRET_KEY ? new StripeGateway(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET ?? null) : null;
  return gateway;
}
