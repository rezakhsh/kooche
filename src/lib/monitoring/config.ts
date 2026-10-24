import type { BrowserMonitoringConfig } from './browser';

// Error monitoring settings (docs/setup.md, "Error monitoring"), shared by the web server, the
// worker, the tunnel and the root layout. No SENTRY_DSN (development, tests): monitoring is off.

export type MonitoringConfig = {
  dsn: string;
  environment: 'staging' | 'production';
  /** peydoo@<first 12 characters of the commit> */
  release: string;
};

type MonitoringEnv = {
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: 'staging' | 'production';
  SOURCE_COMMIT?: string;
};

/** Coolify sets SOURCE_COMMIT at runtime to the deployed commit */
export function releaseName(commit: string | undefined): string {
  return `peydoo@${commit && /^[0-9a-f]{7,40}$/i.test(commit) ? commit.slice(0, 12).toLowerCase() : 'unknown'}`;
}

export function monitoringConfig(env: MonitoringEnv): MonitoringConfig | null {
  if (!env.SENTRY_DSN || !env.SENTRY_ENVIRONMENT) return null;
  return { dsn: env.SENTRY_DSN, environment: env.SENTRY_ENVIRONMENT, release: releaseName(env.SOURCE_COMMIT) };
}

/** What the root layout tells the browser: a placeholder DSN on our own host, never the real one */
export function browserMonitoringConfig(config: MonitoringConfig | null, appUrl: string): BrowserMonitoringConfig | null {
  if (!config) return null;
  return { dsn: `https://browser@${new URL(appUrl).host}/0`, environment: config.environment, release: config.release, sampleRate: 0.5 };
}
