# Setup decisions

Oct 16, 2026 · reviewed against `docs/architecture.md`

This file records the infrastructure as it actually exists and the decisions taken after reviewing the plan. Where it differs from `docs/architecture.md`, this file wins.

## What exists now

| Item | Value |
| --- | --- |
| Server | Hetzner CX23 (2 vCPU, 4 GB RAM, 40 GB disk), Helsinki `hel1`, `135.181.253.129`, server id 170743334 |
| Firewall | `classifieds-app` (id 11815492): inbound 22 (tcp) and ping from anywhere; 80 and 443 (tcp) only from Cloudflare's IP ranges (see "Domain and Cloudflare"). Everything else closed, including 443/udp, Coolify's raw ports 8000/6001/6002 and Traefik's 8080 |
| SSH | Root login by key only (password login for root is off) |
| Coolify | 4.4.6 at https://coolify.peydoo.com (behind the Cloudflare proxy, Let's Encrypt at the server). Public registration disabled; one admin account. API on, but only for the `coolify` Docker network (see "App deployment") |
| Domain | `peydoo.com`, bought Oct 17, 2026, Cloudflare zone (Free plan). `staging.peydoo.com` (app) and `coolify.peydoo.com` (dashboard) are proxied A records to the server; `peydoo.com` and `www` have no records until launch. See "Domain and Cloudflare" |
| Backup storage | Hetzner Storage Box BX11 `classifieds-backups` (id 674924), 1 TB, Falkenstein `fsn1`, `u692990.your-storagebox.de`, SSH/SFTP on port 23 only |
| Photo storage | Cloudflare R2, EU jurisdiction (data stays in the EU), account BerlinWedding. Buckets `classifieds-media-staging` (testing) and `classifieds-media` (production, starts empty at launch). Both private: public `r2.dev` access is off. S3 endpoint `https://fe5720006c80324ed7b6bdd00d63b774.eu.r2.cloudflarestorage.com`, region `auto` |
| Secrets on server | `/root/.secrets/*.env` (root-only, never in Git) |
| Code | https://github.com/rezakhsh/kooche (private). The server pushes with a deploy key (`/root/.ssh/github_deploy`, SSH host alias `github-kooche`) that has write access to this repo only |
| Backups | `/usr/local/bin/classifieds-backup`, nightly at 03:15 UTC (`/etc/cron.d/classifieds-backup`), log in `/var/log/classifieds-backup.log`. restic tags `config` (Coolify config, secrets), `postgres` (database dump) and `coolify-db` (Coolify's own database, dumped inside `coolify-db` with its PostgreSQL 15 `pg_dump`) |
| Alerts | n8n workflow "Kooche – server alerts" (id `71k8LjIW2IJS5c8l`) at https://webhook.khodamehri.com sends to your Telegram (bot credential "Matrix", chat `148310113`). Server side: `/usr/local/bin/kooche-alert` (sender), `/usr/local/bin/kooche-healthcheck` (every 15 min, `/etc/cron.d/kooche-healthcheck`). Webhook path and shared secret in `/root/.secrets/alerts.env` |
| Staging database | Coolify project `classifieds`, environment `staging`, database `classifieds-postgres` (uuid and Docker hostname `pitchwmhavjj8wl2a9ztopqs`), `postgis/postgis:18-3.6`, 768 MB limit, not public (no published port; reachable only on the `coolify` Docker network). Database `classifieds`, locale `b` / `C.UTF-8`. Passwords in `/root/.secrets/postgres.env` |
| Staging Valkey | Coolify database `classifieds-valkey` (uuid and Docker hostname `cgrezwpbbepj0ulgn7wl5qc3`), Redis type with image `valkey/valkey:9.0.6-alpine`, 128 MB limit, `maxmemory 96mb`, `maxmemory-policy noeviction` (BullMQ needs it), AOF on, not public. Password in `/root/.secrets/valkey.env` |
| Staging app | Coolify applications `classifieds-web` (`jc0kgkjqmzxgdccrf0hn93tk`, Dockerfile target `web`, https://staging.peydoo.com, 768 MB) and `classifieds-worker` (`bvhgg5spgjwcwjfnkirvoyvu`, target `worker`, no domain, 384 MB) and `classifieds-migrate` (`2wewwswad9hpecrhvynz5tp0`, target `migrate`, no domain, 128 MB), all from `rezakhsh/kooche` `main` through the GitHub App `kooche-coolify`. A push deploys `classifieds-migrate`, which applies migrations and then deploys the other two. See "App deployment" |
| Staging imgproxy | Coolify application `classifieds-imgproxy` (`ikoznawkb4jv8knhphh2qpf5`, image `ghcr.io/imgproxy/imgproxy:v4.0.16`, 256 MB) at https://img-staging.peydoo.com (proxied by Cloudflare). Reads the R2 staging bucket with a read-only token. See "Photos and imgproxy" |
| Staging Meilisearch | Coolify application `classifieds-meilisearch` (`9cmjl5ncqvcy3m88q2eonrxd`, image `getmeili/meilisearch:v1.54.3`, 384 MB, volume `9cmjl5ncqvcy3m88q2eonrxd-classifieds-meilisearch-data` at `/meili_data`), no domain, no published port, reached as `http://9cmjl5ncqvcy3m88q2eonrxd:7700` on the `coolify` network. Master key and the two app keys in `/root/.secrets/meilisearch.env`. See "Keyword search and saved searches" |
| Swap | 2 GB swap file `/swapfile` (in `/etc/fstab`), `vm.swappiness=10` (`/etc/sysctl.d/90-swap.conf`). A safety net for image builds on 4 GB, not working memory |

The Coolify install had failed: Docker had created the `coolify` network with a malformed IPv6 gateway, so `docker compose up` refused to start. The network was recreated IPv4-only and Coolify started cleanly. If a Coolify upgrade ever fails the same way, the cause is in `/data/coolify/source/upgrade-*.log`.

## Changes from the plan

1. **Server size.** The plan assumes 8 GB in Germany; the server is 4 GB in Helsinki. Helsinki is in the EU, so GDPR is unaffected and the latency to Germany is ~25 ms. 4 GB is enough until the first app deploy. Then resize to **CX33 (4 vCPU, 8 GB, €8.49/month net)** using "CPU and RAM only", which keeps the 40 GB disk so the server can be downgraded again.

2. **PostgreSQL 18 + PostGIS 3.6** (`postgis/postgis:18-3.6`) instead of 17. Version 18 has a built-in `uuidv7()` function (decision 1 in the plan) and faster disk reads. No extension needed for IDs.

3. **Listing photos on Cloudflare R2 (EU jurisdiction)** instead of Hetzner Object Storage. R2 is free up to 10 GB storage, 1 million writes and 10 million reads a month, has no traffic fees, and serves through the Cloudflare network we already use. The app talks plain S3, so switching to Hetzner Object Storage (€6.49/month) later is a configuration change. Hetzner Object Storage also cannot be created through the API, only in Hetzner Console. R2 buckets were created on Oct 16, 2026. The app's upload key (an R2 API token limited to the media bucket, "Object Read & Write") is created when photo upload is built.

4. **Backups on a Storage Box with restic** instead of an Object Storage bucket. A BX11 costs €3.20/month net for 1 TB and lives in Germany, a different region from the server, so one data-centre failure cannot take both. Coolify's built-in database backup only writes to S3, so backups run as a scheduled job instead:
   - `pg_dump` → restic → Storage Box over SFTP, nightly, encrypted and deduplicated.
   - Keep 7 daily, 4 weekly, 6 monthly.
   - Coolify's own config (`/data/coolify/source`, including `APP_KEY`, which decrypts every secret stored in Coolify) is backed up the same way.
   - Restore test once a month (as in the plan).
   - Hetzner server backups (whole-machine snapshots) are managed by the owner directly in Hetzner Console.

5. **Phone verification: Telegram first, SMS as fallback.** Nearly every user in the target audience has Telegram. A Telegram bot's "share contact" button returns the phone number Telegram has already verified, at no cost. Accept it only when the shared contact's `user_id` equals the sender's own id; otherwise someone could share another person's contact. SMS stays for users without Telegram. This removes most of the €10–50/month SMS cost. The bot runs inside our worker, not in n8n, because it is part of login security.

6. **Clear boundary for n8n.** n8n runs on its own server and does non-critical automation only:
   - Posting new listings to Telegram and Instagram channels.
   - Admin alerts (new reports, failed jobs, uptime) to a private Telegram chat.
   - Daily or weekly digests.

   n8n never gets database credentials, and never handles login, payments or moderation decisions. The app sends events to n8n from the outbox worker as webhooks signed with HMAC-SHA256. If n8n needs data, it calls a small authenticated internal API. This keeps the core software ours and replaceable piece by piece.

7. **Meilisearch arrives with the search feature, not in week 1.** Category and city browsing come from PostgreSQL anyway (as the plan says). Adding Meilisearch when keyword search is built keeps fewer services running while the schema is still changing. Search code lives behind one `search` module interface from the start. Built Oct 22, 2026 on the CX23 (CX33 was sold out), with a 384 MB limit; see "Keyword search and saved searches".

8. **One package, not a monorepo.** The Next.js app and the worker live in the same package with two entry points and one Dockerfile with two build targets. Domain code lives in `src/modules/<module>/` (listings, users, chat, payments, moderation…), shared by both entry points. This is the simplest layout that still allows splitting a module out later.

9. **Hostnames only from configuration.** The domain is `peydoo.com` (Oct 17, 2026); the temporary `kooche.taskpilot.dev` and `coolify.taskpilot.dev` are gone. Rules:
   - Every URL comes from `.env` (`APP_URL`, `IMAGE_URL`…). The database stores storage keys, never full URLs (as the plan says).
   - Use one-level names such as `img-staging.peydoo.com`, not `img.staging.peydoo.com`. Cloudflare's free edge certificate covers only one subdomain level.
   - Storage names stay brand-neutral (`classifieds-…`); bucket names can't be changed.

10. **Environments.** Until launch this server is staging. At launch it becomes production, and staging moves to its own small CX23 (€5.49/month). Staging and production never share a database.

11. **Development stays off the server.** Develop locally (WSL, as decided) or in Claude Code sessions. This server only runs what Coolify deploys from GitHub. A dev server here would compete with production for memory.

## Database setup

The schema is in code: Drizzle schema in `src/db/schema/`, migrations in `src/db/migrations/`, seeds in `seed/` (see `docs/schema.md` and `seed/README.md`).

**Locale, before the very first start.** The PostgreSQL cluster must be initialized with `POSTGRES_INITDB_ARGS="--locale-provider=builtin --builtin-locale=C.UTF-8"` (`docs/schema.md`, decision 3). `initdb` reads it only when the data directory is empty, and it can't be changed later without a dump and restore. `compose.yaml` sets it locally. On Coolify, set it as an environment variable on the PostgreSQL service before its first deploy. Check with `SELECT datlocprovider, datlocale FROM pg_database` (expect `b`, `C.UTF-8`); the tests check it too.

**One-time bootstrap, as the superuser.** `src/db/bootstrap/01-classifieds.sh` creates what migrations can't create for themselves:
- `classifieds_owner`: runs migrations and seeds, owns every object. Not a superuser. It has `CREATEROLE`, so migration 0003 can create the other roles.
- `classifieds_template` with `postgis`, which isn't a trusted extension, so only a superuser can install it. The application database is created from it.
- The application database, owned by `classifieds_owner`.

Locally the PostgreSQL image runs it on first start. On a server, run it once: `CLASSIFIEDS_OWNER_PASSWORD=... ./01-classifieds.sh` (leave `CLASSIFIEDS_OWNER_CREATEDB` unset; only local test runs need it).

**Roles.** Migration 0003 creates `classifieds_app`, `classifieds_worker` and `classifieds_readonly` as `NOLOGIN`. Passwords are set per environment, outside Git (server: in `/root/.secrets/` and Coolify):

```sql
ALTER ROLE classifieds_app LOGIN PASSWORD '...';
ALTER ROLE classifieds_worker LOGIN PASSWORD '...';
ALTER ROLE classifieds_readonly LOGIN PASSWORD '...';  -- pg_dump backups
```

**Staging on Coolify (set up Oct 16, 2026).** Done through the Coolify API, in this order. Two Coolify 4.4.6 behaviours matter:
- Coolify picks the data volume's mount path from the image **when the database is created** (`/var/lib/postgresql` for 18+, `/var/lib/postgresql/data` before). Create it with `postgis/postgis:18-3.6` from the start. Creating it from the dashboard's default image and changing the image afterwards leaves PostgreSQL 18 writing outside the volume. Check under Storages that the mount path is `/var/lib/postgresql`.
- The "initdb args" field (`postgres_initdb_args`) is saved but never passed to the container. Set `POSTGRES_INITDB_ARGS` as a normal (not literal) environment variable on the database. As a literal variable, Coolify wraps the value in quotes and `initdb` fails with "unrecognized locale provider". Check `/data/coolify/databases/<uuid>/docker-compose.yml` before the first start.
- The image's own init script also ran on Coolify (unlike locally), so the cluster has `template_postgis` and PostGIS extensions in the `postgres` database. `classifieds` is created from `classifieds_template` and is not affected.

Steps: create the database without starting it; add `POSTGRES_INITDB_ARGS`; start; check the locale; `docker exec -i -e CLASSIFIEDS_OWNER_PASSWORD <uuid> bash -s < src/db/bootstrap/01-classifieds.sh`; migrations and seed from a throwaway `node:24-bookworm-slim` container on the `coolify` network with `MIGRATION_DATABASE_URL` pointing at `<uuid>:5432` (only for this first setup; since then migrations run on every deploy, see "App deployment"); `ALTER ROLE ... LOGIN PASSWORD` with psql's `\getenv`, so passwords never appear in a command line. The host has no Node or psql; use containers (`postgis/postgis:18-3.6` for psql and pg_dump).

`/root/.secrets/postgres.env` holds `POSTGRES_HOST`, the superuser password (also stored in Coolify) and the passwords of `classifieds_owner`, `classifieds_app`, `classifieds_worker` and `classifieds_readonly`. The app and worker get theirs as Coolify environment variables when they are deployed.

**Backup and restore.** `/usr/local/bin/classifieds-backup` runs `pg_dump -Fc -Z0` as `classifieds_readonly` (restic compresses and deduplicates) to `/var/backups/classifieds-db/` (root-only), backs that file up with tag `postgres` and deletes it. The dump goes through a file because restic 0.16 can't fail a `--stdin` backup when the dump fails. `classifieds_readonly` needs `SELECT` on sequences for this (migration 0005).

Restore (tested Oct 16, 2026 into a scratch container; every row count, function, trigger, index and the locale matched):

```bash
restic dump --tag postgres latest /var/backups/classifieds-db/classifieds.dump > classifieds.dump
```

Then, on a cluster initialized with the builtin C.UTF-8 locale: run the bootstrap script, create `classifieds_app`, `classifieds_worker` and `classifieds_readonly` (`NOLOGIN`), `pg_restore --exit-on-error -U postgres -d classifieds classifieds.dump` as the superuser, and set the login passwords again.

**Local development.**

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
npm test
```

For a local app login, run the `ALTER ROLE` lines above once with the passwords from `.env.example` (`docker compose exec postgres psql -U postgres -d classifieds`). `npm test` recreates `classifieds_test` on every run and grants the owner `SET` on the three roles, so the grant tests can switch roles (the account tests also connect as `classifieds_app` and `classifieds_worker` this way). It also empties the Valkey database in `TEST_REDIS_URL` (database 15 by default), which `compose.yaml` now starts.

**Changing the schema.**
- Edit `src/db/schema/`, then `npm run db:generate`. Custom SQL goes in `npx drizzle-kit generate --custom --name=<name>`. Never use `drizzle-kit push`: triggers, grants and the deferrable constraint live only in custom migrations.
- drizzle-kit wraps `geography(Point,4326)` in double quotes. Unquote it in the generated file (see `src/db/types.ts`).
- A new table needs its grants and, if it has `updated_at`, its `set_updated_at` trigger in the same migration. The tests fail otherwise.
- Update `docs/schema.md` in the same change.

## App deployment

One Dockerfile, three targets (decision 8): `web` (Next.js standalone output, `node server.js`), `worker` (esbuild bundle `dist/worker.js`, no `node_modules`) and `migrate` (esbuild bundles `migrate.js` and `trigger.js` plus `src/db/migrations/`). Both images are `node:24.22.0-bookworm-slim` and run as the `node` user. The build runs `npm run typecheck` and `npm run check:rtl` before anything else, and needs no secrets: every setting is read at runtime and checked with Zod (`src/lib/env.ts`).

**Coolify settings.** Build pack Dockerfile, "Docker Build Stage Target" `web`, `worker` or `migrate`. Coolify finds the `HEALTHCHECK` in the Dockerfile and uses it instead of its own (which needs curl, and the slim image has none): `web` calls `/health`, `worker` checks a heartbeat file the outbox loop touches every second. Concurrent builds on the server: 1, so two Next.js builds never run at once. Building `web` takes about 30 seconds.

**Deploy order: migrations first.** Auto-deploy is on only for `classifieds-migrate`; it is off for `classifieds-web` and `classifieds-worker`. Every push to `main` (docs-only commits too) goes:
1. The GitHub App's webhook deploys `classifieds-migrate`. Its container runs `migrate.js` (pending migrations as `classifieds_owner`, logged by name, all in one transaction), then `trigger.js`, which calls `POST http://coolify:8080/api/v1/deploy?uuid=<web>,<worker>` with a deploy-only API token. It then idles (`sleep`, under 1 MB). The `HEALTHCHECK` passes once the deploy is queued.
2. Coolify builds one image at a time, so the web and worker deployments queue behind the migrate deployment and start after it. Each one builds the newest commit on `main`. If a second push arrives in the meantime, its migrate deployment is already ahead of them in the queue, so no app ever starts before its migrations.
3. If a migration or the deploy call fails, the container exits. Coolify never sees it healthy and marks the migrate deployment failed, the previous migrate container keeps running, and web and worker stay on the old version. Look at the failed deployment's log in Coolify, fix, push again.
4. A restart of the same migrate container (server reboot) reruns the migrations, which is a no-op, but doesn't deploy again: a marker file in the container's own filesystem remembers the deploy call.

Coolify health settings on `classifieds-migrate`: start period 5 s, interval 5 s, 24 retries, so Coolify waits up to about two minutes for the migrations. Raise them before a migration that takes longer.

Rules that follow from this:
- **Migrations must be backward compatible.** The old web and worker keep running until the new containers are healthy, and if the web build fails after the migrations, the old code runs on the new schema. Add first, remove later (expand and contract): a new column is nullable or has a default; a column is dropped one deploy after the code stopped using it.
- **Deploying by hand:** redeploy `classifieds-migrate`, which deploys the other two. "Deploy" on web or worker alone skips the migrations; use it only when no migration is pending.
- **Rolling back** web or worker in Coolify doesn't undo migrations. A schema change is undone with a new migration.

**Cache purge after each web deploy** (since Oct 19, 2026). `classifieds-web` has the post-deployment command `node purge-cache.js` (`src/deploy/purge-cache.ts`, bundled into the `web` image by `npm run build:purge`). Coolify 4.4.6 runs it with `docker exec` in the new container after the rolling update: the new container is healthy and the old one has been stopped and removed, so nothing of the previous build can be cached again afterwards (checked in `ApplicationDeploymentJob`: `rolling_update()` → `post_deployment()` → `run_post_deployment_command()`). It runs after every web deployment, from a push, by hand or as a rollback. It purges APP_URL's host only (`{"hosts": ["staging.peydoo.com"]}`, available on the Free plan), not the whole zone, so `img-staging.peydoo.com` keeps its cached photos and imgproxy doesn't render them all again. A failure (retried once on a network error or 5xx) only writes "Post-deployment command failed" with Cloudflare's message to the deployment log; the deployment stays successful and the 60-second bound is the fallback. Success writes "Cloudflare cache purged for staging.peydoo.com" to the deployment log. Verified Oct 19, 2026: a `/austria` copy cached during the rolling update was a MISS right after it.

Where else it could have run, not chosen: in `trigger.js` after it queues the deploy (it would have to poll `GET /api/v1/deployments/<uuid>`, which needs the `read` ability on the deploy token, and would miss deploys by hand and rollbacks), or in the worker at start (depends on the queue deploying web before worker, purges on every worker restart, and misses web-only deploys).

The token `peydoo-cache-purge` (account-owned, id `35270e58ab0b1b447df4657bb4ca3ffd`) has only Cache Purge on zone `peydoo.com` and works only from the server's IPv4 `135.181.253.129` (calls over IPv6 are refused; the containers reach Cloudflare over IPv4). Its value is in `/root/.secrets/infra.env` and in the env of `classifieds-web`. The env vars and the command were set on Oct 19, 2026 through the API with a one-hour token made with `php artisan tinker` in the `coolify` container and deleted afterwards.

Why this design (Coolify 4.4.6, checked in its source):
- A **pre-deployment command** runs with `docker exec` in the **old**, still-running container, before the new image is even built. It would run the previous commit's migrations, and is skipped when no container runs. It would also put the owner password into the web app.
- In a **Docker Compose** application, Coolify adds `env_file: .env` to every service, so a one-shot migrate service there would hand the owner password to web and worker. Compose deploys also replace rolling updates with a recreate.
- The GitHub webhook queues all matching applications **in no defined order**, so a migrate app next to two auto-deploying apps can't be guaranteed to run first.

**Coolify API (on since Oct 16, 2026).** Needed for step 1. "Allowed IPs" is the `coolify` Docker network `10.0.1.0/24` **without** `10.0.1.1`, written as `10.0.1.2/31,10.0.1.4/30,10.0.1.8/29,10.0.1.16/28,10.0.1.32/27,10.0.1.64/26,10.0.1.128/25`. The gateway must stay out: Docker's userland proxy forwards IPv6 connections (the server has IPv6 and listens on `[::]:443`), so every client reaching Coolify over IPv6 appears as `10.0.1.1`. Calls from outside, over IPv4, over IPv6 and with a forged `X-Forwarded-For`, answer "You are not allowed to access the API" (tested); `/api/health`, which n8n checks, is outside the allowlist and still answers. Coolify checks the token before the IP, so a wrong token gets 401 even from outside. The token `classifieds-deploy` has only the `deploy` ability; its value is in `/root/.secrets/coolify-api-tokens.env` and in the env of `classifieds-migrate`. For other API work, create a temporary token from a container on the `coolify` network (calls from the host itself are refused too) and delete it afterwards.

**Environment variables** (runtime only, never build time):

| App | Variables |
| --- | --- |
| `classifieds-web` | `NODE_ENV`, `APP_URL`, `APP_TIME_ZONE`, `DATABASE_URL` (as `classifieds_app`), `REDIS_URL`, `AUTH_SECRET`, `PHONE_CODE_SECRET`, `SMTP_URL`, `EMAIL_FROM`, `TELEGRAM_BOT_USERNAME`, `SMS_PROVIDER`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET_MEDIA`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `IMAGE_URL`, `IMGPROXY_KEY`, `IMGPROXY_SALT`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_PURGE_TOKEN` (read only by the post-deployment command), `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `MEILI_URL`, `MEILI_SEARCH_KEY` (`SEARCH_INDEXING` unset on staging, which means `off`) |
| `classifieds-worker` | `NODE_ENV`, `WORKER_DATABASE_URL` (as `classifieds_worker`), `REDIS_URL`, `TELEGRAM_BOT_TOKEN`, `S3_*` (same five as web), `APP_URL`, `SMTP_URL`, `EMAIL_FROM` (expiry reminders, saved-search alerts), `MEILI_URL`, `MEILI_WRITE_KEY` |
| `classifieds-imgproxy` | `IMGPROXY_KEY`, `IMGPROXY_SALT`, `IMGPROXY_USE_S3`, `IMGPROXY_S3_ENDPOINT`, `IMGPROXY_S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (read-only token), `IMGPROXY_BASE_URL`, `IMGPROXY_S3_ALLOWED_BUCKETS`, `IMGPROXY_WORKERS`, `IMGPROXY_MAX_SRC_RESOLUTION`, `IMGPROXY_MAX_SRC_FILE_SIZE`, `IMGPROXY_TTL`, `IMGPROXY_STRIP_METADATA`, `IMGPROXY_ALLOW_SECURITY_OPTIONS` |
| `classifieds-meilisearch` | `MEILI_MASTER_KEY` (also in `/root/.secrets/meilisearch.env`, nowhere else), `MEILI_ENV=production`, `MEILI_NO_ANALYTICS=true`, `MEILI_MAX_INDEXING_MEMORY=128Mb`, `MEILI_MAX_INDEXING_THREADS=1`, `MEILI_LOG_LEVEL=WARN` |
| `classifieds-migrate` | `NODE_ENV`, `MIGRATION_DATABASE_URL` (as `classifieds_owner`, the only place outside `/root/.secrets` with the owner password), `COOLIFY_API_URL` (`http://coolify:8080`), `COOLIFY_DEPLOY_TOKEN`, `DEPLOY_APP_UUIDS` (`jc0kgkjqmzxgdccrf0hn93tk,bvhgg5spgjwcwjfnkirvoyvu`) |

Hostnames are the Coolify uuids on the `coolify` network: `pitchwmhavjj8wl2a9ztopqs:5432` and `redis://default:<password>@cgrezwpbbepj0ulgn7wl5qc3:6379`. Other variables in `.env.example` are added with the features that use them.

**`/health`** returns 200 `{"status":"ok"}` when PostgreSQL and Valkey both answer within 2 seconds, else 503. It never returns error details.

**Security headers.** `src/proxy.ts` sets a strict Content-Security-Policy with a fresh nonce per request (`script-src 'self' 'nonce-…' 'strict-dynamic'`, no `unsafe-inline`), so every page is rendered per request. `next.config.ts` sets HSTS (two years, `includeSubDomains`; `preload` is decided at launch, once production serves `peydoo.com` itself, because it is hard to undo and covers every subdomain), `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` and COOP. Logged-out browse pages are cached by Cloudflare for up to 60 seconds since Oct 19, 2026 ("Browsing and favorites"), and every visitor of one cached copy gets the same nonce (see "The nonce on cached pages" there). `SEARCH_INDEXING=off` (the default, so staging sets nothing) adds `X-Robots-Tag: noindex, nofollow` to every page in `src/proxy.ts`; production sets `on`.

**Coolify 4.4.6 API pitfalls** (found while setting this up):
- Start, stop and deploy endpoints are `POST` now (`POST /api/v1/deploy?uuid=…`, `POST /api/v1/databases/<uuid>/start`). `GET` answers with a message, not an error status.
- `redis_conf` must be base64-encoded. With a config file, `appendonly` must be in it (Coolify only adds `--appendonly yes` without one).
- `dockerfile_target_build` can't be set when creating an application, only with a `PATCH` afterwards.
- An application created without `domains` gets an `sslip.io` domain; clear it with `PATCH {"domains": ""}` (the worker has none).
- An API token's value is `<id>|<secret>`. Quote it in an env file, or `source` treats the `|` as a pipe.
- `POST /api/v1/deploy?uuid=a,b` answers 200 as long as one uuid exists and silently skips unknown ones. `trigger.js` checks that every uuid got a `deployment_uuid`.
- Creating an application needs `ports_exposes` even without a domain (`classifieds-migrate` has `3000`, unused).

**Fonts.** `src/app/fonts/Vazirmatn-subset.woff2` (69 KB, all weights) is cut from the pinned `vazirmatn` package by `scripts/subset-font.sh` (fonttools in a throwaway Python container). Rerun it when the package version changes.

## Domain and Cloudflare

Set up Oct 17, 2026. Zone `peydoo.com` on Cloudflare's Free plan.

| Record | Points to | Proxy |
| --- | --- | --- |
| `staging.peydoo.com` A | `135.181.253.129` | on |
| `coolify.peydoo.com` A | `135.181.253.129` | on |
| SES records (DKIM, `bounce`, `_dmarc`) | see "Accounts and phone verification" | DNS only |

`peydoo.com` and `www` have no records until launch.

**Zone settings.** SSL Full (strict), minimum TLS 1.2, TLS 1.3 and HTTP/3 at the edge on. Two settings are off on purpose:
- **Always Use HTTPS is off.** Traefik already redirects HTTP to HTTPS for every Coolify domain and leaves `/.well-known/acme-challenge/` alone. Let's Encrypt (HTTP-01, through Cloudflare) renews the server's certificates that way. In Full (strict), Cloudflare reaches the server over HTTP for HTTP requests, so the challenge gets through.
- **Bot Fight Mode is off.** It would challenge GitHub's webhooks to Coolify and the n8n uptime checks.
- **Email Address Obfuscation is off** (Scrape Shield, turned off Oct 21, 2026 with the owner's approval). It rewrote every email address in the HTML into `[email protected]` plus Cloudflare's `email-decode.min.js`, which the CSP blocks (it has no nonce), and the changed HTML broke React's hydration (#418) on `/account` and `/account/notifications`. It can't work under our CSP; the user's own email only appears behind sign-in.

**Certificates.** Cloudflare's Universal SSL at the edge covers `peydoo.com` and `*.peydoo.com`, one level only. The server keeps its own Let's Encrypt certificates from Traefik, which Full (strict) requires.

**A records only, no AAAA.** Cloudflare reaches the server over IPv4. Over IPv6, Docker's userland proxy would show every connection as coming from `10.0.1.1` (see "Coolify API"), and the app could no longer tell Cloudflare apart from anyone else. Visitors still get IPv6 from Cloudflare.

**Origin lock.** The Hetzner firewall allows 80 and 443 only from Cloudflare's ranges (https://www.cloudflare.com/ips/), so nobody can bypass Cloudflare by calling the server's IP. Every hostname served from this server must therefore be proxied. The same list is in `src/lib/client-ip.ts`; if Cloudflare changes it, update both.

**Client IP.** See "Accounts and phone verification".

**Moving a hostname in Coolify 4.4.6.** Two traps:
- **Dashboard domain.** When the instance domain changes, the GitHub App's webhook URL must follow, or pushes stop deploying. On Oct 17, 2026 it was changed with the App's own key, which Coolify stores (`PATCH https://api.github.com/app/hook/config`). The App's homepage and callback URLs can only be changed in GitHub's App settings.
- **Application domain.** Coolify keeps the generated Traefik labels in the app's `custom_labels`. It regenerates them only when the domain is changed in its UI, so a domain changed any other way keeps routing the old host. Regenerate them ("Reset to default labels" in the UI) and restart the app.

**At launch** (decision 10):
- This server's app gets `peydoo.com` and `www.peydoo.com` (www redirects to the apex), with `APP_URL=https://peydoo.com`, `SEARCH_INDEXING=on` and a new Telegram bot.
- `staging.peydoo.com` moves to the new staging server.
- Decide on HSTS `preload`.
- A production Turnstile widget for `peydoo.com` with its own keys in the production web app ("Bot protection").
- The Cache Rule covers `staging.peydoo.com` only: add `peydoo.com` to its host condition when production gets the domain ("Browsing and favorites").
- Production's web app gets the same post-deployment command and the two `CLOUDFLARE_*` variables (it purges its own APP_URL host, `peydoo.com`); if production runs on another server, the purge token's IP condition needs that server's IPv4.

## Accounts and phone verification

Built Oct 16, 2026 (code in `src/modules/users/`, pages under `src/app/login/` and `src/app/account/`).

**Sign-in: email one-time code only.** No passwords, no Google or Apple yet. Better Auth 1.7.10 on our own tables (`docs/schema.md`, section 6) with the `emailOTP` plugin: 6 digits, valid 10 minutes, locked after 5 wrong tries, stored as a SHA-256 hash, deleted when used. A first sign-in creates the account. Google is added later as a social provider with account linking (`trustedProviders: ['google']`): it links to the user with the same verified email through `auth_accounts`, so nobody is migrated. Better Auth's `/api/auth/*` route is not mounted yet; the forms are server actions that call `auth.api.*`. Mount it with Google, which needs the callback.

**Sessions.** An HTTP-only cookie (`__Secure-better-auth.session_token` on HTTPS), `SameSite=Lax`, 30 days, extended at most once a day. The cookie cache is off, so every request checks `sessions` and a revoked device is out on its next request. "My devices" (`/account/devices`) lists the sessions with browser and system from the user agent and deletes them by id and owner; the session token never reaches the browser. Deactivated or deleted accounts get no new sessions (a Better Auth session hook). Known limit: a full page load can't write cookies in Next.js, so the cookie's own expiry is extended only when a server action runs; at worst a user signs in again 30 days after the last form they sent.

**Email.** Amazon SES in eu-central-1, sent through SMTP with nodemailer (`SMTP_URL` = `smtp://<user>:<url-encoded password>@email-smtp.eu-central-1.amazonaws.com:587`, STARTTLS required). Sender `"پیدو" <noreply@peydoo.com>` (`EMAIL_FROM`); there is no inbox on peydoo.com. Sent directly from the web process, not through the outbox, because the outbox would store the code in plain text. Persian, right-to-left, HTML and plain text. Without `SMTP_URL` (development only; `env.ts` requires it in production) the code is printed to the log.

**SES setup (Oct 17, 2026).** Domain identity `peydoo.com` in eu-central-1: Easy DKIM (RSA 2048, three CNAMEs), custom MAIL FROM `bounce.peydoo.com` (MX and SPF TXT), DMARC `_dmarc.peydoo.com` = `v=DMARC1; p=none; adkim=s; aspf=r`. All of these are DNS-only records in the peydoo.com Cloudflare zone. The account has production access (out of the sandbox, 50,000 emails a day). The SMTP login is in `/root/.secrets/ses-smtp.env` (the password is derived from the AWS secret key with SES's algorithm); the AWS keys themselves are in `/root/.secrets/aws-ses.env`. The app only needs `SMTP_URL`. Tighten DMARC to `p=quarantine` once the DMARC reports show only SES.

**Telegram verification** (decision 5). The bot runs in the worker with long polling (`getUpdates`); the worker has no public URL and the token is only in the worker's env. Flow:
1. `/account/phone` creates a `phone_verifications` row (method `telegram`, 15 minutes) with the SHA-256 of a random 32-character token and shows `t.me/<TELEGRAM_BOT_USERNAME>?start=<token>`.
2. `/start <token>` in the bot claims the row for that Telegram account (`telegram_user_id`); a second Telegram account can't use the same link. The bot shows a "share my phone number" button (`request_contact`).
3. A shared contact is accepted only when `contact.user_id` equals `from.id`. Otherwise the row fails with `foreign_contact`.
4. One transaction marks the row verified, stores the number, `phone_verification_method = 'telegram'` and `telegram_user_id` on the user and writes `audit_log` (`phone.verified`). A number another account has fails with `phone_in_use`; a Telegram account linked to another user fails with `telegram_in_use`.
5. The page asks `/account/phone/status` every 3 seconds and refreshes when the number is verified.

Only one process may poll a bot token. During a rolling deploy the old and new worker overlap for a few seconds; Telegram answers 409 to one of them and it retries after 5 seconds. **Each environment needs its own bot**: staging uses the bot in `/root/.secrets/auth.env`, production gets a new one at launch.

**SMS fallback.** `SmsProvider` interface (`src/modules/users/sms.ts`). `SMS_PROVIDER=log` writes the message to the log, which is what development and staging use. Codes are HMAC-SHA256 with `PHONE_CODE_SECRET`, valid 10 minutes, failed after 5 wrong tries. SMS goes only to mobile numbers in the 36 seeded countries (`seed/countries.ts`) against SMS-pumping fraud; Telegram accepts any number. Provider when needed (nothing bought): **seven.io** (Berlin, German DPA, pay as you go, REST API); alternative GatewayAPI (Denmark). Adding one is an adapter plus its key in env.

**Rate limits** (Valkey, fixed windows, every key with an expiry because of `noeviction`; `src/modules/users/limits.ts`):

| What | Limit |
| --- | --- |
| Login code requests | 1 per minute and 5 per hour per email, 20 per hour per IP |
| Login code checks | 10 per 15 minutes per email (cleared by a successful sign-in), 50 per hour per IP |
| Phone verification starts (Telegram or SMS) | 5 per hour and 10 per day per user, 20 per hour per IP |
| SMS | 3 per day per number; 10 code checks per 15 minutes per user |
| Bot messages | 30 per hour per Telegram account (then ignored) |

**Client IP** (`clientIp()` in `src/lib/client-ip.ts`). Coolify's Traefik has no `forwardedHeaders.trustedIPs`, so it drops any `X-Forwarded-For` the client sends and writes the address it saw. That address is a Cloudflare server when Cloudflare proxies the hostname. Only then does the app take `CF-Connecting-IP`; otherwise it takes Traefik's address, so a header sent straight to the server is ignored. Better Auth reads no IP header itself (`disableIpTracking`); its session hook stores `clientIp()` in `sessions.ip_address`, and the rate limits use the same value.

**Permissions.** Posting a listing and sending a message need a verified phone; browsing and favorites don't (decided Oct 16, 2026). `canPostListing()` and `canSendMessage()` in `src/modules/users/permissions.ts` must be called by the posting and chat features before they write anything.

**Name, seller page, data download and deletion** (approved Oct 21, 2026; code in `src/modules/users/profile.ts`, `export.ts`, `erasure.ts`, pages under `src/app/account/` and `src/app/u/[token]/`):
- **Name** (`/account/name`): 2–50 characters, the same rule as on the posting form (`checkDisplayName()`). Names containing پیدو, پشتیبانی, مدیر سایت, peydoo, admin, support or «کاربر حذف‌شده» are refused (normalized, Latin folded, without spaces or ZWNJ). Valkey limit `rename:user:1d`, 10 a day.
- **Seller page** `/u/{public_token}`: name, member since, phone verified, active listings and upcoming events. `noindex, follow`, and `u` is in the proxy's `NOT_BROWSE`, so it is never marked `public` for the edge cache. Deactivated and deleted accounts answer 404.
- **Download** (`/account/data`): a POST form to the route handler `/account/data/export`. A route handler has no server-action origin check, so it refuses any `Origin` other than APP_URL's (403). Valkey limit `export:user:1h`, 3 an hour; each download writes `audit_log` `user.data_exported` with the session, IP and user agent. Built on request, not as a job (decided Oct 21, 2026): one account's data is small; switch to a job with an emailed link if exports grow.
- **Deletion** (`/account/delete`): confirmed by typing the account's own email and a tick (decided Oct 21, 2026; an emailed code was the stronger alternative). `erase_user` stays executable only by the worker: the app's transaction sets `status = 'deactivated'` (no new sessions, no posting or messages), deletes every session and writes `user.erase_requested` to the outbox and `audit_log`; the worker's `accounts` queue (5 attempts, exponential backoff) calls `erase_user` only for a deactivated account, and `erase_user` does nothing for one already deleted. The action clears the browser's cookie by setting it expired with `Secure` (a `__Secure-` cookie is only replaced by a secure one) and ends on `/account/deleted`.

## Bot protection

Built Oct 21, 2026 (roadmap step 3). Cloudflare Turnstile on sign-in and publishing, and tighter limits for accounts in their first 7 days.

**Where Turnstile is checked** (server actions, before anything is written):
- Sign-in, "send code" (`requestCode`): every request. Entering the code isn't checked (5 tries per code, 10 per 15 minutes per email).
- "Send the code again" (`resendCode`) has no widget: it works only for 10 minutes after a Turnstile-checked request for the same email (Valkey `login-human:<sha256(email)>`, 10-minute expiry; `src/modules/security/login-human.ts`). The `login_email` cookie alone could be forged.
- Publishing a listing or an event (`saveListingAction`, `saveEventAction`) when it goes out: a draft (or a new form) published, or a rejected one sent again. Not "save", edits of live listings, pause, resume, renew or photos.

**The check** (`verifyTurnstile()` in `src/modules/security/turnstile.ts`, `checkTurnstile()` in `server.ts`): siteverify with the secret, the token and `clientIp()`, 5-second timeout. Accepted only with `success: true`, `hostname` equal to APP_URL's host, and `action` equal to the form's (`login`, `publish-listing`, `publish-event`), so a token from one form can't be spent on another. Tokens are single-use and live 300 seconds (siteverify answers `timeout-or-duplicate`). Fails closed: no token, an HTTP error, a malformed answer, a timeout or no network all refuse. The log gets the outcome and error codes, never the token. Cloudflare's test secrets (`1x…`, `2x…`, `3x…`) answer hostname `example.com` and no action, so those two checks are skipped for them, and `env.ts` allows a test secret only with a local APP_URL (`localhost`, `127.0.0.1`, `*.localhost`, `*.test`).

**The widget** (`useTurnstile()` in `src/components/turnstile.tsx`): our own client code adds `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`, which `'strict-dynamic'` trusts without a nonce. Explicit render with the form's `action`, `language: 'fa'`, `appearance: 'interaction-only'` (nothing shows unless Cloudflare wants a click), `refresh-expired: 'auto'`; the token is the form's hidden `cf-turnstile-response`. The send/publish button reads «در حال بررسی امنیتی…» and stays disabled until a token is there; after a refused submit the widget is reset (the token is spent). The site key comes from the server page as a prop (`turnstileSiteKey()`), read at runtime like every setting.

**CSP** (`src/proxy.ts`, `contentSecurityPolicy()`): `frame-src https://challenges.cloudflare.com` and the same host in `script-src` (only for browsers without `'strict-dynamic'`). On every page, because a page reached by an in-app link keeps the CSP of the page the visit started on, such as a cached `/germany`. No `unsafe-inline`.

**Edge cache:** the widget is only on `/login`, `/new/…`, `/my/listings/…`, `/events/new` and `/my/events/…`, none of them browse pages, so none is cached. Cached browse pages only gained the CSP line; the deploy's purge replaced the old copies.

**Without JavaScript** (decided Oct 21, 2026): browsing, favorites, chat, saving drafts and the other forms work as before. Sending a login code and publishing need JavaScript: Turnstile has no mode without it, and a way around it would be the one every bot takes. A `<noscript>` note says so («برای این کار باید جاوااسکریپت مرورگرتان روشن باشد…»), the button is disabled, and a form that arrives without a token is refused («بررسی امنیتی هنوز تمام نشده است…»).

**Widgets and keys.** One widget per environment, mode managed, limited to that environment's hostname: `peydoo-staging` for `staging.peydoo.com` now, a new one for `peydoo.com` at launch. `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are in the env of `classifieds-web` and in `/root/.secrets/turnstile.env`; both are required in production (`env.ts`), and without them in development the widget and the check are off. Staging's widget (site key `0x4AAAAAAFfyUwICex1hcXNk`) was created on Oct 21, 2026 through the API with a one-hour account token `peydoo-turnstile-setup` that had only "Turnstile Sites Write" (minted with the infra token, approved by the owner) and was deleted right after. The infra token itself can't manage Turnstile; do the same for production at launch, or use the dashboard (Turnstile → Add widget).

**New-account limits** (accounts younger than 7 days by `users.created_at`; `isNewAccount()` in `src/modules/users/new-account.ts`, shared with chat):

| What | All accounts | Accounts under 7 days | Where |
| --- | --- | --- | --- |
| Listings published | no daily limit | 3 in 24 hours | `saveListing()`, counted in PostgreSQL (`publishedInLastDay()`): own non-event listings by `published_at`, deleted ones included; renewals keep their old `published_at` |
| Events published | 5 in 24 hours | 2 in 24 hours | `saveEvent()`, the same query for events |
| Photos added | 60 an hour | also 20 an hour and 40 a day | Valkey `listing-upload:new-user:1h` / `:1d` (`newAccountUploadChecks()`) |
| New chats, links in chat | | unchanged ("Chat") | |

The publish limits are inside the transaction after `canPostListing()`, so no caller can skip them; the refusal is `new_account_limit`, shown as «حساب‌های تازه (کمتر از ۷ روز) در هر ۲۴ ساعت حداکثر ۳ آگهی منتشر می‌کنند…». Saving and editing still work.

## Photos and imgproxy

Built Oct 17, 2026 with the posting feature (code in `src/modules/media/`).

**R2 tokens.** Two Account API tokens, created through the Cloudflare API on Oct 17, 2026 (the owner gave the infra token permission to create tokens), both limited to `classifieds-media-staging` in the EU jurisdiction:
- `classifieds-staging-rw` (Object Read & Write): web and worker.
- `classifieds-staging-imgproxy` (Object Read): imgproxy.

The S3 credentials of an R2 token are its id (access key id) and the SHA-256 of its value (secret). They are only in `/root/.secrets/r2.env` and Coolify. Tested: the read-only token can't write, and neither token can reach `classifieds-media`. Production gets its own two tokens for `classifieds-media` at launch.

**Bucket settings** (Cloudflare API, `cf-r2-jurisdiction: eu`):
- CORS: `PUT` from `https://staging.peydoo.com` with the `content-type` header, max age 1 hour. Production adds its origin at launch.
- Lifecycle: objects under `uploads/` are deleted after 1 day (originals that were never processed), next to R2's default rule that aborts multipart uploads after 7 days.

**Upload.** The web reserves a `listing_images` row (`pending_upload`, key `uploads/<listing>/<random>`) and returns a presigned `PUT` URL valid for 5 minutes. R2 has no presigned POST with a size range, so `Content-Type` and `Content-Length` are signed into the URL (aws4fetch with `allHeaders`); R2 answers 403 to any other size or type (tested). Limits: JPEG, PNG or WebP, at most 15 MB, at most 10 photos per listing (fewer where `categories.max_images` says so). The browser then confirms, which writes the `listing_image.uploaded` outbox event.

**Processing (worker, queue `media`, one image at a time).** sharp 0.35 (libvips 8.18) decodes the file (anything else is `rejected` and deleted), applies the EXIF rotation, scales to at most 2560 px, re-encodes to WebP quality 85 without any metadata (EXIF and GPS, XMP, IPTC, ICC), and stores width, height, size, ThumbHash, a 64-bit pHash and SHA-256. The master is `listings/<2 hex>/<image id>.webp`; the original is deleted. libvips' cache is off and at most 40 megapixels are decoded. The worker image ships `node_modules` for sharp only (about 20 MB); the rest stays one bundled file.

**imgproxy.** Coolify application `classifieds-imgproxy`, Docker image `ghcr.io/imgproxy/imgproxy:v4.0.16`, 256 MB, 2 workers. It has no published port: Traefik routes `img-staging.peydoo.com` to it, and the firewall lets only Cloudflare reach Traefik. `IMGPROXY_BASE_URL=s3://classifieds-media-staging/`, so a URL carries only the base64 storage key, never the bucket. Every URL is signed (`IMGPROXY_KEY`/`IMGPROXY_SALT`, in `/root/.secrets/imgproxy.env` and in Coolify for imgproxy and web); unsigned or changed URLs get 403. Only three sizes exist (`src/modules/media/imgproxy.ts`: thumb 160², card 480×360, full 1280), each as AVIF and WebP. URLs end in `.avif`/`.webp`, so Cloudflare caches them by extension: `Cache-Control: public, max-age=31536000`, second request `cf-cache-status: HIT` (tested). Masters never change (a new photo is a new key), so nothing needs purging. imgproxy v4 renamed `IMGPROXY_CONCURRENCY` to `IMGPROXY_WORKERS`.

**CSP.** `src/proxy.ts` adds the R2 endpoint's origin to `connect-src` (uploads) and `IMAGE_URL`'s origin to `img-src`. `Permissions-Policy` allows geolocation for our own origin ("use my location", snapped to ~500 m in the browser and again on the server). The outline map is inline SVG with class attributes only, so the CSP needs nothing new.

## Alerts

One n8n workflow, **Kooche – server alerts**, receives reports from the server and checks from outside. It sends a Telegram message only when something changes: one 🔴 when a check fails and one 🟢 when it recovers. Events, such as a failed backup, are always sent. Its memory between runs lives in the workflow's static data. Successful runs aren't stored, so the 5-minute timer doesn't fill the n8n database; failed runs are.

| Check | Where | Alerts when |
| --- | --- | --- |
| Coolify dashboard reachable (`https://coolify.peydoo.com/api/health`) | n8n, every 5 min | 2 failed checks in a row |
| Staging app (`https://staging.peydoo.com/health`) | n8n, every 5 min | 2 failed checks in a row |
| Server alive | server heartbeat every 15 min | no heartbeat for 35 min (covers the whole server being down) |
| Disk | server, every 15 min | `/` at 85% or more |
| Memory | server, every 15 min | under 300 MB available |
| Containers | server, every 15 min | a container is unhealthy or restarting, or a Coolify-managed one stopped |
| Nightly backup | backup script | it fails (immediately), or no successful run for 25 h |
| Coolify deployments | server, every 15 min | a deployment of any Coolify application failed (once per failure) |
| Search (since Oct 22, 2026) | server, every 15 min | no Meilisearch container running, it was killed for memory, or it restarted since the last run (found by its image; restart count in `/var/lib/kooche/meili-restarts`). Keyword search falls back to PostgreSQL meanwhile |

**Failed deployments.** `kooche-healthcheck` reads failed rows from the last 24 hours in Coolify's `application_deployment_queues` table (read-only, `docker exec coolify-db psql`) and sends each one as a `deploy` event in the same batch: app, short commit, commit message and a link to the deployment log. For `classifieds-migrate` it adds that web and worker were not deployed. The uuids already sent are in `/var/lib/kooche/deploy-alerts-sent`. Only failures still inside the window are kept, so a lost file re-sends at most one day of failures. If `coolify-db` doesn't answer, the check is skipped and the file stays as it is (the containers check reports that case). The alert arrives up to 15 minutes after the failure. A separate, faster cron would race the healthcheck's n8n run and lose state.

To add a check:
- **A URL:** add it to `URLS` at the top of the workflow's "Check and decide" Code node.
- **A job on the server:** call `kooche-alert event|status|heartbeat`.
- **Several reports at once:** send them as one `kooche-alert batch '[...]'`. Parallel n8n runs overwrite each other's memory, so separate requests sent at the same moment can lose state.

**CX33 watcher.** A second n8n workflow, **Peydoo – CX33 available** (id `v7KPDYAV6hIgtfs2`), checks Hetzner every 5 minutes and emails reza.khodamehri@gmail.com (Gmail credential "Gmail account reza.khodamehri@gmail.com") when CX33 can be ordered in `hel1`. CX33 was sold out everywhere on Oct 21, 2026, and keyword search (roadmap step 4) waits for it. It only reads (`GET /v1/server_types?name=cx33` and `GET /v1/servers/170743334`) and never changes the server: the owner decided on Oct 21, 2026 to rescale by hand, because an automatic rescale powers off staging and every Claude session on the server without warning. Rescale in Hetzner Console with "CPU and RAM only", so the 40 GB disk stays and a downgrade remains possible.
- One email each time CX33 goes from sold out to available (state per type in the workflow's static data); none while it stays available. The "Remember" node saves that state only after Gmail sent the email, so a failed send is retried every 5 minutes (failed runs are kept in n8n, successful ones aren't).
- Once Peydoo is no longer CX23 it sends one last email and stops checking for good (static data `done`). Then deactivate or delete it.
- Type, location and server id are constants at the top of its "Config" Code node. Tested on Oct 21, 2026 with CPX22 (available) in place of CX33: one email arrived, the following runs sent none. If Gmail sends fail (n8n shows failed runs: "credential needs to be reconnected"), reconnect the credential in n8n; the alert is retried until it goes out.
- It uses the n8n credential **Hetzner Cloud – Peydoo project** (`httpBearerAuth`, limited to `api.hetzner.cloud`). That is the project-wide read/write token from `/root/.secrets/infra.env`, the owner's choice, so it now also lives in n8n's credential store on `n8nworkerReza`, where it could change any server in the project. Delete the credential with the workflow.

## Countries, places and the map

Decided by the owner on Oct 17, 2026, after comparing hosted geocoders (Geoapify, MapTiler, Stadia), self-hosted address search (Photon, Nominatim: several GB of data and 1–2 GB of memory, too heavy for this server) and our own map tiles (PMTiles: 2.6 GB for Germany and Austria, 11 GB for Europe, on R2):

- **No outside address or map service.** The seller types a postal code or town, with suggestions from our own GeoNames postal codes (`postal_places`, about 34,000 rows for DE and AT, a few MB), or taps "use my location" (the browser's own geolocation, free; the position is snapped to ~500 m before it leaves the browser and again on the server). No street is asked for or stored.
- **The map is an outline of the country** with a dot (`src/components/outline-map.tsx`): SVG drawn from Natural Earth (public domain), inside our own pages, no tiles, no storage, no third party. A real street map can replace it later without any change to stored data: either MapLibre with our own PMTiles extract on R2 (~€0.05/month for DE+AT) or a hosted style.
- **Home page:** the list of open countries; `/{slug}` (`/germany`, `/austria`) shows that country's newest listings. The choice is kept in the `country` cookie (slug, one year, set by the browser on the country page) and the header links back to the list (`/?choose`). Cloudflare's `CF-IPCountry` highlights the visitor's country when the request really came through Cloudflare. City and category pages sit under the country (`/germany/berlin`, `/germany/cars`, `/germany/berlin/cars`; "Browsing and favorites").
- **Currency:** always the country's `default_currency`; no currency field in the form.
- **Open now:** Germany and Austria (EUR). **Seeded, closed:** Turkey (TRY), with SMS to Turkish numbers off.

**Opening another country** (checklist):
1. Regions and cities in `seed/locations/<cc>.ts` (GeoNames ids, coordinates, time zones; Persian names read by a native speaker; city slugs unique across all countries).
2. Postal codes: download `https://download.geonames.org/export/zip/<CC>.zip` and run `node scripts/import-postal-codes.mjs <CC>.txt <cc>`; add the code to `POSTAL_COUNTRIES` in `seed/postal/index.ts`. Check odd place-name formats first (Austria's city districts needed a rewrite).
3. Outline: `node scripts/build-country-outlines.mjs ne_10m_admin_1_states_provinces.geojson DE AT <CC>`.
4. Currency in `seed/currencies.ts` with its minor unit; prices and Stripe products in that currency.
5. Banned terms in the local language (`src/modules/moderation/`).
6. Terms and privacy cover the country. Outside the EU (UK, Switzerland, Turkey): their own data-protection law (UK GDPR, FADP, KVKK) and VAT on Pro payments.
7. If the country was kept out of SMS (`SMS_CLOSED` in `src/modules/users/phone-number.ts`), take it out.
8. Set it active in `seed/countries.ts` (and a `sortOrder`), run the tests, deploy, then run the seed on the server (below).

**Seeding on staging.** The seed is not part of the deploy. After a deploy whose migrations need new reference data (like 0008), run it once as `classifieds_owner` from a throwaway container on the `coolify` network, the same way as the first setup ("Database setup"): `npm run db:seed` with `MIGRATION_DATABASE_URL`. It runs in one transaction with the seed checks, and can be rerun. Until it has run, the country list is empty and posting finds no postal codes; old listings keep working.

## Events

Decided by the owner on Oct 18, 2026, after a look at what Iranians in Germany and Austria post (concerts and Persian party nights, Nowruz, Chaharshanbe Suri, Yalda and Sizdah Bedar, theatre, film, readings, language classes, student meetups, webinars) and at how Persian ticket sites (Volek, Tizo), Eventbrite and Meetup show events:

- **A section of its own, «رویدادها», each event a listing underneath** (`docs/schema.md`, section 8, "Events"). Photos, post-checks, contact, history and the outbox work for events as for listings; the event adds its dates, venue, links and details.
- **Pages:** `/{country}/events` (soonest first; today, this weekend, this week, this month; city, type, online only, free only; works without JavaScript), the event page `/e/{title}/{token}` (the Gregorian date in Persian with a small Jalali line, in the venue's time zone; event dates are Gregorian everywhere, decided by the owner on Oct 18, 2026, because Iranians abroad and the venues use it; venue and street address, "open in map" as a link to OpenStreetMap's search, the outline map, ticket button, organizer, languages, age, all dates of a series, share to Telegram and WhatsApp, schema.org `Event` markup), "add to calendar" at `/e/{title}/{token}/calendar` (an .ics file made on request), the form `/events/new` and `/my/events/{id}`, and "my events" `/my/events` (edit, pause, cancel, post again, delete). The country page links to its events.
- **Rules:** posting needs a verified phone (like listings), at most 5 new events a day per account; links only https and never through a URL shortener; the online link only for signed-in visitors; an event ends by itself after its last date and can't be renewed. Businesses are not required now; promoters get Pro pages and paid placement later.
- **Worker:** no new job for ending events (the listing expiry job does it). One job scheduler, `event-digest` on queue `events`, Mondays 08:00 Berlin time, writes one `event_digest.weekly` outbox event per country for the planned channel posting through n8n.
- **Cost and memory:** no new service and no new setting. Two small tables in PostgreSQL; one image size more in imgproxy (`poster`, 480×600, for the upright posters on event cards).

## Chat

Decided by the owner on Oct 18, 2026 (plan approved the same day with all five open points as recommended). A buyer couldn't reach a seller at all before this, which is why chat comes before search. Code in `src/modules/chat/`, `src/app/chat/` and `src/worker/chat.ts`; tables in `docs/schema.md`, section 10.

**What people get.** "Chat with seller" on listing and event pages opens `/chat/new?l=<token>` (listing, three quick first messages, the composer) or the existing conversation. The conversation is created with its first message, one per listing per buyer, and only verified phones can write (`canSendMessage()`, plus messaging sanctions). The inbox `/chat` merges buying and selling, newest first, with filters (all, buying, selling, archived), unread badges and "seen" ticks; the header (computers) and the bottom bar (phones, now five items) show how many conversations have unread messages. A conversation `/chat/{id}` fills the screen like a messenger: my messages at the end side (left in RTL), the other person's at the start side, Jalali day dividers, ticks, a fixed safety tip, archive, block and report. Links are shown as text, never as links. Everything works without JavaScript as plain pages and form posts.

**Instant delivery: server-sent events through Valkey.**
- `GET /chat/stream?c=<conversation>` (or no `c` on the inbox) is a Next.js route handler. Every web process holds **one** Valkey subscriber connection (`src/modules/chat/hub.ts`) and subscribes to `chat:user:<id>` while that user has a stream open. Whoever commits a change publishes it: the web after a message or a read, the worker after a listing closed or reopened its conversations. Several app instances work as they are.
- Events: `message` (with `id:` = the message id), `read` (the other side's watermark, for the ticks), `conversation` (closed or reopened), `unread` (the badge), `reload`, and `ping` every 20 seconds. The ping keeps Cloudflare's 100-second idle limit away and refreshes the presence key.
- Nothing is missed: the browser's EventSource sends `Last-Event-ID` when it reconnects (`?after=` on the first connect). The stream subscribes first, then replays the conversation's messages after that id (keyset on `created_at, id`, at most 100; more means `reload`), then flushes what arrived meanwhile; the browser drops duplicates by id. Sends to one conversation lock its row and take `clock_timestamp()` to the millisecond after the lock, so within a conversation the order of `created_at` is the commit order.
- The browser (`src/app/chat/use-chat-stream.ts`) closes the stream 30 seconds after the tab is hidden and reopens it when visible, reconnects at once when it comes back online, and after 50 seconds without even a ping (a connection that died without closing). After three failures in a minute, or a refusal, it falls back to reloading the page data every 20 seconds while visible and tries the stream again after 5, 10, 20… up to 60 seconds. It never reloads while offline: Next.js would fall back to a full page load, which fails.
- Each stream ends after 10 minutes and the browser reconnects, so no connection lives forever. Limits per web process: 2,000 streams (then 503) and 5 per user (then 429); both make the page fall back. A stream holds **no** database connection.
- Response headers: `text/event-stream`, `Cache-Control: no-cache, no-store, no-transform`, `X-Accel-Buffering: no` and `Content-Encoding: none` (stops Next.js's compression from holding events back). CSP needs nothing new (`connect-src 'self'`).
- "Has the chat open" = a visible page with a live stream: a Valkey sorted set `chat:viewing:<user>:<conversation or *>` (member: the stream, score: its expiry, 60 seconds, refreshed by every ping). The inbox counts as viewing every conversation.

**Notices: Telegram first, email as fallback** (`src/modules/notifications/chat-notice.ts`, `src/worker/chat.ts`).
1. Sending writes `message.sent` to the outbox (not for withheld messages). The worker's `chat-notify` job checks at once: receiver active, notices on (`users.notification_prefs.chat`, `/account/notifications`), conversation open, message unread, receiver not viewing. If a notice may be needed it schedules a second check **20 seconds** later; someone who reads within that time gets nothing.
2. The second check repeats all of that, picks the channel (Telegram when `telegram_user_id` is set and the bot isn't marked unreachable, else email) and takes the **debounce** slot `notice:<conversation>:<receiver>`: at most one notice per conversation per **5 minutes** on Telegram, **15 minutes** by email.
3. The notice: «پیام تازه از {name} درباره «{title}»» with buttons to open the conversation (`APP_URL/chat/{id}`) and the notification settings. **No message text**, so scam text and personal data stay out of Telegram and email.

**Does the bot scale?** The bot has two independent halves:
- *Incoming* (phone verification, `/start`, block and unblock) is one long-polling loop in the worker. Its load is tiny and doesn't grow with chat.
- *Outgoing* notices are plain `sendMessage` calls from the BullMQ queue `telegram-send`. Its limiter lives in Valkey, so it holds for every worker process together: **one message every 40 ms, 25 a second**, which keeps any one-second span at 26 or fewer, under Telegram's limit of about 30 (a plain "25 per second" window could let 50 through at its edge; the test caught that). That is 90,000 notices an hour.
- **429 (flood control):** the job reads `parameters.retry_after`, pauses the whole queue for that long (`worker.rateLimit()`) and goes back to waiting with `RateLimitError`, without using up an attempt. Tested against a fake Telegram: one 429 with `retry_after: 1`, the next call a second later, delivered once.
- **403 (bot blocked, account deleted) or 400 "chat not found":** the account is marked unreachable (`tg:unreachable:<telegram id>`, 30 days) and the notice goes by email. The bot also hears `my_chat_member` (blocked or unblocked) and clears the mark when the person writes to it again. After 30 days Telegram is simply tried again.
- **Other errors:** 10 attempts with exponential backoff from 5 seconds (about 45 minutes in all); after the last one the notice goes by email. Email (`email-send`, one every 100 ms, under SES's rate) has 10 attempts from 10 seconds. Failed jobs are kept (1,000 per queue) and logged. Nothing is dropped.
- Telegram also limits one chat to about one message a second; the debounce keeps each conversation far below that.
- Beyond 25 a second, Telegram's paid broadcasts allow up to 1,000 a second; that would be a setting on the same queue. Each environment keeps its own bot (production gets one at launch).

**Phone number** (approved Oct 18, 2026). The seller chooses per listing with the form's switch «شماره تلفنم هم نمایش داده شود», off by default (chat only). Revealing it needs a signed-in visitor **with a verified phone**, and is limited per visitor (10 an hour, 30 a day) and per IP (40 an hour, 100 a day). Every reveal is written to `audit_log` (`listing.phone_revealed`: who, which listing, IP and browser; the IP is scrubbed after 90 days, the row deleted after 2 years). Code: `src/modules/listings/phone-reveal.ts`.

**Scam guard** (`src/modules/chat/risk.ts`). On the normalized text (Persian digits, Arabic letters and stray ZWNJs can't hide anything) the detector sets `messages.risk_flags`:

| Flag | Found by |
| --- | --- |
| `link` | URLs, `www.`, bare domains with common endings, shorteners, `t.me` / `wa.me` |
| `iban` | ISO 13616 pattern with the mod-97 check (no false hits on prices or postal codes) |
| `payment_request` | بیعانه، پیش‌پرداخت، واریز، کارت به کارت، شماره کارت، PayPal friends and family، Western Union، gift cards، crypto، تتر …; a 16-digit card number that passes Luhn |
| `off_platform_contact` | تلگرام، واتساپ، سیگنال، اینستاگرام، ایمیل …, email addresses, `@usernames`, messenger links |
| `phone_number` | Numbers libphonenumber accepts: international ones, and national ones starting with 0 for DE, AT and IR |

The receiver sees a Persian warning per flag under the message; the sender sees nothing. **Accounts younger than 7 days can't send a message with a link or an IBAN**; the composer keeps the text and explains why.

**Limits** (Valkey, `src/modules/chat/limits.ts`):

| What | Limit |
| --- | --- |
| Messages | 20 a minute and 300 an hour per user |
| New conversations | 30 an hour per user; accounts under 7 days 5 an hour and 15 a day |
| Reports | 20 a day per user |
| Blocks | 50 a day per user |

**Blocking and reports.** The blocker can't write until they unblock. The blocked person's messages are stored with `withheld = true`: never shown to the blocker (not even after an unblock), not counted, no live event, no notice, no inbox entry; to the sender they look sent and never "seen". Reporting a message (scam, harassment, spam, offensive, personal data, other) writes `reports.message_id` (one open report per person per message) and a `report.created` outbox event for the phase-4 queue and, later, the n8n admin alert; the dialog offers to block too.

**Conversations follow their listing.** A listing sold, deleted, expired or taken down closes its open conversations with a system message (stored as a code, the text is in `fa.ts`); renewed or live again reopens them, unless a participant deleted their account. Locked conversations (moderation) stay locked.

**Retention and export.** `chat-retention` (queue `retention`, 02:30 UTC) deletes conversations 90 days after a participant deleted their account, except those with a message a report or decision still points at. `exportChatData()` returns what the user can see of their conversations, for the data-export job when it is built.

## Browsing and favorites

Decided by the owner on Oct 18, 2026 (plan approved with the four open points as recommended: cache headers now and the Cloudflare rule before launch, every filtered page `noindex`, a 2-hour "near me" token, a shipping filter). Everything here runs on PostgreSQL + PostGIS, behind the `search` module (`src/modules/search/`); keyword queries (since Oct 22, 2026) go to Meilisearch behind the same interface ("Keyword search and saved searches"). Pages in `src/app/[country]/_browse/`.

**Addresses.** Latin slugs from the seed; city and category slugs never clash, and a seed check keeps them, `events` and the filter parameters apart.

| Path | Page |
| --- | --- |
| `/{country}` | The country's listings (as before) |
| `/{country}/{category}` | A category in the country (`/germany/cars`); the old `?category=` redirects here (308) |
| `/{country}/{city}` | A city (`/germany/berlin`) |
| `/{country}/{city}/{category}` | A category in a city (`/germany/berlin/cars`) |
| `/{country}/{city}/events` | A city's events; the old `/germany/events?city=berlin` redirects here |

An events category in a browse address goes to the events pages. City pages show listings whose city is that city, which includes towns whose postal codes lead to it (`postal_places.location_id`).

**Filters** (`src/modules/search/filters.ts`). Price (whole units of the country's currency in the address, compared in minor units; hidden where `price_mode = 'none'`), place (a city, or a postal code alone or with 5 / 10 / 25 / 50 km), "ships", and the category's own fields marked `is_filterable` (never free text). For a parent category only the fields all its listings have. The address is short and always in the same order: `?sort=price_asc&price=..15000&brand=bmw,audi&year=2015..&mileage_km=..100000`; ranges `a..b`, choices comma-separated in the order of the options, yes/no `=1`. The plain GET form (no JavaScript) sends `year_min`, repeated checkboxes and empty fields; the page answers with one redirect to the canonical address. Each field is checked with Zod against the definitions; anything unknown, retired, not filterable here, out of the field's own range, reversed, from another category or a model without its make is dropped with that redirect and never reaches SQL. Selects match any chosen value; multi-selects match any, except checklists marked `validation.filter: 'all'` (`features`, `car_extras`).

**Query** (`src/modules/search/browse.ts`). Choices and yes/no fields as `attributes @> '{…}'` (the GIN index); numbers and dates through a guarded cast and text order. Sorting: newest (`ranked_at`), price up or down (free counts as 0; listings without a price last in both orders), distance when a radius is on (`point <-> $p`, GIST). Keyset paging on `(sort key, id)` with an opaque cursor checked against the sort, 24 a page; the total is counted up to 1,001 («بیش از ۱٬۰۰۰ آگهی»). Category and city counts are cached per process for a minute.

**"Near me"** (`src/modules/search/near.ts`, `_browse/near-me.tsx`). Only after a tap and the browser's permission. The browser snaps its position to the ~500 m grid before sending it to a server action; the server snaps again, checks it is within 100 km of a city of the page's country, and returns the cell encrypted with AES-256-GCM (key derived from `AUTH_SECRET` with HKDF, no new setting), valid 2 hours. The page moves to `?sort=distance&near=<token>&r=10`, so paging and filters work with plain links. The address carries no readable position (Cloudflare logs, history, shared links), a changed token fails the GCM tag, an expired one shows «… منقضی شده است», and the position is never stored or logged (Traefik has no access log; a test checks nothing is logged). Distances are whole kilometres to the listing's stored, already rounded point («کمتر از ۱ کیلومتر», «حدود ۳ کیلومتر»); no response contains coordinates. Without JavaScript the button doesn't appear and the postal code does the same job. A radius crosses city borders, so a postal code or "near me" moves a city page to the country's address.

**Favorites** (`src/modules/listings/favorites.ts`). Signed-in users only (no verified phone needed), active listings only and never your own, at most 1,000 per account and 60 saves a minute. The ♡ is a form with a server action, so it works without JavaScript. Logged out, the action keeps the listing's public token in an HTTP-only cookie (`pending_favorite`, SameSite=Lax, 30 minutes) and goes to `/login?next=<page>`; the login action saves it once and returns. «نشان‌شده‌ها» at `/my/favorites` (header ♡ on computers, the account page) keeps listings that went away, dimmed, as «دیگر در دسترس نیست»; paused, sold and expired ones stay linked. The seller sees «♡ ۴ نفر نشان کرده‌اند» on "my listings" and on their own listing and event pages; `favoriteCounts()` only counts the asking seller's listings, and the number is never in anyone else's page. No outbox event yet (price-drop alerts would add one).

**SEO.** Titles and descriptions in Persian, canonical to the plain page, `noindex, follow` for any filter, sort, cursor or place and for empty pages. JSON-LD `BreadcrumbList` (country › city › categories) and `ItemList` on browse pages. Sitemaps (`src/modules/search/sitemap.ts`): the worker rebuilds them every hour and once at start (queue `seo`) into `sitemap_files`; `/sitemap.xml` is the index, `/sitemaps/<country>.xml` the plain browse and events pages that have something on them, `/sitemaps/<country>-listings-<n>.xml` every active listing and event page (50,000 per file). With `SEARCH_INDEXING` off (staging) the sitemap addresses answer 404 and `robots.txt` says `Disallow: /`; with it on, `robots.txt` names the sitemap and keeps crawlers out of `/my/`, `/account`, `/chat`, `/login` and the posting forms.

**Caching** (Cache Rule since Oct 19, 2026, approved by the owner). `src/proxy.ts` sends `Cache-Control: public, max-age=0, s-maxage=60` on browse pages (`/{country}` with up to two more segments, the city and country events lists included) for GET and HEAD when nothing personal is in the request, and `private, no-store` when there is a session cookie, the `view` cookie, or a postal code or "near me" in the address (checked: Next.js keeps the header). The `country` cookie no longer counts: the proxy renders every browse page as if its own country were chosen (it sets the request's cookie; `RememberCountry` saves the same value in the browser anyway), so the header's country chip is the same for everyone. Checked on staging: the HTML for no cookie, `country=austria` and `country=germany` is identical apart from the nonce.

The Cache Rule (`http_request_cache_settings`, ruleset `d9f850946905400c8344f3cb069834fc`, rule ref `staging_browse_logged_out`; the Free plan accepts the cookie and header conditions):

```
http.host eq "staging.peydoo.com"
and not starts_with(http.request.uri.path, "/_next/")
and not starts_with(http.request.uri.path, "/api/")
and not http.cookie contains "better-auth.session_token"
and not http.cookie contains "view="
and not http.request.uri.query contains "_rsc"
and not any(lower(http.request.headers.names[*])[*] eq "rsc")
```

Action: eligible for cache, edge TTL "use the Cache-Control header if present, bypass if not" (`bypass_by_default`), browser TTL from the origin. So the origin decides what is shared: only responses marked `public` are kept, and Next.js's `private, no-store` on every other page keeps them out. The cookie conditions matter for lookups: without them a signed-in visitor would be served the logged-out copy. The cookie match is a substring (`matches` is a Business feature), so `view=` also skips the cache for any other cookie ending in `view`; that only costs a cache hit. React Server Components requests are left out by the rule, not by the proxy: Next.js 16 removes the `RSC` header and the `_rsc` parameter before the proxy runs, and Cloudflare ignores `Vary`. Without that, one request with `RSC: 1` would store Next.js's 307 to `?_rsc` under the page's address for every visitor. Verified Oct 19, 2026 on `/austria`: logged out MISS, then HIT; after 60 s EXPIRED, then HIT again; with either session cookie or `view=list` DYNAMIC (`private, no-store`); `country=germany` HIT; `RSC: 1` and `?_rsc=` DYNAMIC, and a plain request right after the `RSC: 1` one was still the 200 page; POST DYNAMIC; a postal code BYPASS; `/`, `/login` BYPASS. A cached copy carries the CSP header and the HTML from the same render, so the nonce in both always matches.

**The nonce on cached pages** (decided Oct 19, 2026). Every visitor of one cached copy gets the same nonce, readable by anyone who loads the page, for at most 60 seconds; then the next render makes a new one. Every other page keeps a fresh nonce per request. Accepted, because the nonce only helps an attacker who already has an injection on that exact copy that the cache key doesn't capture: anything rendered on the server (a listing title, a query parameter) is in the page before its nonce is drawn, and a different address is a different copy with a new nonce. What remains is DOM-based XSS (the browser itself writing attacker data, say from `location.hash`, into the page), and browse pages have no such sink: their client components only set the `country` and `view` cookies and run "near me", and the one `dangerouslySetInnerHTML` is the JSON-LD with `<` escaped. `'strict-dynamic'` with no `'unsafe-inline'` stays. Keep it that way: no `innerHTML` or HTML from the client on browse pages. Not chosen:
- Hashes instead of a nonce: Next.js 16 streams its RSC payload in inline `<script>` tags whose content differs per page and per render, and it has no hash support. Hashing them would mean rewriting every HTML response, which the proxy can't do (it never sees the body). `experimental.sri` covers only the external chunks.
- A Cloudflare Worker that swaps in a fresh nonce on every cached response (HTMLRewriter): the strongest option, but code on every browse request, outside Coolify, with a Free limit of 100,000 requests a day. Worth it only if browse pages ever get a client-side HTML sink.
- No nonce on browse pages (`'unsafe-inline'`): makes any injection there work.
- No edge cache: keeps a nonce per request, but every logged-out page view renders on the 4 GB server.

**Purged after each deploy, not on listing changes.** After a deploy, a cached copy would point at JavaScript chunks and server action ids of the previous build (the ♡ and "near me" would fail until it renews), so `classifieds-web` purges its host once the new container serves alone ("App deployment", "Cache purge after each web deploy"). Listing changes are not purged: 60 seconds is the bound there. A purge from the worker on listing changes doesn't fit cleanly (filtered and paged addresses can't be purged by URL). A browser tab left open on the old build still has the old server action ids until it reloads; the purge doesn't change that.

Sitemaps have no nonce and send `public, max-age=3600`; `robots.txt` gets Next.js's `public, max-age=0, must-revalidate` (Cloudflare revalidates it every time).

**Speed** (`scripts/generate-listings.ts` and `scripts/explain-browse.ts`, scratch database only, never staging): with 5,000 and with 50,000 generated listings (85% active, valid attributes from the real definitions, weighted by city size and category), the country, city, category and city-plus-filter pages ran in under 1 ms on their partial indexes; attribute filters across a whole country used the GIN index (4–7 ms at 50,000); postal code only went from 17 ms to 0.05 ms with the new partial index (migration 0012); a 10–50 km radius by distance took 3 ms at 5,000 and about 20 ms at 50,000. Two known slow spots at 50,000: price order over all categories of a country (50 ms; within a category 2 ms), and the category and city counts (30 ms, hence the one-minute cache). Neither needs an index at today's volume; add an expression index for the price order if it is ever used much.

## Keyword search and saved searches

Built Oct 22, 2026 (roadmap step 4). Plan approved by the owner with the six points as recommended: Meilisearch at 384 MB with light indexing on the CX23, no backup of the index, keyword pages `noindex` and not edge-cached, matching events as a strip, alerts at most every 15 minutes per search plus a daily digest and 10 a day per user, facet counts only where they are cheap.

**The rule.** PostgreSQL stays the source of truth and renders every card. Meilisearch only answers which listing ids match a keyword, in which order (`src/modules/search/keyword.ts`); the page loads those listings from PostgreSQL with `status = 'active'` (`cardsByIds()` in `browse.ts`). A stale index entry can never show a sold listing, an old price or anyone's data. Browsing without a keyword is unchanged and never touches Meilisearch.

**Service** (`classifieds-meilisearch`, Coolify application from the image, like imgproxy):
- Image `getmeili/meilisearch:v1.54.3` (pinned; 1.55.0 was 10 days old). No domain, no published port, only on the `coolify` network. Data on a Coolify volume at `/meili_data`. Coolify health check on `/health`, port 7700 (the image has curl and wget).
- **"Consistent container name" is on** (`is_consistent_container_name_enabled`): the container is named `9cmjl5ncqvcy3m88q2eonrxd` and reachable by that name, and a redeploy stops the old container before starting the new one. Without it the only DNS name carries the deploy's timestamp (`…-20261022T083850`) and changes every deploy, and a rolling update would run two Meilisearch processes on one data volume. `--network-alias` in the custom docker options is ignored by Coolify 4.4.7. A redeploy therefore means a few seconds without keyword search (the PostgreSQL fallback covers them).
- Memory limit **384 MB**. `MEILI_MAX_INDEXING_MEMORY=128Mb` (the default is two thirds of the *host's* RAM, which inside a 384 MB container is an OOM kill waiting to happen), `MEILI_MAX_INDEXING_THREADS=1`, `MEILI_ENV=production`, `MEILI_NO_ANALYTICS=true`, `MEILI_LOG_LEVEL=WARN`. Index settings keep it light too: only the declared fields are searchable, filterable or sortable, word proximity per field (`proximityPrecision: byAttribute`), no facet search, `maxTotalHits` 1,001, and the worker deletes Meilisearch's finished tasks older than 7 days every night.
- Measured on a scratch stack: idle with staging's few listings 28 MB; a full rebuild of 42,575 active listings (50,000 generated) in 8.2 s peaking at 151 MB and settling at 99 MB, 143 MB of disk; a keyword search with category counts over them in ~12 ms.
- **Keys** (`src/modules/search/keys.ts`, created once with `scripts/meili-keys.ts`, which prints them): the master key lives only in `/root/.secrets/meilisearch.env` and on the Meilisearch service. `classifieds-web` gets `MEILI_SEARCH_KEY` (action `search`, index `listings` only); `classifieds-worker` gets `MEILI_WRITE_KEY` (documents, settings, indexes, swap, tasks; all indexes, because an index swap's task belongs to no index and a key limited to `listings` can't see it; this Meilisearch serves nothing else). Key values derive from their fixed uids and the master key, so a restored master key gives the same keys. Both apps also get `MEILI_URL` (`http://<uuid>:7700`). Without them keyword search runs on PostgreSQL and the worker keeps no index.

**Backup and restore: none for the index, on purpose.** Everything in it is rebuilt from PostgreSQL (backed up nightly), and its settings and synonyms are in code. To restore, start an empty Meilisearch (or delete the `listings` index) and restart `classifieds-worker`: at start it checks the index (`indexState()`: missing, outdated settings, an older document shape, or a count that differs from PostgreSQL's active listings) and rebuilds it. The rebuild also runs every night at 04:00 UTC.

**Keeping the index in line** (`src/worker/search.ts`, `src/modules/search/sync.ts`): queue `search-sync`, concurrency 1, on every `listing.*` outbox event except `created`, and on `event.published|changed|cancelled`. The job re-reads the listing and writes it (active) or removes it (anything else), so repeated, late or out-of-order events do no harm; account erasure and expiry already write listing events. A rebuild builds `listings_new` in batches of 500 and swaps it in atomically, and runs on the same queue, so single writes wait and then correct whatever changed during it. A failed write retries 8 times with backoff; anything still missed is repaired by the nightly rebuild.

**Documents** (`src/modules/search/documents.ts`): id, country, leaf category, city, postal code, the stored (already rounded) point, price (free 0, none absent), shipping, kind, whether it is an event, `ranked_at`, the category's filterable fields (dates as `YYYYMMDD` numbers), and searchable text in this order: title, the category path's Persian names, the Persian labels of chosen options (a make), city/place/district, description. All text is the normalized text (`normalizePersian`), and queries are normalized the same way. No user, email, phone or token.

**Persian.** Arabic ي/ك/ى, Persian and Arabic digits and diacritics are folded by `normalizePersian`; Meilisearch's own tokenizer (locale `pes`) splits at ZWNJ and joins split words, so «کتاب‌ها», «کتابها» and «کتاب ها» find each other (tested against the real engine). Synonyms in `src/modules/search/synonyms.ts`, two-way groups (ماشین/خودرو/اتومبیل, موبایل/گوشی/تلفن همراه, لپ‌تاپ/نوت‌بوک/laptop, iPhone and car makes in both scripts, Wohnung, Kaution…); words with a second everyday meaning stay out (کار, هندی, موتور). A short stop-word list, without «ها»/«های» (they would break the ZWNJ join). Every word must match (`matchingStrategy: all`), typos allowed from 5 letters, never in numbers. A native speaker can extend the synonym file; the worker applies changed settings at its next start by rebuilding.

**Pages.** `q` on every browse page: `/germany?q=پژو ۲۰۶`, `/germany/berlin/cars?q=…&price=..5000&sort=price_asc`. It combines with every filter, the postal radius and "near me", and with the sorts; «مرتبط‌ترین» (relevance, newest first among equals) is the default with a keyword. The keyword is kept as typed (trimmed, at most 10 words and 100 characters). A search box in the header on computers (searches the chosen country) and on browse pages (searches within the page's city and category and keeps its filters, with a link to widen to the whole country); on phones the header has a search button that leads to the country page's box. Plain GET forms, no JavaScript needed. Paging by an offset cursor tied to the sort, 24 a page, up to the 1,001 hits Meilisearch counts. Up to four matching events of the country appear above the results (not on category pages). Per-IP limit: 60 keyword searches a minute (`KEYWORD_LIMIT`); over it the page says so instead of searching.
- **Fallback:** if Meilisearch is unset, down or slower than 2 s, the same page comes from PostgreSQL (every word or a synonym in the normalized title or description, ZWNJ ignored, newest first) with a notice. Tested by stopping Meilisearch.
- **SEO and caching:** keyword pages are `noindex, follow` with the plain page as canonical, and `private, no-store` in the proxy (`q` joins `near` and `postal`), so Cloudflare never keeps them: long-tail queries are rarely asked twice, and a shared copy would mostly cache typos.
- **No prefetching of keyword addresses** (`src/components/browse-link.tsx`): Next.js fetched ~20 linked keyword pages ahead on every keyword page view (categories, sorts, chips), each a Meilisearch query counted against the visitor's limit. Found in headless Chromium.
- **Counts per option.** With a keyword they come from the same multi-search: categories (without the category and its fields), and each choice or yes/no field without its own filter. Without a keyword they are **not shown**: measured on 50,000 generated listings, a count of every option of a plain category page took 14 ms (phones) to 82 ms (cars, 11 fields) per page view, over the 10 ms bar; with a city or price 3–13 ms. Revisit with the CX33 or by sending filtered browse pages with counts to Meilisearch.

**Saved searches** (`src/modules/search/saved.ts`, `/my/searches`). «ذخیره این جستجو» on any browse page narrower than a whole country (a keyword, a filter, a city or a category). The form posts the page's path and canonical query, which are read back exactly as the page reads them; anything else is refused. Logged out it goes through sign-in back to the same page (no cookie keeps the search meanwhile, so the privacy policy's cookie list is unchanged), and one more tap saves. "Near me" is never saved (the position is never stored; the page says to use a postal code); a postal radius stores the postal area's centre. At most 20 per user and 30 saves an hour; the same search in another sort is one search. `/my/searches` (also linked from the account page and the notification settings): open, rename (60 characters), فوری / روزانه / خاموش, delete. Every write checks the owner.

**Alerts** (`src/modules/search/alerts.ts`, `src/worker/search-alerts.ts`, `src/modules/notifications/search-alert.ts`):
- Once a newly published listing is in the index, queue `search-alerts` finds the searches whose page would show it (browse SQL plus `id = …`; keywords through Meilisearch restricted to that id), among searches saved before the listing went out, of other active users with alerts on. Each match is a row in `saved_search_hits`, once per pair.
- Instant searches: the first notice 2 minutes after the match (time for the post-checks and for more matches to join), then at most one every 15 minutes per search, gathering what came meanwhile into one message. Daily searches: one message at 18:00 Berlin time, which also sends instant matches whose job was lost for over an hour. At most 10 messages a day per user; over that, matches wait for the next day. Matches whose listing went away before the notice are dropped. Matches are deleted after 30 days.
- Sent through the chat's `telegram-send` and `email-send` queues (one shared limiter): Telegram when the account is linked to the bot and the bot can reach it, else email; a blocked bot falls back to email. Telegram: a line with the count and the search's name, a button per listing (up to 5), «دیدن همه نتایج» and «جستجوهای ذخیره‌شده». Email: the same as a list, plus a link that turns that search's alert off without signing in (`/alerts/off?t=<random token>`; opening it changes nothing, its button does) and `List-Unsubscribe` with `List-Unsubscribe-Post` for mail apps' own button (RFC 8058, `POST /alerts/off/one-click`).
- Switch per user in `/account/notifications` («وقتی آگهی تازه‌ای با جستجوهای ذخیره‌شده‌ام آمد، خبرم کن», `notification_prefs.savedSearches`, on unless turned off), and per search on `/my/searches`.
- Checked end to end on the scratch stack: a search saved, a matching listing published through the outbox, the email arrived 2 minutes later with the listing, the search link and both unsubscribe forms; the one-click POST turned the alert off.

**When the server grows (CX33, 8 GB):** Meilisearch limit 1 GB, `MEILI_MAX_INDEXING_MEMORY=384Mb`, `MEILI_MAX_INDEXING_THREADS=2` (environment only, no code), and reconsider counts per option on browse pages without a keyword.

## Legal pages

Built Oct 21, 2026 (roadmap step 2, `docs/progress.md`).

- **Texts:** Persian in `src/messages/fa.ts` under `pages` (a separate export, so client bundles don't carry them), the binding German terms and privacy policy in `src/messages/legal-de.ts`. Both share `LegalDoc` (`legal-types.ts`) and the same section ids; `tests/legal.test.ts` fails if they drift. Rendered by `src/components/legal-doc.tsx`. Change a fact (period, service, cookie) in both languages together with the code.
- **Operator:** `src/messages/operator.ts` (Impressum, controller, terms §1.1). Public, the same in every environment and part of legal text, so a reviewed commit rather than `.env`.
- **Contact address:** `support@peydoo.com` through Cloudflare Email Routing (free) to the owner's inbox `reza.khodamehri@gmail.com` (already a verified destination in the account). Turned on Oct 21, 2026 through the API after the owner gave the token Email Routing rights: rule "support to owner". It added MX `route1–3.mx.cloudflare.net`, SPF `v=spf1 include:_spf.mx.cloudflare.net ~all` and DKIM `cf2024-1._domainkey` on the apex; SES keeps `bounce.peydoo.com` and DMARC is unchanged. Mail to any other address at peydoo.com is rejected (no catch-all). The token can't read the routing log (no zone analytics); check delivery in the inbox or the dashboard (Email Routing → Activity log).
- **Moderation grounds:** `policy_ground` is `terms-<section>` (`policyGround()`, `groundSection()` in `src/modules/moderation/terms.ts`). A new automatic check names a section that exists in the terms.
- **Drafts:** `draft: true` shows the banner. Set it to false once the lawyer has approved, and update `updated`.
- The page paths are in the proxy's `NOT_BROWSE` and in `RESERVED_SLUGS`.

## Brand and design

Approved by the owner on Oct 17, 2026 (plan: https://claude.ai/artifact/TgjPF24NJujB7bQAYnz3AK).

- **Name:** پیدو (Peydoo). Under it: «نیازمندی‌های ایرانیان خارج از کشور». Slogan: «هر چی بخوای، تو پیدو پیداست». All in `src/messages/fa.ts` (`site`).
- **Logo:** option A, a turquoise rounded square with a white magnifier and a saffron dot. React: `src/components/logo.tsx`; favicon `src/app/icon.svg`. The PNG icons, `favicon.ico` and the share image (`opengraph-image.png`) are drawn by `scripts/brand-assets.mjs` in the Playwright image (command in the file); run it again when the logo or slogan changes. `src/app/manifest.ts` is the "add to home screen" manifest.
- **Colours:** tokens in `src/app/globals.css`. `brand-*` (Persian turquoise, primary `brand-700` #0B6E77), `saffron-*` (accent, dark text only), and `neutral-*` redefined with a turquoise tint. Every text colour passes WCAG AA on white and `neutral-50`. Light only; dark mode later redefines the same tokens.
- **Type and icons:** Vazirmatn only (self-hosted). Icons are our own line drawings in `src/components/icons.tsx` (no icon font or CDN); `categoryIcon()` maps a top category's slug to its icon. Flags of open countries are in `src/components/flag.tsx`; add one when a country opens.
- **Layout:** header with the logo, the chosen country and (on computers) the actions; on phones a bottom bar (`src/components/bottom-nav.tsx`) with listings, post, my listings and account; footer. Listing cards come from `src/components/listing-card.tsx` (grid or list); new list pages (cities, search, events) reuse it.
- **Country page:** a category and everything under it is `/{country}/{category}` (since Oct 18, 2026; `?category=<slug>` redirects there); categories sit in a sidebar from the `lg` breakpoint and in a row plus a sheet on phones. `?view=grid|list` switches the layout and is remembered in the `view` cookie.
- **Photo viewer** (`src/app/v/[slug]/[token]/gallery.tsx`): a native `<dialog>` with native horizontal scrolling and scroll snap, so the strict CSP needs nothing new. Tap or click to open, swipe or arrow keys to move, Esc, the close button, a click beside the photo or the back button (it adds `#photos` to the address) to close. Without JavaScript each photo links to its large image.
- **Country fixed when posting:** `postingCountry()` in `src/modules/listings/posting-country.ts`. The listing's own country; for a new listing the country chosen on the home page, else the saved place's. The form shows it as fixed text with a "change country" link to `/?choose` (only before the listing has a country). The save action decides the country on the server and refuses a form that names another; `saveListing()` refuses any other country for a listing that has one (`locked`).

## Memory budget

**Now (CX23, 4 GB, staging):** limits, and use measured on Oct 16, 2026 right after the first app deploy (idle, after 20 page loads).

| Service | Limit | Measured |
| --- | --- | --- |
| Coolify (app, db, redis, proxy, sentinel) | 600 MB | ~420 MB |
| PostgreSQL + PostGIS | 768 MB | 69 MB |
| Valkey | 128 MB | 3 MB |
| Next.js app | 768 MB | 76 MB |
| Worker | 384 MB | 34 MB |
| Migrate (idle after the deploy call) | 128 MB | under 1 MB |
| imgproxy | 256 MB | see "Posting" below |
| Meilisearch (since Oct 22, 2026) | 384 MB | 28 MB idle at staging size; 151 MB peak rebuilding 42,575 listings |
| System reserve | ~1 GB | |

Whole server at that moment: 1.95 GB used, 1.87 GB available, 214 MB of swap used (pushed out during the image builds). About 1 GB of the "used" figure was Claude Code sessions running on the server, not the product. Close idle sessions before heavy builds.

Places (Oct 17, 2026): `postal_places` adds a few MB to PostgreSQL; no new service, and the outline map is part of the pages.

Events (Oct 18, 2026): two small tables and one BullMQ queue with a weekly job; no new service.

Chat (Oct 18, 2026): no new service and no new setting. Measured against the production build on a scratch stack: 500 open chat streams raised the web process from 77 MB to 131 MB (about 110 KB per stream with Node's heap growth) at 0% CPU between pings; Valkey grew by 0.2 MB and holds one subscriber connection per web process; no stream holds a database connection. The worker runs four more queues (four more blocking Valkey connections) at about 52 MB in all. On today's 768 MB web limit that is room for several thousand streams; the per-process cap is 2,000.

Browsing and favorites (Oct 18, 2026): no new service and no new setting. One small table (`sitemap_files`) and one BullMQ queue (`seo`, hourly). Right after the deploy: web 122 MB, worker 75 MB, PostgreSQL 130 MB; 1.33 GB available. Building the sitemaps for 50,000 listings took 1.2 s and about 220 MB in a standalone script (tsx included), well inside the worker's 384 MB.

Keyword search and saved searches (Oct 22, 2026): one new service, Meilisearch at 384 MB with 1 indexing thread and 128 MB of indexing memory ("Keyword search and saved searches"). On the scratch stack after the browser checks: web 119 MB, worker 51 MB, Meilisearch 28 MB. Two new worker queues (`search-sync`, `search-alerts`), each one more blocking Valkey connection.

**After resize (CX33, 8 GB):** the table in `docs/architecture.md`, with Meilisearch at 1 GB to start.

## Monthly cost now

| Item | Net | Incl. 19% VAT |
| --- | --- | --- |
| CX23 server | €5.49 | €6.53 |
| Storage Box BX11 | €3.20 | €3.81 |
| Cloudflare R2 (within free tier) | €0 | €0 |
| **Total** | **€8.69** | **€10.34** |

After the resize to CX33: +€3.00 net.

## Security notes

- The Hetzner and Cloudflare API tokens were shared in chat. They are stored only in `/root/.secrets/infra.env`. The owner chose to keep them as they are.
- The Hetzner token covers the whole project, including the n8n and Supabase servers. Treat it as a key to all of them.
- The Cloudflare token can edit DNS and manage R2. Since Oct 17, 2026 it can also edit zone settings and WAF rules on `peydoo.com`. It can read `taskpilot.dev`'s zone settings too, so check its zone scope in Cloudflare if it should only cover `peydoo.com`. It cannot edit its own permissions. Since Oct 19, 2026 it can also reach the Cache Rules phase (granted by the owner).
- `CLOUDFLARE_CACHE_TOKEN` in `/root/.secrets/infra.env` (`peydoo-cache-rules`, made Oct 19, 2026 with the token above, approved by the owner): Cache Settings read and write and Zone read on `peydoo.com` only. Use it for Cache Rules.
- Coolify admin login: `/root/.secrets/coolify-admin.env`. Turning on two-factor authentication in Coolify is recommended.
- Coolify's API is on, limited to the `coolify` Docker network, with one deploy-only token (`/root/.secrets/coolify-api-tokens.env`). Whoever has it can start or cancel deployments of any application, nothing more.
- The `classifieds_owner` password is in the env of `classifieds-migrate` (stored encrypted by Coolify), never in web or worker.
- Database passwords: `/root/.secrets/postgres.env` (root-only, included in the nightly backup).
- Accounts: `/root/.secrets/auth.env` holds `AUTH_SECRET`, `PHONE_CODE_SECRET`, the SES SMTP credentials and the staging bot token, and the same values are in Coolify. A new `AUTH_SECRET` logs everyone out; a new `PHONE_CODE_SECRET` only invalidates SMS codes in flight.
- R2: `/root/.secrets/r2.env` (staging read-write and read-only S3 credentials) and `/root/.secrets/imgproxy.env` (URL signing key and salt), both also in Coolify. A new imgproxy key or salt breaks every image URL in cached pages until they are rendered again.
- Since Oct 17, 2026 the Cloudflare token can also create API tokens (granted by the owner to create the R2 tokens). That makes it able to mint tokens with any permission in the account; narrow it again in Cloudflare if that isn't wanted.
- Turnstile: `/root/.secrets/turnstile.env` (staging widget's site key and secret), also in Coolify for `classifieds-web`. A new secret (rotated in the dashboard) must reach Coolify at once, or every sign-in and publish is refused.
- Meilisearch: `/root/.secrets/meilisearch.env` holds the master key (also on `classifieds-meilisearch` in Coolify, nowhere else) and the derived web and worker keys (also on `classifieds-web` and `classifieds-worker`). A new master key changes both derived keys: run `scripts/meili-keys.ts` again and update both apps.
- The restic password is in `/root/.secrets/restic.env`. Save a copy in your password manager. Without it, the backups cannot be read if the server is lost.

## Open decisions

1. ~~**Coolify deployments from GitHub.**~~ Done Oct 16, 2026: GitHub App `kooche-coolify`, installed on `rezakhsh/kooche` only.
2. ~~**Brand, then domain.**~~ Done Oct 17, 2026: Peydoo, `peydoo.com` (see "Domain and Cloudflare").
