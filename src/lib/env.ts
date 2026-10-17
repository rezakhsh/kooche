import { z } from 'zod';

// Configuration comes only from the environment (CLAUDE.md). Each process validates the variables
// it uses on first access, at runtime, so `next build` and the image build need no secrets.

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/ });
const redisUrl = z.url({ protocol: /^rediss?$/ });
/** Optional, and an empty value (`NAME=` in an env file) counts as unset */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const webSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.url(),
  // Jalali dates are shown in this zone. Only Germany is active, so Berlin for now.
  APP_TIME_ZONE: z.string().default('Europe/Berlin'),
  DATABASE_URL: postgresUrl,
  REDIS_URL: redisUrl,
  // Better Auth: signs session cookies and encrypts OAuth tokens. 32+ random characters.
  AUTH_SECRET: z.string().min(32),
  // Amazon SES SMTP in eu-central-1: smtps://<user>:<password>@email-smtp.eu-central-1.amazonaws.com:465
  // Unset in development: login codes are printed to the terminal instead.
  SMTP_URL: optional(z.url({ protocol: /^smtps?$/ })),
  // "Display name <address>"; the address must be verified in SES
  EMAIL_FROM: optional(z.string().min(3)),
  // The bot's @username without @, for the t.me/<bot>?start=<token> link. The token itself is
  // only in the worker.
  TELEGRAM_BOT_USERNAME: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{3,31}$/),
  // HMAC key for SMS codes stored in phone_verifications.code_hash. 32+ random characters.
  PHONE_CODE_SECRET: z.string().min(32),
  // `log` writes SMS codes to the log (development and staging). Real providers come later.
  SMS_PROVIDER: z.enum(['log']).default('log'),
  // `off` sends X-Robots-Tag: noindex on every page, so search engines skip staging and test
  // data. Set to `on` in production only.
  SEARCH_INDEXING: z.enum(['on', 'off']).default('off'),
}).refine((e) => e.NODE_ENV !== 'production' || (e.SMTP_URL && e.EMAIL_FROM), {
  message: 'SMTP_URL and EMAIL_FROM are required in production',
  path: ['SMTP_URL'],
});

const workerSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  WORKER_DATABASE_URL: postgresUrl,
  REDIS_URL: redisUrl,
  // Phone verification bot (long polling). Unset: the bot doesn't run (local development).
  TELEGRAM_BOT_TOKEN: optional(z.string().regex(/^[0-9]+:[A-Za-z0-9_-]{30,}$/)),
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
