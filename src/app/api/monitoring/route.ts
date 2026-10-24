import { clientIp } from '../../../lib/client-ip';
import { webEnv } from '../../../lib/env';
import { monitoringConfig } from '../../../lib/monitoring/config';
import { handleTunnel } from '../../../lib/monitoring/tunnel';
import { valkey } from '../../../lib/valkey';

// Browser error reports on their way to Sentry (src/lib/monitoring/tunnel.ts). 404 while
// monitoring is off.

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const env = webEnv();
  const config = monitoringConfig(env);
  return handleTunnel(request, { config, appUrl: env.APP_URL, redis: config ? valkey() : null, ip: clientIp(request.headers) });
}
