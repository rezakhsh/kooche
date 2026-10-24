import {
  createStackParser,
  createTransport,
  dedupeIntegration,
  linkedErrorsIntegration,
  Scope,
  type BaseTransportOptions,
  type Transport,
} from '@sentry/core';
import { nodeStackLineParser, ServerRuntimeClient } from '@sentry/core/server';
import type { Redis } from 'ioredis';
import type { MonitoringConfig } from './config';
import { createThrottle, fingerprint, takeBudget } from './limits';
import { scrubEvent } from './scrub';

// Error reports from the web server and the worker to Sentry's EU region (docs/setup.md, "Error
// monitoring"). Sentry's core client only, without @sentry/nextjs or OpenTelemetry: no build
// plugin, no auto-instrumentation, a few MB of memory. Each event is scrubbed (./scrub.ts), sent
// at most once per 10 minutes per process, and only within the daily budget (./limits.ts).
// Without a config every function here does nothing.

export type Component = 'web' | 'worker';
export type ReportContext = {
  tags?: Record<string, string | number | boolean>;
  /** Queue, job name and attempts of a worker job (never its data) */
  job?: { queue: string; job: string; attempts: number };
  /** false for what reached the user as an error page or failed request (Next.js's onRequestError) */
  handled?: boolean;
};

const SEND_TIMEOUT_MS = 5_000;

let client: ServerRuntimeClient | undefined;
let component: Component = 'web';

/** Sends envelopes with fetch, 5 seconds at most */
function fetchTransport(options: BaseTransportOptions): Transport {
  return createTransport(options, async (request) => {
    const response = await fetch(options.url, {
      method: 'POST',
      body: request.body as BodyInit,
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    return {
      statusCode: response.status,
      headers: {
        'x-sentry-rate-limits': response.headers.get('x-sentry-rate-limits'),
        'retry-after': response.headers.get('retry-after'),
      },
    };
  });
}

/** Starts monitoring for this process; false when it is off (no config) */
export function initMonitoring(
  config: MonitoringConfig | null,
  name: Component,
  redis: () => Redis | null,
): boolean {
  if (!config || client) return !!client;
  component = name;
  const throttle = createThrottle();
  let budgetWarnedDay = '';
  client = new ServerRuntimeClient({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    platform: 'node',
    runtime: { name: 'node', version: process.version },
    stackParser: createStackParser(nodeStackLineParser()),
    integrations: [dedupeIntegration(), linkedErrorsIntegration()],
    transport: fetchTransport,
    sendDefaultPii: false,
    sendClientReports: false,
    traceLifecycle: 'static',
    maxBreadcrumbs: 0,
    beforeSend: async (event) => {
      const clean = scrubEvent(event);
      if (throttle.isRepeat(fingerprint(clean))) return null;
      const repeats = throttle.takeDropped();
      if (repeats) console.warn(`monitoring: ${repeats} repeated errors were not sent`);
      let connection: Redis | null = null;
      try {
        connection = redis();
      } catch {
        // No Valkey configured: the per-process limit applies
      }
      if (!(await takeBudget(connection, 'server'))) {
        const day = new Date().toISOString().slice(0, 10);
        if (budgetWarnedDay !== day) console.warn('monitoring: daily budget used up, errors are not sent until tomorrow (UTC)');
        budgetWarnedDay = day;
        return null;
      }
      return clean;
    },
  });
  client.init();
  return true;
}

export function monitoringEnabled(): boolean {
  return !!client;
}

/** Reports an error that was caught and logged; never throws */
export function reportError(error: unknown, context: ReportContext = {}): void {
  if (!client) return;
  try {
    const scope = new Scope();
    scope.setClient(client);
    scope.setTags({ component, ...context.tags });
    if (context.job) scope.setContext('peydoo', context.job);
    client.captureException(error, { originalException: error, syntheticException: new Error(), mechanism: { handled: context.handled ?? true, type: context.handled === false ? 'onRequestError' : 'generic' } }, scope);
  } catch (e) {
    console.error('monitoring: report failed:', e instanceof Error ? e.message : e);
  }
}

/** Waits until queued reports are sent (before the process exits) */
export async function flushMonitoring(timeoutMs = 2_000): Promise<void> {
  if (client) await client.flush(timeoutMs).then(undefined, () => false);
}

/** For tests */
export async function closeMonitoring(): Promise<void> {
  const c = client;
  client = undefined;
  if (c) await c.close(1_000).then(undefined, () => false);
}
