import { describe, expect, it, vi } from 'vitest';
import { purgeHost } from './cloudflare-purge';

const env = {
  APP_URL: 'https://staging.example.com',
  CLOUDFLARE_ZONE_ID: '0123456789abcdef0123456789abcdef',
  CLOUDFLARE_PURGE_TOKEN: 'secret-token',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('purgeHost', () => {
  it('purges only APP_URL’s host in the zone', async () => {
    const fetchFn = vi.fn(async () => json(200, { success: true, errors: [] }));
    await expect(purgeHost(env, fetchFn, 0)).resolves.toBe('staging.example.com');
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/purge_cache`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ hosts: ['staging.example.com'] });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-token');
  });

  it('fails without retry on a 4xx and never shows the token', async () => {
    const fetchFn = vi.fn(async () => json(403, { success: false, errors: [{ code: 10000, message: 'Authentication error' }] }));
    const err = await purgeHost(env, fetchFn, 0).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('403 10000 Authentication error');
    expect((err as Error).message).not.toContain('secret-token');
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it('retries once on a 5xx or network error', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(json(200, { success: true }));
    await expect(purgeHost(env, fetchFn, 0)).resolves.toBe('staging.example.com');
    expect(fetchFn).toHaveBeenCalledTimes(2);

    const failing = vi.fn(async () => json(502, {}));
    await expect(purgeHost(env, failing, 0)).rejects.toThrow('502 no details');
    expect(failing).toHaveBeenCalledTimes(2);
  });
});
