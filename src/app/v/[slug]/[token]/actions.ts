'use server';

import { headers } from 'next/headers';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { appDb } from '../../../../db/drizzle';
import { clientIp } from '../../../../lib/client-ip';
import { hit } from '../../../../lib/rate-limit';
import { valkey } from '../../../../lib/valkey';
import { messages } from '../../../../messages/fa';
import { LISTING_LIMITS } from '../../../../modules/listings/limits';
import { listingPhone } from '../../../../modules/listings/queries';
import { currentSession } from '../../../../modules/users/server';

export type PhoneState = { phone?: string; error?: string; signIn?: boolean } | undefined;

/**
 * "Show number": only for signed-in visitors, rate-limited per visitor and per IP, and only when
 * the listing is active and its seller allows phone contact. The number is never in the page.
 */
export async function revealPhoneAction(token: string): Promise<PhoneState> {
  const session = await currentSession();
  if (!session) return { signIn: true };
  if (!/^[0-9a-hjkmnp-tv-z]{10}$/.test(token)) return { error: messages.genericError };
  const ip = clientIp(await headers());
  const limited = await hit(valkey(), [
    [LISTING_LIMITS.phoneRevealPerUserHour, session.user.id],
    ...(ip ? ([[LISTING_LIMITS.phoneRevealPerIpHour, ip]] as const) : []),
  ]);
  if (!limited.ok) return { error: messages.rateLimited(Math.ceil(limited.retryAfterSeconds / 60)) };

  const phone = await listingPhone(appDb(), token);
  if (!phone) return { error: messages.listing.phoneHidden };
  return { phone: parsePhoneNumberFromString(phone)?.formatInternational() ?? phone };
}
