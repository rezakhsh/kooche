import type { PurgeEnv } from '../lib/env';

/**
 * Purges every cached response of APP_URL's host from Cloudflare's cache (purge by hostname, on
 * every plan). Only that host: img-staging and the Coolify dashboard keep their cache, so imgproxy
 * doesn't render every photo again after a deploy. Retries once on a network error or a 5xx.
 * Errors carry Cloudflare's message, never the token.
 */
export async function purgeHost(
  env: PurgeEnv,
  fetchFn: typeof fetch = fetch,
  retryDelayMs = 5_000,
): Promise<string> {
  const host = new URL(env.APP_URL).hostname;
  const url = `https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/purge_cache`;
  let lastError = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (attempt > 1) await new Promise((r) => setTimeout(r, retryDelayMs));
    let res: Response;
    try {
      res = await fetchFn(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.CLOUDFLARE_PURGE_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ hosts: [host] }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      lastError = `network error: ${e instanceof Error ? e.message : String(e)}`;
      continue;
    }
    const body = (await res.json().catch(() => null)) as { success?: boolean; errors?: { code: number; message: string }[] } | null;
    if (res.ok && body?.success) return host;
    lastError = `${res.status} ${(body?.errors ?? []).map((e) => `${e.code} ${e.message}`).join('; ') || 'no details'}`;
    if (res.status < 500) break;
  }
  throw new Error(`Cloudflare purge of ${host} failed: ${lastError}`);
}
