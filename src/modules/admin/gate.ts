import { createHmac, timingSafeEqual } from 'node:crypto';

// The admin page's secret address (approved Oct 23, 2026; docs/setup.md, "Admin page"). The pages
// live under the internal route /admin, but the only way in is /<ADMIN_PATH>/…: src/proxy.ts
// rewrites that to /admin/… and marks the request with a header only it can set. The admin layout,
// pages and actions refuse anything without the mark with a plain 404, so /admin itself answers
// like any unknown address. The mark is derived from AUTH_SECRET, so a header sent by a client
// (the proxy removes it anyway, but prefetches skip the proxy) can't open the gate. This is an
// extra layer only: sign-in, the staff role and the TOTP check guard every page and action.

export const ADMIN_ROUTE = '/admin';
export const ADMIN_GATE_HEADER = 'x-peydoo-admin-gate';
/** The request's method, set by src/proxy.ts for the server (headers() doesn't give it) */
export const METHOD_HEADER = 'x-peydoo-method';

export function adminGateValue(secret: string): string {
  return createHmac('sha256', secret).update('peydoo-admin-gate-v1').digest('base64url');
}

/**
 * The method as the proxy marks it: a client can't send a mark of its own (prefetch headers skip
 * the proxy), so a missing or wrong one counts as a change (code check, Oct 30, 2026).
 */
export function methodMark(method: string, secret: string): string {
  return `${method}.${createHmac('sha256', secret).update(`peydoo-method-v1:${method}`).digest('base64url')}`;
}

/** The method the proxy marked, or null */
export function markedMethod(header: string | null | undefined, secret: string): string | null {
  const method = header?.split('.')[0];
  if (!header || !method) return null;
  const a = Buffer.from(header);
  const b = Buffer.from(methodMark(method, secret));
  return a.length === b.length && timingSafeEqual(a, b) ? method : null;
}

/** Whether the request carries the proxy's mark */
export function gateOpen(header: string | null | undefined, secret: string): boolean {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(adminGateValue(secret));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The internal /admin path for an address under the secret prefix, else null */
export function adminRoute(pathname: string, adminPath: string | undefined): string | null {
  if (!adminPath) return null;
  const prefix = `/${adminPath}`;
  if (pathname === prefix || pathname === `${prefix}/`) return ADMIN_ROUTE;
  if (pathname.startsWith(`${prefix}/`)) return ADMIN_ROUTE + pathname.slice(prefix.length);
  return null;
}

/** /admin itself or below: reachable only through the rewrite */
export function isInternalAdminPath(pathname: string): boolean {
  return pathname === ADMIN_ROUTE || pathname.startsWith(`${ADMIN_ROUTE}/`);
}

/** The public address of an admin page, from its path inside the admin page ('/queue') */
export function adminAddress(adminPath: string, path = ''): string {
  return `/${adminPath}${path === '/' ? '' : path}`;
}
