import { visitorCountry } from './client-ip';

// Iran read-only (wave 0, docs/wave0-plan.md, item 5). A request from Iran (Cloudflare's
// CF-IPCountry, trusted only when the request really came through Cloudflare) may read everything
// but write nothing, except what protects the person: reporting content (DSA Art. 16), signing
// out and ending other sessions, deleting the account, downloading their data, turning off
// notifications and alerts, leaving a city waitlist, plus error reports and the payment and
// messenger webhooks (which never come from Iran). No accounts, sign-ins, phone checks, posting,
// chat, favorites or payments.
//
// Three layers: src/proxy.ts refuses the write with a Persian page (iranBlocksRequest), the
// Cloudflare WAF rule (iranWafExpression, docs/setup.md) does the same at the edge, where it can't
// be bypassed, and the pages show a banner and notices so nobody fills in a form for nothing.
// Never mention "sanctions" to the user (owner, round 12).

export const isIranRequest = (headers: Headers): boolean => visitorCountry(headers) === 'IR';

/** Writes allowed from Iran: exact paths */
export const IRAN_WRITE_PATHS = [
  '/account', // sign out
  '/account/devices',
  '/account/delete',
  '/account/data/export',
  '/account/notifications',
] as const;

/** Writes allowed from Iran: path prefixes */
export const IRAN_WRITE_PREFIXES = ['/report', '/alerts/off', '/waitlist/leave', '/api/monitoring', '/api/stripe/webhook', '/api/whatsapp/webhook'] as const;

const READS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Whether a request from Iran must be refused: every write outside the lists above */
export function iranBlocksRequest(pathname: string, method: string): boolean {
  if (READS.has(method.toUpperCase())) return false;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if ((IRAN_WRITE_PATHS as readonly string[]).includes(path)) return false;
  return !IRAN_WRITE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * The same rule as a Cloudflare WAF custom rule expression (action: Block). Free plan: no regex,
 * so exact paths and prefixes only. Kept here so the edge and the app can't drift apart.
 */
export function iranWafExpression(): string {
  const exact = IRAN_WRITE_PATHS.map((p) => `"${p}"`).join(' ');
  const prefixes = IRAN_WRITE_PREFIXES.map((p) => `http.request.uri.path eq "${p}" or starts_with(http.request.uri.path, "${p}/")`).join(' or ');
  return `(ip.src.country eq "IR" and not http.request.method in {"GET" "HEAD" "OPTIONS"} and not http.request.uri.path in {${exact}} and not (${prefixes}))`;
}
