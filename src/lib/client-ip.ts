import { isIP } from 'node:net';

// The client's IP address. Coolify's Traefik doesn't trust incoming X-Forwarded-* headers (no
// forwardedHeaders.trustedIPs), so it drops what the client sent and writes the address it saw.
// The last entry is the one our proxy added. Revisit when Cloudflare proxies the real domain
// (then CF-Connecting-IP, accepted only from Cloudflare's ranges).

export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  const ip = forwarded?.split(',').at(-1)?.trim() ?? headers.get('x-real-ip')?.trim();
  return ip && isIP(ip) ? ip : null;
}
