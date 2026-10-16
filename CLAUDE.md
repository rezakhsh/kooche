# CLAUDE.md

Persian-language classifieds marketplace for Iranians in Europe. Modular monolith: one TypeScript codebase, Next.js app + background worker, PostgreSQL as the single source of truth.

Read first: `docs/setup.md` (current infrastructure and decisions, wins over everything else), `docs/architecture.md` (product and architecture plan), `docs/progress.md` (where work stands).

## Rules

- **Persian only, right-to-left.** `<html lang="fa" dir="rtl">`, Tailwind logical classes (`ms-`, `me-`, `ps-`, `pe-`), never `ml-`/`mr-`/`pl-`/`pr-`. All interface text in the Persian messages file, never inline.
- **Database access only from server code.** The browser never talks to PostgreSQL, Valkey, Meilisearch or object storage directly (except uploads through one-time signed URLs).
- **Validate every input on the server with Zod.**
- **Every schema change through a Drizzle migration.** Never edit the database by hand.
- **IDs:** UUIDv7 primary keys (`uuidv7()`, PostgreSQL 18). Public URLs use short random tokens, never internal IDs.
- **Money:** integers in minor units plus a `currency` column. Never floats or decimals.
- **Time:** `timestamptz` in UTC. Jalali dates only in the interface.
- **Persian text:** store original plus normalized text (ي→ی, ك→ک, digits→Latin, diacritics removed, ZWNJ consistent). Normalize with the shared function, never ad hoc.
- **Money and entitlements** change only through payment-provider webhooks. Listings never store "is_featured"; compute it from entitlements.
- **Side effects through the outbox.** Search sync, notifications and n8n webhooks are written as `outbox_events` in the same transaction and processed by the worker.
- **n8n is for non-critical automation only** (channel posting, alerts, digests). Never auth, payments, moderation or database access. Webhooks to n8n are HMAC-signed.
- **Configuration from `.env` only.** No hostnames, bucket names or secrets in code. The database stores storage keys, never full URLs. Commit `.env.example`, never `.env`.
- **Tests required** for permissions, payments and moderation.

## Layout

- `src/app/` Next.js routes (App Router).
- `src/worker/` worker entry point (BullMQ jobs, outbox processor).
- `src/modules/<module>/` domain code shared by both (listings, users, organizations, chat, payments, moderation, search, media, notifications).
- `src/db/` Drizzle schema and migrations. `seed/` categories, attributes and cities (Persian), in Git.

## Workflow

- One feature per session. Plan first, get approval, then build.
- Commit after every working step. Deploy to staging first.
- Update `docs/progress.md` at the end of each session.
- Never put secrets in Git, prompts or logs.
