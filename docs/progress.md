# Progress

## Oct 16, 2026: infrastructure foundation

Done:
- Coolify repaired (broken IPv6 Docker network) and running at https://coolify.taskpilot.dev. Admin account created, public registration off.
- Hetzner firewall `classifieds-app` attached: only 22, 80, 443 open.
- Storage Box BX11 `classifieds-backups` in Falkenstein for off-site backups.
- Nightly encrypted restic backup (`/usr/local/bin/classifieds-backup`, cron 03:15 UTC) of Coolify config and server secrets to the Storage Box. First snapshot taken and a restore tested. PostgreSQL dumps get added when the database is deployed.
- Setup reviewed and decisions written to `docs/setup.md`.
- Cloudflare R2 buckets for photos created in the EU: `classifieds-media-staging` and `classifieds-media`.

Next:
1. Resolve the open decisions in `docs/setup.md` (brand and domain).
2. ~~Phase 2 of the plan: design the full PostgreSQL schema and get it approved before any feature code.~~ Done, see below.

## Oct 16, 2026: database design (phase 2)

Done:
- Full PostgreSQL 18 + PostGIS 3.6 schema designed in `docs/schema.md`: 36 tables, constraints, indexes with the queries they serve, database roles, retention and account deletion.
- Approved Oct 16, 2026, with the answers recorded in section 16 of `docs/schema.md` (Stripe coupon for free launch Pro, email required, a phone number already in use is refused, anonymous reports with email allowed).
- Must be set before the first `initdb`: `POSTGRES_INITDB_ARGS="--locale-provider=builtin --builtin-locale=C.UTF-8"` (section 1, decision 3).

Next:
1. ~~Write the schema as Drizzle schema files and migrations in `src/db/`, plus the seed files.~~ Done, see below.
2. Still open, decided with the posting feature: whether editing an active listing sends it back to review.

## Oct 16, 2026: schema in code (migrations, seeds, tests)

Done:
- Tooling: one npm package (Node 24, TypeScript, Drizzle ORM 0.45 + drizzle-kit 0.31, postgres.js, Vitest). `compose.yaml` for local PostgreSQL 18 + PostGIS 3.6 with the built-in C.UTF-8 locale, and a superuser bootstrap script (`src/db/bootstrap/`). How it fits together is in `docs/setup.md`, "Database setup".
- Drizzle schema for all 36 tables in `src/db/schema/`, one file per module, with every CHECK, partial index, composite FK and `NULLS NOT DISTINCT` index from `docs/schema.md`. Custom types for `geography(Point,4326)`, `ltree` and `bytea`.
- Migrations `0000`–`0004`: extensions, tables, `set_updated_at()` triggers and the deferrable image-position constraint, roles and grants, and the `SECURITY DEFINER` functions (`erase_user`, `purge_audit_log`, `scrub_audit_ip`, `purge_moderation_records`). Choices made where the doc left room are in `docs/schema.md`, section 17.
- `normalizePersian()` in `src/lib/normalize-persian.ts`, the one normalizer for every `*_normalized` column.
- Seeds in `seed/`:
  - 15 currencies (incl. USD, CAD, AUD, MYR).
  - 36 countries: EU, EEA, Switzerland, UK, US, Canada, Australia, Malaysia. Only Germany is active.
  - The 16 German Länder and 52 cities (GeoNames).
  - Categories: 13 roots and 115 leaves merging Divar and Kleinanzeigen, with 118 attributes and 317 options in Persian.
  - The loader can be rerun safely and runs the seed checks before it commits.
- 48 tests, all passing: seed checks (including the three named in the doc), grants, schema guarantees and the retention functions. Each run starts from an empty database. Verified from an empty `compose.yaml` volume.

Next:
1. ~~Set up the staging database on the server.~~ Done, see below.
2. Persian names of the cities and categories: a quick read-through by a native speaker before launch.
3. Product rows (bump, featured, Pro) go into a seed once Stripe prices exist.

## Oct 16, 2026: staging database on Coolify

Done:
- PostgreSQL 18.6 + PostGIS 3.6 (`postgis/postgis:18-3.6`) as Coolify database `classifieds-postgres` (project `classifieds`, environment `staging`). 768 MB limit, no public port. Initialized with the builtin `C.UTF-8` locale (`datlocprovider` `b`).
- Bootstrap script run once as the superuser, migrations `0000`–`0005` and the seed applied as `classifieds_owner`.
- `classifieds_app`, `classifieds_worker` and `classifieds_readonly` have LOGIN passwords, stored only in `/root/.secrets/postgres.env`. Logins tested over the network.
- New migration `0005`: `classifieds_readonly` gets `SELECT` on sequences, without which `pg_dump` failed on Drizzle's migration sequence. New grants test; 49 tests pass.
- Nightly backup now also dumps the database as `classifieds_readonly` (restic tag `postgres`). First snapshot taken, and a restore into a scratch container matched staging exactly.
- Coolify pitfalls (volume path chosen at creation, ignored initdb-args field) and the restore procedure are in `docs/setup.md`, "Database setup".
- The temporary Coolify API token used for this setup is deleted, and API access is off again.

Next:
1. Persian names of the cities and categories: a quick read-through by a native speaker before launch.
2. Product rows (bump, featured, Pro) go into a seed once Stripe prices exist.
3. ~~Coolify's own database isn't in the nightly backup yet.~~ Done: restic tag `coolify-db`, first snapshot taken, and a restore into a scratch PostgreSQL 15 container matched the live database.
4. ~~The backup has no failure alert.~~ Done: Telegram alerts through n8n for backup, uptime, disk, memory, containers and server heartbeat (`docs/setup.md`, "Alerts"). `https://kooche.taskpilot.dev/health` added on Oct 16, 2026.

## Oct 16, 2026: app shell on staging (start of phase 3)

Done:
- Next.js 16 (App Router) in the existing package. `<html lang="fa" dir="rtl">`, Vazirmatn variable font self-hosted and cut down to 69 KB (`scripts/subset-font.sh`), Tailwind 4, all text in `src/messages/fa.ts`, Jalali dates through `Intl` (`fa-IR-u-ca-persian`, zone from `APP_TIME_ZONE`). Placeholder home page and a Persian 404 page.
- `npm run check:rtl` fails the build on physical-direction Tailwind classes (`ml-`, `pr-`, `left-`, `text-right`…).
- `/health` checks PostgreSQL (as `classifieds_app`) and Valkey; 200 or 503.
- Strict nonce-based CSP (`src/proxy.ts`), HSTS and the other security headers (`next.config.ts`). No CSP violations in Chrome.
- Worker in `src/worker/`: Valkey connection for BullMQ, outbox poller following `docs/schema.md` section 13 with an empty handler list (events without a handler are logged and marked processed), heartbeat for the Docker health check, clean shutdown on SIGTERM. BullMQ rejects `:` in job ids, so the job id is `<outbox id>_<handler>` (schema doc updated).
- One Dockerfile, targets `web` (standalone) and `worker` (esbuild bundle), non-root. Next's own type check is off because TypeScript 7 has no JavaScript API; `npm run typecheck` runs before every build instead.
- 55 tests pass (new: outbox hand-off, Jalali formatting), run on a scratch PostgreSQL built like `compose.yaml`.
- Coolify: Valkey 9.0.6 (`classifieds-valkey`, 128 MB, `noeviction`, AOF), GitHub App `kooche-coolify`, applications `classifieds-web` and `classifieds-worker` deployed from `main` with auto-deploy. https://kooche.taskpilot.dev serves the page and `/health` returns OK. Details and API pitfalls in `docs/setup.md`, "App deployment".
- 2 GB swap file for builds; Coolify limited to one build at a time.
- Memory after the deploy: web 76 MB, worker 34 MB, Valkey 3 MB, PostgreSQL 69 MB, Coolify ~420 MB; server 1.95 GB used of 3.8 GB (table in `docs/setup.md`, "Memory budget").
- Auto-deploy tested: pushing a commit to `main` redeployed both apps one after the other, and `/health` answered 200 throughout the rolling update.
- `https://kooche.taskpilot.dev/health` is in the n8n alert workflow's `URLS` ("Kooche staging app").
- The temporary Coolify API token is deleted and API access is off again.

Next:
1. ~~Run migrations as a deploy step before the first feature that changes the schema.~~ Done, see below.
2. Phase 3 features: Better Auth login (email code, Google, Apple) and phone verification through the Telegram bot.
3. Persian names of the cities and categories: a quick read-through by a native speaker before launch.
4. Product rows (bump, featured, Pro) go into a seed once Stripe prices exist.

## Oct 16, 2026: migrations on every deploy

Done:
- New Dockerfile target `migrate` and Coolify application `classifieds-migrate` (128 MB). A push to `main` now deploys only `classifieds-migrate` (auto-deploy is off for web and worker). It applies pending migrations as `classifieds_owner`, then has Coolify deploy `classifieds-web` and `classifieds-worker` through a deploy-only API token, and then idles at under 1 MB. If a migration fails, web and worker are not deployed. How it works, why not a pre-deployment command or a compose app, and the rules (backward-compatible migrations, deploy by hand through `classifieds-migrate`) are in `docs/setup.md`, "App deployment".
- `runMigrations()` now returns the tags it applied; the deploy log lists them ("Migrations applied: …" or "No pending migrations").
- Tested on a scratch PostGIS with a fake Coolify endpoint: empty database (0000–0005 applied, deploy called once), up-to-date database (no-op, deploy called), a new harmless migration (applied by name), a broken migration (exit 1, rolled back, no deploy call), a container restart (no-op, no second deploy call), an unknown app uuid and an invalid env (exit 1), `docker stop` in 0.1 s. 55 tests pass.
- Coolify API turned on for good, limited to the `coolify` Docker network without its gateway (IPv6 clients appear as the gateway). Refusals from outside over IPv4, IPv6 and with a forged `X-Forwarded-For` tested. Token `classifieds-deploy` (deploy ability only) in `/root/.secrets/coolify-api-tokens.env`.
- The owner password is only in `classifieds-migrate`'s env, not in web or worker.
- Proven on staging with the push of `5f3b25c` (no new migration): `classifieds-migrate` logged "No pending migrations" and queued both apps; web started 1 s after the migrate deployment finished, worker after web, all three on the same commit. `/health` answered 200 on every one of 156 checks (one per second) through the whole chain, about 2.5 minutes from push to worker healthy. The migrate container idles at 660 KB.
- The temporary setup token is deleted; only `classifieds-deploy` remains.

Next:
1. Phase 3 features: Better Auth login (email code, Google, Apple) and phone verification through the Telegram bot.
2. ~~A Telegram alert when a deployment fails (today it only shows in Coolify).~~ Done, see below.
3. Persian names of the cities and categories: a quick read-through by a native speaker before launch.
4. Product rows (bump, featured, Pro) go into a seed once Stripe prices exist.

## Oct 16, 2026: alert on failed deployments

Done:
- `kooche-healthcheck` (every 15 min) now also reads failed deployments of the last 24 hours from Coolify's database (read-only) and sends each one once, as a `deploy` event in its existing batch, through n8n to Telegram. It covers every Coolify application (today `classifieds-migrate`, `classifieds-web`, `classifieds-worker`). For a failed `classifieds-migrate` the message says web and worker were not deployed. The n8n workflow is unchanged. Details in `docs/setup.md`, "Alerts".
- Chosen over Coolify's own notifications so all alerts arrive in one chat in one style, with no bot token stored in Coolify.
- Tested with a fake failed `classifieds-migrate` row in Coolify's database: dry runs showed the event once and nothing on the next run. A run with `coolify-db` unreachable skipped the check and left the sent file as it was. Then the 22:15 cron run sent exactly one Telegram alert, and a second run at 22:16 sent nothing new. The fake row is deleted.

Next:
1. Phase 3 features: Better Auth login (email code, Google, Apple) and phone verification through the Telegram bot.
2. Persian names of the cities and categories: a quick read-through by a native speaker before launch.
3. Product rows (bump, featured, Pro) go into a seed once Stripe prices exist.

## Oct 16–17, 2026: user accounts (phase 3, first feature)

Done:
- Sign-in by email one-time code only (decided Oct 16, 2026: no passwords, Google later without migrating users). Better Auth 1.7.10 on our own tables with database-made `uuidv7()` ids, 6-digit codes valid 10 minutes, locked after 5 wrong tries, stored hashed. HTTP-only, Secure, SameSite=Lax session cookie, 30 days, no cookie cache so a revoked device is out on its next request.
- Login emails through Amazon SES (eu-central-1, identity `peydoo.com` with DKIM, custom MAIL FROM and DMARC, out of the sandbox) from `noreply@peydoo.com`, in Persian.
- Phone verification through @Peydoo_bot, which runs in the worker with long polling: one-time deep-link token, contact accepted only when `contact.user_id` equals the sender, number already used by another account refused (`phone_in_use`), Telegram account linked elsewhere refused (`telegram_in_use`), method stored on the user, `audit_log` entry.
- SMS fallback behind an `SmsProvider` interface; `log` provider on staging. Recommended provider when needed: seven.io (alternative GatewayAPI); nothing bought. SMS only to the 36 seeded countries.
- Rate limits in Valkey on code requests, code checks, phone attempts, SMS per number and bot messages.
- `canPostListing()` / `canSendMessage()` need a verified phone; favorites only need a session. The posting and chat features must call them.
- Persian RTL pages: `/login`, `/login/code`, `/account`, `/account/phone`, `/account/phone/sms`, `/account/devices`. All text in `src/messages/fa.ts`.
- 42 new tests (104 in total with the domain session's), run as the app and worker database roles. A no-JavaScript end-to-end run against the built image passed locally.
- Deployed to https://staging.peydoo.com (commit `2a7d0d8`, the first deploy on the new domain). The owner signed in by email code, verified their phone through Telegram and logged out a device; the database rows match (Oct 17, 2026).
- Settings in Coolify and `/root/.secrets/auth.env`, details in `docs/setup.md`, "Accounts and phone verification".

Next:
1. ~~Clean-up jobs in the worker: expired sessions (30 days), login codes (1 day), phone verification attempts (90 days) (`docs/schema.md`, section 14).~~ Done, see below.
2. A "your name" field (accounts start as «کاربر») with the profile or posting feature.
3. Staff two-factor login before the first moderator account.
4. Turnstile on the login form once the Cloudflare proxy is on.
5. Production gets its own Telegram bot at launch (one bot per environment).
6. Persian names of the cities and categories: a quick read-through by a native speaker before launch.
7. Product rows (bump, featured, Pro) go into a seed once Stripe prices exist.

## Oct 17, 2026: move to peydoo.com

Done:
- Everything that ran on `taskpilot.dev` now runs on `peydoo.com`.
  - The app is at https://staging.peydoo.com. `peydoo.com` and `www` stay empty until launch, when this server becomes production.
  - The Coolify dashboard is at https://coolify.peydoo.com.
  - Both are proxied by Cloudflare and have Let's Encrypt certificates at the server.
  - The `kooche.taskpilot.dev` and `coolify.taskpilot.dev` records are deleted; nothing depends on `taskpilot.dev` any more.
- Cloudflare zone: SSL Full (strict) and minimum TLS 1.2. Always Use HTTPS and Bot Fight Mode are off on purpose (`docs/setup.md`, "Domain and Cloudflare").
- Hetzner firewall: 80 and 443 only from Cloudflare's IP ranges, so nobody can bypass Cloudflare. 443/udp is closed.
- Client IP: the app takes `CF-Connecting-IP` only when Traefik saw a Cloudflare address. Better Auth no longer reads IP headers itself; sessions store the same value as the rate limits. Tests for both. Checked live: a sign-in through Cloudflare at 10:42 UTC stored the visitor's own IPv6 address in `sessions.ip_address`, not a Cloudflare address.
- `SEARCH_INDEXING` (default `off`) sends `X-Robots-Tag: noindex` on staging.
- The GitHub App's webhook follows the dashboard. Proven by the push of `2a7d0d8`, which deployed through `classifieds-migrate` as usual.
- n8n checks `https://coolify.peydoo.com/api/health` and `https://staging.peydoo.com/health`.
- Pitfall found: an app domain changed outside Coolify's UI keeps its old Traefik labels until they are regenerated (`docs/setup.md`).

Next:
1. The `kooche-coolify` GitHub App's homepage and callback URLs still name `coolify.taskpilot.dev`. They aren't used after installation, but should be changed in GitHub's App settings.
2. At launch: `peydoo.com` and `www` for production, `SEARCH_INDEXING=on`, the HSTS `preload` decision, a production Telegram bot, and staging moving to its own server (`docs/setup.md`, "Domain and Cloudflare").
3. Turnstile on sign-in and posting, Cloudflare cache rules with caching of logged-out pages.

## Oct 17, 2026: retention of account data

Done:
- Daily worker job `account-retention` (BullMQ job scheduler on queue `retention`, 02:30 UTC): deletes expired sessions 30 days after `expires_at`, login codes 1 day after `expires_at` and phone verification attempts 90 days after `created_at`, as `classifieds_worker`, in batches of 5,000 (at most 100 per table per run). Logs one line with the three counts. Details in `docs/schema.md`, section 17.
- No migration: the worker's grants and the existing indexes were already enough.
- First BullMQ queue and `Worker` in the worker; it closes cleanly on SIGTERM. The job scheduler keeps the schedule in Valkey, so restarts and rolling deploys don't run it twice.
- 5 new tests (109 in total), run as `classifieds_worker`: rows past each cut-off are deleted, newer ones stay, batching and the per-run batch cap. The worker bundle was also run against a scratch database: it registered the schedule (next run 02:30 UTC) and a manually queued run deleted an expired session and kept a live one.

Next:
1. ~~Retention for `outbox_events` (7 days after processing) and `webhook_events` (90 days), and scheduling `purge_audit_log`, `scrub_audit_ip` and `purge_moderation_records` on the same `retention` queue (`docs/schema.md`, section 14).~~ Done, see below.
2. After the next deploy, check the worker log on 02:30 UTC for the first `retention:` line.

## Oct 17, 2026: retention of events and history

Done:
- Daily worker job `event-retention`: deletes `outbox_events` 7 days after `processed_at` and processed `webhook_events` 90 days after `created_at`. Unprocessed webhook events are kept (approved Oct 17, 2026).
- Daily worker job `history-retention`: calls `purge_audit_log('2 years')`, `scrub_audit_ip('90 days')` and `purge_moderation_records('2 years')` in batches of 5,000 until a call comes back short, at most 100 calls each per run.
- Both run on queue `retention` at 02:30 UTC next to `account-retention`, as `classifieds_worker`, and each logs one line, `retention: <job>: …`. The `account-retention` line now has the same `retention: account-retention:` prefix.
- No migration and no new index (reasons in `docs/schema.md`, section 17). Code in `src/db/retention.ts`.
- 6 new tests (115 in total), run as `classifieds_worker`: rows past each cut-off are deleted, newer ones and unprocessed ones stay, batching and the per-run cap for both the deletes and the function calls. Run in Docker against a scratch PostgreSQL built like `compose.yaml` plus Valkey; typecheck and the worker bundle build pass.

Next:
1. After the next deploy, check the worker log after 02:30 UTC for three `retention:` lines (`account-retention`, `event-retention`, `history-retention`).

## Oct 17, 2026: posting (phase 3, core feature)

Decided by the owner (Oct 17, 2026):
- Listings go live at once.
- Automatic checks in the worker can take a listing down afterwards.
- Editing an active listing keeps it live and runs the same checks. This settles the open question from phase 2.
- Up to 10 photos per listing.
- 30 days, renewable with one tap.
- City plus an optional district; the stored point is snapped to ~500 m.

Done:
- **Posting.**
  - `/new` has a category picker over the seeded tree that works without JavaScript.
  - `/my/listings/[id]` is one form for drafts and edits:
    - the category's attributes, validated with Zod against `category_attributes`, inherited fields and dependent selects included;
    - title, description, price type and amount in Persian or Latin digits, stored in minor units;
    - city, optional district and an optional "use my location" (snapped in the browser and again on the server, at most 40 km from the city);
    - phone contact on/off and shipping.
  - Text is stored with `normalizePersian()`.
  - Posting needs a verified phone (`canPostListing()`).
  - An account still named «کاربر» is asked for a name before publishing.
- **Photos.**
  - The browser uploads straight to R2 through 5-minute presigned PUTs with size and type signed in (15 MB; JPEG, PNG or WebP).
  - The worker re-encodes every photo with sharp to a WebP master: EXIF and GPS gone, rotation applied, non-images rejected. It stores width, height, ThumbHash, pHash and SHA-256. The database holds storage keys only.
  - Photos can be reordered, made the cover or removed.
  - Abandoned uploads are cleaned after 24 hours, with an R2 lifecycle rule as backup.
  - Two R2 tokens limited to the staging bucket: read-write for web and worker, read-only for imgproxy.
- **imgproxy.** v4.0.16 as Coolify app `classifieds-imgproxy` (256 MB) at https://img-staging.peydoo.com behind Cloudflare. Signed URLs in three sizes, as AVIF and WebP, cached by Cloudflare for a year.
- **Listing page** `/v/{persian-title}/{token}`:
  - server-rendered, with schema.org Product/Offer JSON-LD and a canonical URL;
  - photos over a ThumbHash placeholder;
  - city and district only;
  - the phone number fetched on request for signed-in visitors, rate-limited and never in the HTML;
  - chat as a "coming soon" placeholder.
  - Paused, sold and expired listings show a notice and are `noindex`. Deleted ones are 404, and drafts are visible only to their owner.
- **"My listings".** Edit, pause/resume, mark sold, renew (expired, or in the last 3 days), delete (soft, with confirmation).
- **Post-checks** in the worker:
  - Banned terms (weapons, drugs, currency exchange and money transfers to Iran) and an exact copy of another seller's photo take a listing down. Each take-down writes a `moderation_decisions` row by rule with the DSA statement and a `rejected` event.
  - Near-duplicate photos are flagged as `escalate` for the phase-4 queue.
  - A taken-down listing can be fixed and sent again; it is checked before it goes live.
  - The AI review and human queue plug in at `reviewPolicy()` and `CHECKS`.
- **Expiry.** A worker job every 15 minutes, plus a daily reminder email through SES (09:00 Berlin) for listings expiring in 2–3 days, sent once.
- **Outbox events** for every change of a published listing and for photo uploads and removals. Search sync subscribes later.
- **Migration `0006`:** `listings.district` and `district_normalized`. No grant changes.
- **Tests.** 69 new (184 in total): permissions (only verified users post, only owners edit, pause, sell, renew, delete or touch photos), attribute validation, the 10-photo and per-category limits, expiry and renewal, EXIF and GPS removal with rotation, non-images rejected, the post-checks, the reminder and imgproxy signing. They run as the app and worker roles.
- **Local end-to-end run** in headless Chromium against the real R2 staging bucket and imgproxy: category → photos → form error keeps the input → name → publish → public page (JSON-LD, no phone, bucket or coordinates in the HTML; a forged image size gets 403) → pause, resume, edit live, sold, delete (404). The stored masters in R2 have no EXIF, XMP or ICC.
- Details: `docs/setup.md` ("Photos and imgproxy"), `docs/schema.md` (section 17, "Posting").

Next:
1. Deploy to staging and check it there with a real account; memory after the deploy.
2. Persian terms of use, so `policy_ground` can name real sections instead of `terms-prohibited-items`.
3. Draft clean-up (drafts untouched for months) and the 12-month purge of deleted listings with their R2 files.
4. Turnstile on posting; new-account limits (phase 4).
5. Production at launch: its own two R2 tokens for `classifieds-media`, CORS for `peydoo.com`, `img.peydoo.com`.
