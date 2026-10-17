import { describe, expect, it } from 'vitest';
import { clientIp } from '../src/lib/client-ip';

// Coolify's Traefik writes the address it saw as the last X-Forwarded-For entry. CF-Connecting-IP
// counts only when that address is Cloudflare's.

const CLOUDFLARE_V4 = '172.71.10.20'; // 172.64.0.0/13
const CLOUDFLARE_V6 = '2a06:98c1:3120::7'; // 2a06:98c0::/29

describe('clientIp', () => {
  it('takes the address Traefik saw', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9');
    expect(clientIp(new Headers({ 'x-forwarded-for': '198.51.100.1, 203.0.113.9' }))).toBe('203.0.113.9');
    expect(clientIp(new Headers({ 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('takes CF-Connecting-IP behind Cloudflare', () => {
    for (const edge of [CLOUDFLARE_V4, CLOUDFLARE_V6]) {
      const headers = new Headers({ 'x-forwarded-for': edge, 'cf-connecting-ip': '2001:db8::42' });
      expect(clientIp(headers)).toBe('2001:db8::42');
    }
  });

  it('ignores CF-Connecting-IP sent straight to the server', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.9', 'cf-connecting-ip': '198.51.100.1' });
    expect(clientIp(headers)).toBe('203.0.113.9');
  });

  it('ignores a Cloudflare address the client wrote into X-Forwarded-For', () => {
    const headers = new Headers({
      'x-forwarded-for': `${CLOUDFLARE_V4}, 203.0.113.9`,
      'cf-connecting-ip': '198.51.100.1',
    });
    expect(clientIp(headers)).toBe('203.0.113.9');
  });

  it('falls back to the Cloudflare address without a valid CF-Connecting-IP', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': CLOUDFLARE_V4 }))).toBe(CLOUDFLARE_V4);
    const junk = new Headers({ 'x-forwarded-for': CLOUDFLARE_V4, 'cf-connecting-ip': 'not-an-ip' });
    expect(clientIp(junk)).toBe(CLOUDFLARE_V4);
  });

  it('returns null without a valid address', () => {
    expect(clientIp(new Headers())).toBeNull();
    expect(clientIp(new Headers({ 'x-forwarded-for': 'unknown' }))).toBeNull();
  });
});
