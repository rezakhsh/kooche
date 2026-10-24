import type { Instrumentation } from 'next';

// Server-side error monitoring (docs/setup.md, "Error monitoring"). register() starts the Sentry
// client once per server process when SENTRY_DSN is set (runtime only, never at build time).
// onRequestError reports what Next.js caught in rendering, route handlers, server actions and the
// proxy, tagged with the route's pattern (/[country]/[city]), never the real path, so tokens in
// addresses don't leave the server.

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !process.env.SENTRY_DSN) return;
  const [{ webEnv }, { valkey }, { monitoringConfig }, { initMonitoring }] = await Promise.all([
    import('./lib/env'),
    import('./lib/valkey'),
    import('./lib/monitoring/config'),
    import('./lib/monitoring/server'),
  ]);
  initMonitoring(monitoringConfig(webEnv()), 'web', valkey);
}

/** Next.js's own control flow (redirect(), notFound() …), not errors */
function isControlFlow(error: unknown): boolean {
  const digest = typeof error === 'object' && error !== null && 'digest' in error ? String(error.digest) : '';
  return /^(NEXT_|BAILOUT_TO_CLIENT_SIDE_RENDERING|DYNAMIC_SERVER_USAGE)/.test(digest);
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !process.env.SENTRY_DSN || isControlFlow(error)) return;
  const { reportError } = await import('./lib/monitoring/server');
  reportError(error, {
    tags: {
      route_type: context.routeType,
      route: context.routePath,
      method: request.method,
      ...(context.renderSource ? { render_source: context.renderSource } : {}),
    },
  });
};
