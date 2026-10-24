import {
  getEnvelopeEndpointWithUrlEncodedAuth,
  makeDsn,
  parseEnvelope,
  serializeEnvelope,
  type Envelope,
  type Event,
} from '@sentry/core';
import type { Redis } from 'ioredis';
import { hit, type Limit } from '../rate-limit';
import { describeDevice } from '../user-agent';
import { browserMonitoringConfig, type MonitoringConfig } from './config';
import { takeBudget } from './limits';
import { scrubEvent } from './scrub';

// The browser's way to Sentry (POST /api/monitoring; docs/setup.md, "Error monitoring"). Browsers
// only talk to our own origin, so the CSP stays connect-src 'self', and the page only knows a
// placeholder DSN, so nobody can fill our Sentry project from outside. Only error events pass:
// sessions, client reports, replays, attachments and transactions are dropped. Each event is
// scrubbed like a server event, browser and system are taken from the User-Agent (the header itself
// isn't forwarded) and environment and release are ours, not the page's. Sentry sees our server's
// IP, never the visitor's. Nothing from the body is ever logged.

export const MAX_ENVELOPE_BYTES = 64 * 1024;
const FORWARD_TIMEOUT_MS = 5_000;
export const TUNNEL_LIMITS = {
  minute: { name: 'monitoring:minute', max: 10, windowSeconds: 60 },
  day: { name: 'monitoring:day', max: 50, windowSeconds: 24 * 3600 },
} satisfies Record<string, Limit>;

export type TunnelDeps = {
  config: MonitoringConfig | null;
  appUrl: string;
  redis: Redis | null;
  ip: string | null;
  fetch?: typeof fetch;
};

const status = (code: number, headers?: Record<string, string>) => new Response(null, { status: code, headers });

async function readLimited(request: Request): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_ENVELOPE_BYTES) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_ENVELOPE_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    body.set(c, offset);
    offset += c.byteLength;
  }
  return body;
}

function eventFrom(payload: unknown): Event | null {
  try {
    const value = payload instanceof Uint8Array ? JSON.parse(new TextDecoder().decode(payload)) : payload;
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Event) : null;
  } catch {
    return null;
  }
}

export async function handleTunnel(request: Request, deps: TunnelDeps): Promise<Response> {
  const { config, redis } = deps;
  const browser = browserMonitoringConfig(config, deps.appUrl);
  if (!config || !browser) return status(404);
  if (request.headers.get('origin') !== new URL(deps.appUrl).origin) return status(403);

  const body = await readLimited(request);
  if (!body) return status(413);

  if (redis && deps.ip) {
    try {
      const limited = await hit(redis, [
        [TUNNEL_LIMITS.minute, deps.ip],
        [TUNNEL_LIMITS.day, deps.ip],
      ]);
      if (!limited.ok) return status(429, { 'Retry-After': String(limited.retryAfterSeconds) });
    } catch {
      // Valkey down: the budget's per-process fallback still limits what goes out
    }
  }

  let envelope: Envelope;
  try {
    envelope = parseEnvelope(body) as Envelope;
  } catch {
    return status(400);
  }
  const [headers, items] = envelope;
  if (headers.dsn !== browser.dsn) return status(400);

  // The SDK sends one event per envelope; anything else is a session, client report …, and the
  // SDK only needs a 200
  const item = items.find(([itemHeaders]) => itemHeaders.type === 'event');
  const event = item ? eventFrom(item[1]) : null;
  if (!event || event.type !== undefined) return status(200);
  if (!(await takeBudget(redis, 'browser'))) return status(429, { 'Retry-After': '3600' });

  const device = describeDevice(request.headers.get('user-agent'));
  const clean = scrubEvent({
    ...event,
    environment: config.environment,
    release: config.release,
    platform: 'javascript',
    contexts: {
      ...(device.browser ? { browser: { name: device.browser } } : {}),
      ...(device.os ? { os: { name: device.os } } : {}),
      device: { family: device.mobile ? 'mobile' : 'desktop' },
    },
    tags: { ...event.tags, component: 'browser' },
  });
  const dsn = makeDsn(config.dsn);
  if (!dsn) return status(500);
  const out = serializeEnvelope([
    { event_id: clean.event_id, sent_at: new Date().toISOString(), dsn: config.dsn },
    [[{ type: 'event' }, clean]],
  ] as Envelope);
  try {
    const response = await (deps.fetch ?? fetch)(getEnvelopeEndpointWithUrlEncodedAuth(dsn), {
      method: 'POST',
      body: out as BodyInit,
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
    });
    if (response.status === 429) return status(429, { 'Retry-After': response.headers.get('retry-after') ?? '60' });
    return status(response.ok ? 200 : 502);
  } catch {
    return status(502);
  }
}
