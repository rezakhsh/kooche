import { z } from 'zod';

// Configuration comes only from the environment (CLAUDE.md). Each process validates the variables
// it uses on first access, at runtime, so `next build` and the image build need no secrets.

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/ });
const redisUrl = z.url({ protocol: /^rediss?$/ });

const webSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.url(),
  // Jalali dates are shown in this zone. Only Germany is active, so Berlin for now.
  APP_TIME_ZONE: z.string().default('Europe/Berlin'),
  DATABASE_URL: postgresUrl,
  REDIS_URL: redisUrl,
});

const workerSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  WORKER_DATABASE_URL: postgresUrl,
  REDIS_URL: redisUrl,
});

// The `migrate` Docker target: after the migrations it asks Coolify to deploy web and worker.
const deploySchema = z.object({
  COOLIFY_API_URL: z.url({ protocol: /^https?$/ }),
  // A Coolify API token with only the `deploy` ability.
  COOLIFY_DEPLOY_TOKEN: z.string().min(1),
  // Comma-separated Coolify application uuids, deployed in this order.
  DEPLOY_APP_UUIDS: z.string().regex(/^[a-z0-9]+(,[a-z0-9]+)*$/),
});

export type WebEnv = z.infer<typeof webSchema>;
export type WorkerEnv = z.infer<typeof workerSchema>;
export type DeployEnv = z.infer<typeof deploySchema>;

function parse<T extends z.ZodType>(schema: T, name: string): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    // Names and messages only, never values: they may contain passwords.
    const problems = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid ${name} environment: ${problems}`);
  }
  return result.data;
}

let web: WebEnv | undefined;
let worker: WorkerEnv | undefined;
let deploy: DeployEnv | undefined;

/** Environment of the Next.js app. Server code only. */
export function webEnv(): WebEnv {
  return (web ??= parse(webSchema, 'web'));
}

/** Environment of the background worker. */
export function workerEnv(): WorkerEnv {
  return (worker ??= parse(workerSchema, 'worker'));
}

/** Environment of the deploy trigger in the `migrate` image. */
export function deployEnv(): DeployEnv {
  return (deploy ??= parse(deploySchema, 'deploy'));
}
