import { parseEnvelope, type Event } from '@sentry/core';
import { Queue, UnrecoverableError, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { parseWebEnv } from '../src/lib/env';
import { browserMonitoringConfig, monitoringConfig, releaseName, type MonitoringConfig } from '../src/lib/monitoring/config';
import { BROWSER_DAILY_BUDGET, budgetKey, createThrottle, DAILY_BUDGET, resetFallbackBudget, takeBudget } from '../src/lib/monitoring/limits';
import { redact, scrubEvent } from '../src/lib/monitoring/scrub';
import { closeMonitoring, flushMonitoring, initMonitoring, monitoringEnabled, reportError } from '../src/lib/monitoring/server';
import { handleTunnel, MAX_ENVELOPE_BYTES } from '../src/lib/monitoring/tunnel';
import { contentSecurityPolicy } from '../src/proxy';
import { reportJobFailure } from '../src/worker/monitoring';

// Error monitoring (docs/setup.md, "Error monitoring"): what leaves our servers, how much, and that
// nothing happens without a DSN. A local HTTP server stands in for Sentry's ingest.

const KEY = '0123456789abcdef0123456789abcdef';
const APP_URL = 'https://staging.peydoo.test';

let redis: Redis;
let ingest: Server;
let received: Event[] = [];
let ingestStatus = 200;
let dsn = '';

beforeAll(async () => {
  redis = new Redis(process.env.TEST_REDIS_URL!, { maxRetriesPerRequest: 1 });
  ingest = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const [, items] = parseEnvelope(new Uint8Array(Buffer.concat(chunks)));
      for (const [headers, payload] of items) if (headers.type === 'event') received.push(payload as Event);
      res.writeHead(ingestStatus).end('{}');
    });
  });
  await new Promise<void>((resolve) => ingest.listen(0, '127.0.0.1', resolve));
  dsn = `http://${KEY}@127.0.0.1:${(ingest.address() as AddressInfo).port}/1`;
});

afterAll(async () => {
  await closeMonitoring();
  await redis.quit();
  await new Promise((resolve) => ingest.close(resolve));
});

beforeEach(async () => {
  received = [];
  ingestStatus = 200;
  resetFallbackBudget();
  await redis.del(...(await redis.keys('monitoring:*')), 'monitoring:none');
  await redis.del(...(await redis.keys('rl:monitoring:*')), 'rl:none');
});

const config = (): MonitoringConfig => ({ dsn, environment: 'staging', release: releaseName('cf2162dec4c297efe10f4d2a2e0dc7444d5cc458') });

/** Waits until the client's queue is sent (the ingest answers at once) */
async function sent(): Promise<Event[]> {
  await flushMonitoring(3_000);
  return received;
}

describe('scrubbing', () => {
  it('redacts emails, phones (Persian digits too), IPs, IBANs, cards and secrets', () => {
    const out = redact(
      [
        'mail reza.k+test@example.de failed',
        'phone +49 176 1234 5678 and ۰۱۷۶۱۲۳۴۵۶۷۸',
        'from 203.0.113.7 and 2001:db8::8a2e:370:7334 and fe80:0:0:0:202:b3ff:fe1e:8329',
        'iban DE89 3704 0044 0532 0130 00',
        'card 4111 1111 1111 1111',
        'key sk_live_51Habcdefghijklmnop and whsec_abcdefghijklmnop',
        'Authorization: Bearer abcdef.ghijkl.mnopqr',
        'jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N',
        'postgres://classifieds_app:s3cret@db:5432/classifieds',
        'token /alerts/off/Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFiY2RlZg',
        'user 0192f3a4-5b6c-7d8e-9f01-23456789abcd',
      ].join('\n'),
    );
    for (const leak of ['reza.k', 'example.de', '176 1234', '۰۱۷۶', '01761234', '203.0.113', '2001:db8', 'fe80', 'DE89', '4111', 'sk_live', 'whsec_', 'abcdef.ghijkl', 'eyJ', 's3cret', 'Zm9vYmFy', '0192f3a4']) {
      expect(out).not.toContain(leak);
    }
    expect(out).toContain('[email]');
    expect(out).toContain('[phone]');
    expect(out).toContain('[ip]');
    expect(out).toContain('[number]');
    expect(out).toContain('[secret]');
    expect(out).toContain('[id]');
    expect(out).toContain('postgres://[secret]@db:5432/classifieds');
  });

  it('keeps what explains the error: dates, times, line numbers, short tokens, file paths', () => {
    const text = 'at /app/.next/server/chunks/ssr/page-0a1b2c3d4e5f6789.js:12:34 on 2026-10-24 10:00:00, listing /v/7k2m9q4x1z took 5000 ms';
    expect(redact(text)).toBe(text);
  });

  it('rebuilds the event from known fields: no user, headers, cookies, body, query strings or extra data', () => {
    const event: Event = {
      event_id: 'a'.repeat(32),
      message: 'failed for someone@example.com',
      user: { id: '1', email: 'someone@example.com', ip_address: '198.51.100.1' },
      server_name: 'web-container-1',
      request: { url: 'https://peydoo.com/chat?c=secret#x', headers: { cookie: 'session=1' }, cookies: { a: 'b' }, data: 'hello', query_string: 'q=1' },
      extra: { query: 'SELECT … WHERE email = $1', parameters: ['someone@example.com'] },
      tags: { route: '/[country]/[city]', email: 'x@y.de', 'Bad Key': 'v' },
      contexts: { browser: { name: 'Chrome', version: '130' }, peydoo: { queue: 'media', job: 'media_process', attempts: 5 }, secrets: { token: 'x' } },
      breadcrumbs: [
        { category: 'console', message: 'chat text' },
        { category: 'ui.click', message: 'button' },
        { category: 'navigation', data: { from: '/chat?c=1', to: '/my' } },
      ],
      exception: {
        values: [
          {
            type: 'PostgresError',
            value: 'duplicate key for 09121234567',
            stacktrace: { frames: [{ filename: 'https://peydoo.com/_next/static/chunks/a.js?v=1', function: 'f', lineno: 1, colno: 2, vars: { password: 'x' }, context_line: 'secret()' }] },
          },
        ],
      },
    };
    const out = scrubEvent(event);
    const json = JSON.stringify(out);
    expect(out.user).toBeUndefined();
    expect(out.server_name).toBeUndefined();
    expect(out.extra).toBeUndefined();
    expect(out.request).toEqual({ url: 'https://peydoo.com/chat' });
    expect(out.tags).toEqual({ route: '/[country]/[city]', email: '[email]' });
    expect(out.contexts).toEqual({ browser: { name: 'Chrome', version: '130' }, peydoo: { queue: 'media', job: 'media_process', attempts: 5 } });
    expect(out.breadcrumbs).toEqual([{ category: 'navigation', timestamp: undefined, data: { from: '/chat', to: '/my' } }]);
    expect(out.exception?.values?.[0]?.value).toBe('duplicate key for [phone]');
    expect(out.exception?.values?.[0]?.stacktrace?.frames?.[0]).toEqual({ filename: 'https://peydoo.com/_next/static/chunks/a.js', function: 'f', lineno: 1, colno: 2 });
    for (const leak of ['someone', 'cookie', 'session', 'hello', 'secret', 'password', 'chat text', 'button', '198.51']) expect(json).not.toContain(leak);
  });
});

describe('settings', () => {
  const base = {
    APP_URL,
    DATABASE_URL: 'postgres://a:b@localhost/c',
    REDIS_URL: 'redis://localhost',
    AUTH_SECRET: 'x'.repeat(32),
    TELEGRAM_BOT_USERNAME: 'peydoo_bot',
    PHONE_CODE_SECRET: 'y'.repeat(32),
  };

  it("accepts only Sentry's EU region (or a local test ingest), with an environment", () => {
    const eu = `https://${KEY}@o4508000000000000.ingest.de.sentry.io/4508000000000001`;
    expect(parseWebEnv({ ...base, SENTRY_DSN: eu, SENTRY_ENVIRONMENT: 'staging' }).success).toBe(true);
    expect(parseWebEnv({ ...base, SENTRY_DSN: `https://${KEY}@o4508000000000000.ingest.us.sentry.io/1`, SENTRY_ENVIRONMENT: 'staging' }).success).toBe(false);
    expect(parseWebEnv({ ...base, SENTRY_DSN: `https://${KEY}@o1.ingest.sentry.io/1`, SENTRY_ENVIRONMENT: 'staging' }).success).toBe(false);
    expect(parseWebEnv({ ...base, SENTRY_DSN: eu }).success).toBe(false);
    expect(parseWebEnv({ ...base, SENTRY_DSN: 'http://k@localhost:9000/1', SENTRY_ENVIRONMENT: 'production' }).success).toBe(true);
    expect(parseWebEnv({ ...base, SENTRY_DSN: '' }).success).toBe(true);
  });

  it('names the release after the commit and gives the browser only a placeholder DSN', () => {
    expect(releaseName('CF2162DEC4C297EFE10F')).toBe('peydoo@cf2162dec4c2');
    expect(releaseName(undefined)).toBe('peydoo@unknown');
    expect(releaseName('not a commit')).toBe('peydoo@unknown');
    expect(monitoringConfig({ SENTRY_DSN: 'x' })).toBeNull();
    const browser = browserMonitoringConfig(config(), APP_URL);
    expect(browser).toEqual({ dsn: 'https://browser@staging.peydoo.test/0', environment: 'staging', release: 'peydoo@cf2162dec4c2', sampleRate: 0.5 });
    expect(JSON.stringify(browser)).not.toContain(KEY);
  });

  it("leaves the CSP's connect-src at our own origin", () => {
    const csp = contentSecurityPolicy('n', { IMAGE_URL: undefined, S3_ENDPOINT: undefined });
    expect(csp).toContain("connect-src 'self';");
    expect(csp).not.toContain('sentry');
  });
});

describe('budget and throttle', () => {
  const day = new Date('2030-01-01T12:00:00Z');

  it('allows 160 a day in all, of which 60 from browsers, then nothing until the next day', async () => {
    let browser = 0;
    for (let i = 0; i < BROWSER_DAILY_BUDGET + 10; i++) if (await takeBudget(redis, 'browser', day)) browser++;
    expect(browser).toBe(BROWSER_DAILY_BUDGET);
    let server = 0;
    for (let i = 0; i < DAILY_BUDGET; i++) if (await takeBudget(redis, 'server', day)) server++;
    expect(server).toBe(DAILY_BUDGET - BROWSER_DAILY_BUDGET);
    expect(await takeBudget(redis, 'server', new Date('2030-01-02T00:00:01Z'))).toBe(true);
    const ttl = await redis.ttl(budgetKey('2030-01-01'));
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(2 * 86400);
  });

  it('falls back to 20 an hour per process without Valkey', async () => {
    let ok = 0;
    for (let i = 0; i < 30; i++) if (await takeBudget(null, 'server', day)) ok++;
    expect(ok).toBe(20);
    expect(await takeBudget(null, 'server', new Date('2030-01-01T13:00:00Z'))).toBe(true);
  });

  it('sends the same error once per 10 minutes', () => {
    const t = createThrottle();
    expect(t.isRepeat('a', 0)).toBe(false);
    expect(t.isRepeat('a', 60_000)).toBe(true);
    expect(t.isRepeat('b', 60_000)).toBe(false);
    expect(t.isRepeat('a', 10 * 60_000)).toBe(false);
    expect(t.takeDropped()).toBe(1);
  });
});

describe('server and worker reports', () => {
  afterEach(async () => {
    await closeMonitoring();
  });

  it('does nothing without a DSN', async () => {
    expect(initMonitoring(null, 'web', () => redis)).toBe(false);
    expect(monitoringEnabled()).toBe(false);
    reportError(new Error('nobody hears this'));
    expect(await sent()).toEqual([]);
  });

  it('sends one scrubbed event with environment, release and component, and throttles repeats', async () => {
    initMonitoring(config(), 'web', () => redis);
    const cause = new Error('connect to 10.0.1.5 refused');
    const error = new Error('sign-in failed for reza@example.com', { cause });
    reportError(error, { tags: { route_type: 'action', route: '/login' } });
    reportError(error, { tags: { route_type: 'action', route: '/login' } });
    const events = await sent();
    expect(events).toHaveLength(1);
    const e = events[0]!;
    expect(e.environment).toBe('staging');
    expect(e.release).toBe('peydoo@cf2162dec4c2');
    expect(e.tags).toMatchObject({ component: 'web', route_type: 'action', route: '/login' });
    expect(e.server_name).toBeUndefined();
    expect(e.user).toBeUndefined();
    const values = e.exception!.values!.map((v) => v.value);
    expect(values).toContain('sign-in failed for [email]');
    expect(values).toContain('connect to [ip] refused');
    expect(e.exception!.values!.at(-1)!.stacktrace!.frames!.length).toBeGreaterThan(0);
  });

  it('stops at the daily budget', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await redis.set(budgetKey(today), String(DAILY_BUDGET), 'EX', 60);
    initMonitoring(config(), 'worker', () => redis);
    reportError(new Error('over budget'));
    expect(await sent()).toEqual([]);
  });

  it('reports a BullMQ job once, after its last attempt, without its data', async () => {
    initMonitoring(config(), 'worker', () => redis);
    const connection = new Redis(process.env.TEST_REDIS_URL!, { maxRetriesPerRequest: null });
    const queue = new Queue('monitoring-test', { connection });
    const failures: number[] = [];
    const worker = new Worker(
      'monitoring-test',
      async (job) => {
        if (job.name === 'never') throw new UnrecoverableError('bad request for 0176 1234 5678');
        throw new Error('smtp timeout');
      },
      { connection: connection.duplicate() },
    );
    worker.on('failed', (job, e) => {
      failures.push(job?.attemptsMade ?? 0);
      reportJobFailure(job, e);
    });
    try {
      await queue.add('retry', { email: 'private@example.com' }, { attempts: 2 });
      await queue.add('never', { email: 'private@example.com' }, { attempts: 5 });
      await expect.poll(() => failures.length, { timeout: 10_000 }).toBe(3);
      const events = await sent();
      expect(events).toHaveLength(2);
      const retry = events.find((e) => e.tags?.job === 'retry')!;
      expect(retry.tags).toMatchObject({ component: 'worker', queue: 'monitoring-test' });
      expect(retry.contexts?.peydoo).toEqual({ queue: 'monitoring-test', job: 'retry', attempts: 2 });
      const never = events.find((e) => e.tags?.job === 'never')!;
      expect(never.exception!.values!.at(-1)!.value).toBe('bad request for [phone]');
      expect(JSON.stringify(events)).not.toContain('private');
    } finally {
      await worker.close();
      await queue.obliterate({ force: true });
      await queue.close();
      await connection.quit();
    }
  });
});

describe('browser tunnel', () => {
  const browserDsn = 'https://browser@staging.peydoo.test/0';
  const browserEvent = {
    event_id: 'b'.repeat(32),
    platform: 'javascript',
    environment: 'made-up',
    release: 'made-up',
    user: { ip_address: '{{auto}}' },
    request: { url: `${APP_URL}/chat?c=1`, headers: { 'User-Agent': 'x' } },
    exception: { values: [{ type: 'TypeError', value: 'x is undefined for a@b.de', stacktrace: { frames: [{ filename: `${APP_URL}/_next/static/chunks/a.js`, lineno: 1 }] } }] },
  };
  const envelope = (header: object, items: Array<[object, object]>) =>
    [JSON.stringify(header), ...items.flatMap(([h, p]) => [JSON.stringify(h), JSON.stringify(p)])].join('\n');
  const post = (body: string, headers: Record<string, string> = {}) =>
    new Request(`${APP_URL}/api/monitoring`, {
      method: 'POST',
      body,
      headers: { origin: APP_URL, 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1', ...headers },
    });
  const deps = (over: Partial<Parameters<typeof handleTunnel>[1]> = {}) => ({ config: config(), appUrl: APP_URL, redis, ip: '198.51.100.7', ...over });

  it('is off without a DSN', async () => {
    const res = await handleTunnel(post(envelope({ dsn: browserDsn }, [[{ type: 'event' }, browserEvent]])), deps({ config: null }));
    expect(res.status).toBe(404);
    expect(received).toEqual([]);
  });

  it('forwards one scrubbed event with the real DSN, our environment and release, and the device from the User-Agent', async () => {
    const res = await handleTunnel(post(envelope({ dsn: browserDsn, sdk: { name: 'sentry.javascript.browser' } }, [[{ type: 'event' }, browserEvent]])), deps());
    expect(res.status).toBe(200);
    expect(received).toHaveLength(1);
    const e = received[0]!;
    expect(e.environment).toBe('staging');
    expect(e.release).toBe('peydoo@cf2162dec4c2');
    expect(e.tags).toMatchObject({ component: 'browser' });
    expect(e.contexts).toEqual({ browser: { name: 'Safari' }, os: { name: 'iOS' }, device: { family: 'mobile' } });
    expect(e.request).toEqual({ url: `${APP_URL}/chat` });
    expect(e.user).toBeUndefined();
    expect(e.exception!.values![0]!.value).toBe('x is undefined for [email]');
  });

  it('refuses other origins, wrong DSNs, big bodies, and drops what is not an event', async () => {
    const good = envelope({ dsn: browserDsn }, [[{ type: 'event' }, browserEvent]]);
    expect((await handleTunnel(post(good, { origin: 'https://evil.test' }), deps())).status).toBe(403);
    expect((await handleTunnel(post(envelope({ dsn: `https://${KEY}@o1.ingest.de.sentry.io/1` }, [[{ type: 'event' }, browserEvent]])), deps())).status).toBe(400);
    expect((await handleTunnel(post('not an envelope'), deps())).status).toBe(400);
    expect((await handleTunnel(post('x'.repeat(MAX_ENVELOPE_BYTES + 1)), deps())).status).toBe(413);
    const other = envelope({ dsn: browserDsn }, [
      [{ type: 'session' }, { sid: '1' }],
      [{ type: 'client_report' }, {}],
      [{ type: 'replay_event' }, {}],
    ]);
    expect((await handleTunnel(post(other), deps())).status).toBe(200);
    const transaction = envelope({ dsn: browserDsn }, [[{ type: 'event' }, { ...browserEvent, type: 'transaction' }]]);
    expect((await handleTunnel(post(transaction), deps())).status).toBe(200);
    expect(received).toEqual([]);
  });

  it('limits each IP to 10 a minute', async () => {
    const body = envelope({ dsn: browserDsn }, [[{ type: 'event' }, browserEvent]]);
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await handleTunnel(post(body), deps({ ip: '198.51.100.8' }))).status);
    expect(codes.filter((c) => c === 200)).toHaveLength(10);
    expect(codes.slice(10)).toEqual([429, 429]);
  });

  it("passes on Sentry's 429", async () => {
    ingestStatus = 429;
    const res = await handleTunnel(post(envelope({ dsn: browserDsn }, [[{ type: 'event' }, browserEvent]])), deps());
    expect(res.status).toBe(429);
  });
});
