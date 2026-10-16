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
1. Run migrations as a deploy step (pre-deployment command as `classifieds_owner`) before the first feature that changes the schema.
2. Phase 3 features: Better Auth login (email code, Google, Apple) and phone verification through the Telegram bot.
3. Persian names of the cities and categories: a quick read-through by a native speaker before launch.
4. Product rows (bump, featured, Pro) go into a seed once Stripe prices exist.
