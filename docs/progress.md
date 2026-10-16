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
1. Set up the staging database on the server: `POSTGRES_INITDB_ARGS` before its first start, the bootstrap script, migrations, seed, role passwords in `/root/.secrets/`. Add its `pg_dump` (as `classifieds_readonly`) to the nightly backup.
2. Persian names of the cities and categories: a quick read-through by a native speaker before launch.
3. Product rows (bump, featured, Pro) go into a seed once Stripe prices exist.
