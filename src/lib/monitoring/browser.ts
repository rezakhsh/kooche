// Browser error monitoring (docs/setup.md, "Error monitoring"). Runs on every page from
// src/instrumentation-client.ts, so it stays tiny: it reads the settings the root layout puts in
// <meta name="peydoo-monitoring"> (absent when monitoring is off: then nothing happens), listens
// for uncaught errors, and only when one happens loads Sentry's browser SDK (./browser-sdk.ts) as
// its own chunk. Reports go to our own /api/monitoring (the CSP's connect-src 'self'), which
// scrubs them and adds the real DSN; the page only knows a placeholder.

export const MONITORING_META = 'peydoo-monitoring';

export type BrowserMonitoringConfig = {
  /** Placeholder DSN on our own host; the tunnel replaces it */
  dsn: string;
  environment: string;
  release: string;
  sampleRate: number;
};

type Sdk = typeof import('./browser-sdk');

let config: BrowserMonitoringConfig | null | undefined;
let sdk: Promise<Sdk | null> | undefined;
/** The last few page paths (no query string), sent along as breadcrumbs */
const paths: Array<{ path: string; at: number }> = [];

function readConfig(): BrowserMonitoringConfig | null {
  if (config !== undefined) return config;
  try {
    const content = document.querySelector(`meta[name="${MONITORING_META}"]`)?.getAttribute('content');
    config = content ? (JSON.parse(content) as BrowserMonitoringConfig) : null;
  } catch {
    config = null;
  }
  return config;
}

/** Errors that carry a digest come from the server and were reported there */
function fromServer(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'digest' in error && !!(error as { digest?: unknown }).digest;
}

export function reportBrowserError(error: unknown, mechanism = 'generic'): void {
  try {
    if (fromServer(error)) return;
    const c = readConfig();
    if (!c) return;
    sdk ??= import('./browser-sdk').then(
      (m) => (m.startSdk(c) ? m : null),
      () => null,
    );
    const crumbs = paths.slice();
    void sdk.then((m) => m?.capture(error, mechanism, crumbs));
  } catch {
    // Monitoring must never break the page
  }
}

export function noteNavigation(url: string): void {
  try {
    const path = new URL(url, location.href).pathname;
    paths.push({ path, at: Date.now() / 1000 });
    if (paths.length > 5) paths.shift();
  } catch {
    // ignore
  }
}

let started = false;

export function startBrowserMonitoring(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  // Read now: global-error.tsx replaces the whole document, <meta> included
  if (!readConfig()) return;
  noteNavigation(location.href);
  window.addEventListener('error', (e) => {
    // "Script error." from other origins has no error object and nothing useful
    if (e.error !== undefined && e.error !== null) reportBrowserError(e.error, 'onerror');
  });
  window.addEventListener('unhandledrejection', (e) => reportBrowserError(e.reason, 'onunhandledrejection'));
}
