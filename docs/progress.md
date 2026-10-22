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

Not done:
- **Staging deploy:** waits for the owner's approval. Steps: `free -m`; merge `pro`; `classifieds-migrate` applies 0014; set `STRIPE_SECRET_KEY` on web and worker and `STRIPE_WEBHOOK_SECRET` on web in Coolify; run `scripts/stripe-setup.ts` on the staging database (writes products and the webhook endpoint for `https://staging.peydoo.com/api/stripe/webhook`); a short test purchase through Cloudflare.
- The business inbox (managers answering chats), business logos, events posted as a business, the admin page for verification and refunds (roadmap step 8).

For the owner:
- Before live payments (at launch): activate the Stripe account, statement descriptor, Steuernummer on invoices, PayPal recurring and SEPA in live mode; a tax advisor confirms the VAT notes (thresholds, Austria) and the lawyer terms section 14.
- Payments from Iran: nothing until a sanctions lawyer has confirmed an approach (`docs/payments-iran.md`).

