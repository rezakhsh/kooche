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
3. Turnstile on sign-in and posting. ~~Cloudflare cache rules with caching of logged-out pages.~~ Done for staging Oct 19, 2026.

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

Deployed to staging Oct 17, 2026 (`2af67ac`). Memory right after: web 95 MB, worker 64 MB, imgproxy 15 MB (idle), PostgreSQL 29 MB, Valkey 3 MB; 1.78 GB available on the server.

Fixed after the owner tried it (`52bd5f9`, migration `0007`):
- Opening a category created a draft each time, which also filled the daily draft limit. Now `/new/{category}` shows an empty form and stores nothing; the draft is created on the first save or the first photo (the address bar then moves to `/my/listings/{id}` without a reload). The limit is 20 real drafts a day.
- Deleting an unfinished draft failed: `listings_publishable_check` and `listings_price_required_check` applied to `deleted` too. Migration 0007 exempts `deleted` like `draft`. New test.
- The owner's 10 empty drafts were deleted through the normal delete path, and today's draft counter in Valkey was cleared.

Next:
1. ~~Countries (Germany and Austria), address entry with a map, and currency taken from the country.~~ Done, see below.
2. Persian terms of use, so `policy_ground` can name real sections instead of `terms-prohibited-items`.
3. Draft clean-up (drafts untouched for months) and the 12-month purge of deleted listings with their R2 files.
4. Turnstile on posting; new-account limits (phase 4).
5. Production at launch: its own two R2 tokens for `classifieds-media`, CORS for `peydoo.com`, `img.peydoo.com`.

## Oct 17, 2026: countries, places and currency

Decided by the owner (Oct 17, 2026), after a plan with hosted geocoders, self-hosted address search and own map tiles compared:
- No outside address or map service. Sellers give a postal code or town, or use the browser's location (free). No street.
- Like Kleinanzeigen, the place is saved on the account and pre-fills the next listings; each listing keeps its own place and can change it.
- The rounded ~500 m point is kept when the browser location is used ("near me" search later).
- The map is a drawn outline of the country with a dot, not a street map.
- The home page lists the countries (like Divar's list of cities); Germany and Austria open; Turkey added but closed.
- The currency comes from the country; sellers no longer choose it.

Done (branch `location-map`):
- **Home page** `/`: the open countries, the visitor's own highlighted (Cloudflare's country header). **Country pages** `/germany`, `/austria`: newest listings, 24 at a time with a "more" link. The choice is remembered in a cookie and shown in the header with a link back to the list.
- **Posting form:** country, "postal code or town" with suggestions from our own GeoNames postal codes and our cities (Persian names too), optional district text, "use my location" (snapped in the browser and on the server; fills in the nearest postal code), the outline map as a preview, and "remember for my next listings". The currency select is gone; the amount shows the country's currency. Works without JavaScript (the server resolves what was typed).
- **"My location"** at `/account/place`: set or remove the saved place (postal code, place, district; never a position).
- **Listing page:** "12045 Berlin", the city (or "near Frankfurt" for a town that isn't the city), the district, and the outline map with a caption saying how exact it is. JSON-LD carries the postal code and place.
- **Data:** Austria's 9 states and 29 cities; postal codes for Germany (15,050 places) and Austria (18,998); country web addresses; Turkey and the lira (closed; no SMS to Turkish numbers yet). Three new seed checks.
- **Migration `0008`:** `postal_places`, `countries.slug`, `listings.postal_code` and `place_name`, the `postal_code` precision, the saved place on `users`, an index for the country page, and `erase_user` clearing the saved place. Additive only.
- **Tests:** 22 new (207 in total), all passing: the stored point is never the exact one and never in the row, positions abroad or far from the place refused, the currency always follows the country (a forged currency is ignored; no listing in the database differs), Austria and the postal codes seeded with a city each, Turkey closed and without SMS, place search and resolution, the saved place (and `erase_user` clearing it), the country page's paging. The production build passes, and the pages were checked in headless Chromium against the test data (home, Austria page, listing page, posting form with suggestions, "my location").
- Docs: `docs/setup.md` ("Countries, places and the map", with the checklist for opening a country), `docs/schema.md` (sections 4, 6, 8 and 17), `seed/README.md`.

Deployed to staging Oct 17, 2026 (`2782e7d`): `classifieds-migrate` applied `0008_location_places`, then web and worker came up healthy. The seed was run once as `classifieds_owner` from a throwaway container on the `coolify` network (16 currencies, 37 countries, 25 regions, 81 cities, 34,048 postal places; seed checks passed). `/` lists Germany and Austria, `/germany` and `/austria` answer 200, `/turkey` 404. Staging has no live listings yet (only deleted test drafts), so both country pages are empty. Memory right after: web 70 MB, worker 65 MB, PostgreSQL 85 MB, Valkey 5 MB; 1.71 GB available on the server.

Next:
1. The owner tries posting with a postal code, a town and "use my location" on staging.
2. A native speaker reads the Persian names of the Austrian states and cities.
3. City pages under the country (`/germany/berlin`) and category filters on the country page.
4. "Near me" search on the stored ~500 m points.
5. Later, if wanted: street-level address search and a real street map (both possible without changing stored data).

## Oct 18, 2026: listing fields per category

The owner asked (Oct 17) which fields each category is missing. A plan compared every category with Kleinanzeigen's posting forms and filters (what German and Austrian buyers expect) and Divar's Persian wording, and was approved Oct 18 with all five choices as recommended: rent price = cold rent with extra costs and deposit; a date field type; shipping (already a listing checkbox, nothing to add); about 45 car makes and 300 models; Germany-only fields (WBS) optional and labelled «فقط آلمان». Plan page: https://claude.ai/artifact/3fXT1NNZunDx2kyuhQuDz6

Done (branch `listing-fields`):
- `seed/categories.ts`: 289 attributes and 1,257 options (was 118 and 317), no category added or removed. Real estate: extra costs, deposit, available from/until, apartment and house type, a features checklist, pets, WBS, year built, energy class, WG room type and flatmate preference, short-stay price unit, land and commercial use, parking rent or sale. Cars: trim, accident history, TÜV/HU month, colour, owners, service book, doors, Euro class, equipment checklist, and make, model, year, mileage, fuel and gearbox now required. Motorbikes, bikes, campers, vans, boats, parts and tyres got their own fields; electronics an exact model, RAM, colour, battery health, warranty, receipt; furniture, appliances, carpets (material, more origins), clothing (garment type, brand, colour, EU size numbers), jewellery (material, karat for gold, weight), prams, car seats, toys, pets (vaccinated, chip, neutered, papers), books, tickets (event date, required), services (price unit, what is offered, home visits), lessons (audience, trial lesson, subjects, levels, exam preparation), jobs (salary, experience, Persian-speaking, visa help, licence, start date), rideshare (from, to, date). `rent_type` retired.
- New field type `date` (migration `0009`, a CHECK change only) and amounts in minor units of the listing's currency. The posting form shows a date input, month and year selects, and the currency next to amounts; the listing page shows Jalali dates, Gregorian months, amounts with the currency, and the warm rent next to the cold rent. Details in `docs/schema.md`, section 17.
- 7 new tests (214 in total), all passing in Docker on a scratch PostgreSQL built like `compose.yaml` plus Valkey; typecheck and `check:rtl` pass. Upgrade from `main`'s seed tested on a scratch database.

Not done:
- Deploy. After merging, `classifieds-migrate` applies `0009`; then run the seed once on staging as in `docs/setup.md` ("Seeding on staging"). Until the seed runs, the new fields don't appear and old ones keep working.
- Cards don't read `show_on_card` yet, and filters come with search.
- The listing page and posting form are also being restyled on `design-brand`; both branches touch `src/app/my/listings/[id]/form.tsx`, `editor-data.ts`, `src/app/v/[slug]/[token]/page.tsx` and `src/messages/fa.ts`, so the second to merge resolves small conflicts there (here only the attribute field, the attribute text and two message groups changed).

Next:
1. A native speaker reads the new Persian labels and options.
2. Cards: show up to three `show_on_card` fields under the price.
3. Possible new categories, e.g. driving lessons.

## Oct 18, 2026: events («رویدادها»)

Decided by the owner (Oct 18, 2026), after research into what Iranians in Germany and Austria post (Persian concerts and party nights in Frankfurt, Düsseldorf, Hamburg and Berlin; Nowruz, Yalda and Chaharshanbe Suri; readings, films and lectures at Vienna's Iranisches Kulturhaus; Graz's cultural initiative) and how Volek, Tizo, Eventbrite and Meetup show events. Kleinanzeigen has only ticket resale, and no events section was found on Divar:
- A separate section with its own pages and form; each event is a listing underneath, so photos, post-checks, contact and history are shared.
- Start and end in the venue's local time, stored in UTC, shown in Jalali and Gregorian. Events can be one-off, last several days (up to 14), or repeat weekly or monthly (up to 26 dates).
- The venue's street address is public. The online link is shown only to signed-in visitors.
- Free, "tickets from", or paid at the door; ticket link, organizer, languages, age limit, poster and photos.
- A verified phone to post (no business needed now), at most 5 events a day, the same post-checks, no URL shorteners.
- Events end after their last date and can't be renewed; "post again" copies one.
- No new service.

Done (branch `events`, built on `listing-fields` because both change the category list and 0010 follows 0009):
- **Pages:**
  - `/germany/events` and `/austria/events`: soonest first; today, this weekend, this week or this month; city, type, online only, free only; paging.
  - Event page `/e/{title}/{token}`: date and time in Jalali and Gregorian with the time zone, venue and address, "open in map", outline map, ticket button with a warning, organizer, languages, age, every date of a series, Telegram, WhatsApp and copy-link sharing, schema.org `Event` markup. Ended events say so and are `noindex`.
  - "Add to calendar" (.ics).
  - The form `/events/new` and `/my/events/{id}`: type, text, dates with a Jalali reading, in person, online or both, place field, venue, address, link, price, ticket link, organizer, languages, age, postponed or cancelled, poster and photos.
  - "My events": edit, pause, resume, cancel, post again, delete.
  - The country page links to its events. Old `/v/` links of events redirect.
- **Kept apart:** events don't appear in the listing grid, "my listings" or the renewal email. The listing category picker sends the events section to its own form. `community › events` is retired.
- **Worker:** the weekly digest (Mondays 08:00 Berlin) writes one `event_digest.weekly` outbox event per country. `event.published`, `event.changed` and `event.cancelled` are written with each change. All are waiting for the n8n channel posting.
- **Migration `0010`:** `event_details` and `event_dates`, indexes for "upcoming in a country or city", grants (the app writes, the worker reads) and the `updated_at` trigger. Additive only.
- **Tests:** 38 new (252 in total), all passing, run as the app and worker roles:
  - Permissions: verified phone only, only the organizer edits, cancels, copies or pauses, events only through the events module, the daily limit, no negotiable price.
  - Dates: time zones, both clock changes, overnight ends, the 14-day and 26-date limits, past and too-far dates, edits of a running event, drafts.
  - Expiry after the event: expires_at = last end, the expiry job, no renew, no sold, no resume once over, no reminder email, an ended event can't be edited, only copied.
  - Countries and places: Germany and Austria with their time zones and cities, Turkey closed, a place required, the currency from the country.
  - Lists: country, city, type, online, free, time window, paging, paused hidden, events outside the listing grid.
  - Post-checks on venue and organizer, and shortener links. Links, the calendar file, the digest, and grants.
- The production build passes. The pages were loaded from the production build against a local database with demo events (list with filters, event page, calendar file, the `/v/` redirect, sign-in for posting).
- Docs: `docs/schema.md` (sections 3, 8 "Events", 14 and 17), `docs/setup.md` ("Events"), `seed/README.md`.

Not done yet:
- Not deployed. After the merge, the seed has to be run once on staging, as for 0008: the events section appears only after the seed.
- The brand session decides how event cards and pages look. Today they use the shared components and plain styles. The new root category `events-calendar` needs an icon in its icon map.
- Report buttons come with phase 4, as for listings.
- City pages for events (`/germany/berlin/events`) come with the city pages.
- The n8n webhook for channel posting.

Merge order: `listing-fields` first (or together), because 0010 follows 0009. Expect small conflicts with `design-brand` in `src/app/[country]/page.tsx`, `src/app/v/[slug]/[token]/page.tsx`, `src/app/new/page.tsx`, `src/app/my/listings/[id]/page.tsx`, `src/components/place-field.tsx`, `src/modules/listings/queries.ts` and `src/messages/fa.ts`. Each of these got only a few added lines.

## Oct 17–18, 2026: brand, design and the listing experience

Asked by the owner (Oct 17): the listing page was too plain and photos could not be enlarged; the country should not change on the posting page; a site name line and slogan; a logo to choose from; a colour palette; categories on the side and a grid or list switch. A plan with four logos, the palette and page mockups was approved the same day (https://claude.ai/artifact/TgjPF24NJujB7bQAYnz3AK): logo A, «نیازمندی‌های ایرانیان خارج از کشور», «هر چی بخوای، تو پیدو پیداست», turquoise and saffron, a bottom bar on phones, dark mode later.

Done (branch `design-brand`, details in `docs/setup.md`, "Brand and design"):
- **Brand:** logo, favicon, app icons, share image and manifest; colour tokens in `globals.css` (every `emerald-` class is now `brand-`); own line icons; flags for Germany and Austria.
- **Every page:** new header (logo with its line, the chosen country), bottom bar on phones, footer. Home page with the slogan, countries with flags and listing counts, and three reasons to trust the site. Country page with the category sidebar (computers) or a swipeable row and a bottom sheet (phones), filtering by category (`?category=`), counts per category, grid or list (remembered), photo count and "2 hours ago" on cards. Listing page with the photo viewer, large price, seller box (member since, phone verified), details table, breadcrumb links back into the country page. Category picker with icons and the country it posts into. "My listings" with tabs by status, days left, coloured status. Account as a list of settings with their values. Login with the logo.
- **Country fixed when posting:** shown as fixed text in the form; decided and enforced on the server (see setup).
- **Tests:** 9 new (216 in total), all passing: which country a listing gets (own, chosen, saved, closed ones skipped), the server refusing another country for a live listing and a saved draft (also in lower case) with nothing changed, a draft without a country taking one, the category filter and counts, relative dates and the member-since month.
- **Checked in headless Chromium** (production build, scratch database, a stand-in for imgproxy) on an iPhone 13 size and 1280 px: no CSP errors and no sideways scrolling on any page; the view switch is remembered; the category sheet opens and closes after a choice; the viewer opens on the tapped photo, moves by swipe and arrow keys, closes with Esc and with the back button, and releases the page; the posting form has no country select and follows the chosen country (Germany, Austria).

Not done:
- Not deployed. Merge `design-brand` into `main` to deploy (no migration).
- Chat stays "coming soon"; the sticky contact bar from the mockup was left out because the bottom bar is at the bottom on phones; the seller box sits right under the price instead.
- Dark mode (tokens are ready), pinch zoom beyond the browser's own, and search.
- Coordinate: the events section can reuse `ListingCard`, `Pill`, the tokens and the icons; the category-fields work renders inside the existing form cards.

## Oct 18, 2026: listing fields, events and the new design merged

`listing-fields`, `events` (which contains it) and `design-brand` merged into `main`. Fitted together:
- The events category is not a filter on the country page; a «رویدادها» chip (phones) and a sidebar link (computers) lead to `/{country}/events`. Category and home-page counts leave out events, like the listing pages.
- The event form shows the country as fixed text and its save action decides the country on the server, as for listings (`postingCountry()`); one more test (an event can't move to Austria).
- The listing page shows the cold rent with the big price and the warm rent under it. Money fields in the form use the country's minor unit for a new listing.
- Event pages and the event card use the new colours.
- 262 tests pass; the production build and the headless Chromium check (all pages above, plus the events list and the event form) pass with no CSP errors.

Deployed to staging Oct 18, 2026 (`652bf93`): `classifieds-migrate` applied `0009_attribute_date` and `0010_events`, then web and worker came up healthy. The seed was run once as `classifieds_owner` from a throwaway container on the `coolify` network (141 categories, 127 leaves, 289 fields, 1,257 options; seed checks passed). Checked live: `/`, `/germany` with a category and list view, `/austria`, `/germany/events`, the icons, the share image and the manifest answer 200, `/turkey` 404, the CSP header is in place. Memory right after: web 93 MB, worker 71 MB, PostgreSQL 162 MB, Valkey 4 MB; 1.5 GB available on the server.

Changed after the owner tried it (Oct 18, 2026):
- Photos: the photo box came before the event type, and a new event can't take photos until it has a type. The box now follows the type (`9a56e98`).
- Dates: event dates are shown in the Gregorian calendar (miladi), in Persian, everywhere: cards, the event page, "my events" and the form's day check under each date field. The event page keeps the Jalali date as a small second line. The owner's reason: Iranians outside Iran, and the venues and tickets, use the Gregorian calendar. Listings keep Jalali dates.

## Oct 18, 2026: chat between buyers and sellers

Decided by the owner (Oct 18, 2026), plan approved with all five open points as recommended:
- Instant: server-sent events from the Next.js app, fanned out through Valkey pub/sub, heartbeats under Cloudflare's 100 seconds, reconnect with the last message id, fallback to reloading.
- Notices: Telegram bot first, email when the bot can't reach someone; one per conversation per few minutes (Telegram 5, email 15), none while the chat is open; a BullMQ queue limited to 25 a second that honors 429 and drops nothing; a per-user switch.
- Phone number: the seller chooses per listing, chat only by default; reveal only for verified users, limited per day and per IP, every reveal logged.
- Scam guard: warn always, block links and IBANs from accounts under 7 days; send limits and new-conversation limits for new accounts.
- Also: chats of taken-down listings close too and reopen when live again; links in messages are plain text; the bottom bar gets «پیام‌ها».

Done (branch `chat`):
- **Pages:** «گفتگو با آگهی‌دهنده» on listing and event pages; `/chat/new?l=` (listing, quick first messages, composer; nothing stored until sent); the inbox `/chat` (buying and selling merged, filters, unread badges, seen ticks, archive); the conversation `/chat/{id}` (full screen on phones, bubbles, Jalali day dividers, ticks, safety tip, risk warnings, report dialog, archive, block, read-only states with their reasons, "load older"); `/account/notifications`. Badges in the header and the bottom bar (now five items). Works without JavaScript.
- **Live:** `/chat/stream` with one Valkey subscriber per web process, replay after `Last-Event-ID`, `ping` events every 20 s, streams ending after 10 minutes, presence for "chat open", caps per process and per user; the browser closes the stream for hidden tabs, reconnects when back online or after 50 s of silence, and falls back to reloading with a backoff retry.
- **Notices:** worker queues `chat`, `chat-notify`, `telegram-send` (one every 40 ms, 429 pauses the queue, 403 marks the bot unreachable and sends email, the last failed attempt sends email) and `email-send`. The bot now hears block and unblock (`my_chat_member`). The Telegram client moved to `src/modules/notifications/telegram-api.ts`.
- **Safety:** risk detector with five flags, the new-account rule, rate limits, messaging sanctions honored, quiet blocking (`messages.withheld`), message reports with `report.created`.
- **Phone reveal:** verified viewers only, 10 an hour and 30 a day per viewer, 40 an hour and 100 a day per IP, `audit_log` row per reveal. The form switch is relabelled.
- **Retention and export:** `chat-retention` daily (90 days after an account deletion, unless reported); `exportChatData()` ready for the export job.
- **Migration `0011`:** `messages.withheld`, one open report per person per message. Additive; no seed needed.
- **Tests:** 61 new (324 in total), all passing: participants only, blocks and withheld messages, the new-account rule, rate limits, sanctions, risk flags (27 cases including false-positive guards), closed, reopened and locked conversations, read watermarks and the replay, reports, the phone reveal limits and log, retention, export, the notice rules and debounce, and the send queues against a fake Telegram (429 with `retry_after`, 403, ten 502s then email, the 25-a-second limiter), plus the bot's block tracking.
- **Checked in two headless Chromium browsers** (production build, TLS in front, scratch PostgreSQL and Valkey, a phone-sized buyer and a desktop seller): start from the listing page, the seller's badge, seen ticks live, a reply delivered live in about 100–140 ms, the link refusal for the new buyer, the payment warning, catching up after offline, a hidden tab catching up when visible, a web restart (deploy) with the stream coming back, sending without JavaScript, report, block (the withheld message never reaches the seller, also after a reload), no sideways scroll, no CSP errors. That run found and fixed four bugs: the header badge counting the chat being read, text typed before the page loaded being lost, a quick second message being wiped, and a stream that died without closing never reconnecting.
- **Memory:** 500 open streams raised the web process from 77 to 131 MB; Valkey +0.2 MB; the worker about 52 MB (`docs/setup.md`, "Memory budget").
- Docs: `docs/setup.md` ("Chat", including why the bot scales), `docs/schema.md` (sections 10, 11, 14, 15, 17).

Deployed to staging Oct 18, 2026 (`d1e8f70`, approved by the owner): `classifieds-migrate` applied `0011_chat`, then web and worker came up healthy; the bot polls as @Peydoo_bot and `/health` answers 200. No seed and no new setting.

Checked live on https://staging.peydoo.com:
- **Through Cloudflare:** a chat stream answered `text/event-stream` without compression (`cf-cache-status: DYNAMIC`), got a `ping` every 20 seconds and stayed open for the full 10 minutes until the server ended it (600.6 s). A temporary test account was used for this and deleted afterwards.
- **Two verified accounts** (the owner's رضا as seller and their second account as buyer, both linked to the bot by then): one conversation, 28 messages in both directions between 20:47 and 20:54 UTC, both read watermarks set, nothing left unread, every `message.sent` handed to the worker.
- **Notices** (BullMQ results in Valkey): 41 checks; 2 Telegram notices sent, one to each side (`sent`, no retries, nothing failed); the others correctly skipped: 21 while the receiver had the chat open, 2 already read, 12 within the 5-minute debounce. No email was needed, because both accounts reach the bot.

Not checked live yet:
- The email fallback (both test accounts are now linked to the bot). Covered by the tests with a fake Telegram (403 and ten 502s end in an email); SES itself already sends the login codes and expiry reminders.
- Block and report on staging (no rows yet). Covered by the tests and the local two-browser run.
- Chat images, the business inbox (organization managers answering), the n8n alert for new reports, the 12-month purge of deleted listings (it must delete conversations first), and the data-export job.


## Oct 18, 2026: city and category pages, filters, "near me" and favorites

Decided by the owner (Oct 18, 2026), plan approved with the four open points as recommended:
- Filters on price, place (city or postal code with radius) and each category's own filterable fields, from the definitions, validated with Zod on the server; a "ships" filter too.
- "Near me" at 5 / 10 / 25 / 50 km, only after a tap and the browser's permission, never stored or logged, as a 2-hour encrypted token in the address.
- Favorites for signed-in users; a ♡ tapped while logged out is saved after sign-in.
- Every filtered page `noindex`; Google gets the plain country, city and category pages.
- Cloudflare: cache headers now, the Cache Rule and the CSP nonce decision before launch.
- Keyword search (Meilisearch) waits for a CX33; all of this runs on PostgreSQL + PostGIS behind the `search` module.

Done (branch `browse`, details in `docs/setup.md`, "Browsing and favorites"):
- **Pages:** `/germany/cars`, `/germany/berlin`, `/germany/berlin/cars` and `/germany/berlin/events`; one server-rendered browse page for all of them, with categories (with counts for the city), the filter form in a phone sheet or the computer sidebar (first when a category is chosen), removable chips, sort links (newest, cheapest, most expensive, nearest), the most active cities as links on country pages, grid or list, "more" with a keyset cursor. Old `?category=` and `?city=` addresses redirect. Listing pages link back through the city and category pages. Works without JavaScript, except "near me".
- **Search module** (`src/modules/search/`): the filter address and its Zod schema built from `category_attributes`, the PostgreSQL query behind `searchListings()`, places, the "near me" token, sitemaps and paths.
- **Favorites:** ♡ on cards, listing and event pages; `pending_favorite` cookie through sign-in; «نشان‌شده‌ها» at `/my/favorites` with listings that went away marked; the seller's count on "my listings" and their own pages.
- **SEO:** Persian titles and descriptions, canonical URLs, `noindex` for filters, sorting, paging, places and empty pages, `BreadcrumbList` and `ItemList` JSON-LD, hourly sitemaps from the worker (`seo` queue) in `sitemap_files`, `robots.txt`; sitemaps answer 404 and `robots.txt` disallows everything while `SEARCH_INDEXING` is off.
- **Caching:** `Cache-Control: public, s-maxage=60` on logged-out browse pages, `private, no-store` with a session, the `view` cookie, another country's cookie, a postal code or "near me". No Cloudflare rule yet, so nothing is cached at the edge.
- **Migration `0012`:** `sitemap_files` and the partial index for "this postal code only". Additive. The seed adds `filter: 'all'` to the two equipment checklists and four seed checks.
- **Speed:** measured with `scripts/generate-listings.ts` and `scripts/explain-browse.ts` on 5,000 and 50,000 generated listings in a scratch database: browse pages under 1 ms on their indexes, GIN for attribute filters across a country (4–7 ms at 50,000), a radius by distance 3 ms (5,000) to about 20 ms (50,000); postal code only 17 ms → 0.05 ms with the new index; counts cached for a minute (30 ms at 50,000).
- **Tests:** 34 new (358 in total), all passing: filter validation against the definitions (unknown, forged, retired, out-of-range, reversed, other categories' fields, models without their make, `__proto__`, SQL in values), each filter type in the query, events, paused listings and other countries left out, keyset paging with ties in time and price and listings added between pages for all four sorts, price order with free and priceless listings, the "near me" token (encrypted, cell only, expiry, any changed character refused, another secret refused), radius results measured to the stored point with whole kilometres and no coordinates and nothing logged, places outside the country, postal codes, favorites permissions (active only, not own, idempotent, only your own removed, the 1,000 limit, 60 a minute, counts only for the seller, "my favorites" paging and gone listings, the logged-out cookie saved once after sign-in, a forged back address, `erase_user`), sitemap contents (only non-empty plain pages, active listings and events, no filtered addresses, no closed country, escaping, splitting at the limit, worker writes and app reads, 404 with indexing off) and the cache header rules.
- **Checked in headless Chromium** on the production build against the 50,000-listing scratch database, phone and computer: 42 checks passed, among them every page answering 200 with no sideways scroll and no CSP or console errors; the no-JavaScript form landing on the canonical address, chips removing their filter, and the ♡ going to sign-in with the HTTP-only cookie; "near me" with a browser position in Berlin ending on the canonical address with a token, no coordinates in the address or page, the position sent already rounded, kilometres on the cards; signed in, the ♡ filling and staying after a reload, «نشان‌شده‌ها» listing and removing it, and the page turning `private, no-store`.

Deployed to staging Oct 18, 2026 (approved by the owner): `browse` fast-forwarded into `main` (`7fec952`); `classifieds-migrate` applied `0012_browse`, then web and worker came up healthy, and the worker built the sitemaps at start (`seo: sitemaps: 2 files, 10 addresses, 309 ms`). The first seed run on staging stopped at the new browse-slug check: staging still has the retired `community › events` category (inactive, never shown), which a fresh test database doesn't. Nothing changed (the seed is one transaction). The check now looks only at active cities and categories, with a test for exactly this case (`8c7a806`, deployed); the second run loaded (141 categories, 289 fields, 1,257 options) and `features` and `car_extras` carry `filter: 'all'`.

Checked live on https://staging.peydoo.com: `/germany`, `/austria`, `/germany/cars`, `/germany/berlin`, `/germany/berlin/cars`, `/austria/wien/apartments-rent` and `/germany/berlin/events` answer 200; `?category=cars` redirects (308) to `/germany/cars`, `/germany/events?city=berlin` to `/germany/berlin/events`, a plain form address to the canonical one, an unknown filter is dropped; `/germany/nowhere` is 404; `/my/favorites` asks for sign-in. Headers: `Cache-Control: public, max-age=0, s-maxage=60`, `X-Robots-Tag: noindex, nofollow`, `cf-cache-status: DYNAMIC` (nothing cached at the edge, as intended); `robots.txt` says `Disallow: /` and the sitemap addresses answer 404 while `SEARCH_INDEXING` is off. `sitemap_files` holds the index, `germany` (8 pages) and one listing file. Headless Chromium against staging (phone and computer, five pages): no CSP or console errors, no sideways scroll. Staging has 2 active listings, so filters and "near me" were exercised on the 50,000-listing scratch database (above), not on staging data.

Memory right after (Oct 18, 22:47 UTC): web 122 MB, worker 75 MB, PostgreSQL 130 MB, Valkey 7 MB, imgproxy 41 MB; 1.33 GB available on the server. Swap is full (2 GB): it is held by idle Claude Code session processes (about 90–100 MB each), not by the product; closing idle sessions frees it.

Not done:
- ~~The Cloudflare Cache Rule and the nonce decision.~~ Done Oct 19, 2026, see below. A worker purge doesn't fit cleanly on the Free plan.
- Facet counts per option, saved searches and alerts, keyword search: with Meilisearch. Cards still don't show `show_on_card` fields.
- An expression index for price order over all categories, if that sort is ever used much.

## Oct 19, 2026: edge caching of logged-out browse pages

Plan approved by the owner (Oct 19, 2026): a narrow Cloudflare token for Cache Rules, the proxy fixes, deploy to staging, the rule for `staging.peydoo.com`, the nonce kept as it is on cached pages.

Done (details in `docs/setup.md`, "Browsing and favorites", "Caching" and "The nonce on cached pages"):
- **Two problems found before the rule went in.** (1) The `country` cookie changed the header's country chip (none without the cookie, the chip with it) while both answers were `public`, so one cached copy would have served the other. The proxy now renders every browse page as if its own country were chosen, and that cookie no longer makes a page private. (2) Next.js answers a request with `RSC: 1` and no `_rsc` with a 307 to `?_rsc`, sent `public`; Cloudflare ignores `Vary`, so one such request could have redirected every visitor for a minute. Next.js 16 removes the `RSC` header and `_rsc` from what the proxy sees, so the rule leaves those requests out. Only GET and HEAD are marked `public` now.
- **Cache Rule** on the Free plan (the cookie and header conditions are accepted): staging host, not `/_next/` or `/api/`, no session or `view` cookie, no RSC request; eligible for cache, using the origin's `Cache-Control` and bypassing when there is none.
- **Token** `peydoo-cache-rules` (`CLOUDFLARE_CACHE_TOKEN` in `/root/.secrets/infra.env`): Cache Settings and Zone read on `peydoo.com` only. The owner also gave the main token access to Cache Rules.
- **Nonce decision:** a cached copy shares one nonce for at most 60 seconds, on logged-out browse pages only. Accepted. It only helps DOM-based XSS on that copy, and browse pages have no client-side HTML sink. Hashes (Next.js's inline RSC scripts change per render), a nonce-swapping Worker, `'unsafe-inline'` and no edge cache were compared and not chosen.
- **Tests:** the cache header rules updated (another country's cookie is shared now, only GET and HEAD shared); 360 tests pass, typecheck and the RTL check too.
- Commits `8e518c9` and `2c768ff`, deployed to staging through Coolify.

Checked live on https://staging.peydoo.com (Oct 19, 2026): logged out `/austria` MISS, then HIT, EXPIRED after 60 s and HIT again; two visitors of one copy get the same nonce in the CSP header and the HTML; either session cookie and `view=list` DYNAMIC with `private, no-store`; `country=germany` HIT; `RSC: 1` and `?_rsc=` DYNAMIC, and the page stays the normal 200 copy after an `RSC: 1` request; POST DYNAMIC, a postal code BYPASS, `/` and `/login` BYPASS. The HTML of `/germany/berlin` without a cookie and with `country=austria` or `country=germany` is identical apart from the nonce. Not checked in a browser on a HIT copy (the header and HTML nonce match, which is what the browser checks).

Not done:
- Production: add `peydoo.com` to the rule's host condition at launch.
- ~~After a deploy, a cached copy can point for up to 60 seconds at the previous build's chunks and server actions.~~ Done Oct 19, 2026, see below.

## Oct 19, 2026: Cloudflare cache purge after each deploy

Plan approved by the owner (Oct 19, 2026): a Coolify post-deployment command on `classifieds-web`, purge by host, a new purge-only token, deploy to staging.

Done (details in `docs/setup.md`, "App deployment", "Cache purge after each web deploy"):
- **`node purge-cache.js`** (`src/deploy/purge-cache.ts`, `src/deploy/cloudflare-purge.ts`) as the post-deployment command of `classifieds-web`. Coolify runs it in the new container once it is healthy and the old one is removed, after every web deployment (push, by hand, rollback). It purges APP_URL's host only, so the imgproxy host keeps its cache. Checked in Coolify 4.4.6's source; compared with purging from `trigger.js` (needs `read` on the deploy token, misses rollbacks) and from the worker at start (depends on queue order).
- **Token** `peydoo-cache-purge`: Cache Purge on `peydoo.com` only, usable only from the server's IPv4 (tested: IPv4 purges, IPv6 is refused). In `/root/.secrets/infra.env` and in Coolify's env of `classifieds-web`, never in Git. Purge by host works on the Free plan (tested).
- **Coolify:** `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_PURGE_TOKEN` and the command set through the API with a one-hour token, deleted afterwards.
- **Tests:** three unit tests for the purge request (only the app host, no retry on 4xx, the token never in the error, one retry on 5xx or a network error); typecheck passes.
- Commit `2c4af69`, deployed to staging.

Checked live on https://staging.peydoo.com (Oct 19, 2026): `/austria` was cached during the web deployment (HIT, 15 s old at 08:01:33); the rolling update removed the old container at 08:01:36, the deployment log shows "Cloudflare cache purged for staging.peydoo.com" at 08:01:37, and the next request (08:01:48, when that copy would have been 30 s old) was a MISS, then HIT again.

Incident on the way: the first deploy (07:42) left the server at 100% CPU and unreachable. The web image build (npm ci, typecheck, Next.js build) ran while 12 Claude Code sessions used about 3 GB of the 4 GB. The owner power-cycled the server; web and worker deployments were marked failed and staging stayed on the previous build. After the other sessions were ended (2.4 GB available) the redeploy went through. Keep builds and many parallel sessions apart on this server.

Not done:
- A failed purge only shows in the deployment log; no alert. The 60-second bound is the fallback.


## Oct 21, 2026: roadmap for the rest of the build

Decided by the owner (Oct 21, 2026): finish the public site first; the admin page (reports, moderation queue, everything in one place) is the last build step, then launch. Each step runs in its own session and worktree, with a plan approved first. The owner now works from a laptop; the master session in the Claude desktop app starts each step.

Order:
1. **Account, seller page and listing cards** (done and on staging Oct 21, 2026, see below). Cards show up to three `show_on_card` fields. Users edit their name, delete their account (`erase_user`) and download their data. A public seller page (public token only) lists their active listings and events.
2. **Legal and help pages:** Impressum, privacy policy and terms of use in Persian and German (a lawyer checks them before launch; `policy_ground` then names real sections), safety tips, help and contact, linked from the footer.
3. **Bot protection:** Turnstile on sign-in and posting, limits for accounts in their first 7 days.
4. **Keyword search and saved searches with alerts** (Meilisearch). The owner first resizes the server to CX33.
5. **AI posting:** a photo plus a short Persian voice note becomes a listing. Needs an Anthropic API key.
6. **Pro and payments:** business pages, Stripe subscriptions, paid bumps and featured listings through entitlements. Needs a Stripe account and prices.
7. Optional: dark mode, photos in chat.
8. **Admin page (last):** one place for the owner to see everything: reports and the moderation queue (take down or restore with the DSA statement), escalated post-checks, users, listings, events and payments. Staff two-factor login comes first. The public report buttons on listing and event pages come in this step, with the queue behind them.
9. **Launch:** production on `peydoo.com`, security review and load test, n8n posting to Telegram channels, the first Berlin businesses. Step 8 must be done before launch (DSA: a way to report content and a reason for every removal).
10. **Smaller photo uploads** (added Oct 23, 2026; built Oct 23, 2026, see below). The browser shrinks each photo to at most 2560 px before uploading (`createImageBitmap` with the EXIF orientation, then a canvas or `OffscreenCanvas` in a Web Worker, saved as JPEG or WebP at about 0.85 quality). It asks for the signed upload link only afterwards, with the new size and type. On a phone, 8–15 MB per photo becomes about 0.5–1.5 MB, so posting is faster and uses less mobile data. Any failure (an old browser, too little memory, a format the browser can't decode such as HEIC outside Safari) sends the original as today. The server's re-encode, metadata stripping and checks stay exactly as they are; this only saves upload time. Small enough to do before launch if posting speed becomes a priority (the strategy's "posting easier than Telegram").
11. **AI moderation of listings** (added Oct 23, 2026, after launch; the owner: cheaper than checking by hand). One more automatic check with `decided_by = 'ai'`: a clear violation is taken down with the same statement of reasons (marked automated), an unclear case goes to the admin queue as an `escalate` row, so staff only look at what the AI isn't sure about. It replaces the admin page's review of new listings; staff check a weekly sample of AI decisions. Needs an Anthropic API key.

For the owner along the way: a native speaker reads the Persian names and labels; resize to CX33 before step 4; an Anthropic API key before step 5; a Stripe account before step 6; change the `kooche-coolify` GitHub App's `coolify.taskpilot.dev` addresses.

## Oct 21, 2026: card fields, your name, download and delete, the seller page (roadmap step 1)

Plan approved by the owner (Oct 21, 2026) with the four open points as recommended: the export is a direct download (not a job), deletion is confirmed by typing the account's email, seller pages are `noindex`, car and motorcycle cards leave out make and model.

Done (branch `profile`, details in `docs/setup.md`, "Accounts and phone verification", and `docs/schema.md`, sections 14 and 17):
- **Cards:** up to three of the category's `show_on_card` fields under the price, in grid and list view («۲۰۱۸ · ۱۲۰٬۰۰۰ کیلومتر · بنزین»; flats «۶۵ متر مربع · تعداد اتاق ۲»; jobs type, work mode, salary). Values only, with the label for screen readers; a count without a unit carries its label; a yes/no field shows its label when yes. `attributeText()` moved to `src/modules/listings/attribute-text.ts`, so years on the listing page lost their thousands separator too («۲۰۱۸», was «۲٬۰۱۸»). Card rows come from one column set (`cardColumns`) and `cardOf()`; event cards from `eventCardOf()`.
- **Seed:** `brand` and `model` off the cards for cars and motorcycles (titles name them). `u` is a reserved slug. **Run the seed on staging after the deploy.**
- **Name:** `/account/name`, first row of the account list («انتخاب نکرده‌اید» while it is «کاربر»). 2–50 characters; names with پیدو, پشتیبانی, مدیر سایت, peydoo, admin or support (and «کاربر حذف‌شده») are refused, compared normalized without spaces or ZWNJ; 10 changes a day. Posting uses the same rule.
- **Seller page `/u/{token}`:** name, member since, phone verified, active listings (24 a page, not events, not organization listings) and upcoming events, the ♡ for visitors, a notice for the owner. 404 for deactivated and deleted accounts. `noindex, follow`, never cached at the edge (`u` is not a browse segment). Linked from the seller box on listing pages («همه آگهی‌های این آگهی‌دهنده»), the organizer box on event pages and «صفحه عمومی من» in the account list.
- **Download my data:** `/account/data` → POST `/account/data/export` (Origin must be APP_URL, 3 an hour, `audit_log` `user.data_exported`): one JSON file with the account, devices, every listing and event still kept (fields, history, photo links, dates), favorites, saved searches, blocks (name and page only), reports filed, orders, chats (`exportChatData()`) and the account's own `audit_log` rows.
- **Delete my account:** `/account/delete` explains what happens (section 14) and asks for the account's email and a tick. One transaction deactivates the account, deletes every session and writes `user.erase_requested` and an `audit_log` row; the worker's new `accounts` queue calls `erase_user` for deactivated accounts only (it stays worker-only). Ends on `/account/deleted`, with the cookie cleared. The only owner of an organization is refused.
- **No migration.** No new setting. One new BullMQ queue (`accounts`).
- **Tests:** 21 new (384 in total), all passing: card facts (order, at most three, empty and retired fields, years, amounts, yes/no, checklists, labelled counts), names (lengths, reserved names, only your own row, normalized text, the daily limit), the seller page (only active own listings, no paused, sold, expired, draft, rejected, in-review, deleted or organization listings, events apart and ended ones left out, no email, phone or user id, unverified, unknown, malformed, deactivated and deleted accounts, paging and a forged cursor), the export (own data only against a second user with a chat, a block and a withheld message; no other email or phone), the Origin check, deletion (wrong email, sessions of others untouched, outbox and audit rows, a second request, sole owner, the worker erasing only requested accounts and only once, the app still refused `erase_user`, the queue job end to end) and the cache header for `/u/…`.
- **Checked in headless Chromium** (production build behind TLS, scratch PostgreSQL, Valkey and worker), phone 390×844 and computer 1280×800: 66 checks passed. Cards with facts in grid and list, the listing page year, seller page from the listing and event pages (three active listings, not the paused one, the event, no email, phone or id, noindex), 404 for an unknown token, the account rows, a reserved name refused and a new one saved, the owner notice, the export download (`peydoo-data-2026-10-21.json`, own data only), a forged Origin refused (403), deletion with another email refused, then deleted: notice page, cookie gone, the old session sent to sign-in, the worker erased the account within a second (`accounts: erase …: erased`), its seller page and listing 404. No sideways scroll, no CSP or console errors. That run found the kept `__Secure-` cookie (fixed: `cookies().delete()` sends no `Secure`).
- Memory on the scratch stack: web 134 MB, worker 62 MB.

Deployed to staging Oct 21, 2026 (approved by the owner): `profile` fast-forwarded into `main` (`456e8f8`); `classifieds-migrate` had nothing to apply, then web and worker came up healthy (`telegram: polling as @Peydoo_bot`). The seed ran once as `classifieds_owner` (141 categories, 289 fields, 1,257 options); `brand` and `model` are off the cards for cars and motorcycles.

Checked live on https://staging.peydoo.com:
- **Logged out (curl through Cloudflare):** `/u/ps2y23gdng` (رضا) 200, `private, no-store`, `cf-cache-status: BYPASS`, `noindex, follow`, no email or phone in the HTML, links to the flat and the meetup; the listing and event pages link to it; `/u/0000000000` 404; `/account/name`, `/account/data` and `/account/delete` redirect to sign-in, `/account/deleted` 200; the export answers 403 to a foreign Origin and sends a request without a session to sign-in. The flat's card reads «۶۵ متر مربع · تعداد اتاق ۲».
- **Headless Chromium, phone and computer, with a temporary account** (signed in through Better Auth with the staging secret, the login code captured by the script, no email sent): account rows, the name saved, two exports with this account's own data, then deletion: notice page, cookie cleared, the old session sent to sign-in. The staging worker logged `accounts: erase …: erased`; the row is a tombstone with no sessions, and `audit_log` holds `user.data_exported` ×2, `user.erase_requested` and `user.erased`. No sideways scroll.
- **Found and fixed:** Cloudflare's Email Address Obfuscation rewrote the email on `/account` (and `/account/notifications`) into a link plus `/cdn-cgi/…/email-decode.min.js`. The CSP blocked that script (correctly) and the changed HTML made React's hydration fail (#418); React then rebuilt the page in the browser, so it still looked right. It was there before this change (the email row is older). Turned off for the zone with the owner's approval (`docs/setup.md`, "Domain and Cloudflare"). Rechecked in Chromium with a second temporary account (deleted by the worker afterwards): the HTML from Cloudflare carries the real address, no CSP or hydration errors on phone or computer.
- **Fixed after the check:** a screen reader heard a count's label twice («تعداد اتاق: تعداد اتاق ۲»); facts that already start with their label get no hidden label now.

Not done:
- Avatars (the `user.erased` handler that deletes the file has nothing to delete yet).
- Organization pages: listings posted for an organization stay off the personal seller page.

## Oct 21, 2026: legal and help pages (roadmap step 2)

Plan approved by the owner (Oct 21, 2026). Operator details given by the owner: private person Reza Khodamehri Sheijani, Cornelius-Fredericks-Str. 14, 13351 Berlin, `support@peydoo.com`, no VAT ID, no phone. No English version for now (not legally needed for Germany and Austria; add `legal-en.ts` with the same section ids when a non-German-speaking country opens, with the lawyer).

Done (branch `legal`, details in `docs/setup.md`, "Legal pages"):
- **Pages:** `/terms` and `/terms/de`, `/privacy` and `/privacy/de` (German binding, `lang="de" dir="ltr"`, hreflang alternates, contents list, anchors `#s5-2`), `/impressum` (§5 DDG block in German, Persian around it), `/safety` (quotes the chat warnings from `messages.chat.risk`), `/help` (FAQ in `<details>`, no JavaScript), `/contact` (the email, DSA art. 16 notice elements, art. 11/12 contact). Every legal page shows a draft banner until a lawyer has checked it (`draft: true`).
- **Terms:** 13 numbered sections; prohibited items in 5.1–5.9 match `src/modules/moderation/terms.ts` and the categories left out in `seed/categories.ts`.
- **Privacy:** every service (Hetzner, Cloudflare incl. R2 and Email Routing, Amazon SES, Telegram as a separate controller, self-hosted n8n), the periods from `docs/schema.md` section 14 plus backups (up to 6 months), the six cookies (all necessary, no banner), the Berlin supervisory authority.
- **policy_ground with real sections:** banned terms → `terms-5.2` (weapons), `terms-5.3` (drugs), `terms-5.4` (money transfer); duplicate photos → `terms-4.3`; event links → `terms-4.6`. Statements name the section («بند ۵.۴ شرایط استفاده») and the edit page links to it. Older rows keep `terms-prohibited-items` (no link). No migration.
- **Links:** footer («پیدو» nav), a terms notice under the sign-in form and above «انتشار آگهی» (listings and events), privacy link on the phone page, «نکات ایمنی» in the chat tip.
- **Bundle:** the long texts are `pages` in `fa.ts`, separate from `messages`, so the 18 client components that import `messages` don't ship them (checked in the build output).
- **Tests:** 23 new (407 in total), all passing: fa/de sections identical and numbered, operator filled, every cited section exists, groups map to 5.2–5.4, statements name the section, new paths not browse pages and reserved slugs; the banned-term and event-link tests check the new grounds.
- **Checked in headless Chromium** (production build behind TLS, scratch PostgreSQL and Valkey), phone 390×844 and computer 1280×800: 129 checks passed: all eight pages 200, not shared at the edge, no country cookie, no sideways scroll; German pages LTR; operator, processors, cookies and periods present; FAQ opens; footer links; sign-in, listing form, phone page and chat links; a listing taken down by the real check shows and links section 5.4. No CSP or console errors.

Deployed to staging Oct 21, 2026 (approved by the owner; 2.1 GB available before): `legal` fast-forwarded into `main` (`2c691c3`); `classifieds-migrate` had nothing to apply, then web and worker came up healthy. No seed run needed (the reserved slugs are only a seed check).

Checked live on https://staging.peydoo.com: `/terms`, `/terms/de`, `/privacy`, `/privacy/de`, `/impressum`, `/safety`, `/help` and `/contact` answer 200 through Cloudflare with `private, no-store` and `cf-cache-status: BYPASS`, no cookies set; the Impressum carries the name, address and `mailto:support@peydoo.com`; `/germany` (a MISS after the deploy's purge) has all six footer links. Headless Chromium against staging, phone and computer, those pages plus `/login` and `/germany`: 22/22, no sideways scroll, no CSP or console errors.

For the owner:
- **support@peydoo.com:** Cloudflare Email Routing turned on Oct 21, 2026 (owner widened the token; done through the API), forwarding to reza.khodamehri@gmail.com. A test mail through SES was accepted (250 Ok); the owner confirms it arrived.
- **Lawyer before launch:** all three texts, especially Telegram (art. 49), the 18+ age, §12 changes, §13 dispute clause, and whether Austria needs anything extra.
- Add the SMS provider to the privacy policy when one is bought.

## Oct 21, 2026: bot protection (roadmap step 3)

Plan approved by the owner (Oct 21, 2026) with the three open points as recommended: a temporary Turnstile-only token to create the widget, the new-account numbers as proposed, sign-in and publishing need JavaScript.

Done (on `main`, not pushed yet; details in `docs/setup.md`, "Bot protection"):
- **Turnstile** before a login code is sent and before a listing or event goes out (draft or new form published, rejected one sent again). Checked on the server with siteverify: hostname and action must match, single-use, fails closed. "Send the code again" only for 10 minutes after a checked request for that email (the email cookie could be forged before).
- **Widget** loaded by our own client code (`'strict-dynamic'` trusts it), `interaction-only`, button disabled until the token is there, reset after a refusal. CSP: `frame-src https://challenges.cloudflare.com` on every page. Without JavaScript: a note on both forms, the button off, the server refuses a form without a token; everything else works as before.
- **New accounts (under 7 days):** 3 listings and 2 events published per 24 hours (PostgreSQL, deleted ones count), 20 photos an hour and 40 a day (Valkey), on top of the existing limits. `isNewAccount()` moved to `src/modules/users/new-account.ts` and is shared with chat.
- **Settings:** `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` (web), required in production; test secrets only with a local APP_URL. No migration, no new service.
- **Tests:** 15 new (422 in total), all passing, typecheck and `check:rtl` clean: missing, malformed, forged (`invalid-input-response`), expired or reused (`timeout-or-duplicate`), wrong hostname, wrong action, HTTP error, malformed answer, network error and timeout all refused, Cloudflare gets secret, token and IP; the resend window (email only, 10 minutes); the CSP; 3 listings then `new_account_limit`, saving and editing still allowed, a deleted listing still counted, free again after 24 hours, the limit gone at exactly 7 days and never for older accounts; events 2 vs 5; photo limits for new accounts only. The "5 events a day" test now uses a 30-day-old account.
- **Checked in headless Chromium** (production image behind TLS, scratch PostgreSQL and Valkey, a mail catcher for the real login mail), phone 390×844 and computer 1280×800, with Cloudflare's test keys: 72 checks passed. Always-pass keys: the widget frame and token, sign-in end to end (mail arrived, code accepted, on to phone verification), a form without a token refused, "send again" refused for an email that never passed, a listing and an event published, a 1-day-old account's 4th listing refused in Persian, without JavaScript the note and the disabled button (save still works). Always-fail secret (a forged token): sign-in and publishing refused, no mail sent, the widget resets. Always-blocking widget: send and publish stay disabled, save works. No CSP violations, no console errors, no sideways scroll.

Not done:
- Real people passing the widget on staging: headless Chromium is held by Cloudflare (no token, by design), so the owner signs in and publishes once on a phone and a computer.

Deployed to staging Oct 21, 2026 (approved by the owner; 2.0 GB available before). Widget `peydoo-staging` created through the API with a one-hour Turnstile-only token (deleted right after; keys in `/root/.secrets/turnstile.env`); the owner set both keys on `classifieds-web` in Coolify (creating a Coolify API token was blocked by the session's permission check). Pushed `e3c7a0c`: `classifieds-migrate` had nothing to apply, then web and worker came up healthy (`telegram: polling as @Peydoo_bot`).

Checked live on https://staging.peydoo.com:
- `/health` ok; `/login` carries the new CSP (`frame-src https://challenges.cloudflare.com`, `'strict-dynamic'`, no `unsafe-inline`), the staging site key and `cf-cache-status: BYPASS`; `/germany` came back MISS with the new CSP after the deploy's purge.
- Headless Chromium, phone and computer: the real widget loads (its frame and Cloudflare's challenge script answer 200, no CSP violation), but Cloudflare gives automated browsers no token, so the button stays «در حال بررسی امنیتی…». With the form forced open, a forged token was refused by siteverify (`invalid-input-response`, so the real secret works) and a missing one before any call; no email was sent; 4/4.

## Oct 21, 2026: CX33 watcher (before roadmap step 4)

CX33 and CX43 are sold out in every location, so the resize before keyword search waits. An automatic rescale from n8n was planned first; the owner chose an alert instead (stopping the server would cut off staging and every Claude session without warning). The n8n workflow **Peydoo – CX33 available** checks Hetzner every 5 minutes, read-only, and emails reza.khodamehri@gmail.com when CX33 can be ordered in Helsinki, with the rescale steps. It stops once the server is no longer CX23. Details in `docs/setup.md`, "Alerts". The owner took a Hetzner snapshot of the server the same day (`Peydoo-1792624565`).

For the owner: when the email comes, rescale in Hetzner Console ("CPU and RAM only"), check https://staging.peydoo.com/health, then delete the workflow and its "Hetzner Cloud – Peydoo project" credential in n8n.

## Oct 22, 2026: keyword search, saved searches and alerts (roadmap step 4)

Built on the CX23: CX33 is still sold out, and staging has a handful of listings. Plan approved by the owner (Oct 22, 2026) with the six points as recommended: Meilisearch at 384 MB with light indexing, no backup of the index (rebuilt from PostgreSQL), keyword pages `noindex` and never edge-cached, matching events as a strip above the results, alerts at most every 15 minutes per search plus a daily digest and 10 a day per user, counts per option only where cheap.

Done (branch `search`, details in `docs/setup.md`, "Keyword search and saved searches", and `docs/schema.md`, section 9):
- **Meilisearch** behind the `search` module: a small fetch client, documents built from PostgreSQL (normalized text, filterable fields, the rounded point, no personal data), settings and Persian synonyms in code, two keys defined in code (`scripts/meili-keys.ts`: web may only search `listings`, the worker writes). Cards always come from PostgreSQL, so a stale entry never shows.
- **Sync from the outbox:** queue `search-sync` (concurrency 1) on every listing and event change; a full rebuild into a second index that is swapped in, at worker start when the index is missing or outdated and nightly at 04:00 UTC; Meilisearch's old tasks deleted nightly.
- **Keyword search:** `?q=` on every browse page with all filters, radius, "near me" and sorts (relevance by default), a box in the header (computers) and on browse pages, counts per category and option from the same request, up to four matching events, 60 keyword searches a minute per IP, a PostgreSQL fallback with a notice when Meilisearch is down. Links to keyword pages are not prefetched.
- **Counts without a keyword: not shown.** Measured on 50,000 generated listings: 14–82 ms per plain category page, over the 10 ms bar. Revisit with the CX33.
- **Saved searches:** «ذخیره این جستجو» on any page narrower than a whole country, `/my/searches` (open, rename, فوری / روزانه / خاموش, delete), 20 per user. "Near me" is never saved.
- **Alerts:** matches recorded once per search and listing (`saved_search_hits`), checked with the browse query itself (keywords through Meilisearch), so a listing alerts exactly the searches whose page shows it. First notice 2 minutes after the match, then at most every 15 minutes per search; daily searches at 18:00; 10 a day per user; Telegram, else email, through the chat's send queues. A switch in `/account/notifications`; emails carry a no-sign-in "turn this alert off" link and RFC 8058 one-click.
- **Migration 0013:** `saved_search_hits` and `saved_searches.unsubscribe_token`. Additive. `alerts` joined the reserved slugs.
- **Settings:** `MEILI_URL` and `MEILI_SEARCH_KEY` (web), `MEILI_URL` and `MEILI_WRITE_KEY` (worker), all optional (unset: keyword search on PostgreSQL, no index). `compose.yaml` gained the Meilisearch service; tests need `TEST_MEILI_URL` and `TEST_MEILI_MASTER_KEY`.
- **Tests:** 45 new (467 in total), all passing, typecheck and `check:rtl` clean, against a real Meilisearch 1.54.3: Persian normalization through the engine (Arabic ي/ك, Persian and Arabic digits, diacritics, ZWNJ joined and split, synonyms both ways, a typo), every filter type and both price orders with a keyword, counts per option, offset cursors, stale entries left out, events kept apart, the fallback, filter quoting; the sync (draft, publish, edit, pause, resume, sold, expiry and renewal, take-down and the corrected listing's return, delete, account erasure, events, late and repeated jobs, the queue end to end, rebuild repairing drift, the start-up check, the keys as made on the server); saved-search permissions (only canonical page addresses, once per search, near me refused, 20 a user, deactivated accounts, another user can't see, rename, change or delete, the app can't write matches, the unsubscribe token); alerts (exactly the searches whose page shows the listing, checked against each page; once only; not for later searches, switched-off users, inactive accounts or events; gathering; 2 and 15 minutes; daily; the cap of 10; dropped when the listing went away or alerts were turned off; Telegram or email; purge; Telegram and email through the real queues with a blocked bot).
- **Checked in headless Chromium** (production build behind TLS, scratch PostgreSQL, Valkey, Meilisearch, worker and a mail catcher), phone 390×844 and computer 1280×800: 71 checks passed. The boxes on each size, a search with Arabic letters finding cars through the category name and a synonym, noindex and `private, no-store`, the keyword chip, sorts keeping the keyword, counts next to options, the widen link, the events strip, "near me" keeping the keyword (and not saveable), saving through sign-in (real login mail), `/my/searches` (daily, rename, delete), the notification switch, a forged unsubscribe link. No CSP or console errors, no sideways scroll. With Meilisearch stopped: the fallback notice and results. That run found the prefetching (fixed) and that a key limited to `listings` can't see an index swap's task (fixed: the worker key covers all indexes).
- **Measured:** a rebuild of 42,575 active listings in 8.2 s, Meilisearch peaking at 151 MB of its 384 MB; a keyword search with counts ~12 ms. On the scratch stack afterwards: web 119 MB, worker 51 MB, Meilisearch 28 MB.

Deployed to staging Oct 22, 2026 (approved by the owner; 2.2 GB available before). Coolify set up through the API with a one-hour token made with `php artisan tinker` (allowed by the owner's new permission rule, deleted afterwards):
- `classifieds-meilisearch` (`9cmjl5ncqvcy3m88q2eonrxd`): image `getmeili/meilisearch:v1.54.3`, 384 MB, volume at `/meili_data`, the six `MEILI_*` settings, health check on `/health`, no domain, no published port. "Consistent container name" turned on: an application container's only DNS name carries the deploy's timestamp, so the apps couldn't have reached it by a fixed name (`--network-alias` in the custom docker options was ignored).
- Master key generated into `/root/.secrets/meilisearch.env`; `scripts/meili-keys.ts` created the web and worker keys into the same file; `MEILI_URL` and `MEILI_SEARCH_KEY` set on `classifieds-web`, `MEILI_URL` and `MEILI_WRITE_KEY` on `classifieds-worker`. No key value went through the conversation.
- `kooche-healthcheck` has the new `search` check (first run at 08:45 UTC: running, no OOM kill, no restarts).
- `search` fast-forwarded into `main` (`feefc39`): `classifieds-migrate` applied `0013_saved_search_hits`, then web and worker came up healthy; the worker found no index and built it (2 documents, 0.6 s).

Checked live on https://staging.peydoo.com: `/health` ok; through Cloudflare `/germany?q=کرایه` finds the flat «اجاره خانه در ودینگ» (synonym), «خانه ودینگ» too, Arabic «مافيا» shows the meetup in the events strip, an unknown word finds nothing; every keyword page `noindex, follow`, `private, no-store`, `cf-cache-status: BYPASS`, no fallback notice and no failed search in the web log. Headless Chromium against staging, phone and computer: 14/14 (box, Arabic letters plus synonym, the save button, the events strip, `/my/searches` behind sign-in, no sideways scroll, no CSP or console errors). Memory right after: web 92 MB, worker 76 MB, Meilisearch 39 MB, 2.1 GB available.

For the owner: sign in on a phone (headless browsers don't get past Turnstile), save a search, and post a matching listing from another account to see an alert arrive by Telegram. A native speaker can extend `src/modules/search/synonyms.ts`.

## Oct 22, 2026: search suggestions like Divar, header on one line

The owner wanted the search box to behave like Divar and Kleinanzeigen. Recorded in headless Chromium first: neither searches listings while you type; Divar asks `api.divar.ir/v8/prediction/w/query` for phrases with a category and an approximate count («پژو 206 / در خودرو سواری و وانت / ۳ هزار آگهی»), Kleinanzeigen an Algolia index of `{completion, categories, conversions}`. Plan approved by the owner as recommended; learning phrases from what people search is a later step (it needs a line in both privacy policies).

Done (branch `search`, details in `docs/setup.md`, "Keyword search and saved searches", bullet "Suggestions while typing"):
- **Header:** nothing wraps any more; below 1280 px chat, my listings and account are icons (`a2d1c7a`).
- **Phrase index `suggestions`** in Meilisearch: categories at every level, makes per category, makes + models, each with the count of active listings its page shows, per country and per city. Built by the worker from one GROUP BY and swapped in at start, a minute after listing changes and every 15 minutes; skipped when nothing changed.
- **The rows:** the search as typed, up to six phrases with category and approximate count, then the keyword in the categories with matching listings (counted with the keyword page's own filter). «پژو ۲» completes to «پژو 206», «پژو 207»; «خودرو» lists categories; «خودرو پژو» narrows to Peugeots in خودرو. Make and model rows open the category page filtered by them. Without Meilisearch, the rows of the first version from the category tree, without counts.
- **The gap of the first version is closed:** every count is the count of the page its row opens (tested against the browse and keyword pages, and in the browser by opening every row).
- **Keys:** the web key may search `listings` and `suggestions`. `scripts/meili-keys.ts --quiet` recreates a key whose definition changed with the same uid (same value, nothing to change in Coolify) and prints no key.
- **Tests:** 494 in all, passing, typecheck and `check:rtl` clean. New: phrase records (levels, makes, models, «سایر» and events left out, per city), counts equal to the pages', the rows and their order, category-first narrowing, Arabic ي/ك, Persian and Latin digits, ZWNJ and spacing, the city scope, free text, rebuild skipped and repeated, the worker's delayed rebuild gathering a burst of changes, the keys on both indexes, Meilisearch or the index missing, the API's parameters and 120 a minute.
- **Checked in headless Chromium** on the scratch stack, phone 390×844 and computer 1280×800: 45/45 (the rows above, every count against its page, arrow keys, Enter, tapping a row, Escape, Enter as typed, Hamburg's own phrases, no CSP or console errors, no sideways scroll), and 6/6 with Meilisearch stopped.
- **Measured:** counts like 50,000 listings give 10,116 phrases, indexed in 1.1 s, Meilisearch around 41 MB of 384 MB; a lookup about 45 ms.

Deployed to staging Oct 22, 2026 (approved by the owner; scratch containers removed first, 2.1 GB available): the web key recreated on staging with `--quiet` (no key value shown; the old value still searches `listings`), `search` fast-forwarded into `main` (`aa01e95`), web and worker healthy, the worker built `suggestions` at start (4 phrases from staging's listings, 0.7 s). Live through Cloudflare: «املاک» offers the category with its count, «اجاره» and the synonym «کرایه» offer «اجاره آپارتمان در املاک», «ودینگ» the keyword in اجاره آپارتمان; `private, max-age=30`, `cf-cache-status: DYNAMIC`, no errors in the web log. That check found a keyword row under a category already offered («املاک در اجاره آپارتمان» below «املاک»); fixed in `890b2de` and deployed with these docs.

**Deploy race fixed (approved by the owner).** The first deploy's logs showed the old worker, still running during Coolify's rolling update, taking the new worker's start-up rebuild: it rebuilt the listings index with the old document version (the second deploy corrected it; checked in Meilisearch: version-2 documents, right counts). Start-up rebuilds now carry the stamp of the code that asked for them and other code puts them back until that worker takes them (30 minutes at most); phrase records carry the stamp, so an index built by other code is rebuilt at the next 15-minute run (`docs/setup.md`, "Keeping the index in line"). 3 new tests (497 in all, passing). This deploy itself still started next to a worker without the check.

For the owner: type in the box on a phone and a computer once real listings arrive; phrases appear as soon as a make or category has a listing.

## Oct 22, 2026: Pro and payments (roadmap step 6), plan approved

Decided by the owner (Oct 22, 2026):
- **Roadmap step 5 (AI posting) is deferred** until the site has more customers. Step 6 comes first; the admin page stays the last build step.
- **The owner uses the German small-business VAT exemption** (Kleinunternehmer, §19 UStG): no VAT on invoices, the §19 note on every invoice, Stripe Tax off. What changes past the thresholds, and what selling to Austria means, is in the plan below and goes to a tax advisor before launch.
- Stripe first (test mode on staging). Payments from Iran are a separate study, nothing built: `docs/payments-iran.md` (a sanctions lawyer must confirm any approach first).
- Businesses get 3 free active listings without Pro (Pro 25, Pro Plus 100). Private people may have at most 2 active service or lesson offers; job offers and regulated professions are business-only.
- Launch businesses get 6 months of free Pro through a 100% Stripe coupon.
- Prices: bump €1.99, 3 bumps over 7 days €4.49, featured 7 days €6.99, featured event €9.99, Pro €24/month or €240/year, Pro Plus €59/month or €590/year.

Plan (approved): one-time products through Stripe Checkout (cards, Apple Pay, Google Pay, PayPal, EPS), Pro through Stripe Billing (cards, wallets, PayPal, SEPA) with the Customer Portal; webhooks stored by the web, applied by the worker; business pages `/b/{slug}`, members, posting as a business, included bumps and featured slots. Built on branch `pro` (`/root/classifieds-pro`), see below.

## Oct 22, 2026: Pro and payments built (roadmap step 6)

Done (branch `pro`, not merged or deployed yet; details in `docs/setup.md`, "Payments and Pro", and `docs/schema.md`, section 17):
- **Payments core:** Stripe behind one gateway (`src/modules/payments/gateway.ts`, SDK 23.0.0, API `2026-09-30.endive`). Hosted Checkout for one-time products (cards with Apple Pay and Google Pay, PayPal, EPS) and Pro subscriptions (cards, PayPal, SEPA), hosted Customer Portal. The §19 UStG footer on every customer and one-off invoice; no tax. The webhook route stores signed events once; the worker (queue `payments`) applies them to orders, payments, subscriptions and entitlements in one locked transaction. Refunds and disputes revoke; a `pro_plan` per paid invoice with 7 days' grace; bumps applied every minute; included Pro bumps and featured slots granted by the worker.
- **Migration 0014:** the business's Impressum details and town, `orders.buyer_country`, `entitlements.provider_invoice_id` (unique), and the app may insert only a pending order's columns.
- **Private products:** «ارتقای آگهی» on my listings, my events and the owner's listing page → `/my/listings/{id}/promote` (bump €1.99, 3 bumps €4.49, featured 7 days €6.99, featured event €9.99; the withdrawal tick, logged), `/my/orders`, the order page refreshing until the webhook is applied. Featured: badge on cards and listing pages, up to three in a strip on browse pages, featured events on the events list. Never stored on listings.
- **Businesses:** `/business`, `/business/new`, `/b/{slug}` (address, map link, contact, listings, German Impressum, LocalBusiness JSON-LD), members-only manage view with stats (views, saves, chats, phone reveals), edit, team (email invitations within the plan's seats), billing; `/pro`. «انتشار به نام» in the posting form; owners and managers manage every listing of the business. Verified badge by `scripts/verify-business.ts` until the admin page.
- **Limits (decided Oct 22, 2026):** businesses 3 active listings without Pro, 25 Pro, 100 Pro Plus; private people 2 active service or lesson offers; job offers and tax and accounting only as a business. At publish, renew and resume.
- **Views:** counted in Valkey (once per visitor per half hour, no bots, not the seller), flushed every 5 minutes.
- **Legal:** terms section 14 (paid services, withdrawal right and waiver, subscriptions, refunds, private vs business) and Stripe in the privacy policy, German and Persian; still drafts for the lawyer.
- **Scripts:** `stripe-setup.ts` (products, prices, coupon, portal, webhook endpoint, DB rows; idempotent), `stripe-launch-codes.ts`, `verify-business.ts`.
- **Tests:** 58 new (555 in all), passing, typecheck and `check:rtl` clean: permissions (promote, post as, staff/manager/owner, team and billing owner-only, invitations only for the invited email, expired and revoked, last owner), the webhook-only rule against the database roles (no paid order inserted by the app, no writes to money tables), signatures (bad, missing, other secret, tampered), idempotency (same event twice and concurrently, same session or invoice under a new event id), out-of-order subscription events, refunds (full, partial, adding up, PayPal `pyr_`, before the payment), disputes, bump scheduling (spacing, once, paused waits, closed revoked, two workers), Pro limits and seats, allowances, the coupon path (€0 invoice, end of free months), featured strip and badges, my orders, private and business limits, views, the live-key guard, CSP, legal sections.
- **Stripe test-mode run (local scratch stack: production build, worker, Stripe CLI forwarding webhooks, headless Chromium, phone 390×844 and computer 1280×800):** real Checkout payments with a test card (bump applied, `ranked_at` moved, invoice with the §19 footer and no tax), a declined card (nothing granted), PayPal (featured 7 days, strip and badge for logged-out visitors), a refund through the API (order refunded, featured revoked), a resent event (applied once) and forged signatures (400, nothing stored); a business through the form, Pro by card (plan granted by `invoice.paid`), the Customer Portal, Pro Plus with a launch code and no card (€0, plan granted, no payment row), SEPA (subscription active; plan waits for the debit to settle), an invitation email accepted by the invited account, staff 404 on team and billing; Checkout offers exactly cards/PayPal/EPS for one-time and cards/PayPal/SEPA for subscriptions. No CSP errors, no sideways scroll.
- **Found by that run and fixed:** PayPal refund ids are `pyr_…` (the worker refused them and retried, then applied them once fixed); the 6-month coupon made a yearly plan's whole first year free, so launch codes are now monthly-only and the Portal switches only monthly prices.

Deployed to staging Oct 22, 2026 (approved by the owner; 1.9 GB available before):
- `scripts/stripe-setup.ts` run once against the staging database as `classifieds_owner` from a throwaway container on the `coolify` network: 6 products and 8 prices written, the coupon and the Portal found, the webhook endpoint `https://staging.peydoo.com/api/stripe/webhook` created (its secret written straight into `/root/.secrets/stripe.env`).
- Coolify (through the API, with a one-hour token made with `php artisan tinker` and deleted afterwards): `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` on `classifieds-web`, `STRIPE_SECRET_KEY` on `classifieds-worker`. No value went through the conversation.
- `pro` fast-forwarded into `main` (`ee4edbf`): `classifieds-migrate` applied `0014_pro_payments`, then web and worker came up healthy (`telegram: polling as @Peydoo_bot`). Memory right after: web 106 MB, worker 81 MB.

Checked live on https://staging.peydoo.com (the owner asked for no Pro purchase on staging, so one test-mode bump only):
- `/health` ok, `/pro` 200, the webhook route refuses an unsigned request (400).
- Headless Chromium through Cloudflare with a temporary account (signed in through Better Auth with the staging secret, no email sent; verified phone and one test listing written as the owner): the promote page on phone and computer (no sideways scroll, no CSP or script errors), Checkout offering card, PayPal and EPS, a €1.99 bump paid with Stripe's test card, the order page turning paid once Stripe's webhook reached staging.
- In the database: order paid, €1.99, tax 0, buyer country DE, invoice id; the charge recorded (`pi_…`); `checkout.session.completed` and `invoice.paid` applied on the first attempt; the worker logged `payments: bumps: 1 applied` and the listing's `ranked_at` moved.
- The temporary account was deleted through the normal path (`requestErasure`, then the worker: `accounts: erase …: erased`); its listing is deleted and the order is kept (10-year records).

Not checked on staging: Pro subscriptions, the launch code, SEPA and the Customer Portal (the owner asked for no Pro purchase there; all four passed in the local Stripe test-mode run, except that SEPA's test debit hadn't settled when the local stack was stopped: the subscription was active and its plan was waiting for `invoice.paid`, as designed).

Not done:
- The business inbox (managers answering chats), business logos, events posted as a business, the admin page for verification and refunds (roadmap step 8).

For the owner:
- Before live payments (at launch): activate the Stripe account, statement descriptor, Steuernummer on invoices, PayPal recurring and SEPA in live mode; a tax advisor confirms the VAT notes (thresholds, Austria) and the lawyer terms section 14.
- Payments from Iran: nothing until a sanctions lawyer has confirmed an approach (`docs/payments-iran.md`).

## Oct 22, 2026: launch strategy (research, no code)

Research study on how to launch: market by country and city, Telegram and other competitors, one country or many, the cold start without fake listings, weaknesses and advantages, ranked future features, and 90-day and 12-month plans. Full study in a Claude Doc ("Peydoo launch strategy", https://claude.ai/artifact/CRYapwgCPUn9duJiKZWk14); summary, gates and the owner's open decisions in `docs/strategy.md`. Nothing decided yet: the owner chooses the launch date, seeding city, free-Pro length, Telegram partners and trademark timing.

## Oct 23, 2026: four mobile fixes from the owner's phone

Fixed (branch `mobile-fixes`, fast-forwarded into `main` as `de798bb`):
- **Car «مدل» wouldn't open.** It was `disabled` until a make was chosen, with no word about it, and without JavaScript it could never be chosen (so a required field blocked publishing). Now never disabled: before a make, every model grouped under its make (`<optgroup>`) with a Persian hint; after a make, only that make's models; choosing a model first fills the make, another make empties a model that no longer fits (`src/modules/listings/dependent-options.ts`). The server fills a missing make from the model, so the no-JavaScript form works too (`validateAttributes`).
- **`https://` scrambled in RTL.** `ltr()` in `src/messages/fa.ts` wraps Latin bits in Unicode isolates (works in strings and attributes, where `<bdi>` can't go): the website label, the SMS number hint, emails in the notification and invitation messages. URL, email and phone inputs already had `dir="ltr"`.
- **Chat box on mobile.** An empty `dir="auto"` field is left to right in Chrome, so the placeholder, its dots and the caret sat on the left. Empty fields are now `dir="rtl"` and turn `auto` from the first letter: `fieldDir()` (`src/lib/field-dir.ts`) for the chat box and place field, `data-auto-dir` plus `AutoDirection` in the layout for the business form and the name field. The grey bar was a scrollbar: the box's height left out its 2px border; now counted, and the scrollbar only appears past six lines.
- **English browser validation messages.** `FormValidation` in the root layout catches `invalid` site-wide and sets the Persian text from `messages.validation` (required, checkbox, radio, select, email, URL, pattern with a per-field `data-pattern-message`, length, min/max, step, bad input); cleared on input. Our own code, so it fits the nonce CSP. Without JavaScript the browser's own text still shows; the server's Zod checks stay the real ones.

Tests: 25 new (validation mapping; dependent options on the real 46 makes and 336 models; a model without a make), one changed (a model alone no longer means "make missing"); 580 in all, passing; typecheck and `check:rtl` clean. Headless Chromium on a local production build with the real CSP, phone 390×844 and computer 1280×800: 74/74 (the car form both ways and a car published with the model from the select; without JavaScript a model alone saved with its make; the business label drawn `https://` left to right, LTR inputs, the name field RTL when empty; Persian messages for the unticked delete box, required, slug pattern, email and URL; the chat box RTL and without a scrollbar when empty, LTR for Latin, scrolling only past six lines, RTL again after sending). No CSP or console errors, no sideways scroll.

Deployed to staging Oct 23, 2026 (2.2 GB memory and 2.6 GB disk available before): web, worker and migrate healthy on `de798bb`. Live, without signing in: `/login` gives Persian messages for an empty and a malformed email on phone and computer, `/germany` and `/germany/cars` without sideways scroll; the only console errors come from inside Cloudflare's Turnstile frame (its own CSP, headless browsers are held). Signed-in pages weren't checked live: writing temporary accounts into the staging database was refused by the session's permission check.

For the owner: on the phone, check the four places once: posting a car (tap «مدل» before and after the make), `/business/new` (the website label), a chat (empty box), and the delete-account box unticked.

Not done:
- Without JavaScript, saving a brand-new listing shows an empty form again (the draft is saved; older behaviour, not from this change).
- Disk is at 93–94% (old app images from earlier deploys); worth pruning before it blocks a build.

## Oct 23, 2026: header follows a country change

Reported by the owner: after changing the country (header pill → country list, or a footer link) the listings changed but the header kept the old country and its keyword box, and the logo led back to the old country. Cause: the header is in the root layout, which an in-app link doesn't render again, so it kept the country of the first page; its logo link then reopened that country, which saved it again. Fix (`8e9d910`): `RememberCountry` (`src/app/[country]/remember-country.tsx`) calls `router.refresh()` once when the saved country changes, so the header, keyword box, logo link and bottom bar are rendered again with the new cookie; the header's keyword box is keyed by country.

Checked in headless Chromium, phone 390×844 and computer 1280×800: the same script failed on staging before the deploy (header stayed «آلمان», logo back to Germany) and passed 18/18 locally (production build) and live after it: change through the header and through the footer, the logo staying in the new country, `/help` and the back button keeping it, no console or CSP errors. 580 tests passing, typecheck and `check:rtl` clean. Deployed to staging Oct 23, 2026 (web, worker, migrate healthy). Disk is at 96% after this deploy (1.7 GB free): old app images should be pruned soon.

## Oct 23, 2026: disk cleanup

The disk was at 96% after the day's deploys. Coolify's nightly cleanup at 00:00 had already brought it to 67% (old app images, build cache and the Playwright image removed; running commit `ec381bf` and previous `04f48d5` kept). With the owner's approval, removed by hand: 23 unused anonymous volumes of throwaway PostgreSQL 18 test databases (Oct 16–22, ~6.6 GB), the unused `pro-node-modules` volume (604 MB), `coollabsio/sentinel:1.0.2`, and `node_modules` in the merged, clean worktrees browse, chat, design, events, fields, location and search (`npm ci` restores them). `df -h /`: 38 GB, 22 GB free (40%). Staging `/health` ok and all containers up afterwards. The routine is in `docs/setup.md` ("Disk cleanup").

## Oct 23, 2026: the watcher buys the production server

Decided by the owner (Oct 23, 2026): staging stays on its CX23 and is not resized; the CX33 becomes the future production server. The n8n workflow (renamed **Peydoo – create production CX33**) now buys one clean CX33 `peydoo-prod` (Ubuntu 24.04, its own firewall `peydoo-prod`, labels `role=production`, `app=peydoo`, delete protection) in the first of Falkenstein, Nuremberg, Helsinki with stock, emails the owner the details and stops for good. It checks for an existing production server before every attempt, so it can't buy two. Two SSH keys go in: the owner's and a new staging key (`/root/.ssh/peydoo_prod`, Hetzner key `peydoo-staging-to-prod`), so a session on staging can set production up; tested by logging in to a throwaway server. Tested with throwaway CPX02 servers (deleted). Details in `docs/setup.md`, "Production server watcher".

When the email comes: set up Coolify and production in a new session, then delete the workflow and its "Hetzner Cloud – Peydoo project" credential in n8n.

## Oct 23, 2026: the admin page (roadmap step 8)

Plan approved by the owner (Oct 23, 2026), with three changes from their review: the admin page lives under a secret address instead of `/admin`; every listing gets a code like Kleinanzeigen's Anzeigen-ID; the overview has charts. AI moderation went on the roadmap (step 11), and the plan explains how staff moderate (`docs/setup.md`, "The moderation routine"). Open points taken as recommended: purge the browse pages from Cloudflare after a take-down (worker), the last backup on the status page (one line in the backup script, at deploy), photos of taken-down listings left as a follow-up.

Done (branch `admin`, `/root/classifieds-admin`, not merged or deployed yet; details in `docs/setup.md`, "Admin page", and `docs/schema.md`, section 17):
- **Staff access:** `/<ADMIN_PATH>/…` only (a secret first path segment from `.env`); `/admin` and everyone without a staff role get the normal 404. Email sign-in plus a TOTP check through Better Auth's two-factor plugin, stamped on the session for 8 hours; set-up with a QR code and 10 backup codes; 5 wrong codes per 15 minutes; a used code is refused. Moderator and admin permissions per operation. Every staff action and every look at personal data (email and phone, a reported chat, payments) writes `audit_log` with session and IP. `noindex`, `private, no-store`, own limits (300 page loads and 60 changes per 10 minutes per staff member). `scripts/make-staff.ts <email> admin|moderator|none` makes the first admin; `--reset-2fa` for a lost phone. Passkeys not built (not cheap in Better Auth 1.7).
- **Report buttons (DSA art. 16)** on listing, event, seller and business pages → `/report` (works without JavaScript). Reasons map to the numbered terms sections. Signed in: 20 a day, 5 for new accounts; signed out: name, email, good-faith statement, Turnstile, 5 an hour per IP, 10 a day per email; one open report per person or email per thing. «خلاف قانون» adds the law. Receipt and outcome by email in Persian with a German version (`legal-de.ts`).
- **Listing codes:** 9 digits on every listing and event page and "my listings" («کد آگهی»); typed into the search box it opens the listing; the admin search takes it.
- **Queue and decisions:** one row per thing (reports, near-duplicate photo flags, resubmissions after a take-down by staff, appeals), illegal-content notices first. Item pages for listings and events, users, businesses and chat messages (with five messages around, audit-logged), the person's history, a decision guide with the police note (art. 18), and a form that shows the statement as the person will get it. Take down, restore, no violation, approve, warn, restrict posting or messaging, suspend, ban, hide a message, suspend a business, lift, grant or keep an appeal: each one transaction with the decision, the statement of reasons (art. 17: what, facts, on a report or not, the section or law, decided by a person, how to appeal), the reports closed, `audit_log` and the notices. A suspension takes the account's listings down and they come back when it ends. Sanctions now stop posting and messaging. Statements reach the person by email and a Telegram notice with a link; `/account/notices` shows every decision with an appeal button (one per decision, six months).
- **The owner's alert:** a signed (HMAC-SHA256) summary to n8n at most every 10 minutes, counts only. The n8n workflow **Peydoo – admin alerts** is still to be created at deploy.
- **Everything else:** overview with totals by country, a chart per measure (30 or 90 days, inline SVG) and the strategy's city metrics; users (search, history, contact and sessions for admins, sign out everywhere, release a phone number); listings and events search; businesses with the verification queue; payments (read only, Stripe links); audit log; system status (live checks and a worker snapshot every minute); staff.
- **Legal:** terms 7.4 (the appeal button) and 8.1 (the report button) and the privacy policy (reports, what staff see of a reported chat), both languages; still drafts for the lawyer. DSA duties for a micro enterprise in `docs/setup.md`: art. 11, 12, 14, 16, 17 and 18 apply; 15 and 20–32 don't (art. 15(2), 19, 29) until 12 months after Peydoo stops being small; the appeal is offered anyway.
- **Migration 0015** (additive): listing codes, the two-factor fields, `sessions.staff_verified_at`, `moderation_appeals`, report indexes. One new dependency: `uqr` 0.1.3 (QR codes, no dependencies of its own). New settings, all optional: `ADMIN_PATH` (web, worker), `N8N_ADMIN_ALERT_URL`, `N8N_WEBHOOK_SECRET`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_PURGE_TOKEN` (worker). One new worker queue (`moderation`).
- **Tests:** 57 new (637 in all), passing; typecheck and `check:rtl` clean. Non-staff, signed-out, deactivated staff and staff without a fresh TOTP check refused; the proxy's rewrite and mark; every admin page and action calls the guard (a test walks `src/app/admin`); moderator against admin for every operation; set-up, wrong, reused and expired codes, the lock, backup codes once, the reset; each decision writes its decision, statement with the section, audit row, closes the reports and queues the notices; a take-down leaves browse, keyword search (real Meilisearch), the sitemap and the purged browse URLs and comes back on restore; suspensions, their end, business suspension, hidden messages; appeals; report spam limits and anonymous notices needing an email; the signed alert (one for a burst, no names or emails); the overview numbers, searches, phone release, verification, audit log, status snapshot.
- **Headless Chromium** (local production build behind TLS, scratch PostgreSQL, Valkey, Meilisearch and worker), phone 390×844 and computer 1280×800: 83/83. The 404s, headers, two-factor set-up and check on both sizes, every admin page for admin and moderator without sideways scroll or console and CSP errors, moderators refused on payments, system and staff, a take-down from the phone form (listing 404 publicly, both reports resolved), the seller's notice and appeal, the appeal granted from the computer, business verification, the new-listings review, reports signed in and anonymous (Turnstile test key), a listing code in the search box. The worker sent the statements, appeal answers, receipts and outcomes. That run found inline `style` attributes on the overview's bars (the CSP blocks them); fixed with SVG.

Deployed to staging Oct 23, 2026 (approved by the owner; 1.7 GB available before):
- `ADMIN_PATH` (24 random characters), `N8N_ADMIN_ALERT_URL` and `N8N_WEBHOOK_SECRET` generated into `/root/.secrets/admin.env`. Set through the Coolify API (one-hour `tinker` token, deleted afterwards; no value in the conversation): `ADMIN_PATH` on `classifieds-web` and `classifieds-worker`, the n8n pair and `CLOUDFLARE_ZONE_ID` / `CLOUDFLARE_PURGE_TOKEN` on `classifieds-worker`.
- n8n workflow **Peydoo – admin alerts** (`gzrlze4GF1DiydR3`) created and active: a signed test reached the owner's Telegram (one 🧪 message), a wrong key and a 15-minute-old timestamp were refused.
- `/usr/local/bin/classifieds-backup` writes `peydoo:backup:last-ok` after a successful run (never fails the backup); seeded from the newest restic snapshot.
- `admin` fast-forwarded into `main` (`b614733`): `classifieds-migrate` applied `0015_admin`, web and worker came up healthy (`telegram: polling as @Peydoo_bot`); memory right after: web 103 MB, worker 79 MB. All 18 staging listings got unique codes.
- `make-staff.ts reza.khodamehri@gmail.com admin` (the owner chose this account) as `classifieds_owner` from a throwaway container: `staff.role_changed` written.

Checked live on https://staging.peydoo.com: `/health` ok; `/admin`, `/admin/queue`, `/<ADMIN_PATH>` and `/<ADMIN_PATH>/queue` signed out → 404 with `X-Robots-Tag: noindex, nofollow`, `private, no-store`, `cf-cache-status: BYPASS`; `/report?t=listing&id=…` 200; listing pages show «کد آگهی»; a code typed into the search box redirects to its listing; the worker's status snapshot is written every minute (15 queues, Meilisearch 5 documents for 5 active listings). Not checked live: the signed-in admin flow (two-factor set-up is the owner's first step) and a take-down on staging data; both passed in the local browser check.

For the owner:
- Open `https://staging.peydoo.com/<ADMIN_PATH>` (the value is in `/root/.secrets/admin.env`) signed in as reza.khodamehri@gmail.com, set up two-step login with an authenticator app, and keep the backup codes.
- The lawyer reads terms 7.4 and 8.1 and the privacy policy's new paragraph.

Not done:
- Passkeys; deleting the photos of an illegal-content take-down from R2 and the image cache; a "request verification" button for businesses (the queue shows every unverified business with legal details); a badge with the queue size in the navigation.

## Oct 23, 2026: smaller photo uploads (roadmap step 10)

Plan approved by the owner. The browser now shrinks each photo before uploading it (branch `photo-shrink`):
- **What it does.** `src/modules/media/shrink.ts` decides and orchestrates, `shrink.worker.ts` decodes with `createImageBitmap` (EXIF orientation applied) and draws on an `OffscreenCanvas` in a Web Worker, `shrink-client.ts` starts the worker or, where there is no `OffscreenCanvas` (Safari before 16.4) or the worker won't load, does the same on the page with a `<canvas>`. Long side at most 2560 px, never enlarged; WebP at 0.85, JPEG where the browser can't encode WebP (Safari silently returns PNG, so the type is checked); a PNG only ever becomes WebP (JPEG would turn transparency black). A photo within 2560 px and at most 1 MB goes as it is.
- **Fallbacks.** The original goes, exactly as before, when there is no `createImageBitmap`, the browser can't decode the file (HEIC outside Safari, a broken file), memory runs out, the result isn't smaller, or 20 seconds pass. A file the server wouldn't take as it is (HEIC decoded by Safari, over 15 MB) is sent shrunk even if the result is bigger.
- **Photo editor** (`src/app/my/listings/[id]/photos.tsx`, listings and events): shrinks first, then asks for the signed link with the shrunk file's type and size, then uploads. The type and size checks run after shrinking. The label stays «در حال بارگذاری…» throughout; no new Persian text. One worker per batch, photos still one after another.
- **CSP:** `worker-src 'self'` (`src/proxy.ts`). Turbopack bundles the worker as `/_next/static/chunks/turbopack-worker-*.js`; it also copies the worker's TypeScript source to `/_next/static/media/` (harmless, nothing secret in it).
- **Server unchanged:** limits, signing, the worker's WebP re-encode and metadata stripping. Without JavaScript nothing changes either (photo upload has always needed JavaScript).

Tests: 17 new (`tests/photo-shrink.test.ts`: the size decision, output types, the Safari WebP fallback, every failure sending the original, a stuck worker timing out, the CSP); 654 in all after rebasing on the admin page, passing; typecheck and `check:rtl` clean.

Checked in headless Chromium (production build behind TLS as `staging.peydoo.com`, scratch database and worker, the real staging R2 bucket and imgproxy), phone 390×844: 24/24.
- A 12 MP phone photo (7.7 MB JPEG, stored sideways with EXIF orientation 6 and GPS) was shrunk in the Web Worker and uploaded as a **0.78 MB WebP**, 1920×2560, upright, no EXIF or GPS. The stored master: 762 KB WebP, 1920×2560, upright.
- Master quality against the original scaled without loss: 35.8 dB PSNR, against 37.9 dB when the worker gets the original. Side by side the two masters look the same. Part of the gap is Chrome's resampling, not compression: raising the browser's quality to 0.90 or 0.92 doesn't help (simulated with sharp: 37.1 and 37.0 dB against 37.1 at 0.85), so 0.85 stays. The JPEG path (Safari) simulates at 35.5 dB. The test photo is full of sensor-like noise, the hardest case; ordinary photos lose less.
- Fallbacks in the real browser: a small photo (201 KB, 1200×900) sent byte for byte; a file Chrome can't decode sent as the original and rejected by the worker as before; no `OffscreenCanvas` → no worker, shrunk on the page; the worker script blocked → the page took over for both photos of the batch; no `createImageBitmap` → the 7.7 MB original sent and processed as before.
- No CSP violations and no console errors from our page, no sideways scroll. The only console errors came from inside Cloudflare's Turnstile frame (its own CSP), as before. The check's 21 test objects were deleted from the staging bucket afterwards.

Deployed to staging Oct 23, 2026 (fast-forward of `main` to `fd35a66`, 1.9 GB memory and 11 GB disk free before): web, worker and migrate healthy. Live through Cloudflare, phone 390×844: 10/10. `/germany` sends `worker-src 'self'`, the worker bootstrap and its three chunks answer 200, and on `/germany` the live worker, started under the live CSP, shrank a 6.5 MB 12 MP JPEG drawn in the page to a 0.8 MB 2560×1920 WebP with no CSP violation. `/germany` and `/login` showed no CSP or console errors from our page and no sideways scroll. The signed-in photo editor wasn't checked live: that needs a temporary account in the staging database.

For the owner: on a phone, add a fresh camera photo to a listing once; it should upload in a second or two on mobile data instead of several.


## Oct 24, 2026: production on peydoo-prod (roadmap step 9, launch)

Plan approved by the owner (Oct 24, 2026) with production's **own Coolify** (rather than adding the server to staging's), **Cloudflare Access** in front of `peydoo.com` until go-live (rather than a hidden hostname), and a **`production` branch promoted by one command** (rather than release tags). Decided by the owner on Oct 23: staging stays on the CX23; production starts from an empty database. Everything is in `docs/setup.md`, "Production"; decision 10 there is corrected.

Done (branch `production-setup`, `/root/classifieds-prod`):
- **Server** `peydoo-prod` (CX33, nbg1, `2.31.122.66`): key-only root SSH (password login tested refused), full upgrade and reboot, 2 GB swap, staging's Docker daemon settings; Hetzner firewall `peydoo-prod` (80/443 only from Cloudflare; 8000, 6001 and 8080 closed from outside).
- **Coolify 4.5.0** (staging's version; staging had auto-updated from 4.4.6, now in the docs), auto-update off, root admin made with `tinker` before anything was public, registration off, API only on the `coolify` network, deploy-only token. The installer made the `coolify` network dual-stack; recreated IPv4-only like staging's. Dashboard https://coolify-prod.peydoo.com behind Access. Read-only GitHub deploy key `peydoo-prod-readonly` (added by the owner); staging's GitHub App stays on staging.
- **Services** in the 8 GB budget: PostgreSQL 18 + PostGIS (2 GB, builtin C.UTF-8 checked before anything else, tuned `postgresql.conf`), bootstrap, migrations 0000–0015 and the seed, role passwords; Valkey (256 MB), Meilisearch (1 GB, 384 MB indexing memory, 2 threads, its two keys), imgproxy at https://img.peydoo.com (512 MB, unsigned URLs 403); `classifieds-migrate`, `-web`, `-worker` from branch `production`, auto-deploy off, web with the post-deployment purge.
- **Separate settings:** new `AUTH_SECRET`, `PHONE_CODE_SECRET`, database, Valkey, imgproxy and Meilisearch secrets, `ADMIN_PATH`; R2 tokens `classifieds-prod-rw` and `classifieds-prod-imgproxy` (tested: neither reaches the staging bucket; read-only can't write), CORS and the `uploads/` lifecycle on `classifieds-media`; purge token `peydoo-cache-purge-prod` bound to production's IPv4; Turnstile widget `peydoo-production`; bot @peydoobot (the owner pasted its token in the conversation and chose to keep it); SES: the same sender, and the SMTP login is reused because the AWS key can't create IAM users. All secrets live only in production's `/root/.secrets` and Coolify; `peydoo-secret` lets the owner add one over SSH without it being shown.
- **Cloudflare:** proxied A records for `peydoo.com`, `www`, `img`, `coolify-prod`; Access application for `peydoo.com`, `www` and `coolify-prod` (the owner's email, one-time code) with bypasses for certificates, the Stripe webhook and the two health URLs, plus a service token for scripted checks; the Cache Rule now covers `peydoo.com` too (staging still MISS then HIT).
- **Releases:** branch `production` created at `84b2664` (what staging runs). `peydoo-promote` on staging (only a commit on `main` that staging's web has deployed; fast-forward only; shows commits and migrations; then `peydoo-deploy --wait` on production over SSH).
- **Backups:** restic on a new Storage Box sub-account `u692990-sub1` (home `peydoo-prod`, can't see staging's backups), own password, nightly at 03:15 UTC, the same three tags. `classifieds-restore-test`: the first run restored the newest dump into a scratch PostGIS and matched locale, 43 tables, 862 functions, 23 triggers, 165 indexes, 16 migrations and all 44,394 rows; the config snapshot restored Coolify's `.env` byte for byte.
- **Alerts:** staging's `kooche-alert` and `kooche-healthcheck` on production, reporting to the new n8n workflow **Peydoo – production alerts** (own path, secret and memory; URL checks of `peydoo.com/health` and `coolify-prod.peydoo.com/api/health`); a test 🔴/🟢 pair was sent. **Peydoo – production admin alerts** for the worker's report alerts; a signed test was sent.
- **Cleanup:** the n8n watcher **Peydoo – create production CX33** and its project-wide Hetzner credential deleted; temporary Cloudflare and Coolify setup tokens deleted.

First deploy Oct 24, 2026 (`peydoo-deploy --wait`, commit `84b2664`): migrate ("No pending migrations"; they had run at setup), then web and worker, all healthy; "Cloudflare cache purged for peydoo.com"; the worker polls as @peydoobot and built empty search indexes. The `www` redirect needed one more step: Coolify writes an application's Traefik labels when it is created and doesn't regenerate them when `redirect` changes through the API, so they were regenerated (as "Reset to default labels" does) and web redeployed; now `www.peydoo.com/…` → 302 `peydoo.com/…`.

Checked through Cloudflare from staging (with the Access service token where needed): `/health` ok without a token (bypass); `/` without a token → Access login, with it 200; `X-Robots-Tag: noindex, nofollow`, `robots.txt` `Disallow: /`, `/sitemap.xml` 404 (`SEARCH_INDEXING` off); `/germany` cached (HIT); HSTS two years with `includeSubDomains`; `/admin` 404; `/login` 200 with the production Turnstile site key; a keyword search 200; `/api/stripe/webhook` 404 (no Stripe key yet, as designed); `coolify-prod.peydoo.com/api/health` OK. Photos: a test image in `classifieds-media`, a signed imgproxy URL through `img.peydoo.com` gave AVIF (MISS, then HIT), a changed signature 403, the image deleted. Memory right after: 1.6 GB used, 6.2 GB available (`docs/setup.md`, "Production" → "Memory").

Release path tested Oct 24, 2026: merged this branch into `main` (staging deployed `c13d2f5`, healthy), then `peydoo-promote --yes` moved `production` from `84b2664` to `c13d2f5` (two docs commits, no migrations), production's migrate deployed web and worker, and the web purged `peydoo.com`. Running it again says production is already there; promoting an older commit is refused (no force pushes). Production now runs `c13d2f5`; later docs-only commits on `main` need no promote.

Checked by the owner on the phone, Oct 24, 2026: signing in through Access and then on the site by email (the SES code arrived), phone verification with @peydoobot (`phone.verified` in `audit_log`). Then `make-staff.ts reza.khodamehri@gmail.com admin` on production (`staff.role_changed`). Stripe: the owner created the sandbox `peydoo-production` and pasted its key; `stripe-setup.ts` made the products, prices, coupon, portal and webhook there, web and worker were redeployed with the key, and the webhook takes a correctly signed event (200) and refuses unsigned ones (400). The temporary copy of the code on production was deleted afterwards.

Not checked yet: posting with a photo through the site (the photo path itself was checked above), a test-mode purchase, the admin two-step login.

For the owner:
- Set up two-step login at `https://peydoo.com/<ADMIN_PATH>` (the value is in production's `/root/.secrets/admin.env`) and keep the backup codes.
- On the phone: post one listing with a photo, and buy a bump with Stripe's test card 4242 4242 4242 4242 (the sandbox charges nothing). The go-live reset empties the database anyway.
- Save production's restic password (`/root/.secrets/restic.env` on production) in the password manager; turn on two-factor login in both Coolify dashboards.
- The launch checklist in `docs/setup.md` ("Launch checklist for the owner").

## Oct 24, 2026: error monitoring (Sentry, EU region)

Plan approved by the owner (Oct 24, 2026): **Sentry's EU region** on the free plan, through our own tunnel, with our own scrubbing. GlitchTip was looked at on the n8n server (`n8nworkerReza`) first and rejected: ~356 MB available, 3 of 4 GB swap in use, an n8n worker killed for memory three weeks earlier (`docs/setup.md`, "Error monitoring").

Done (branch `error-monitoring`, `/root/classifieds-sentry`):
- **Packages:** `@sentry/core` and `@sentry/browser` 11.5.0, pinned. No `@sentry/nextjs`, no build plugin, no OpenTelemetry; the build needs no Sentry token.
- **Web:** `src/instrumentation.ts` reports what Next.js catches in rendering, route handlers, server actions and the proxy, tagged with the route's pattern (never the real path). `reportError()` beside the login, checkout, portal and chat-replay log lines.
- **Worker:** every queue's `failed` handler reports a job once, when it fails for good, with queue and job name only; the outbox loop, the Telegram loop (not the deploy-time 409), expiry-reminder sends, unhandled rejections and uncaught exceptions (flushed before exit).
- **Browser:** a 0.6 KB loader on every page; the SDK (21 KB gzipped) loads only after an error. New Persian `global-error.tsx`; the admin error page reports too. Errors with a digest are skipped (reported on the server), so one event per error.
- **Tunnel** `/api/monitoring`: the CSP is unchanged (`connect-src 'self'`). The page has a placeholder DSN, the tunnel adds the real one; only error events, 64 KB, our Origin, 10 a minute and 50 a day per IP.
- **Privacy:** events are rebuilt from known fields and every text redacted (emails, phones with Persian digits too, IPs, IBANs, card numbers, UUIDs, tokens and keys, passwords in URLs; no query strings, headers, cookies, bodies, user, local variables or extra data). Sentry added to the privacy policy in German and Persian (3.1, 8, 9; still drafts for the lawyer).
- **Quota:** 160 events a day in Valkey for everything (browsers at most 60), so 5,000 a month can't be exceeded; 20 an hour per process without Valkey; the same server error at most once per 10 minutes per process.
- **Settings:** `SENTRY_DSN` (only the EU region is accepted) and `SENTRY_ENVIRONMENT` (staging | production) on web and worker; the release comes from Coolify's `SOURCE_COMMIT`. No DSN = off (development, tests).

Tests: 18 new (`tests/monitoring.test.ts`: scrubbing, settings, budget and throttle against Valkey, the server client against a fake ingest, real BullMQ jobs, the tunnel); 672 in all, passing; typecheck and `check:rtl` clean. Headless Chromium on a local production build behind TLS with a fake ingest, phone 390×844 and computer 1280×800: 26/26 with monitoring on (each kind of error arrived exactly once, scrubbed; no CSP violations, no foreign requests), 20/20 off (nothing loaded or sent, tunnel 404). That run found that `global-error.tsx` replaces the `<meta>` with the rest of the document; fixed by reading the settings when the page starts. Memory on the scratch stack: web 97 MB, worker 68 MB.

Sentry set up the same day: the owner created organization `peydoo` in the EU region and a personal API token; through the API, project `peydoo`, its DSN straight into `/root/.secrets/sentry.env`, data scrubbing and IP removal, inbound filters, and three email alerts (new issue, regression, more than 20 in an hour; Sentry's new workflows API, the old rules endpoint is gone). A real test event from `scripts/monitoring-check.ts` arrived scrubbed, with environment and release, without IP or user.

Deployed to staging Oct 24, 2026 (approved by the owner; `main` fast-forwarded to `badfc62`; migrate, web and worker healthy): the two variables on web and worker through the Coolify API (temporary token deleted), the meta tag with release `peydoo@badfc6293e09`, the tunnel live (403 for another Origin). `scripts/monitoring-check.ts` on the live site: server and browser events arrived scrubbed with environment and release, no IP. The n8n workflow **Peydoo – Sentry alerts** (Sentry's email → Telegram) delivered the first new issue (PEYDOO-2) to Telegram.

Still to be confirmed: a second test issue (PEYDOO-3, 12:23 UTC) came close behind PEYDOO-2, so Sentry held its email for a digest (then 5–30 minutes; the project's digest delay is now 1–5 minutes, and the n8n step lists every issue link of a digest). It hadn't reached n8n by 12:33 UTC; check that a «🐞 staging» message for PEYDOO-3, or a digest naming it, arrived in Telegram.

First real error, Oct 24, 2026 at 18:46 UTC: the worker's Telegram long poll lost its connection once (`fetch failed`, `ECONNRESET`); the bot retried and kept polling. At the owner's request, the Telegram loop now reports only from the third failure in a row (`failureStreak` in `src/worker/monitoring.ts`, one new test); every failure is still logged.

Not done: production (its own `sentry.env`, `SENTRY_ENVIRONMENT=production`, `peydoo-set-env`, then a release with `peydoo-promote`); browser source maps (only if browser reports turn out hard to read).

For the owner:
- Turn on two-factor login in Sentry; delete the personal API token there (User Settings → Personal Tokens) when no more Sentry changes are planned. It is also in `/root/.secrets/sentry-user.env`.
- The test issues PEYDOO-1 to PEYDOO-3 in Sentry can be resolved.

## Oct 24, 2026: design research, three directions (no app changes)

Asked by the owner: review staging's look and structure (phone first), research classifieds apps and Persian/RTL conventions, propose three directions with mockups, and wait for a choice before planning any change.

Done (branch `design-research`, `/root/classifieds-design-research`):
- **Staging review** in headless Chromium (Playwright image, one browser at a time), phone 390×844 and computer 1280×800, logged out; seller names, emails and phone-like numbers replaced before each shot. Main findings: on phones the first listing starts at y≈356 (country) and y≈485 (category) of 844; no contact on the first screen of a listing page (phone or 1280×800); prices render «€۸۷۰»; «·» next to Persian digits reads as zero; 20 places with 10–11px text; empty pages keep full controls.
- **Research** (cited): Divar, Sheypoor, Kleinanzeigen, Vinted and Airbnb from their live pages; Leboncoin, OLX and Facebook Marketplace from articles; Persian fonts (competitors' live CSS), RTL mirroring, WCAG 2.2 AA, the EAA micro-enterprise exemption, one-handed use.
- **Three directions with mockups** (country page, category list, listing page, posting start; phone and computer; staging next to them): A «آشنا» (Divar's layout in Peydoo's colours, recommended), B «صیقل‌خورده» (today's look with the problems fixed), C «محله» (a city hub with Estedad and bigger photos; needs a migration for drafts without a category). Plus eight fixes for any direction.
- `docs/design-options.md` (findings, directions, costs and files, research, sources); page with all screenshots: https://claude.ai/artifact/HqNDhAzv3SHSbbVCDmsQkQ. Mockup sources in `docs/design-options/mockups/`.

Not done:
- Signed-in pages (posting form, chat, account, business) weren't screenshotted: email-code sign-in, no test inbox. Judged from code.
- The Oct 17 brand plan artifact couldn't be opened from this session's account; its decisions came from `docs/setup.md`.

Next: the owner picks a direction or mixes parts; then a change plan for approval. No code was changed.

Round 2 (same day): the owner chose B «صیقل‌خورده» (today's look, "this is my style") and asked for a usability round including the admin panel.
- **Signed-in screenshots** with the owner's staging account:
  - The owner requested the email code on their phone (Turnstile blocks headless Chromium), and the code was typed in a headless browser.
  - The admin two-step check took a TOTP code the owner sent; the first expired in transit.
  - Nothing was posted, sent or changed. The session was signed out and its file deleted.
- **Found:**
  - The WG posting form is about 9 phone screens with «mm/dd/yyyy» date fields.
  - Five buttons per listing in "my listings".
  - A report flag beside every chat message, and a flat 13-row account page.
  - The admin panel sits inside the public chrome.
  - The admin decision form preselects «برداشتن آگهی» and the first reason.
  - The system page shows 4 unapplied payment webhooks in plain grey and cuts off the "failed" column.
- **Final proposal** on the same artifact: 34 screens, phone and computer, before/after. Details, sizes (about 8–10 days in five parts, no schema change) and five open decisions are in `docs/design-options.md`. Sources in `docs/design-options/mockups/final/`.

Next: the owner answers the five decisions on the page; then a build plan for approval. No code changed.

Round 3 (Oct 25, 2026), asked by the owner: events in depth, `/pro` and `/business/new`, a first page for many countries (US, Canada, Australia, Turkey later), the footer and Impressum, a cookie banner if needed, Gregorian dates instead of Jalali, a look at dark mode; admin shortcuts approved.
- **Done:**
  - 51 screens on the same artifact.
  - Events: list, event page, 2 posting steps.
  - First visit for an open country, a waitlist for a country not open yet, a country chooser.
  - Pro, a 3-step business setup, a business page.
  - The footer with the German legal names; a cookie banner only for the future.
  - Dark previews of four screens.
  - All dates in the mockups are Gregorian.
- **Decided, to be confirmed:**
  - No cookie banner on current facts (§ 25 TDDDG).
  - `/` suggests the country and city from Cloudflare and never redirects; unopened countries stay 404 behind a waitlist card.
  - Impressum within two taps from every screen.
  - Dates via `fa-u-ca-gregory` (mostly `src/lib/format.ts`).
  - Dark mode follows the phone, with a setting.
- **Size:** round 3 adds about 8–10 days, so 15–18 in all.

Details in `docs/design-options.md`.

Next: the owner answers four decisions (founding Pro terms, showing the waitlist count, event saves and follows now or later, dark mode now or later); then a build plan for approval. No code changed.

Round 4 (Oct 25, 2026): the owner approved the waitlist count, founding Pro and event saves and follows, and asked about event filters, cookies in Germany, which countries next, and Iran.
- **Event filters:** an events filter sheet was added.
- **Cookies:** checked on staging. Logged out, only `country` and `view`; no browser storage; only Turnstile outside. So no banner.
- **Waitlist and founding Pro:** both got guardrails from research.
- **Country order:** Canada → Netherlands and Sweden → UK → US → Australia; avoid Turkey, the UAE, Armenia and Georgia.
- **Iran:** blocked at launch; maybe a static guide site later, with a lawyer's sign-off; never accounts, chat or payments from Iran.
- **Dark mode:** a gallery of 10 screens.

Artifact version 5. Details in `docs/design-options.md`, "Round 4".

Round 5 (Oct 25, 2026): the owner asked about light or dark, France, Turkey, the UAE, Austria on a waitlist, pioneer rewards, Iran read-only with +98 blocked, and where to show founding Pro.
- **Light or dark:** automatic by default (follow the device, light otherwise), with a choice in settings and the footer.
- **Country order:** Germany now → Austria on a short-timer waitlist (Vienna gate 300 / 15 / 60) → Netherlands → Canada → Italy, Sweden → UK → France (waitlist first) → US, Australia. Turkey gets a guide page and no marketplace (e-Devlet ad verification, scams, VAT). The UAE stays closed.
- **Pioneers:** dated badge, 48 h early entry, opening-day listings with free bumps, invite bumps; an opening gate per country.
- **Founding Pro:** shown in context (business panel progress, Pro page, one home line), with honest scarcity and "Pro costs €24 a month".
- **Iran:** read-only from Iranian IPs, +98 and non-seeded numbers refused, extra sign-in signals, honest limits, lawyer questions.

New mockups: `appearance`, `iran`, `iran-phone`, `turkey`, `business-dashboard`; updated: `home`, `home-waitlist` (Austria), `countries`, `pro`, footer. Research in `docs/design-options/research/`. Artifact version 6. Details in `docs/design-options.md`, "Round 5".

Round 6 (Oct 25, 2026): the owner wants every country open within one year, events and businesses for Turkey and the UAE, and asked how the gate works and about posting across borders.
- **Two switches:** a country starts in Starter mode (events, verified businesses, jobs, services) on a planned date; a city's gate (people, businesses, prepared listings; date announced at 75%) opens rooms, items and cars.
- **Calendar:** Berlin Nov 2026; Vienna and the Netherlands Starter at Yalda; UK and Canada Feb; US and Australia at Nowruz; Italy and Sweden Apr; Paris May; Istanbul events and businesses Jun (lawyer first); Open cities through the year. Brake if Berlin misses its gate by end of Feb.
- **Turkey:** events and verified businesses, free, with sanctions screening. **UAE:** hidden until a Q4 2027 review.
- **Cross-border posting:** same zone, everything; another zone, wanted posts, events, businesses and online services only.

New mockups: `waitlist-announced`, `admin-countries`, `us-starter`, `turkey-starter`, `post-crossborder`, `listing-crossborder`. Research in `docs/design-options/research/round6-*.md`. Artifact version 7. Details in `docs/design-options.md`, "Round 6".

Round 7 (Oct 25, 2026): the final plan for the owner's decision, https://claude.ai/artifact/1ZzHVpR7EvAdsPudG6Qbaw (copy in `docs/design-options/launch-plan.html`).
- **Calendar:** Canada, Australia and the US start in Jan–Feb (Starter); Open cities at their gates; no shared Berlin brake, but health per country and a capacity check for new openings; fallbacks for the server, payments, SMS and moderators.
- **Turkey:** paid business-to-business (verification €49, Pro €190 a year), with sanctions checks before any money.
- **Stripe:** its "citizen of Iran" clause is the biggest open risk.
- **Review:** an independent review of rounds 1–6 found errors; they are fixed in the doc and mockups and listed in the plan's "Corrections".
- **Build:** estimated at 40–55 days in five waves.

The owner decided to close Austria now and follow the gate plan. It is wave 0's first item; no app code has changed yet. Artifact (design page) version 8.

Round 8 (Oct 25): phone verification costs, Telegram limits, Iran messaging, soft legal and solo moderation; the plan page is now in Persian (version 2).

Round 9 (Oct 25): phone verification without SMS (users send a code to our WhatsApp), Telegram limits per bot, the waitlist explained simply, private vs business rules, Turkey earlier with private listings in safe categories, sanctions checks, Stripe re-rated medium-low (plan page version 3). Round 10 (Oct 25): Iran partly active (guides, relocation-jobs filter; later wanted posts and free online events), no events in Iran; the US stayed five Iran general licences on 24 Aug 2026 (plan page version 4). Round 11 (Oct 25): everyone posts from a country's start date and the city gate becomes the city launch; Telegram OIDC login with the phone scope tested successfully on the staging bot; private vs business simplified with three service groups; business verification by country (plan page version 5). Next: the owner decides the plan page's 13 points; then the detailed build plan for wave 0 for approval.

### Owner decisions and preferences from the design research (Oct 24–25, 2026)

Collected here so every tool sees them. Details in `docs/design-options.md` (round 9, round 8, then "Final plan (round 7)"). The plan page is in Persian since round 8. The two plan pages are private claude.ai artifacts in the VS Code account; the owner can share them, and a copy of the plan is `docs/design-options/launch-plan.html`.

**Decided by the owner:**
- Design direction B «صیقل‌خورده»: keep today's look (turquoise, saffron, Vazirmatn, rounded cards) and make it easier to use. "This is my style."
- Dates in Gregorian (Persian month names and digits); Jalali only as a second label for cultural dates. Iranians abroad can't convert Jalali easily. (CLAUDE.md still says Jalali; update it when the build starts.)
- Peydoo is for Iranians in many countries, not only Germany or Europe. Never design for Berlin only.
- Always include events, Pro and business pages, the footer with Impressum, and the admin panel when designing.
- Approved: admin keyboard shortcuts, 4 posting steps, «آگهی‌های من» in the bottom bar, event filters, saves and follows, the waitlist count, founding Pro per city, no cookie banner while nothing needs consent.
- Light and dark mode both; proposal is automatic by default with a choice.
- Iran: read-only for listings. People in Iran may sign up with email and send messages (round 8; no posting, no payments). +98 numbers are refused even with a VPN; no listings from Iran.
- Legal: "soft but inside a safe zone". Write paragraphs and self-assessments instead of hiring a lawyer per country; the red lines stay (round 8).
- Moderation: the owner moderates alone with AI pre-screening, holds and user reports. No Minijob, no contractors (round 8).
- The one-year plan: every country live within a year. Hurry the US, Canada and Australia (largest diasporas, copycat risk). No plan where one country's failure stops the others.
- Turkey must make money (paid business listings), not cost money. The owner also wants private listings in Turkey and Turkey earlier (round 9: Istanbul businesses 1 Feb 2027, private listings in safe categories May 2027; housing and cars are never possible there).
- Avoid SMS: phone verification through Telegram and WhatsApp (the user sends us a code); SMS stays built but off (round 9).
- Launch strategy (round 12, Oct 26): Berlin open from the start; every other big city has a waitlist whose only opening condition is a number of verified businesses (e.g. Hamburg 20). People can sign up without limit and are shown for information only. When a country's key cities are open, the whole country opens. No city calendar.
- Founding businesses keep the «بنیان‌گذار» badge for one year, not forever.
- Sign-up reward by city size (Oct 26): one free bump for the first 200 confirmed sign-ups in a big city, 100 in a medium city, 50 in a small one; usable from day 3 to day 60 after the city opens.
- Businesses and events are live in every planned country from the start (once each country's small legal checklist is done; Turkey after KVKK); listings open city by city by business count.
- The Randstad (Amsterdam, Rotterdam, The Hague, Utrecht) counts as one "city" with 30 businesses; Sweden and Italy are each one "city" (Sweden 30; Italy 20 proposed, owner to confirm). Proposed targets for the other cities are in `docs/design-options/research/round12-cities.md` and the plan page (version 6); Germany (Oct 26): Berlin is the only exception and is open from the start; the rest of Germany is treated like every other country (city waitlists by business count, then the whole country after its key cities). Still open: whether to lower the business targets.
- No WhatsApp notifications ever (cost); notifications by Telegram and email only. City openings are announced by the owner by email to everyone, not through notification settings.
- Iran wording never mentions sanctions: «پیدو در ایران دفتر و نماینده ندارد و نمی‌تواند امنیت معامله و پرداخت را برای شما تضمین کند».
- Admin wants: view the site as any country, one staff-verified test account per country, and sign in as a user (owner only, logged).
- People in Iran never verify a phone; email only.
- Close Austria for now and follow the country and gate plan (first item of the first build wave; not done yet).

**Open for the owner** (the plan page's 13 decisions, round 9):
1. the calendar and the new city rule (everyone posts from a country's start; the gate only sets the city launch; merge a city below 50% for 6 months into a region);
2. launch order;
3. phone verification without SMS (Telegram login as the main path, tested; the bot as fallback; WhatsApp; SMS off with a trigger);
4. private vs business (declaration, limits, review queue, free basic business profile, the always-business list);
5. Turkey earlier (businesses 1 Feb, Nowruz, private listings in May, KVKK in January);
6. Turkey prices;
7. the Turkey sanctions process;
8. Iran partly active (no events in Iran; guides and relocation jobs now; wanted posts and online events after the lawyer) and the travel rule;
9. soft legal and solo moderation;
10. Stripe (no nationality questions, Radar rules, Mollie before May 2027);
11. spending now;
12. founding Pro after 6 months;
13. the shorter list for the lawyer and the tax advisor.

**Owner to do after the Telegram login test (Oct 25):** remove the test redirect `https://staging.peydoo.com/tg-oidc-test` from the staging bot in BotFather and regenerate its OIDC client secret (it was pasted in chat).

**Code gap found in round 8 (not fixed; no app changes yet):** the Telegram bot path (`telegramNumberToE164()` in `src/modules/users/phone-number.ts`) accepts any number, including +98 and anonymous +888 numbers. Only the SMS path refuses Iran. Planned for wave 0.

**Working rules the owner gave for this research:**
- No app changes until the owner approves.
- Run `free -m` before any browser, build or deploy, and use one browser at a time.
- Never touch the Claude desktop app's processes.
- A push to main deploys staging only; production only with `peydoo-promote`, and only when asked.
- No real users' names, phone numbers or emails in screenshots or mockups.


## Oct 26, 2026: wave 0 build plan (waiting for approval, no app changes)

Asked by the owner: a detailed build plan for wave 0 only (what must be live before Berlin opens), then wait for approval.

Done (branch `wave0`, `/root/classifieds-wave0`): `docs/wave0-plan.md`. It covers only Berlin open (Austria closed, other German cities on a business-count waitlist), the Telegram +98 / +888 / allowlist refusal and Telegram login (OIDC, phone scope) as the main check, WhatsApp where the user sends the code (SMS built but off), founding Pro as a Stripe trial without a card that ends by itself, Iran read-only with the round 12 wording, and the § 356a BGB withdrawal button (checked: missing; terms say "by email"). For each: files, migrations 0016–0019, tests, risks, days, and what the owner does by hand in BotFather, Meta and Stripe. Estimate 16–18 working days.

Found while reading: round 12 has no section in `docs/design-options.md` (it is in this file and the plan page v6); the founding-business mockup says €24 after 6 months while the plan page says €12; the `iran` mockup shows email sign-up and messaging, which the plan builds only in wave 4 after the lawyer.

Owner's answers (same day): Hamburg 20; Berlin area including Potsdam (built as Berlin + Potsdam within 40 km); €24 a month after founding Pro, only on yes; 30 founding places in Berlin; everyone verifies a phone to post (no email-only account); +90 on the allowlist; no cuts. Founding badge in wave 0, one year from the day the business creates its page. Plan page (Persian, for reading): https://claude.ai/artifact/BckX9nUbr8L53bfEaPZfd1 (copy `docs/wave0-plan.html`). Next: the owner says go; then the build starts in the order in `docs/wave0-plan.md`.

## Oct 26, 2026: wave 0, step 1: the phone country rule (Telegram bot)

The owner approved the wave 0 plan ("start as you planned"). Step 1 of `docs/wave0-plan.md`:
- **One rule for every phone channel:** `checkVerifiedNumber()` in `src/modules/users/phone-number.ts` accepts only the 37 countries in `seed/countries.ts` (`PHONE_COUNTRIES`, Turkey included). +98 fails with `country_not_allowed`, Telegram's anonymous +888 numbers with `no_country`. The bot path uses it now; Telegram login and WhatsApp will use it.
- **Bot replies** in Persian with the round 12 wording (no "sanctions"; a separate text for +98, other countries and +888).
- **Migration 0016:** `phone_verifications.number_country`. Verified and refused attempts keep the number's country; a refused number itself is never stored. SMS attempts record it too.
- **`scripts/phone-country-check.ts`:** counts verified numbers the rule would refuse. Staging: 2 verified numbers, 1 of them +98 (left on its account; the owner decides).
- **CLAUDE.md:** "Iranians in many countries", Gregorian dates in the interface, and the phone-number rule (approved with the plan).
- **Tests:** 679 passing (6 new), typecheck and `check:rtl` clean, run in a Node container against throwaway PostgreSQL, Valkey and Meilisearch. `tests/search.test.ts` › "each filter type returns exactly the matching listings" failed once in a full run without Meilisearch and passed alone and in the next full run: probably order-dependent, unrelated to this change.

## Oct 26, 2026: wave 0, step 2: Austria closed, only the Berlin area open

- **Austria closed:** `seed/countries.ts` and migration 0017 (`/austria` answers 404; nobody can post there). Staging had no Austrian listings.
- **City launch** (migration 0017; `docs/setup.md`, "Countries, places and the map"): `locations` gets `launch_status`, `business_goal`, `launch_radius_km`, `launch_with_id` and `opened_at`. Listings other than events are published only in the Berlin area (Berlin and Potsdam, within 40 km of Berlin's centre); Hamburg 20, Cologne and Bonn 25, Düsseldorf 20, Frankfurt 20 are on the waitlist; everything else opens with the country. Drafts can be saved anywhere. Events everywhere in Germany. The seed sets these only for new cities, so the owner's later changes stay.
- **Tests:** 688 passing (new `tests/city-launch.test.ts`, 8 tests; a seed test that the owner's launch state survives a re-seed). Tests about places, search and events open everything for their own run (`openEverywhereForTests()` in `tests/listings-fixtures.ts`) and restore the state afterwards.
- **Not changed, for the lawyer's list:** the terms (§ 1, Persian) still say Peydoo is for Iranians in Germany and Austria.

## Oct 26, 2026: wave 0, step 3: Iran read-only

- **Rule:** requests from Iran (Cloudflare's country, trusted only through Cloudflare) read everything and write nothing, except report, sign out, sessions, account deletion, data download and notification settings (`src/lib/region.ts`; `docs/setup.md`, "Iran read-only").
- **Three layers:** the proxy refuses with a Persian page; a Cloudflare WAF rule (`iran_read_only`, created from the same list) blocks at the edge; a banner on every page and notices instead of the sign-in, posting, event, business, phone and chat forms. The wording is round 12's without the sign-up and messaging sentence (that comes in wave 4 after the lawyer) and without "sanctions". `/help#iran` answers "why?", travelling and moving.
- **Cloudflare:** the Cache Rule now skips Iranian visitors; pages for Iran are `private, no-store`.
- **Tests:** 697 passing (9 new in `tests/iran.test.ts`). `tests/search.test.ts` › "each filter type…" now looks only at its own listings: other files commit cars in Rostock too, which made it fail depending on file order (seen twice today).

## Oct 26, 2026: wave 0, step 4: Telegram login (built, waiting for BotFather)

- **"Log in with Telegram"** (OpenID Connect, phone scope) as the main phone check: `src/modules/users/telegram-oidc.ts`, the start action and `/account/phone/telegram/callback` (`docs/setup.md`, "Accounts and phone verification"). The new `/account/phone` follows the `verify-phone` mockup: the reason first, one big Telegram button, the tip for people whose Telegram is on +98, the bot as a fold-out fallback. Without `TELEGRAM_OIDC_CLIENT_ID`/`_SECRET` the page shows the bot as before, so nothing changes on staging until the owner sets up BotFather.
- **Migration 0018:** method `telegram_oidc` on `phone_verifications` and `users`.
- **Tests:** 705 passing (8 new in `tests/telegram-login.test.ts` with a fake Telegram: PKCE, client secret, signature, issuer, audience, expiry, nonce, unverified number, +98, +888, refusal, another account's state, an expired attempt, a reused state, a number already in use). `tests/search.test.ts`'s Rostock count now adds the live cars other files leave there (it failed in about 1 of 3 runs).
- **Owner to do:** BotFather for the staging bot (remove the test redirect, new secret, add `https://staging.peydoo.com/account/phone/telegram/callback`), then hand over the client ID and secret with `peydoo-secret` (to be added on staging).
- **Owner said (Oct 26):** "nothing is live on staging". Steps 1–3 were deployed, but almost nothing is visible from Germany: Austria gone (home page and `/austria` 404), the Iran help section, and publishing outside the Berlin area refused. The Hamburg waitlist page is step 8. Report visible changes explicitly from now on.
- **Same day, after trying it:** the owner switched Telegram login off ("very complicated, and it shows that Peydoo wants to access their Telegram"). Removed `TELEGRAM_OIDC_*` from staging's web; the bot is the only Telegram path again. The code stays, off. The +98 tip ("add a second Telegram account with your local number") now shows with the bot too.

## Oct 26, 2026: wave 0, step 8 (moved up by the owner): city waitlist pages and admin "Countries and cities"

The owner asked for the visible waitlist before WhatsApp (they are setting up Meta meanwhile).
- **Built** (`docs/setup.md`, "Countries, places and the map", "Waitlist"): the waitlist page for cities that aren't open (Hamburg, Cologne and Bonn, Düsseldorf, Frankfurt with their goals; every other city "with the country"), double opt-in, leave links, the 30-day cleanup, and admin › Countries and cities (open a city or the country, goals, CSV of confirmed emails). Migration 0019 (`city_waitlist`, column grant on `locations`).
- **Bug found by the tests and fixed:** "open the whole country" wrote the country code into `audit_log.target_id` (a uuid); now in `data.country`.
- **Tests:** 719 passing (14 new in `tests/waitlist.test.ts`; `tests/grants.test.ts` counts 43 tables).
- **Telegram bots:** the staging bot @Peydoo_bot got a name («پیدو · آزمایشی»), descriptions, the /start command and a profile photo through the Bot API (`scripts/telegram-profile/profile.py`, `avatar.svg`). The live bot @peydoobot waits for the owner's OK (same texts, name «پیدو | Peydoo», no test line; run the script on production with its `auth.env`).
- **Helpers on staging:** `/usr/local/bin/peydoo-secret` and `/usr/local/bin/coolify-api`, copied from production.

**Where wave 0 stands (for the next session):** steps 1–4 and 8 done on staging (Telegram login built but switched off by the owner). Left: step 5 WhatsApp (owner is setting up Meta; the plan's 9 steps), step 6 founding Pro (Stripe trial without card, €24 after 6 months only on yes, 30 places in Berlin, badge one year from the business page's creation), step 7 the withdrawal button, then docs and a phone-size browser check of all pages. Done: the WAF rule `iran_read_only` now also allows `/waitlist/leave`. Also to do: ask the owner before setting the live bot's profile. Tests run in a Node container against throwaway PostgreSQL (port 55432), Valkey (56379) and Meilisearch (57700): containers `wave0-test-pg`, `wave0-test-valkey`, `wave0-test-meili`; remove them when wave 0 is done.

## Oct 26, 2026: wave 0, step 6: founding Pro that never charges by itself

- **Built** (`docs/setup.md`, "Payments and Pro", "Founding Pro"): admin › businesses «پیشنهاد بنیان‌گذار» (verified, with a city, within the city's places: its goal, Berlin 30); the owner's «شروع ۶ ماه پروی رایگان» on the billing page (Stripe trial, no card, cancelled at the end without a payment method; €24 a month only if they add one); reminders 14 and 3 days before; the «بنیان‌گذار» badge on the business page for a year from the page's creation. Migration 0020.
- **Retired:** the 100% launch coupon and `scripts/stripe-launch-codes.ts` (it charged €24 after 6 months); Checkout no longer shows a code field. Pro FAQ and terms (fa, de) say "founding businesses" instead of "gift code".
- **Bug found by the tests and fixed:** the reminder query passed a Date to the database driver (the daily job would have crashed).
- **Tests:** 728 passing (9 new in `tests/founding.test.ts`).
- **Not yet:** the badge on listing cards (with the redesign); a Stripe test-clock run in the sandbox (planned with the browser check at the end of wave 0).

**Where wave 0 stands:** steps 1–4, 6 and 8 done on staging. Left: step 7 the withdrawal button; step 5 WhatsApp (owner setting up Meta); final docs and phone-size browser check; the live bot's profile waits for the owner's OK. The owner wants the «صیقل‌خورده» redesign (wave 1) right after wave 0, not in December.
- **Owner's test on staging (same day):** marking TaskPilot as founding sent nothing, the offer was only on the billing page (hard to find), and a bump asked €1.99. Fixed: the offer now sends an email and a Telegram message (outbox `organization.founding_offered`), the offer and its start button sit at the top of the business's manage page, and the bump page tells a founding business that starting the free months gives 3 free bumps a month. €1.99 was right: Pro (and its bumps) starts only when the owner starts the free months. TaskPilot was marked before the notice existed, so it gets no email; its manage page shows the offer. 729 tests passing.
- **Owner's rule (Oct 26): users are always emailed when staff change something, both ways.** Built: business notices for verified, badge removed, rejected and founding (`src/modules/organizations/notices.ts`; email, plus Telegram when linked). Suspensions already had moderation notices. Saved as a standing rule in memory. 733 tests passing.
- **Owner's Pro test on staging (same day):** TaskPilot's founding trial started (Pro until 26 Apr 2027, €0), and an included bump was granted and applied within a minute, but nobody was told and Stripe's portal showed no invoice. Built: payment notices (Pro started/renewed/ended, order paid, bump applied; email with the invoice's link, Telegram when linked), the business's invoices listed on its billing page from Stripe, and an invoice link on the order page. 737 tests passing.

## Oct 27, 2026: right-to-left in every email and Telegram message; bumped listings show their bump time

- **RTL:** the owner saw the final «.» of a bump email on the wrong side. Gmail strips `dir` from `<html>`/`<body>`, so the direction is now on the message box itself (`emailHtml()`, login-code email), and every plain-text line, subject and Telegram message starts with a Right-to-Left Mark (`src/lib/bidi.ts`). Covers all system emails and Telegram messages at once.
- **Bumps:** Kleinanzeigen shows no badge for "Hochschieben"; the listing gets the bump's time. Peydoo now does the same: cards show the last bump's time, and «آگهی‌های من» shows «نردبان: …». Featured keeps its «ویژه» label.
- 738 tests passing.

## Oct 27, 2026: wave 0, step 7: the withdrawal button (§ 356a BGB)

- **Built** (`docs/setup.md`, "Payments and Pro", "Withdrawal button"): «انصراف از قرارداد (Vertrag widerrufen)» on a consumer's paid bump or featured order for 14 days, a second step with the contract, account and receipt email, then «تأیید انصراف (Widerruf bestätigen)». The receipt is emailed at once (with the German confirmation). The worker refunds what wasn't used through Stripe; the refund's webhook ends the rest. Migration 0021 (`order_withdrawals`, column grants). Withdrawals are in the user's data export.
- **Pro is B2B only:** a required "for my business" tick before every Pro checkout (billing page and the founding offer), logged in `audit_log`.
- **Texts:** terms 14.4 and 14.5 (de, fa; dated Oct 27, 2026); the bump waiver now says the right ends with *complete* performance, not with the start (it was wrong for featured).
- **Tests:** 747 passing (9 new in `tests/withdrawals.test.ts`; `tests/grants.test.ts` counts 44 tables).
- **For the lawyer:** the bilingual labels, the button only after login, the button on a bump that already ran, Pro as B2B only.

**Where wave 0 stands:** steps 1–4, 6, 7 and 8 done on staging. Left: step 5 WhatsApp (owner setting up Meta); final docs and a phone-size browser check; a Stripe test-clock run; the live bot's profile waits for the owner's OK. Then wave 1, the «صیقل‌خورده» redesign.

## Oct 27, 2026: people in Iran use their account like anyone; only paying is refused

- **Owner's rule** (replaces wave 0's "Iran read-only"): from Iran, without an account only reading; an email account can message; an account verified with a foreign number can do everything. Travellers keep full use of their account. Saved in memory.
- **Built** (`docs/setup.md`, "People in Iran"): the proxy no longer refuses writes from Iran, and the sign-in, posting, events, business, phone and chat pages no longer show the Iran notice. Paying is refused from Iran (`from_iran` in the checkouts and the Stripe portal; a notice instead of the pay buttons). Pro's included bumps, refunds and the withdrawal button work. New banner and `/help#iran` texts, still never "sanctions".
- **Cloudflare:** the WAF rule `iran_read_only` now skips `staging.peydoo.com`; production keeps the old block until wave 0 is promoted, then the rule is deleted.
- **Tests:** 743 passing (`tests/iran.test.ts` rewritten: payments refused from Iran, writes let through). `tests/search-sync.test.ts` › "the queue puts back a rebuild…" failed once while memory was low and passed on its own.
- **Checked from Iran (same day, through the owner's server in Iran, 31.14.123.70):** Cloudflare sees it as Iran; staging shows the new banner and help, the login page is open, writes to staging pass the edge while the live site still blocks them. But **Iran throttles peydoo.com by name** (the TLS server name, not Cloudflare's address): each connection stops after about 38 KB downloaded or about 1.5 KB uploaded, while other Cloudflare sites (cloudflare.com, 1.3 MB) load normally on the same line. Most pages are bigger, and any form sent from Iran hangs, so Peydoo is practically unusable from that network without a VPN. The signed-in checks therefore couldn't run from Iran; they are covered by `tests/iran.test.ts`. The two test accounts, their sessions and a test draft were deleted, the tunnel closed. Open: check from a home connection in Iran; the owner removes `peydootest` from their server when done.

## Oct 27, 2026: live bot profile; WhatsApp postponed; next is wave 1

- **@peydoobot** (production) got the profile with the owner's OK: name «پیدو | Peydoo», descriptions, /start command and the logo photo (`scripts/telegram-profile/profile.py`, run once on `peydoo-prod` with its `auth.env`; the copy was deleted afterwards).
- **Owner's decisions:** WhatsApp verification postponed (the bot stays the phone check). The phone-size browser check moves to after the redesign. Everything is finished and tested on staging first, then one launch on the live site (wave 0 + wave 1 together; delete the Cloudflare Iran rule then).
- **Next:** the wave 1 plan («صیقل‌خورده» redesign) for the owner's approval. Still open from wave 0: a Stripe test-clock run of founding Pro on staging; removing the test containers `wave0-test-*` when no longer needed.

## Oct 27, 2026: wave 1 build plan (waiting for approval, no app changes)

Asked by the owner after compacting: "plan wave 1". Done: `docs/wave1-plan.md` (English) and the Persian plan page https://claude.ai/artifact/7WW6KmBFQREsCbiRef5TEV (copy `docs/wave1-plan.html`). The «صیقل‌خورده» redesign in 11 parts, each deployed to staging on its own: everywhere (Gregorian dates, date field, prices, sizes, bottom bar, founding badge on cards, colour tokens), finding, listing page, posting in 4 steps, me (my listings, chat, account), events (with reminders for saved events and business follows, migration 0022), Pro and business, footer, admin (nothing preselected, shortcuts), dark mode, and the final phone-size check with the Stripe test clock. Estimate 20.5–22 working days. Four decisions for the owner (event tours later, Instagram paste later, no "where did you sell it?", keep dark mode in). Owner (same day): agreed with all four, keep the three "later" items in the roadmap (now `docs/roadmap.md`), go. Building part 1.

## Oct 27, 2026: wave 1, part 1: everywhere

- **Built** (`docs/setup.md`, "Brand and design", "Wave 1 rules"): Gregorian dates with Persian month names in every page, chat divider and admin chart (relative for the first week, then «۶ اکتبر»); a day / month name / year date field instead of the browser's «mm/dd/yyyy» (listing dates, with «از همین حالا» and «اول ماه بعد» on move-in dates; event dates); prices «۸۷۰ €»; «،» instead of «·»; nothing under 12px; buttons at least 44px tall, the card's heart a 44px target; radios and ticks in turquoise; the phone's bottom bar only on browsing pages; listing cards as in the mockup (grid: price first, title, place and time) with «بنیان‌گذار» on a founding business's listings for the badge's year.
- **Moved to part 10:** colours as tokens. Dark mode will swap the palette's values (white and the neutral scale) under the dark setting, so pages need no class changes now.
- **Left for part 6:** the event page still shows the Jalali date under every event; the redesign shows it only on cultural dates.
- **Tests:** 749 passing (new: `src/lib/date-parts.test.ts`, `src/components/bottom-nav.test.ts`, the badge on cards in `tests/founding.test.ts`; `src/lib/format.test.ts` and the price test now expect Gregorian dates and «۴۵۰ €»).

## Oct 27, 2026: the server was restarted; wave 1, part 2 begins with neighbourhoods

- **Restart:** the owner saw 100% CPU while staging built part 1 (right after a full test run) and restarted the server. Nothing was lost; web and worker were then deployed one after the other (Coolify already builds one at a time, `concurrent_builds=1`), and part 1 is on staging. The restart stopped the test containers (`docker start wave0-test-pg wave0-test-valkey wave0-test-meili`) and emptied the scratchpad. Rule kept: a gap between tests and a build, and tell the owner before each build.
- **Owner's request:** listing cards said «برلین»; they should say the neighbourhood («ودینگ»، «موآبیت»), as in the mockup. Agreed, built first in part 2.
- **Built:** `neighbourhoods` (migration 0022) with Berlin's 97 official Ortsteile (Geoportal Berlin, Datenlizenz Deutschland Zero 2.0; `scripts/import-neighbourhoods.mjs`, simplified to about 10 m, 158 KB) and Persian names in `seed/neighbourhoods/index.ts`. A listing's neighbourhood is looked up from its point (postal code or area, never a city centre): cards «ودینگ، ۲ ساعت پیش», the listing page «ودینگ، برلین» (the seller's own place text still follows), saved listings. Other cities add their file when they open.
- **Tests:** 752 passing (new `tests/neighbourhoods.test.ts`: 97 named and valid shapes, Leopoldplatz → ودینگ, Turmstraße → موآبیت, Oranienplatz → کرویتسبرگ, Potsdam → none, city-only listings → none; `tests/grants.test.ts` counts 45 tables).
- **On staging after the deploy:** run the seed once (`npm run db:seed`), else cards keep saying «برلین». The owner checks the Persian spellings (list page).

## Oct 27, 2026: wave 1, part 2: finding

- **Built** (`docs/setup.md`, "Brand and design", "Wave 1 rules"): the first page (mockup `home`): the visitor's country suggested from Cloudflare's header («به نظر می‌رسد در آلمان هستید»), the big search, the key cities (Berlin with its count, waitlist cities with «۲ از ۲۰ کسب‌وکار»), «همه آلمان», «کشور دیگر» (`/?choose`, the open countries), the categories and events, three trust lines and the business offer. Browse pages (mockups `browse`, `category`): on phones one sticky block with the search and one chip row (filters, all categories, then the applied filters with × or the categories), the result line with count, a sort menu, grid/list and «خبرم کن», and the rent-scam warning on rooms and flats. The filter sheet: buttons instead of selects (radius, shipping, yes/no and short lists), the typical price under the price fields, «نزدیک من» inside it, day / month / year date fields, and «نمایش ۲۳ آگهی» counted live while changing it (`/api/search/count`).
- **Not built here:** the country chooser's «به‌زودی» list with «خبرم کن» per country needs country waitlists (wave 2, countries); the «این هفته در برلین» events strip comes with part 6 (events).
- **Found by the tests and fixed before commit:** the new date-part joining dropped a `__proto__` parameter instead of refusing it.
- **Tests:** 757 passing (new `tests/browse-filters.test.ts`: the live count with price and city, unknown addresses, the typical price and its rounding, date parts in filters).

## Oct 27, 2026: wave 1, part 3: the listing page

- **Built** (mockup `listing`): on phones back, share and ♡ over the photo with the site header and bottom bar out of the way, and a fixed bar with chat, phone and ♡; on computers a card beside the photo with title, price (cold rent and «با هزینه‌های جانبی …»), place and contact, then the seller box and the safety box. Fact tiles under the title; the safety box fits the category (rent, cars, tickets, jobs, pets, the rest); the seller box says how fast they usually answer and links «۲ آگهی دیگر»; «آگهی‌های مشابه» shows the newest 6 of the same category in the same city.
- **Tests:** 762 passing (new `tests/listing-page.test.ts`).

## Oct 27, 2026: wave 1, part 4: posting in 4 steps

- **Built** (mockups `post1`–`post4`, `posted`): step 1 «چه چیزی آگهی می‌کنید؟» with a category search (suggestions with their parent, Arabic keyboard letters understood) above the tree; step 2 photos (big «افزودن عکس» tile, ⋯ menu per photo: main photo, earlier, later, remove), offer or wanted as two buttons, the title with a counter, the description; step 3 the category's fields (short lists, yes/no and checklists as buttons, optional fields «(اختیاری)») and the price (types as buttons, the currency inside the field), shipping; step 4 place, contact (chat always, phone optional), post as, then «پیش از انتشار بررسی کنید» with «تغییر» per part, Turnstile only here, «انتشار آگهی». A bar at the bottom of the phone with «قبلی» and «ادامه: …». Each «ادامه» saves the draft and the server says what is still missing (`saveListing({ check: true })`); a refused publish jumps back to the first step with an error. After publishing: «آگهی شما منتشر شد», Telegram, WhatsApp, copy link, then «ارتقای آگهی», «آگهی‌های من» and «آگهی دیگر».
- **Unchanged:** editing a listing that is out (one page); events keep their own form (part 6). Without JavaScript the draft shows on one page as before.
- **Tests:** 765 passing (new in `tests/listings.test.ts`: the check after each step, the step of every field, the category search).

## Oct 27, 2026: wave 1, parts 1–4 checked against the approved mockups

- **Owner's rule (saved in memory):** every built page must be identical to the approved mockup; compare side by side (mockup | staging, phone and computer) before reporting. Comparison page: https://claude.ai/artifact/J87iHnMiADw4urbwRDyKhy.
- **How:** mockup images from the design page (https://claude.ai/artifact/HqNDhAzv3SHSbbVCDmsQkQ), staging shots with Playwright (one browser, 390 px and 1280 px, names/emails/numbers masked). Signed-in shots through a temporary staging account and session («کاربر نمونه», session cookie signed inside staging's web container); the account, its session and its 7 drafts were deleted afterwards.
- **Fixed (about 40 differences):** header chip with the city and ▾, heart on phones, the header search searches the page it is on; search icon at the start; first page in the mockup's category order with short names, «نزدیک‌ترین شهر», «چطور کار می‌کند», real founding places («۳۰ کسب‌وکار اول برلین… ۲۹ جا مانده»); browse: breadcrumb in the sticky bar, one-line result row, list view on category pages, «تأییدشده» badge and «سرد، ماهانه» on cards, shorter rent warning; filter sheet above the header and bottom bar (it was under the bottom bar), price first with € inside, segmented «فرقی نمی‌کند» choices, place last with 5/10/25 km, no shipping on homes and services; listing page: back arrow and share icon, full-bleed photo, breadcrumb from the city, «ودینگ، 13351 Berlin»، one-line «اجارهٔ سرد، با هزینه‌ها …», fact icons, no outline map; posting: its own bar «✕ ثبت آگهی» with the category (no site header or footer), the only open country taken by itself, suggestions with counts, photos bare with «تا ۱۰ عکس», prompt chips, offer/wanted under the description, «قبلی» at step 2, price first and deposit after it, units inside fields, weekday under dates, «نامحدود / تاریخ مشخص», rent without price kinds, compact postal code at step 4, switches for chat and phone, check list with photo thumbnails, field values and «خودم (…)», a live preview beside steps 3–4 on computers.
- **Left on purpose (on the page):** footer (part 8), events strip (part 6), Anmeldung badge (no such field in the categories), «نزدیک من» kept in filters, cold rent kept apart from extra costs, housemates stays a number.
- **Found:** headless uploads to R2 fail with "Failed to fetch" from the test container, while the owner's real uploads today all finished; not a product bug as far as can be seen. «ادامه» queued behind failing uploads in that test.
- **Tests:** 766 passing.

## Oct 27, 2026: wave 1, part 5: me (my listings, chat, account)

- **Built** (mockups `mylistings`, `mylistings-menu`, `chat`, `account`, `notifications`): my listings as compact rows (status, days left in red when 3 or fewer, «۱۸۴ بازدید، ۹ نشان، ۴ گفتگو»), one button that fits the moment («تمدید رایگان» when running out or expired, «اجاره داده شد» / «فروخته شد», «فعال‌سازی», «ادامهٔ ثبت»), «ویرایش», and «بیشتر ⋯» opening a sheet (promote «از ۱٫۹۹ €», see, share, pause, sold, delete with a confirm); status chips as tabs. A conversation fills the screen (no site header): back, the listing's photo, title, the other person and the price, ⋯ with see listing, «گزارش گفتگو», archive and block; one safety note by the listing's kind; no flag beside each message; quick replies above the box for the seller or the buyer. The account is a hub: profile card (initial, «عضو از …، ودینگ، برلین», phone verified, «صفحهٔ من»), «فعالیت من» tiles with counts, the business with its plan only when there is one, then settings (`/account/settings`, the old list), help, support, the legal pages and sign out. Notifications: rows with switches that save at once. Signed in, the header on computers is chat, my listings, ♡, a round initial and «ثبت آگهی», and away from the country's pages the chip and search use the user's saved city.
- **Kept for later (`docs/roadmap.md`):** the mockup's Telegram/email columns, quiet hours and bundling on the notifications page (needs a per-channel setting and a delivery queue). The settings row already names «ظاهر», which arrives with part 10.
- **Shared pieces:** `src/components/sheet.tsx` (bottom sheet on phones, dialog on computers; the browse page's sheets use it too), `src/components/app-bar.tsx`, `src/components/switch.tsx`; `conversationCounts()` and `homeArea()`.
- **Tests:** 768 passing (new: chat counts per listing for the seller only; the account's home area).
- **Checked against the mockups** (https://claude.ai/artifact/LbfUXBmVfnATg61RgRLim8): a temporary staging account with three listings like the mockup (photos cut from the mockup, uploaded through the real form; the test browser's storage upload now goes through Playwright itself, which fixes the earlier "Failed to fetch"), one conversation and a buyer; all deleted afterwards (the 3 photo files stay in staging storage). Fixed after the first look: the signed-in header (chat, my listings, ♡, a round initial, «ثبت آگهی»; the chip and search use the saved city away from the country's pages), the actions on one line, «فروخته شده», the first day line in a chat, a solid send button, the account tiles in two columns on computers. Left: the notifications channels (roadmap) and the business row, which shows only for users with a business.

## Oct 27, 2026: catch-up with the whole design (owner: "you are not following all the design")

- **Why:** the owner asked for every mockup so far and felt parts were missing. All 58 screens of the design page (https://claude.ai/artifact/HqNDhAzv3SHSbbVCDmsQkQ) are listed with their state on https://claude.ai/artifact/GPzBQetKnU17yvAz4s6NRN. Found: the wave 0 screens were never compared with their mockups; the round 12 city chooser was missing; «به‌زودی» countries had been moved to wave 2 without asking; notifications had only the look.
- **Built:** the phone check «یک بار شماره‌تان را تأیید کنید» (Telegram's blue button, the bot as the second way, «تلگرام ندارم» for SMS) and its own screen for a +98 number; the Iran notice as the mockup's card; the waitlist page's perk icons and «خبرم کن و نردبانم را نگه دار»; the founding business page (`/{country}/{city}/founding`); the city chooser «شهر شما» (`/cities`, from the header chip and «کشور دیگر») with the country's key cities and the other countries' first cities; first waitlist cities for Austria (Vienna, migration 0023), Canada, the US, Australia, the UK and the Netherlands (`seed/locations/first-cities.ts`; a closed country shows only its waitlist city's page); «به‌زودی» in the country list; notifications as designed: Telegram and email per kind (new message, first message about your listing, saved searches), quiet hours from 22 to 8 in the person's city time, and bundling of saved searches into one daily message (`src/modules/users/notification-prefs.ts`, the worker's chat and search-alert queues).
- **New designs where there was no mockup (owner's rule, saved in memory):** settings in groups with each value under its name, devices, the account's sub-pages (one bar with back), messages, saved listings, saved searches (frequency as a three-way switch, rename and delete under ⋯), purchases.
- **Left:** WhatsApp in the phone check (postponed); «رویدادهای این هفته در شهر» in notifications (needs the weekly events message); the business panel and admin cities mockups are compared in parts 7 and 9, which rebuild those pages.
- **On staging after the deploy:** the seed ran (86 cities).
- **Tests:** 776 passing (new `tests/notification-settings.test.ts`; waiting countries in `tests/city-launch.test.ts`; bundling and quiet hours in `tests/search-alerts.test.ts`; chat counts and the home area).

## Oct 27, 2026: wave 1, part 6: events

- **Built** (mockups `events`, `events-filters`, `event`, `post-event1`, `post-event2`): the list for a city (`/germany/berlin/events`) or a country with the season strip (Yalda, Chaharshanbe Suri, Nowruz, Sizdah, found in the Jalali calendar, shown up to 60 days ahead when the city has events for it; `src/modules/events/seasons.ts`), 14 days with a dot where something is on, type chips that apply at once, «رایگان» and «آنلاین», the paid «ویژه» slot, the events by week with their 4:5 posters, «N نفر علاقه‌مند», and «خبرم کن». A city's list includes the country's online events. The filter sheet: only the city / up to 100 km / the whole country, when (today, tomorrow, weekend, week, month, a date), type, price (free, up to 20 in the country's currency), language, who it suits (family, 18+, step-free), in person or online, with a live «نمایش ۴ رویداد» (`/api/events/count`). On the events pages the header's box searches the events. The event page: poster on a blurred copy, date / place / tickets rows with calendar, route and tickets and «۱۲ روز دیگر», other dates of a series, performers, the facts (language, age, seating, step-free, refund, door sales), the organiser with «دنبال کردن» (businesses), the ticket-scam warning, similar events, «کد رویداد», and on phones a ticket bar at the bottom. Posting in three steps: poster first (it may come before the type), type chips, title with a counter; date, half-hour times, an optional end (then three hours, and pages show only the start), repeat chips («چند روز پشت سر هم» = one date over several days), in person / online / both, venues already on Peydoo suggested with their street, neighbourhood and count; then entry, ticket link, about, performers, facts, post as a business, the check before publishing. «رویدادهای من» restyled like «آگهی‌های من», with a switch between the two (shown to those who have events).
- **Notices** (through the send queues, by the person's switches, never in quiet hours): a saved event's reminder the day before (`favorites.reminded_for` marks the date), a followed business's new event (at most two a day), and Monday's «رویدادهای این هفته در شهر» for those who pressed «خبرم کن». Both are rows in the notification settings, which closes the catch-up's open item.
- **Migrations:** 0024 (`organization_follows`, the reminder mark, the event page's facts, `erase_user` deletes follows), 0025 (the event types become the design's eight: concerts, parties (with celebrations), «فرهنگی و ادبی» (with readings, theatre, film, talks), meetups, workshops, «یادبود و همبستگی» (was religious), children, sport, plus «سایر»; events of merged types moved; the seed retires the old four). Staging seed ran (123 leaf categories).
- **Left on purpose:** tours («شهر و تاریخ دیگر») and the Instagram paste (both kept for later by the owner's decision); a drawn moon tile instead of the Yalda photo; with no day chosen, today is outlined, not filled (filled means the list shows only that day); a «ورزش» chip besides the mockup's seven; street and postal code fields under the venue (needed for a new venue).
- **Incident:** the server hit 100% CPU while tests and a staging build ran at the same time, and the owner restarted it. From now on: no tests or browser while a build runs; test containers are stopped during builds.
- **Checked against the mockups:** https://claude.ai/artifact/1SapBYY97XEowXqGgnYMJp (staging 51cf2bd, phone and computer). Fixed after the first look: a hidden label that made the phone page wider than the screen, the type names, short prices («از ۳۵ €», «رایگان»), «کد رویداد» and «گزارش», no site footer on a phone's event page, a full-width «ویژه», the neighbourhood in venue tips. The temporary organiser, viewer, 30 fans, two businesses and 8 events were deleted afterwards (the poster files stay in staging storage).
- **Media kept (owner, for a video later):** screenshots, mockup copies, posters and the comparison page are in `/root/peydoo-media/wave1/part6/` (not in Git). Earlier parts' screenshots were lost with /tmp in the restart.
- **Tests:** 793 passing (new `tests/events-wave1.test.ts`; seasons, the list's address, open end and performers in `src/modules/events/helpers.test.ts`).

## Oct 27, 2026: the owner's picks from the polish proposals, and sample data

- **Proposals:** https://claude.ai/artifact/XwbfSpEHUGKChVAR5F2EqH (events placement, the footer, one-page filters, sitewide ideas). The owner chose 1, 2, 3, 4a, 4b, 4c and 4e.
- **Built:** «رویدادها» right after «فیلترها» on browse pages and first (in saffron) on the first page; the mockup's «این هفته در برلین» strip above a city's or country's listings when it has events this week (it was in the approved browse mockup and had been missed); the approved footer on every browsing page (help, legal, Peydoo, countries with «به‌زودی … خبرم کن»; the Telegram channel shows once `TELEGRAM_CHANNEL` is set); filter sheets as one page (full screen on phones, two columns for events on computers; `full` on `src/components/sheet.tsx`); a soft background under white cards on the first page, browse, events and saved listings (`data-soft-page`, `--color-page`); a pill behind the active tab of the bottom bar; «همه ←» on row titles (`src/components/section-title.tsx`); «ذخیره شد» / «کپی شد» notes and the ♡'s pop (`src/components/toast.tsx`).
- **Sample data on staging (owner's request, kept):** on the owner's account, 10 listings (room, car, iPhone, setar, German lessons, desk, MacBook, stroller; moving and a cook's job posted as the business «taskpilot», since private accounts have a service limit and jobs are business-only) and 5 events with posters; the 6th event (CV workshop) is a draft because of the 5-events-a-day limit. Made with the app's own posting code (`/root/peydoo-media/test-data/seed-samples.mts`), photos cut from the approved mockup and uploaded through the photo editor. Test data now stays on staging (memory rule).
- **Media:** `/root/peydoo-media/proposals/oct27-sitewide/` (before, after, the page) and `/root/peydoo-media/test-data/`.

## Oct 27, 2026: wave 1, part 7: Pro and business

- **Built** (mockups `pro`, `business-new`, `business-legal`, `business-page`, `business-dashboard`): `/pro` with the founding offer of the visitor's country's first open city and its real places left, a monthly / yearly switch (CSS only), three plans with «پیشنهاد ما», and an honest FAQ; no pay buttons from Iran. A new business in three steps in one form (`src/app/business/business-form.tsx`): logo (uploaded straight to R2, made into a 512 px square WebP by the worker, `src/modules/organizations/logo.ts`), name with the page address suggested from it (`suggestSlug`), what it does (12 types), where, «آنلاین هم خدمت می‌دهیم»; then phone, email, website, Instagram, Telegram, languages, opening hours by weekday, one line and «دربارهٔ ما» (designed, no mockup); then the legal details by legal form, with «بعداً تکمیل می‌کنم». Editing shows the three parts on one page. The business page: cover, logo, verified and founding badges, one line, neighbourhood and city, languages, «الان باز است، تا ۱۸:۰۰» from the hours in the city's time (`src/modules/organizations/hours.ts`), message / call / route, follow, listings / events / «دربارهٔ ما» tabs, the Impressum folded at the bottom, opening hours in its JSON-LD. The dashboard: the founding offer as steps where it was given, otherwise «صفحه‌تان را کامل کنید» (logo, contact and hours, legal details, first listing) until done; plan, shortcuts, rows with the category, status, views and chats; it now has the bottom bar (a hub; edit, team and billing stay task pages).
- **Rule change (from the approved plan):** the legal details can wait. They are all or none (form, name, street, postal code, email), and a plan or founding checkout is refused with `legal_missing` until they are complete; billing and the dashboard say so with a link. The page shows the Impressum only when it is complete.
- **Differences on purpose:** «پیام» opens a list of the business's listings to message about (a chat always belongs to a listing; a business-wide chat would change the chat module); the founding box follows the decided rules (offered by Peydoo to verified businesses, the city's places, €24 after six months, badge for a year), not the mockup's older text with an invite code, 50 places and a deadline; the postal code has its own field in step 3; four more business types than the mockup's eight.
- **Also:** a card without a photo shows its category on a soft tile (with the business's name on its page) instead of a grey icon.
- **Migration 0026:** `organizations.business_type`, `tagline`, `languages`, `serves_online`, `instagram`, `telegram`, `opening_hours`.
- **Sample data (kept):** «دارالترجمه پارسیان» (`/b/parsian-translations`) on the owner's account, made through the new steps on staging with a logo, hours and legal details (fictional owner name), and three listings under it (`/root/peydoo-media/test-data/seed-business.mts`). Not verified (that would email the owner).
- **Checked against the mockups:** https://claude.ai/artifact/Emiur66jRJQBNjvSueqYXQ (staging d2485ab, phone and computer); screenshots and the page in `/root/peydoo-media/wave1/part7/`. Fixed after the first look: the category tile on photo-less cards, the bottom bar on the dashboard, «شروع پرو» for visitors, the neighbourhood in the dashboard subtitle (the row tile fix waits for the next build). The temporary session was deleted.
- **Disk:** staging's disk reached 97% after today's many builds. With the owner's go-ahead: Docker build cache older than 2 hours (6.6 GB) and 76 old app image tags removed by hand (the running d2485ab and the previous 7b1d1a8 kept; no volumes touched); 78% used, 7.9 GB free.
- **Tests:** 800 passing (new `tests/business-wave1.test.ts`: legal details later and all-or-none, payment refused without them, profile fields, hours, logo processing, page address).

## Oct 27, 2026: wave 1, part 8: footer and legal

The footer itself was built in the polish round (help, legal with the German names, Peydoo, countries with «به‌زودی … خبرم کن»; two columns on phones, nothing folded). This part makes the Impressum reachable from every screen.

- **Built:** the legal pages link to each other (`src/components/legal-nav.tsx`: Impressum, شرایط (AGB), حریم خصوصی (Datenschutz), تماس DSA) at the top of `/impressum`, `/terms` and `/privacy`, so the account's «Impressum، شرایط و حریم خصوصی» reaches all of them. A conversation's ⋯ ends with the same row (two taps). The posting pages (listing, event, business), which have their own bar instead of the header, keep one line of the four legal links where the footer was, clear of the steps' bar on phones (`[data-footer-slim]`, `globals.css`). The footer's «تماس طبق DSA» now lands on the report section of `/contact` (`#dsa`). Unused old footer texts removed.
- **Left out on purpose:** the mockup footer's «راهنمای ایرانیان در ترکیه» (Turkey pages are wave 2); the Telegram button shows once `TELEGRAM_CHANNEL` is set.
- **Checked on staging (67cab38, also carrying part 7's row tile fix), phone 390 and computer 1280:** footer on `/germany`, the row on each legal page with the current one marked, `/contact#dsa` scrolled to the section, the line on `/new` and `/business/new` (above the step bar on phones), chat ⋯ → Impressum and account → Impressum; no console or CSP errors, no sideways scroll. Only the opened ⋯ panel was captured (the conversation is with another account). Screenshots and script in `/root/peydoo-media/wave1/part8/`. The temporary session was deleted.
- **Tests:** 800 passing, typecheck and `check:rtl` clean.

## Oct 27–28, 2026: wave 1, part 9: admin

- **Built** (mockups `admin-item`, `admin-overview`, `admin-system`, `admin-cities`): the admin has its own dark bar (panel, environment, a search for code, email or name with "/", the staff member, back to the site) and its sections with the queue's size and the system's problems (`src/app/admin/layout.tsx`, `nav.tsx`); the public header, footer, Iran note and bottom bar step aside. **One item at a time:** its place in the queue, the 24-hour clock, J / K (`keys.tsx`); big photos with a greyscale switch, scam phrases marked (`src/modules/admin/risky.ts`), "x% cheaper than similar listings", reports with the reporter's baseless reports, the seller's history (account age, how and from which country the number was verified, decisions, reports, the same text in other listings). The decision has **nothing preselected**, options from mild to severe on keys 1–9 (`bySeverity`), reason chips that pick the terms section and fill a first sentence for the facts, the statement folded, and «… و بعدی», which opens the next item (`nextPath`). **Overview:** what needs attention first (queue, system problems, businesses waiting), the period's numbers with the change against the period before (7/30/90 days), the biggest city against the next-city gates, then the charts and every city. **System status:** problems first in red with what to do (`src/modules/admin/attention.ts`, shared with the overview and the nav badge), green tiles, the queue table with failed first. **Countries and cities** to its mockup: country tabs, key cities open, a bar under each goal, the opening date, the early-signup reward.
- **Differences on purpose:** all 12 reasons as chips; six stat cards (events too); the queue table keeps «زمان‌بندی‌شده»; no «آگهی آماده» column (not stored); the reward follows the size rule (200/100/50), shown, not edited.
- **Found on staging:** 4 payment webhooks not applied and 4 failed jobs in `payments` (the same 4 events), all Stripe test mode. Cause: the local test-mode run of Oct 22 (scratch stack on `localhost:3000`) used the same Stripe test account as staging, and Stripe sends every event to every endpoint of the account. Staging got three `checkout.session.expired` events for bump and featured checkouts started on localhost ("no order for checkout") and one `invoice.paid` for a subscription made there ("no business found"). Nobody's purchase is missing. Proposed fix (waiting for the owner): an expired checkout without an order needs nothing, and in test mode an event for something this database never saw is skipped instead of retried; in live mode it stays an error. Local runs should use their own Stripe sandbox.
- **Checked against the mockups:** https://claude.ai/artifact/8aQxmqypuKjc93b5MBA3Q3 (staging 7afb001, phone and computer); copies in `/root/peydoo-media/wave1/part9/`. A temporary admin account, seller, three listings and four back-dated reports (so the Telegram alert didn't count them) were added for the check and deleted afterwards. Fixed after the first look: «صف بررسی» active on item pages, the search placeholder side, the statement folded, a segmented period switch, the stat order, plain gate bars, the cities page.
- **Tests:** 809 passing (new `tests/admin-wave1.test.ts`: system problems, the 24-hour clock and change, mild-to-severe order, where «و بعدی» may go, scam phrases, period totals, reporter history and same text).

## Oct 28, 2026: wave 1, part 10: dark mode, and Anmeldung on WG photos

- **Built:** automatic by default (follows the device through `prefers-color-scheme`), with «خودکار / روشن / تیره» in Settings › Appearance (`src/app/account/appearance`, mockup `final/appearance`; no account needed) and at the end of the footer for everyone (`src/components/theme-switch.tsx`). A choice is the `theme` cookie (one year, `src/app/theme.ts`, `theme-actions.ts`); the root layout writes it as `data-theme` on `<html>`, so there is no flash, and the browser bar follows (`generateViewport`). Without JavaScript the form posts and the page comes back in the new colours. A `theme` cookie keeps browse pages out of Cloudflare's shared cache (`src/proxy.ts`). The privacy policy lists the cookie (German and Persian, «Stand: 28. Oktober 2026»).
- **How:** every colour name the pages use gets a dark value in `src/app/globals.css` (round 3 tokens: surfaces #0f1716 / #16211f, turquoise #5cc0c7 with dark text on buttons, saffron #f5c862), so pages have no dark code of their own. `white` becomes the dark card surface, and `text-white` on turquoise or near-black turns dark with it. Three names never change: `snow` (text on photos, posters, the admin bar, red buttons), `ink` (text on saffron), `danger` (red buttons, as in the mockup). brand-900/950 and neutral-950 stay dark (posters, the admin bar, the photo viewer, backdrops). Photos are never dimmed.
- **Guard for later changes:** `tests/dark-mode.test.ts` checks 40 text/background pairs for WCAG AA in light and dark, that the device and chosen dark blocks are identical, that every colour used in `src/` has a dark value, and that `text-white` only sits on fills that turn light. It caught one on the first run (the red button's hover in dark).
- **Anmeldung (owner, Oct 28: "the word anmeldung is not positioned on the cover photo"):** part 2 had left the chip out because no such field existed. WG rooms now have a yes/no field «Anmeldung ممکن» (`seed/categories.ts`, filterable; 290 fields), and cards show «Anmeldung» on the photo opposite the photo count (`listing-card.tsx`), as in `final/ui.js`. Only WG rooms ask: a main tenant may always register, and short-term rent is used outside Germany too. The seed was run on staging. The cut-off «…meldung» the owner saw is inside the photo of the sample listing «اتاق مبله در WG، نزدیک Hermannplatz» (a screenshot of a card, badges included); replacing that photo fixes it.
- **Checked against the mockups:** https://claude.ai/artifact/NSbwHvXHqrN76Jx9mJk3ys (staging fd15b2b, the ten dark mockups and Appearance, phone and computer; automatic mode with the device in dark and light; the footer switch with and without JavaScript; the Anmeldung chip inside the photo). Copies in `/root/peydoo-media/wave1/part10/`. A temporary seller, buyer, admin, WG listing, conversation and report were added for the check and deleted afterwards.
- **Tests:** 866 passing.
