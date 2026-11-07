import { describe, expect, it } from 'vitest';
import { s3Storage } from '../src/modules/media/storage';

// The server's own writes to R2 (business fixes, Nov 7, 2026). Inside Next.js's server, a signed
// Request object's body went out without a length and R2 answered 411, so «درخواست تأیید» crashed
// for any real document. put() now signs first and sends the plain bytes with their length.

const config = { endpoint: 'https://r2.example.test', region: 'auto', bucket: 'media', accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'secret' };

function recorder(status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return new Response(status === 200 ? '' : '<Error/>', { status });
  }) as typeof fetch;
  return { calls, fetchFn };
}

describe('writing an object from the server', () => {
  it('sends the bytes themselves, signed, with their length', async () => {
    const { calls, fetchFn } = recorder();
    const body = Buffer.alloc(208_091, 7);
    await s3Storage(config, fetchFn).put('verification/org/doc', body, 'image/png');
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0]!;
    expect(url).toBe('https://r2.example.test/media/verification/org/doc');
    expect(init.method).toBe('PUT');
    // Not a Request or a stream: a wrapper can't lose the length
    expect(init.body).toBeInstanceOf(Uint8Array);
    expect((init.body as Uint8Array).byteLength).toBe(208_091);
    const headers = new Headers(init.headers);
    expect(headers.get('content-length')).toBe('208091');
    expect(headers.get('content-type')).toBe('image/png');
    expect(headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\//);
    expect(headers.get('x-amz-content-sha256')).toBeTruthy();
  });

  it('a refusal is an error with its status', async () => {
    const { fetchFn } = recorder(411);
    await expect(s3Storage(config, fetchFn).put('k', Buffer.from('x'), 'application/pdf')).rejects.toThrow('storage: PUT failed with 411');
  });
});
