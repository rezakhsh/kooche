import { existsSync, writeFileSync } from 'node:fs';
import { deployEnv } from '../lib/env';

// Second step of the `migrate` Docker target (docs/setup.md, "App deployment"), run only after
// the migrations succeeded: asks Coolify to deploy web and worker, whose auto-deploy is off.
// Coolify builds one image at a time, so their deployments queue behind this one.
//
// The marker lives in the container's own filesystem: it survives a restart of this container
// (a reboot reruns the migrations, a no-op, without redeploying the apps) but not a new deploy.
// The Docker HEALTHCHECK waits for it.
const MARKER = '/tmp/deploy-triggered';

if (existsSync(MARKER)) {
  console.log('Deploy already triggered by this container, skipping');
} else {
  const env = deployEnv();
  const url = new URL('/api/v1/deploy', env.COOLIFY_API_URL);
  url.searchParams.set('uuid', env.DEPLOY_APP_UUIDS);
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.COOLIFY_DEPLOY_TOKEN}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Coolify deploy request failed: ${res.status} ${body.slice(0, 300)}`);
  // Coolify answers 200 as long as one uuid exists and silently skips unknown ones.
  const { deployments = [] } = JSON.parse(body) as {
    deployments?: { resource_uuid: string; deployment_uuid?: string; message: string }[];
  };
  for (const uuid of env.DEPLOY_APP_UUIDS.split(',')) {
    const d = deployments.find((x) => x.resource_uuid === uuid);
    if (!d?.deployment_uuid) throw new Error(`Coolify did not queue ${uuid}: ${d?.message ?? 'not found'}`);
    console.log(`Deploy queued: ${uuid} (${d.deployment_uuid})`);
  }
  writeFileSync(MARKER, new Date().toISOString());
}
