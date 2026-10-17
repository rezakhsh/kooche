import { z } from 'zod';

// Configuration comes only from the environment (CLAUDE.md). Each process validates the variables
// it uses on first access, at runtime, so `next build` and the image build need no secrets.

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/ });
const redisUrl = z.url({ protocol: /^rediss?$/ });
/** Optional, and an empty value (`NAME=` in an env file) counts as unset */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

// Photo storage over the S3 API: Cloudflare R2 with EU jurisdiction on the server
// (https://<account>.eu.r2.cloudflarestorage.com, region auto). Optional in development: without
// it, photo upload is switched off.
const s3Fields = {
  S3_ENDPOINT: optional(z.url({ protocol: /^https?$/ })),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET_MEDIA: optional(z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/)),
  S3_ACCESS_KEY_ID: optional(z.string().min(1)),
  S3_SECRET_ACCESS_KEY: optional(z.string().min(1)),
};
const hasS3 = (e: { S3_ENDPOINT?: string; S3_BUCKET_MEDIA?: string; S3_ACCESS_KEY_ID?: string; S3_SECRET_ACCESS_KEY?: string }) =>
  !!(e.S3_ENDPOINT && e.S3_BUCKET_MEDIA && e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY);
const hex = z.string().regex(/^([0-9a-f]{2}){16,}$/, 'hex, at least 16 bytes');

const webSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.url(),
  // Jalali dates are shown in this zone. Only Germany is active, so Berlin for now.
  APP_TIME_ZONE: z.string().default('Europe/Berlin'),
  DATABASE_URL: postgresUrl,
  REDIS_URL: redisUrl,
  // Better Auth: signs session cookies and encrypts OAuth tokens. 32+ random characters.
  AUTH_SECRET: z.string().min(32),
  // Amazon SES SMTP in eu-central-1: smtp://<user>:<url-encoded password>@email-smtp.eu-central-1.amazonaws.com:587
  // (STARTTLS is required by the mailer)
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
  ...s3Fields,
  // imgproxy behind Cloudflare (https://img-staging.peydoo.com), with its signing key and salt
  IMAGE_URL: optional(z.url({ protocol: /^https?$/ })),
  IMGPROXY_KEY: optional(hex),
  IMGPROXY_SALT: optional(hex),
})
  .refine((e) => e.NODE_ENV !== 'production' || (e.SMTP_URL && e.EMAIL_FROM), {
    message: 'SMTP_URL and EMAIL_FROM are required in production',
    path: ['SMTP_URL'],
  })
  .refine((e) => e.NODE_ENV !== 'production' || (hasS3(e) && e.IMAGE_URL && e.IMGPROXY_KEY && e.IMGPROXY_SALT), {
    message: 'S3_*, IMAGE_URL, IMGPROXY_KEY and IMGPROXY_SALT are required in production',
    path: ['S3_ENDPOINT'],
  });

const workerSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  WORKER_DATABASE_URL: postgresUrl,
  REDIS_URL: redisUrl,
  // Phone verification bot (long polling). Unset: the bot doesn't run (local development).
  TELEGRAM_BOT_TOKEN: optional(z.string().regex(/^[0-9]+:[A-Za-z0-9_-]{30,}$/)),
  ...s3Fields,
  // Expiry reminders: the links in the email, and the same SES SMTP as the login codes. Without
  // SMTP_URL the reminder is printed to the log (development).
  APP_URL: z.url(),
  SMTP_URL: optional(z.url({ protocol: /^smtps?$/ })),
  EMAIL_FROM: optional(z.string().min(3)),
}).refine((e) => e.NODE_ENV !== 'production' || (hasS3(e) && e.SMTP_URL && e.EMAIL_FROM), {
  message: 'S3_*, SMTP_URL and EMAIL_FROM are required in production',
  path: ['S3_ENDPOINT'],
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
