# Setup decisions

Oct 16, 2026 · reviewed against `docs/architecture.md`

This file records the infrastructure as it actually exists and the decisions taken after reviewing the plan. Where it differs from `docs/architecture.md`, this file wins.

## What exists now

| Item | Value |
| --- | --- |
| Server | Hetzner CX23 (2 vCPU, 4 GB RAM, 40 GB disk), Helsinki `hel1`, `135.181.253.129`, server id 170743334 |
| Firewall | `classifieds-app` (id 11815492): inbound 22, 80, 443 (tcp) and 443 (udp, HTTP/3), ping. Everything else closed, including Coolify's raw ports 8000/6001/6002 and Traefik's 8080 |
| SSH | Root login by key only (password login for root is off) |
| Coolify | 4.4.6 at https://coolify.taskpilot.dev (Let's Encrypt). Public registration disabled; one admin account |
| DNS (temporary) | `kooche.taskpilot.dev` (app) and `coolify.taskpilot.dev` (dashboard), both A records to the server, not proxied by Cloudflare |
| Backup storage | Hetzner Storage Box BX11 `classifieds-backups` (id 674924), 1 TB, Falkenstein `fsn1`, `u692990.your-storagebox.de`, SSH/SFTP on port 23 only |
| Photo storage | Cloudflare R2, EU jurisdiction (data stays in the EU), account BerlinWedding. Buckets `classifieds-media-staging` (testing) and `classifieds-media` (production, starts empty at launch). Both private: public `r2.dev` access is off. S3 endpoint `https://fe5720006c80324ed7b6bdd00d63b774.eu.r2.cloudflarestorage.com`, region `auto` |
| Secrets on server | `/root/.secrets/*.env` (root-only, never in Git) |
| Code | https://github.com/rezakhsh/kooche (private). The server pushes with a deploy key (`/root/.ssh/github_deploy`, SSH host alias `github-kooche`) that has write access to this repo only |
| Backups | `/usr/local/bin/classifieds-backup`, nightly at 03:15 UTC (`/etc/cron.d/classifieds-backup`), log in `/var/log/classifieds-backup.log` |

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

## Memory budget

**Now (CX23, 4 GB, staging):**

| Service | Limit |
| --- | --- |
| Coolify (measured ~450 MB idle) | 600 MB |
| PostgreSQL + PostGIS | 768 MB |
| Valkey | 128 MB |
| Next.js app | 768 MB |
| Worker | 384 MB |
| imgproxy | 256 MB |
| System reserve | ~1 GB |

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
- The restic password is in `/root/.secrets/restic.env`. Save a copy in your password manager. Without it, the backups cannot be read if the server is lost.

## Open decisions

1. **Coolify deployments from GitHub.** Install Coolify's GitHub App from the Coolify dashboard when the first app is ready to deploy.
2. **Brand, then domain.** Nothing technical depends on it any more. Buy the domain into Cloudflare when decided.
