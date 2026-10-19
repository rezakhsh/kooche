import { purgeEnv } from '../lib/env';
import { purgeHost } from './cloudflare-purge';

// Coolify's post-deployment command on `classifieds-web` (docs/setup.md, "App deployment"): Coolify
// runs it with `docker exec` in the new container after the rolling update, when the new container
// is healthy and the old one is removed. Cached browse pages of the previous build point at its
// JavaScript chunks and server action ids, so they go now instead of within 60 seconds.
// A failure exits 1, which Coolify writes to the deployment log without failing the deployment.
try {
  const host = await purgeHost(purgeEnv());
  console.log(`Cloudflare cache purged for ${host}`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
