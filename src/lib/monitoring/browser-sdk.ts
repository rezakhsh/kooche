import {
  BrowserClient,
  dedupeIntegration,
  defaultStackParser,
  eventFiltersIntegration,
  linkedErrorsIntegration,
  makeFetchTransport,
  Scope,
} from '@sentry/browser';
import type { BrowserMonitoringConfig } from './browser';

// Sentry's browser SDK, loaded by ./browser.ts only when a page has an error. No default
// integrations: no console, DOM, fetch or XHR breadcrumbs (DOM breadcrumbs could carry chat text),
// no sessions, replay, tracing, feedback or client reports. At most 5 reports per page load, half of
// them sampled; errors from extensions and other sites are dropped (allowUrls).

const MAX_PER_PAGE = 5;

let client: BrowserClient | undefined;
let sent = 0;

export function startSdk(config: BrowserMonitoringConfig): boolean {
  if (client) return true;
  try {
    client = new BrowserClient({
      dsn: config.dsn,
      tunnel: '/api/monitoring',
      environment: config.environment,
      release: config.release,
      sampleRate: config.sampleRate,
      transport: makeFetchTransport,
      stackParser: defaultStackParser,
      integrations: [
        eventFiltersIntegration({
          allowUrls: [location.origin],
          ignoreErrors: [/ResizeObserver loop/, /^(TypeError: )?(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?)$/],
        }),
        linkedErrorsIntegration(),
        dedupeIntegration(),
      ],
      sendClientReports: false,
      maxBreadcrumbs: 5,
      beforeSend: (event) => (++sent > MAX_PER_PAGE ? null : event),
    });
    client.init();
    return true;
  } catch {
    return false;
  }
}

export function capture(error: unknown, mechanism: string, paths: Array<{ path: string; at: number }>): void {
  if (!client) return;
  const scope = new Scope();
  scope.setClient(client);
  scope.setTag('component', 'browser');
  for (let i = 1; i < paths.length; i++) {
    scope.addBreadcrumb({ category: 'navigation', timestamp: paths[i]!.at, data: { from: paths[i - 1]!.path, to: paths[i]!.path } }, 5);
  }
  client.captureException(error, { mechanism: { type: mechanism, handled: mechanism === 'generic' } }, scope);
}
