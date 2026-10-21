import { headers } from 'next/headers';
import { clientIp } from '../../lib/client-ip';
import { webEnv } from '../../lib/env';
import { messages } from '../../messages/fa';
import { TURNSTILE_FIELD, verifyTurnstile, type TurnstileAction } from './turnstile';

// Turnstile for server actions: the site key for the page, and the check of a submitted form.

let warned = false;

/** The public site key for the widget, or null when Turnstile is off (development without keys) */
export function turnstileSiteKey(): string | null {
  const env = webEnv();
  return env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY ? env.TURNSTILE_SITE_KEY : null;
}

/** Checks the form's Turnstile token. Returns null when it passed, else the Persian message. */
export async function checkTurnstile(form: FormData, action: TurnstileAction): Promise<string | null> {
  const env = webEnv();
  if (!env.TURNSTILE_SECRET_KEY || !env.TURNSTILE_SITE_KEY) {
    // env.ts requires both in production, so this is development only
    if (!warned) console.warn('turnstile: no keys set, the check is skipped (development only)');
    warned = true;
    return null;
  }
  const r = await verifyTurnstile(
    { token: form.get(TURNSTILE_FIELD), action, ip: clientIp(await headers()) },
    { secret: env.TURNSTILE_SECRET_KEY, hostname: new URL(env.APP_URL).hostname },
  );
  if (r.ok) return null;
  // Error codes only, never the token
  console.warn(`turnstile: ${action} refused (${r.reason}${r.codes?.length ? `: ${r.codes.join(', ')}` : ''})`);
  const t = messages.turnstile;
  return r.reason === 'missing' ? t.missing : r.reason === 'unavailable' ? t.unavailable : t.failed;
}
