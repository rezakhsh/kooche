'use server';

import { headers } from 'next/headers';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { appDb } from '../../../../db/drizzle';
import { clientIp } from '../../../../lib/client-ip';
import { valkey } from '../../../../lib/valkey';
import { messages } from '../../../../messages/fa';
import { revealPhone } from '../../../../modules/listings/phone-reveal';
import { currentSession } from '../../../../modules/users/server';

export type PhoneState = { phone?: string; error?: string; signIn?: boolean; verify?: boolean } | undefined;

/**
 * "Show number": only for signed-in visitors with a verified phone, rate-limited per visitor and
 * per IP, logged, and only when the listing is active and its seller shows the number
 * (src/modules/listings/phone-reveal.ts). The number is never in the page.
 */
export async function revealPhoneAction(token: string): Promise<PhoneState> {
  const session = await currentSession();
  if (!session) return { signIn: true };
  const h = await headers();
  const result = await revealPhone(appDb(), valkey(), {
    userId: session.user.id,
    token: String(token),
    ip: clientIp(h),
    userAgent: h.get('user-agent'),
  });
  if (result.ok) return { phone: parsePhoneNumberFromString(result.phone)?.formatInternational() ?? result.phone };
  switch (result.reason) {
    case 'phone_required':
      return { verify: true };
    case 'sign_in_required':
      return { signIn: true };
    case 'rate_limited':
      return { error: messages.rateLimited(Math.ceil((result.retryAfterSeconds ?? 60) / 60)) };
    case 'hidden':
      return { error: messages.listing.phoneHidden };
    default:
      return { error: messages.genericError };
  }
}
