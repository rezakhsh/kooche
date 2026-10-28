import { z } from 'zod';
import { TEST_SECRETS } from '../modules/security/turnstile';

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
/**
 * The admin page's secret first path segment (docs/setup.md, "Admin page"): /<ADMIN_PATH>/… is the
 * only way in, so the address can't be guessed. Unset: there is no admin page. Also in the worker,
 * for the link in the n8n alert.
 */
const adminPath = optional(z.string().regex(/^[a-z0-9]{16,64}$/, '16 to 64 lowercase letters and digits'));

/**
 * Error monitoring (docs/setup.md, "Error monitoring"): Sentry's EU region only, so a DSN for
 * another region is refused (a local one is allowed for the test ingest). Unset: monitoring is off.
 * SOURCE_COMMIT is set by Coolify at runtime and names the release.
 */
const sentryDsn = z
  .url({ protocol: /^https?$/ })
  .refine((v) => /^https:\/\/[0-9a-f]{16,64}@o\d+\.ingest\.de\.sentry\.io\/\d+$/.test(v) || isLocal(v), {
    message: "a DSN of Sentry's EU region (https://<key>@o<org>.ingest.de.sentry.io/<project>)",
  });
const monitoringFields = {
  SENTRY_DSN: optional(sentryDsn),
  SENTRY_ENVIRONMENT: optional(z.enum(['staging', 'production'])),
  SOURCE_COMMIT: optional(z.string().max(64)),
};
const environmentNamed = (e: { SENTRY_DSN?: string; SENTRY_ENVIRONMENT?: string }) => !e.SENTRY_DSN || !!e.SENTRY_ENVIRONMENT;
const environmentRule = { message: 'SENTRY_ENVIRONMENT (staging or production) is required with SENTRY_DSN', path: ['SENTRY_ENVIRONMENT'] };

const s3Fields = {
  S3_ENDPOINT: optional(z.url({ protocol: /^https?$/ })),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET_MEDIA: optional(z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/)),
  S3_ACCESS_KEY_ID: optional(z.string().min(1)),
  S3_SECRET_ACCESS_KEY: optional(z.string().min(1)),
};
const hasS3 = (e: { S3_ENDPOINT?: string; S3_BUCKET_MEDIA?: string; S3_ACCESS_KEY_ID?: string; S3_SECRET_ACCESS_KEY?: string }) =>
  !!(e.S3_ENDPOINT && e.S3_BUCKET_MEDIA && e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY);
function isLocal(url: string): boolean {
  const host = new URL(url).hostname;
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost') || host.endsWith('.test');
}
const hex = z.string().regex(/^([0-9a-f]{2}){16,}$/, 'hex, at least 16 bytes');

// Stripe (docs/setup.md, "Payments"): a secret or restricted key. Test-mode keys on staging; a
// live key only with PAYMENTS_LIVE=on, which only production sets (at launch). Unset in
// development: payments are switched off.
const stripeFields = {
  STRIPE_SECRET_KEY: optional(z.string().regex(/^(sk|rk)_(test|live)_[0-9A-Za-z]{10,}$/, 'a Stripe secret or restricted key')),
  PAYMENTS_LIVE: z.enum(['on', 'off']).default('off'),
};
/** Whether a Stripe key moves real money */
export const isLiveStripeKey = (key: string) => /^(sk|rk)_live_/.test(key);
const liveKeyAllowed = (e: { STRIPE_SECRET_KEY?: string; PAYMENTS_LIVE: 'on' | 'off' }) =>
  !e.STRIPE_SECRET_KEY || !isLiveStripeKey(e.STRIPE_SECRET_KEY) || e.PAYMENTS_LIVE === 'on';
const liveKeyRule = { message: 'a live Stripe key needs PAYMENTS_LIVE=on (production only)', path: ['STRIPE_SECRET_KEY'] };

// Test accounts (src/modules/users/test-accounts.ts): what would be emailed or sent by Telegram to
// a per-country test account goes to the account with this email (the owner's). Unset: dropped.
const testInboxField = { TEST_INBOX_EMAIL: optional(z.email().max(254)) };

const webSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.url(),
  // Dates are shown in this zone. Only Germany is active, so Berlin for now.
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
  // Peydoo's public Telegram channel (@username without @) for the footer's «کانال تلگرام پیدو».
  // Unset: the footer leaves the channel out.
  TELEGRAM_CHANNEL: optional(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{3,31}$/)),
  // "Log in with Telegram" (OpenID Connect, phone scope): the bot's client ID and secret from
  // BotFather (src/modules/users/telegram-oidc.ts). Set together; unset, the bot is the only path.
  TELEGRAM_OIDC_CLIENT_ID: optional(z.string().regex(/^[0-9A-Za-z_-]{3,64}$/)),
  TELEGRAM_OIDC_CLIENT_SECRET: optional(z.string().min(16)),
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
  // The street map (docs/setup.md, "The street map"): our own OpenStreetMap extract from Protomaps,
  // one PMTiles file on the server's disk, mounted read-only (/maps/20261028.pmtiles). The file's
  // name is its version in the tile addresses. Unset: pages show the outline map instead.
  // The address search that puts an event's venue or a shop on the map from its street address
  // (src/modules/maps/geocode.ts): a Nominatim server, OpenStreetMap's own by default in the
  // environments that set it (https://nominatim.openstreetmap.org). Unset: no lookups, the
  // organizer taps the map.
  GEOCODER_URL: optional(z.url({ protocol: /^https$/ })),
  MAP_TILES_FILE: optional(z.string().regex(/^\/[A-Za-z0-9/_-]+\/[0-9A-Za-z_-]{1,40}\.pmtiles$/, 'an absolute path ending in .pmtiles')),
  // Cloudflare Turnstile on sign-in and publishing (one widget per environment). The site key is
  // public (it goes into the page); the secret only checks tokens with siteverify. Unset in
  // development: no widget and no check.
  TURNSTILE_SITE_KEY: optional(z.string().regex(/^[0-9a-zA-Z_-]{10,100}$/)),
  TURNSTILE_SECRET_KEY: optional(z.string().min(10)),
  // Keyword search (Meilisearch on the `coolify` network, never public) with a key that may only
  // search the listings index. Unset: keyword search runs on PostgreSQL (slower, no typos).
  MEILI_URL: optional(z.url({ protocol: /^https?$/ })),
  MEILI_SEARCH_KEY: optional(z.string().min(16)),
  ...stripeFields,
  // Signing secret of the webhook endpoint (/api/stripe/webhook); made by scripts/stripe-setup.ts
  STRIPE_WEBHOOK_SECRET: optional(z.string().regex(/^whsec_[0-9A-Za-z]{10,}$/)),
  ADMIN_PATH: adminPath,
  ...monitoringFields,
  ...testInboxField,
  // The sign-in code of the per-country test accounts (6 digits; no email is sent to them). Staging
  // only: a known code on the live site would be a back door, so it needs SENTRY_ENVIRONMENT=staging
  // (or a local APP_URL) and is refused with live payments or search indexing on. Unset: these
  // accounts can't sign in by email.
  TEST_ACCOUNT_CODE: optional(z.string().regex(/^[0-9]{6}$/, '6 digits')),
})
  .refine(liveKeyAllowed, liveKeyRule)
  .refine(environmentNamed, environmentRule)
  .refine(
    (e) =>
      !e.TEST_ACCOUNT_CODE ||
      ((e.SENTRY_ENVIRONMENT === 'staging' || isLocal(e.APP_URL)) && e.PAYMENTS_LIVE !== 'on' && e.SEARCH_INDEXING !== 'on'),
    { message: 'TEST_ACCOUNT_CODE is for staging only (SENTRY_ENVIRONMENT=staging or a local APP_URL, no live payments, no indexing)', path: ['TEST_ACCOUNT_CODE'] },
  )
  .refine((e) => !e.STRIPE_SECRET_KEY === !e.STRIPE_WEBHOOK_SECRET, {
    message: 'STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are set together',
    path: ['STRIPE_WEBHOOK_SECRET'],
  })
  .refine((e) => !e.TELEGRAM_OIDC_CLIENT_ID === !e.TELEGRAM_OIDC_CLIENT_SECRET, {
    message: 'TELEGRAM_OIDC_CLIENT_ID and TELEGRAM_OIDC_CLIENT_SECRET are set together',
    path: ['TELEGRAM_OIDC_CLIENT_SECRET'],
  })
  .refine((e) => e.NODE_ENV !== 'production' || (e.SMTP_URL && e.EMAIL_FROM), {
    message: 'SMTP_URL and EMAIL_FROM are required in production',
    path: ['SMTP_URL'],
  })
  .refine((e) => e.NODE_ENV !== 'production' || (hasS3(e) && e.IMAGE_URL && e.IMGPROXY_KEY && e.IMGPROXY_SALT), {
    message: 'S3_*, IMAGE_URL, IMGPROXY_KEY and IMGPROXY_SALT are required in production',
    path: ['S3_ENDPOINT'],
  })
  .refine((e) => e.NODE_ENV !== 'production' || (e.TURNSTILE_SITE_KEY && e.TURNSTILE_SECRET_KEY), {
    message: 'TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are required in production',
    path: ['TURNSTILE_SECRET_KEY'],
  })
  // Cloudflare's test secrets accept anything; only a local build may use them
  .refine((e) => !e.TURNSTILE_SECRET_KEY || !TEST_SECRETS.includes(e.TURNSTILE_SECRET_KEY as never) || isLocal(e.APP_URL), {
    message: 'a Turnstile test secret is only allowed with a local APP_URL',
    path: ['TURNSTILE_SECRET_KEY'],
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
  /** Quiet hours for people without a saved place (wave 1 notification settings) */
  APP_TIME_ZONE: z.string().default('Europe/Berlin'),
  SMTP_URL: optional(z.url({ protocol: /^smtps?$/ })),
  EMAIL_FROM: optional(z.string().min(3)),
  // Keeps the Meilisearch index in line with PostgreSQL, with a key that may write the listings
  // index (documents, settings, swap). Unset: no index is kept (keyword search uses PostgreSQL).
  MEILI_URL: optional(z.url({ protocol: /^https?$/ })),
  MEILI_WRITE_KEY: optional(z.string().min(16)),
  // Applies payment webhooks: reads subscriptions and invoices back from Stripe
  ...stripeFields,
  ADMIN_PATH: adminPath,
  // The owner's Telegram alert for new reports and appeals, through n8n (src/modules/admin/alert.ts),
  // signed with HMAC-SHA256. Unset: no alert.
  N8N_ADMIN_ALERT_URL: optional(z.url({ protocol: /^https$/ })),
  N8N_WEBHOOK_SECRET: optional(z.string().min(32)),
  // Purging the browse pages a taken-down listing was on (src/modules/admin/purge.ts); the same
  // token the web's post-deployment command uses. Unset: the 60-second edge cache bound applies.
  CLOUDFLARE_ZONE_ID: optional(z.string().regex(/^[0-9a-f]{32}$/)),
  CLOUDFLARE_PURGE_TOKEN: optional(z.string().min(1)),
  ...monitoringFields,
  ...testInboxField,
})
  .refine(environmentNamed, environmentRule)
  .refine((e) => e.NODE_ENV !== 'production' || (hasS3(e) && e.SMTP_URL && e.EMAIL_FROM), {
    message: 'S3_*, SMTP_URL and EMAIL_FROM are required in production',
    path: ['S3_ENDPOINT'],
  })
  .refine(liveKeyAllowed, liveKeyRule)
  .refine((e) => !e.N8N_ADMIN_ALERT_URL === !e.N8N_WEBHOOK_SECRET, {
    message: 'N8N_ADMIN_ALERT_URL and N8N_WEBHOOK_SECRET are set together',
    path: ['N8N_WEBHOOK_SECRET'],
  })
  .refine((e) => !e.CLOUDFLARE_ZONE_ID === !e.CLOUDFLARE_PURGE_TOKEN, {
    message: 'CLOUDFLARE_ZONE_ID and CLOUDFLARE_PURGE_TOKEN are set together',
    path: ['CLOUDFLARE_PURGE_TOKEN'],
  });

// The `migrate` Docker target: after the migrations it asks Coolify to deploy web and worker.
const deploySchema = z.object({
  COOLIFY_API_URL: z.url({ protocol: /^https?$/ }),
  // A Coolify API token with only the `deploy` ability.
  COOLIFY_DEPLOY_TOKEN: z.string().min(1),
  // Comma-separated Coolify application uuids, deployed in this order.
  DEPLOY_APP_UUIDS: z.string().regex(/^[a-z0-9]+(,[a-z0-9]+)*$/),
});

// Post-deployment command of `classifieds-web` (src/deploy/purge-cache.ts): purges APP_URL's host
// from Cloudflare's cache once the new container serves alone.
const purgeSchema = z.object({
  APP_URL: z.url({ protocol: /^https?$/ }),
  CLOUDFLARE_ZONE_ID: z.string().regex(/^[0-9a-f]{32}$/),
  // A Cloudflare API token with only Cache Purge on the zone.
  CLOUDFLARE_PURGE_TOKEN: z.string().min(1),
});

export type WebEnv = z.infer<typeof webSchema>;
/** For tests: the web settings checked without caching them */
export const parseWebEnv = (env: Record<string, string | undefined>) => webSchema.safeParse(env);
export type WorkerEnv = z.infer<typeof workerSchema>;
export type DeployEnv = z.infer<typeof deploySchema>;
export type PurgeEnv = z.infer<typeof purgeSchema>;

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
let purge: PurgeEnv | undefined;

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

/** Environment of the cache purge after a deploy, run in the `web` image. */
export function purgeEnv(): PurgeEnv {
  return (purge ??= parse(purgeSchema, 'purge'));
}
