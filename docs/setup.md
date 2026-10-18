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

Why this design (Coolify 4.4.6, checked in its source):
- A **pre-deployment command** runs with `docker exec` in the **old**, still-running container, before the new image is even built. It would run the previous commit's migrations, and is skipped when no container runs. It would also put the owner password into the web app.
- In a **Docker Compose** application, Coolify adds `env_file: .env` to every service, so a one-shot migrate service there would hand the owner password to web and worker. Compose deploys also replace rolling updates with a recreate.
- The GitHub webhook queues all matching applications **in no defined order**, so a migrate app next to two auto-deploying apps can't be guaranteed to run first.

**Coolify API (on since Oct 16, 2026).** Needed for step 1. "Allowed IPs" is the `coolify` Docker network `10.0.1.0/24` **without** `10.0.1.1`, written as `10.0.1.2/31,10.0.1.4/30,10.0.1.8/29,10.0.1.16/28,10.0.1.32/27,10.0.1.64/26,10.0.1.128/25`. The gateway must stay out: Docker's userland proxy forwards IPv6 connections (the server has IPv6 and listens on `[::]:443`), so every client reaching Coolify over IPv6 appears as `10.0.1.1`. Calls from outside, over IPv4, over IPv6 and with a forged `X-Forwarded-For`, answer "You are not allowed to access the API" (tested); `/api/health`, which n8n checks, is outside the allowlist and still answers. Coolify checks the token before the IP, so a wrong token gets 401 even from outside. The token `classifieds-deploy` has only the `deploy` ability; its value is in `/root/.secrets/coolify-api-tokens.env` and in the env of `classifieds-migrate`. For other API work, create a temporary token from a container on the `coolify` network (calls from the host itself are refused too) and delete it afterwards.

**Environment variables** (runtime only, never build time):

| App | Variables |
| --- | --- |
| `classifieds-web` | `NODE_ENV`, `APP_URL`, `APP_TIME_ZONE`, `DATABASE_URL` (as `classifieds_app`), `REDIS_URL`, `AUTH_SECRET`, `PHONE_CODE_SECRET`, `SMTP_URL`, `EMAIL_FROM`, `TELEGRAM_BOT_USERNAME`, `SMS_PROVIDER`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET_MEDIA`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `IMAGE_URL`, `IMGPROXY_KEY`, `IMGPROXY_SALT` (`SEARCH_INDEXING` unset on staging, which means `off`) |
| `classifieds-worker` | `NODE_ENV`, `WORKER_DATABASE_URL` (as `classifieds_worker`), `REDIS_URL`, `TELEGRAM_BOT_TOKEN`, `S3_*` (same five as web), `APP_URL`, `SMTP_URL`, `EMAIL_FROM` (expiry reminders) |
| `classifieds-imgproxy` | `IMGPROXY_KEY`, `IMGPROXY_SALT`, `IMGPROXY_USE_S3`, `IMGPROXY_S3_ENDPOINT`, `IMGPROXY_S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (read-only token), `IMGPROXY_BASE_URL`, `IMGPROXY_S3_ALLOWED_BUCKETS`, `IMGPROXY_WORKERS`, `IMGPROXY_MAX_SRC_RESOLUTION`, `IMGPROXY_MAX_SRC_FILE_SIZE`, `IMGPROXY_TTL`, `IMGPROXY_STRIP_METADATA`, `IMGPROXY_ALLOW_SECURITY_OPTIONS` |
| `classifieds-migrate` | `NODE_ENV`, `MIGRATION_DATABASE_URL` (as `classifieds_owner`, the only place outside `/root/.secrets` with the owner password), `COOLIFY_API_URL` (`http://coolify:8080`), `COOLIFY_DEPLOY_TOKEN`, `DEPLOY_APP_UUIDS` (`jc0kgkjqmzxgdccrf0hn93tk,bvhgg5spgjwcwjfnkirvoyvu`) |

Hostnames are the Coolify uuids on the `coolify` network: `pitchwmhavjj8wl2a9ztopqs:5432` and `redis://default:<password>@cgrezwpbbepj0ulgn7wl5qc3:6379`. Other variables in `.env.example` are added with the features that use them.

**`/health`** returns 200 `{"status":"ok"}` when PostgreSQL and Valkey both answer within 2 seconds, else 503. It never returns error details.

**Security headers.** `src/proxy.ts` sets a strict Content-Security-Policy with a fresh nonce per request (`script-src 'self' 'nonce-…' 'strict-dynamic'`, no `unsafe-inline`), so every page is rendered per request. `next.config.ts` sets HSTS (two years, `includeSubDomains`; `preload` is decided at launch, once production serves `peydoo.com` itself, because it is hard to undo and covers every subdomain), `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` and COOP. When Cloudflare starts caching logged-out pages, a cached page reuses one nonce; revisit then (hashes or SRI instead of nonces). `SEARCH_INDEXING=off` (the default, so staging sets nothing) adds `X-Robots-Tag: noindex, nofollow` to every page in `src/proxy.ts`; production sets `on`.

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
- Turnstile comes with the login and posting features, and cache rules with caching of logged-out pages.

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

**Failed deployments.** `kooche-healthcheck` reads failed rows from the last 24 hours in Coolify's `application_deployment_queues` table (read-only, `docker exec coolify-db psql`) and sends each one as a `deploy` event in the same batch: app, short commit, commit message and a link to the deployment log. For `classifieds-migrate` it adds that web and worker were not deployed. The uuids already sent are in `/var/lib/kooche/deploy-alerts-sent`. Only failures still inside the window are kept, so a lost file re-sends at most one day of failures. If `coolify-db` doesn't answer, the check is skipped and the file stays as it is (the containers check reports that case). The alert arrives up to 15 minutes after the failure. A separate, faster cron would race the healthcheck's n8n run and lose state.

To add a check:
- **A URL:** add it to `URLS` at the top of the workflow's "Check and decide" Code node.
- **A job on the server:** call `kooche-alert event|status|heartbeat`.
- **Several reports at once:** send them as one `kooche-alert batch '[...]'`. Parallel n8n runs overwrite each other's memory, so separate requests sent at the same moment can lose state.

## Countries, places and the map

Decided by the owner on Oct 17, 2026, after comparing hosted geocoders (Geoapify, MapTiler, Stadia), self-hosted address search (Photon, Nominatim: several GB of data and 1–2 GB of memory, too heavy for this server) and our own map tiles (PMTiles: 2.6 GB for Germany and Austria, 11 GB for Europe, on R2):

- **No outside address or map service.** The seller types a postal code or town, with suggestions from our own GeoNames postal codes (`postal_places`, about 34,000 rows for DE and AT, a few MB), or taps "use my location" (the browser's own geolocation, free; the position is snapped to ~500 m before it leaves the browser and again on the server). No street is asked for or stored.
- **The map is an outline of the country** with a dot (`src/components/outline-map.tsx`): SVG drawn from Natural Earth (public domain), inside our own pages, no tiles, no storage, no third party. A real street map can replace it later without any change to stored data: either MapLibre with our own PMTiles extract on R2 (~€0.05/month for DE+AT) or a hosted style.
- **Home page:** the list of open countries; `/{slug}` (`/germany`, `/austria`) shows that country's newest listings. The choice is kept in the `country` cookie (slug, one year, set by the browser on the country page) and the header links back to the list (`/?choose`). Cloudflare's `CF-IPCountry` highlights the visitor's country when the request really came through Cloudflare. City pages go under the country later (`/germany/berlin`).
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

## Brand and design

Approved by the owner on Oct 17, 2026 (plan: https://claude.ai/artifact/TgjPF24NJujB7bQAYnz3AK).

- **Name:** پیدو (Peydoo). Under it: «نیازمندی‌های ایرانیان خارج از کشور». Slogan: «هر چی بخوای، تو پیدو پیداست». All in `src/messages/fa.ts` (`site`).
- **Logo:** option A, a turquoise rounded square with a white magnifier and a saffron dot. React: `src/components/logo.tsx`; favicon `src/app/icon.svg`. The PNG icons, `favicon.ico` and the share image (`opengraph-image.png`) are drawn by `scripts/brand-assets.mjs` in the Playwright image (command in the file); run it again when the logo or slogan changes. `src/app/manifest.ts` is the "add to home screen" manifest.
- **Colours:** tokens in `src/app/globals.css`. `brand-*` (Persian turquoise, primary `brand-700` #0B6E77), `saffron-*` (accent, dark text only), and `neutral-*` redefined with a turquoise tint. Every text colour passes WCAG AA on white and `neutral-50`. Light only; dark mode later redefines the same tokens.
- **Type and icons:** Vazirmatn only (self-hosted). Icons are our own line drawings in `src/components/icons.tsx` (no icon font or CDN); `categoryIcon()` maps a top category's slug to its icon. Flags of open countries are in `src/components/flag.tsx`; add one when a country opens.
- **Layout:** header with the logo, the chosen country and (on computers) the actions; on phones a bottom bar (`src/components/bottom-nav.tsx`) with listings, post, my listings and account; footer. Listing cards come from `src/components/listing-card.tsx` (grid or list); new list pages (cities, search, events) reuse it.
- **Country page:** `?category=<slug>` shows a category and everything under it; categories sit in a sidebar from the `lg` breakpoint and in a row plus a sheet on phones. `?view=grid|list` switches the layout and is remembered in the `view` cookie.
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
| System reserve | ~1 GB | |

Whole server at that moment: 1.95 GB used, 1.87 GB available, 214 MB of swap used (pushed out during the image builds). About 1 GB of the "used" figure was Claude Code sessions running on the server, not the product. Close idle sessions before heavy builds.

Places (Oct 17, 2026): `postal_places` adds a few MB to PostgreSQL; no new service, and the outline map is part of the pages.

Events (Oct 18, 2026): two small tables and one BullMQ queue with a weekly job; no new service.

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
- The Cloudflare token can edit DNS and manage R2. Since Oct 17, 2026 it can also edit zone settings and WAF rules on `peydoo.com`. It can read `taskpilot.dev`'s zone settings too, so check its zone scope in Cloudflare if it should only cover `peydoo.com`. It cannot edit its own permissions.
- Coolify admin login: `/root/.secrets/coolify-admin.env`. Turning on two-factor authentication in Coolify is recommended.
- Coolify's API is on, limited to the `coolify` Docker network, with one deploy-only token (`/root/.secrets/coolify-api-tokens.env`). Whoever has it can start or cancel deployments of any application, nothing more.
- The `classifieds_owner` password is in the env of `classifieds-migrate` (stored encrypted by Coolify), never in web or worker.
- Database passwords: `/root/.secrets/postgres.env` (root-only, included in the nightly backup).
- Accounts: `/root/.secrets/auth.env` holds `AUTH_SECRET`, `PHONE_CODE_SECRET`, the SES SMTP credentials and the staging bot token, and the same values are in Coolify. A new `AUTH_SECRET` logs everyone out; a new `PHONE_CODE_SECRET` only invalidates SMS codes in flight.
- R2: `/root/.secrets/r2.env` (staging read-write and read-only S3 credentials) and `/root/.secrets/imgproxy.env` (URL signing key and salt), both also in Coolify. A new imgproxy key or salt breaks every image URL in cached pages until they are rendered again.
- Since Oct 17, 2026 the Cloudflare token can also create API tokens (granted by the owner to create the R2 tokens). That makes it able to mint tokens with any permission in the account; narrow it again in Cloudflare if that isn't wanted.
- The restic password is in `/root/.secrets/restic.env`. Save a copy in your password manager. Without it, the backups cannot be read if the server is lost.

## Open decisions

1. ~~**Coolify deployments from GitHub.**~~ Done Oct 16, 2026: GitHub App `kooche-coolify`, installed on `rezakhsh/kooche` only.
2. ~~**Brand, then domain.**~~ Done Oct 17, 2026: Peydoo, `peydoo.com` (see "Domain and Cloudflare").
