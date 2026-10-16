# Setup decisions

Oct 16, 2026 · reviewed against `docs/architecture.md`

This file records the infrastructure as it actually exists and the decisions taken after reviewing the plan. Where it differs from `docs/architecture.md`, this file wins.

## What exists now

| Item | Value |
| --- | --- |
| Server | Hetzner CX23 (2 vCPU, 4 GB RAM, 40 GB disk), Helsinki `hel1`, `135.181.253.129`, server id 170743334 |
| Firewall | `classifieds-app` (id 11815492): inbound 22, 80, 443 (tcp) and 443 (udp, HTTP/3), ping. Everything else closed, including Coolify's raw ports 8000/6001/6002 and Traefik's 8080 |
| SSH | Root login by key only (password login for root is off) |
| Coolify | 4.4.6 at https://coolify.taskpilot.dev (Let's Encrypt). Public registration disabled; one admin account. API on, but only for the `coolify` Docker network (see "App deployment") |
| DNS (temporary) | `kooche.taskpilot.dev` (app) and `coolify.taskpilot.dev` (dashboard), both A records to the server, not proxied by Cloudflare |
| Backup storage | Hetzner Storage Box BX11 `classifieds-backups` (id 674924), 1 TB, Falkenstein `fsn1`, `u692990.your-storagebox.de`, SSH/SFTP on port 23 only |
| Photo storage | Cloudflare R2, EU jurisdiction (data stays in the EU), account BerlinWedding. Buckets `classifieds-media-staging` (testing) and `classifieds-media` (production, starts empty at launch). Both private: public `r2.dev` access is off. S3 endpoint `https://fe5720006c80324ed7b6bdd00d63b774.eu.r2.cloudflarestorage.com`, region `auto` |
| Secrets on server | `/root/.secrets/*.env` (root-only, never in Git) |
| Code | https://github.com/rezakhsh/kooche (private). The server pushes with a deploy key (`/root/.ssh/github_deploy`, SSH host alias `github-kooche`) that has write access to this repo only |
| Backups | `/usr/local/bin/classifieds-backup`, nightly at 03:15 UTC (`/etc/cron.d/classifieds-backup`), log in `/var/log/classifieds-backup.log`. restic tags `config` (Coolify config, secrets), `postgres` (database dump) and `coolify-db` (Coolify's own database, dumped inside `coolify-db` with its PostgreSQL 15 `pg_dump`) |
| Alerts | n8n workflow "Kooche – server alerts" (id `71k8LjIW2IJS5c8l`) at https://webhook.khodamehri.com sends to your Telegram (bot credential "Matrix", chat `148310113`). Server side: `/usr/local/bin/kooche-alert` (sender), `/usr/local/bin/kooche-healthcheck` (every 15 min, `/etc/cron.d/kooche-healthcheck`). Webhook path and shared secret in `/root/.secrets/alerts.env` |
| Staging database | Coolify project `classifieds`, environment `staging`, database `classifieds-postgres` (uuid and Docker hostname `pitchwmhavjj8wl2a9ztopqs`), `postgis/postgis:18-3.6`, 768 MB limit, not public (no published port; reachable only on the `coolify` Docker network). Database `classifieds`, locale `b` / `C.UTF-8`. Passwords in `/root/.secrets/postgres.env` |
| Staging Valkey | Coolify database `classifieds-valkey` (uuid and Docker hostname `cgrezwpbbepj0ulgn7wl5qc3`), Redis type with image `valkey/valkey:9.0.6-alpine`, 128 MB limit, `maxmemory 96mb`, `maxmemory-policy noeviction` (BullMQ needs it), AOF on, not public. Password in `/root/.secrets/valkey.env` |
| Staging app | Coolify applications `classifieds-web` (`jc0kgkjqmzxgdccrf0hn93tk`, Dockerfile target `web`, https://kooche.taskpilot.dev, 768 MB) and `classifieds-worker` (`bvhgg5spgjwcwjfnkirvoyvu`, target `worker`, no domain, 384 MB) and `classifieds-migrate` (`2wewwswad9hpecrhvynz5tp0`, target `migrate`, no domain, 128 MB), all from `rezakhsh/kooche` `main` through the GitHub App `kooche-coolify`. A push deploys `classifieds-migrate`, which applies migrations and then deploys the other two. See "App deployment" |
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

7. **Meilisearch arrives with the search feature, not in week 1.** Category and city browsing come from PostgreSQL anyway (as the plan says). Adding Meilisearch when keyword search is built keeps fewer services running while the schema is still changing. Search code lives behind one `search` module interface from the start.

8. **One package, not a monorepo.** The Next.js app and the worker live in the same package with two entry points and one Dockerfile with two build targets. Domain code lives in `src/modules/<module>/` (listings, users, chat, payments, moderation…), shared by both entry points. This is the simplest layout that still allows splitting a module out later.

9. **Hostnames only from configuration.** `kooche.taskpilot.dev` is temporary until the real domain is bought. Rules until then:
   - Every URL comes from `.env` (`APP_URL`, `IMAGE_URL`…). The database stores storage keys, never full URLs (as the plan says).
   - On the temporary domain, use one-level names such as `img-kooche.taskpilot.dev`, not `img.kooche.taskpilot.dev`. Cloudflare's free certificate covers only one subdomain level.
   - Don't change zone-wide settings of `taskpilot.dev` (for example the SSL mode), because they would affect your other sites on that domain. Full Cloudflare hardening (proxy, Full (strict) SSL, firewall rules, Turnstile, cache rules) happens on the new domain's own zone.
   - Storage names are brand-neutral (`classifieds-…`), so the brand decision doesn't block anything.

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

For a local app login, run the `ALTER ROLE` lines above once with the passwords from `.env.example` (`docker compose exec postgres psql -U postgres -d classifieds`). `npm test` recreates `classifieds_test` on every run and grants the owner `SET` on the three roles, so the grant tests can switch roles.

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

Why this design (Coolify 4.4.6, checked in its source):
- A **pre-deployment command** runs with `docker exec` in the **old**, still-running container, before the new image is even built. It would run the previous commit's migrations, and is skipped when no container runs. It would also put the owner password into the web app.
- In a **Docker Compose** application, Coolify adds `env_file: .env` to every service, so a one-shot migrate service there would hand the owner password to web and worker. Compose deploys also replace rolling updates with a recreate.
- The GitHub webhook queues all matching applications **in no defined order**, so a migrate app next to two auto-deploying apps can't be guaranteed to run first.

**Coolify API (on since Oct 16, 2026).** Needed for step 1. "Allowed IPs" is the `coolify` Docker network `10.0.1.0/24` **without** `10.0.1.1`, written as `10.0.1.2/31,10.0.1.4/30,10.0.1.8/29,10.0.1.16/28,10.0.1.32/27,10.0.1.64/26,10.0.1.128/25`. The gateway must stay out: Docker's userland proxy forwards IPv6 connections (the server has IPv6 and listens on `[::]:443`), so every client reaching Coolify over IPv6 appears as `10.0.1.1`. Calls from outside, over IPv4, over IPv6 and with a forged `X-Forwarded-For`, answer "You are not allowed to access the API" (tested); `/api/health`, which n8n checks, is outside the allowlist and still answers. Coolify checks the token before the IP, so a wrong token gets 401 even from outside. The token `classifieds-deploy` has only the `deploy` ability; its value is in `/root/.secrets/coolify-api-tokens.env` and in the env of `classifieds-migrate`. For other API work, create a temporary token from a container on the `coolify` network (calls from the host itself are refused too) and delete it afterwards.

**Environment variables** (runtime only, never build time):

| App | Variables |
| --- | --- |
| `classifieds-web` | `NODE_ENV`, `APP_URL`, `APP_TIME_ZONE`, `DATABASE_URL` (as `classifieds_app`), `REDIS_URL` |
| `classifieds-worker` | `NODE_ENV`, `WORKER_DATABASE_URL` (as `classifieds_worker`), `REDIS_URL` |
| `classifieds-migrate` | `NODE_ENV`, `MIGRATION_DATABASE_URL` (as `classifieds_owner`, the only place outside `/root/.secrets` with the owner password), `COOLIFY_API_URL` (`http://coolify:8080`), `COOLIFY_DEPLOY_TOKEN`, `DEPLOY_APP_UUIDS` (`jc0kgkjqmzxgdccrf0hn93tk,bvhgg5spgjwcwjfnkirvoyvu`) |

Hostnames are the Coolify uuids on the `coolify` network: `pitchwmhavjj8wl2a9ztopqs:5432` and `redis://default:<password>@cgrezwpbbepj0ulgn7wl5qc3:6379`. Other variables in `.env.example` are added with the features that use them.

**`/health`** returns 200 `{"status":"ok"}` when PostgreSQL and Valkey both answer within 2 seconds, else 503. It never returns error details.

**Security headers.** `src/proxy.ts` sets a strict Content-Security-Policy with a fresh nonce per request (`script-src 'self' 'nonce-…' 'strict-dynamic'`, no `unsafe-inline`), so every page is rendered per request. `next.config.ts` sets HSTS (two years, `includeSubDomains`, no `preload` on the temporary domain), `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` and COOP. When Cloudflare starts caching logged-out pages, a cached page reuses one nonce; revisit then (hashes or SRI instead of nonces).

**Coolify 4.4.6 API pitfalls** (found while setting this up):
- Start, stop and deploy endpoints are `POST` now (`POST /api/v1/deploy?uuid=…`, `POST /api/v1/databases/<uuid>/start`). `GET` answers with a message, not an error status.
- `redis_conf` must be base64-encoded. With a config file, `appendonly` must be in it (Coolify only adds `--appendonly yes` without one).
- `dockerfile_target_build` can't be set when creating an application, only with a `PATCH` afterwards.
- An application created without `domains` gets an `sslip.io` domain; clear it with `PATCH {"domains": ""}` (the worker has none).
- An API token's value is `<id>|<secret>`. Quote it in an env file, or `source` treats the `|` as a pipe.
- `POST /api/v1/deploy?uuid=a,b` answers 200 as long as one uuid exists and silently skips unknown ones. `trigger.js` checks that every uuid got a `deployment_uuid`.
- Creating an application needs `ports_exposes` even without a domain (`classifieds-migrate` has `3000`, unused).

**Fonts.** `src/app/fonts/Vazirmatn-subset.woff2` (69 KB, all weights) is cut from the pinned `vazirmatn` package by `scripts/subset-font.sh` (fonttools in a throwaway Python container). Rerun it when the package version changes.

## Alerts

One n8n workflow, **Kooche – server alerts**, receives reports from the server and checks from outside. It sends a Telegram message only when something changes: one 🔴 when a check fails and one 🟢 when it recovers. Events, such as a failed backup, are always sent. Its memory between runs lives in the workflow's static data. Successful runs aren't stored, so the 5-minute timer doesn't fill the n8n database; failed runs are.

| Check | Where | Alerts when |
| --- | --- | --- |
| Coolify dashboard reachable (`/api/health`) | n8n, every 5 min | 2 failed checks in a row |
| Server alive | server heartbeat every 15 min | no heartbeat for 35 min (covers the whole server being down) |
| Disk | server, every 15 min | `/` at 85% or more |
| Memory | server, every 15 min | under 300 MB available |
| Containers | server, every 15 min | a container is unhealthy or restarting, or a Coolify-managed one stopped |
| Nightly backup | backup script | it fails (immediately), or no successful run for 25 h |

To add a check:
- **A URL** (for example the app's `/health` once it's deployed): add it to `URLS` at the top of the workflow's "Check and decide" Code node.
- **A job on the server:** call `kooche-alert event|status|heartbeat`.
- **Several reports at once:** send them as one `kooche-alert batch '[...]'`. Parallel n8n runs overwrite each other's memory, so separate requests sent at the same moment can lose state.

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
| imgproxy | 256 MB | not deployed |
| System reserve | ~1 GB | |

Whole server at that moment: 1.95 GB used, 1.87 GB available, 214 MB of swap used (pushed out during the image builds). About 1 GB of the "used" figure was Claude Code sessions running on the server, not the product. Close idle sessions before heavy builds.

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
- The Cloudflare token can edit DNS and manage R2, but cannot read zone settings or edit its own permissions.
- Coolify admin login: `/root/.secrets/coolify-admin.env`. Turning on two-factor authentication in Coolify is recommended.
- Coolify's API is on, limited to the `coolify` Docker network, with one deploy-only token (`/root/.secrets/coolify-api-tokens.env`). Whoever has it can start or cancel deployments of any application, nothing more.
- The `classifieds_owner` password is in the env of `classifieds-migrate` (stored encrypted by Coolify), never in web or worker.
- Database passwords: `/root/.secrets/postgres.env` (root-only, included in the nightly backup).
- The restic password is in `/root/.secrets/restic.env`. Save a copy in your password manager. Without it, the backups cannot be read if the server is lost.

## Open decisions

1. ~~**Coolify deployments from GitHub.**~~ Done Oct 16, 2026: GitHub App `kooche-coolify`, installed on `rezakhsh/kooche` only.
2. **Brand, then domain.** Nothing technical depends on it any more. Buy the domain into Cloudflare when decided.
