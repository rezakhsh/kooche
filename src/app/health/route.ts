import { appSql } from '../../db/client';
import { valkey } from '../../lib/valkey';

// Liveness and readiness for Coolify, the Docker HEALTHCHECK and uptime checks.
// 200 when PostgreSQL and Valkey both answer, 503 otherwise. Errors are logged, never returned.

export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 2_000;

type Status = 'ok' | 'error';

async function check(name: string, probe: () => Promise<unknown>): Promise<Status> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${TIMEOUT_MS} ms`)), TIMEOUT_MS);
  });
  try {
    await Promise.race([probe(), timeout]);
    return 'ok';
  } catch (e) {
    console.error(`health: ${name} check failed:`, e instanceof Error ? e.message : e);
    return 'error';
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const [postgres, valkeyStatus] = await Promise.all([
    check('postgres', () => appSql()`SELECT 1`),
    check('valkey', () => valkey().ping()),
  ]);
  const ok = postgres === 'ok' && valkeyStatus === 'ok';
  return Response.json(
    { status: ok ? 'ok' : 'error', checks: { postgres, valkey: valkeyStatus } },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
