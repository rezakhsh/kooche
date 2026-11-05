import { headers } from 'next/headers';
import { isIranRequest, isRestrictedCountryRequest } from '../lib/region';
import { messages } from '../messages/fa';
import { Alert } from './ui';

// Where payments can't come from (src/lib/region.ts; owner, Nov 4, 2026): the promote, billing,
// manage and Pro pages show a notice instead of the pay buttons. Iran keeps its own text
// (messages.iran.payments); Stripe's other restricted places, Tor and Ukraine without a region get
// the neutral one. The checkout functions refuse the same requests anyway (restricted_country).

export type PaymentPlace = 'iran' | 'restricted';

/** 'iran', 'restricted', or null when this request may pay */
export async function paymentPlace(): Promise<PaymentPlace | null> {
  const h = await headers();
  if (isIranRequest(h)) return 'iran';
  return isRestrictedCountryRequest(h) ? 'restricted' : null;
}

/** Instead of the pay buttons */
export function PaymentPlaceNotice({ place }: { place: PaymentPlace }) {
  return <Alert tone="info">{place === 'iran' ? messages.iran.payments : messages.paymentPlace.notice}</Alert>;
}

/** The refusal's text key: a request from Iran keeps the Iran text */
export const placeErrorKey = (reason: string, place: PaymentPlace | null): string => (reason === 'restricted_country' && place === 'iran' ? 'from_iran' : reason);
