import { BlockList, isIP } from 'node:net';
import { viewAsCountry } from '../modules/admin/view-as';

// The client's IP address. Coolify's Traefik doesn't trust incoming X-Forwarded-* headers (no
// forwardedHeaders.trustedIPs), so it drops what the client sent and writes the address it saw.
// The last entry is that address: the visitor, or a Cloudflare server when Cloudflare proxies the
// hostname. Only then is CF-Connecting-IP taken; anyone else can send that header by calling the
// server directly. Our DNS records are A only, so Cloudflare reaches the server over IPv4 (over
// IPv6 Docker's proxy would hide its address behind the network gateway).

// https://www.cloudflare.com/ips/ (also GET https://api.cloudflare.com/client/v4/ips), checked
// Oct 17, 2026. The Hetzner firewall allows ports 80 and 443 only from these ranges; update both
// together (docs/setup.md, "Domain and Cloudflare").
export const CLOUDFLARE_RANGES = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

const cloudflare = new BlockList();
for (const range of CLOUDFLARE_RANGES) {
  const [net, prefix] = range.split('/');
  cloudflare.addSubnet(net!, Number(prefix), isIP(net!) === 6 ? 'ipv6' : 'ipv4');
}

function valid(ip: string | null | undefined): string | null {
  const trimmed = ip?.trim();
  return trimmed && isIP(trimmed) ? trimmed : null;
}

export function isCloudflare(ip: string): boolean {
  const family = isIP(ip);
  return family !== 0 && cloudflare.check(ip, family === 6 ? 'ipv6' : 'ipv4');
}

export function clientIp(headers: Headers): string | null {
  const peer =
    valid(headers.get('x-forwarded-for')?.split(',').at(-1)) ?? valid(headers.get('x-real-ip'));
  if (peer && isCloudflare(peer)) return valid(headers.get('cf-connecting-ip')) ?? peer;
  return peer;
}

/**
 * Whom a per-address limit counts: an IPv4 address itself, an IPv6 address by its /64, which one
 * home or phone connection gets whole (Check B, Oct 31, 2026: each address of it counted apart)
 */
export function ipBlock(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  const [head = '', tail = ''] = ip.toLowerCase().split('::');
  const front = head ? head.split(':') : [];
  const back = tail ? tail.split(':') : [];
  const groups = ip.includes('::') ? [...front, ...Array<string>(Math.max(0, 8 - front.length - back.length)).fill('0'), ...back] : front;
  return `${groups.slice(0, 4).map((g) => parseInt(g, 16).toString(16)).join(':')}::/64`;
}

/**
 * The visitor's country as Cloudflare sees it (CF-IPCountry, ISO code), only when the request
 * really came through Cloudflare. Used to highlight a country on the home page and for the Iran
 * rules (./region.ts). Staff viewing the site as a country get that country, unless the request
 * really comes from Iran (src/modules/admin/view-as.ts).
 */
export function visitorCountry(headers: Headers): string | null {
  const real = cloudflareCountry(headers);
  return real === 'IR' ? real : (viewAsCountry(headers) ?? real);
}

function fromCloudflare(headers: Headers): boolean {
  const peer = valid(headers.get('x-forwarded-for')?.split(',').at(-1)) ?? valid(headers.get('x-real-ip'));
  return !!peer && isCloudflare(peer);
}

function cloudflareCountry(headers: Headers): string | null {
  if (!fromCloudflare(headers)) return null;
  const code = headers.get('cf-ipcountry')?.toUpperCase() ?? '';
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/**
 * Where Cloudflare places the visitor, only when the request really came through Cloudflare: the
 * country as sent (`T1` for Tor and `XX` for unknown included, which visitorCountry() leaves out),
 * and the first-level region from the "Add visitor location headers" managed transform
 * (`cf-region-code`, ISO 3166-2 without the country, e.g. `43` for Crimea; `cf-region`, its name;
 * switched on for peydoo.com on Nov 5, 2026, docs/setup.md "Domain and Cloudflare"). Used for the
 * payment block (./region.ts). Staff viewing the site as a country are not placed here.
 */
export function cloudflareLocation(headers: Headers): { country: string | null; regionCode: string | null; regionName: string | null } | null {
  if (!fromCloudflare(headers)) return null;
  const country = headers.get('cf-ipcountry')?.trim().toUpperCase() ?? '';
  const regionCode = headers.get('cf-region-code')?.trim().toUpperCase() ?? '';
  const regionName = headers.get('cf-region')?.trim() ?? '';
  return {
    country: /^[A-Z0-9]{2}$/.test(country) ? country : null,
    regionCode: /^[A-Z0-9]{1,3}$/.test(regionCode) ? regionCode : null,
    regionName: regionName ? regionName.slice(0, 100) : null,
  };
}
