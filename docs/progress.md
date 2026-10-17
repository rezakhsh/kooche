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
1. Clean-up jobs in the worker: expired sessions (30 days), login codes (1 day), phone verification attempts (90 days) (`docs/schema.md`, section 14).
2. A "your name" field (accounts start as «کاربر») with the profile or posting feature.
3. Staff two-factor login before the first moderator account.
4. Turnstile on the login form once the Cloudflare proxy is on.
5. Production gets its own Telegram bot at launch (one bot per environment).
6. Persian names of the cities and categories: a quick read-through by a native speaker before launch.
7. Product rows (bump, featured, Pro) go into a seed once Stripe prices exist.
