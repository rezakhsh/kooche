// Checks error monitoring end to end after a deploy (docs/setup.md, "Error monitoring"): sends one
// server event straight to Sentry, as the web and worker do, and one browser-shaped envelope through
// the live tunnel, as a page would. Both carry a test email and phone number, which must arrive in
// Sentry as [email] and [phone]. Prints the event ids to look up in Sentry; never the DSN.
//
//   set -a; . /root/.secrets/sentry.env; set +a
//   SENTRY_ENVIRONMENT=staging APP_URL=https://staging.peydoo.com npx tsx scripts/monitoring-check.ts
//
// For production behind Cloudflare Access until go-live, add CF_ACCESS_CLIENT_ID and
// CF_ACCESS_CLIENT_SECRET (staging's /root/.secrets/access-prod.env).

import { randomUUID } from 'node:crypto';
import { monitoringConfig, browserMonitoringConfig } from '../src/lib/monitoring/config';
import { flushMonitoring, initMonitoring, reportError } from '../src/lib/monitoring/server';

const appUrl = process.env.APP_URL?.replace(/\/$/, '');
const environment = process.env.SENTRY_ENVIRONMENT;
if (!appUrl || (environment !== 'staging' && environment !== 'production') || !process.env.SENTRY_DSN) {
  throw new Error('SENTRY_DSN, SENTRY_ENVIRONMENT (staging or production) and APP_URL are required');
}
const config = monitoringConfig({ SENTRY_DSN: process.env.SENTRY_DSN, SENTRY_ENVIRONMENT: environment, SOURCE_COMMIT: process.env.SOURCE_COMMIT });
const browser = browserMonitoringConfig(config, appUrl)!;
const stamp = new Date().toISOString();

// 1. Server: through the same client, scrubbing and budget as the web and worker (no Valkey here:
//    the per-process limit applies)
initMonitoring(config, 'web', () => null);
reportError(new Error(`monitoring check (server) ${stamp} for check@example.com, +49 176 1234 5678`), { tags: { check: 'server' } });
await flushMonitoring(5_000);
console.log(`server event sent (${stamp})`);

// 2. Browser: an envelope like the SDK's, through /api/monitoring
const eventId = randomUUID().replace(/-/g, '');
const event = {
  event_id: eventId,
  timestamp: Date.now() / 1000,
  platform: 'javascript',
  level: 'error',
  tags: { check: 'browser' },
  request: { url: `${appUrl}/monitoring-check?secret=1` },
  exception: { values: [{ type: 'Error', value: `monitoring check (browser) ${stamp} for check@example.com`, stacktrace: { frames: [{ filename: `${appUrl}/_next/static/chunks/check.js`, function: 'check', lineno: 1, colno: 1, in_app: true }] } }] },
};
const body = [JSON.stringify({ event_id: eventId, sent_at: stamp, dsn: browser.dsn }), JSON.stringify({ type: 'event' }), JSON.stringify(event)].join('\n');
const access = process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET
  ? { 'CF-Access-Client-Id': process.env.CF_ACCESS_CLIENT_ID, 'CF-Access-Client-Secret': process.env.CF_ACCESS_CLIENT_SECRET }
  : {};
const res = await fetch(`${appUrl}/api/monitoring`, {
  method: 'POST',
  body,
  headers: { Origin: appUrl, 'Content-Type': 'text/plain;charset=UTF-8', 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0 Safari/537.36', ...access },
});
console.log(`browser event ${eventId}: tunnel answered ${res.status}`);
if (res.status !== 200) process.exitCode = 1;
