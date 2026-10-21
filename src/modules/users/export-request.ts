import type { Limit } from '../../lib/rate-limit';

// Guards of the export download (src/app/account/data/export/route.ts)

export const EXPORT_LIMIT: Limit = { name: 'export:user:1h', max: 3, windowSeconds: 3_600 };

/**
 * A route handler has no server-action origin check of its own: only a form posted from our own
 * pages may start a download. Browsers send Origin on every POST.
 */
export function sameOrigin(headers: Headers, appUrl: string): boolean {
  const origin = headers.get('origin');
  return !!origin && origin === new URL(appUrl).origin;
}
