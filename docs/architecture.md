# Persian Classifieds Platform — Architecture & Build Plan

Oct 14, 2026 · @reza

> Decisions in `docs/setup.md` (Oct 16, 2026) override this document where they differ.

## Summary

Build one well-structured application (a "modular monolith") on PostgreSQL, hosted in Germany behind Cloudflare. Don't copy Divar's microservices. Divar and Kleinanzeigen run many services because they have large engineering teams and hundreds of thousands of new listings a day. A solo founder working with Claude Code needs the opposite: few moving parts, and a database designed correctly from day one.

| Decision | Choice | Why |
| --- | --- | --- |
| Architecture | Modular monolith, one TypeScript codebase | One person can run it; split into services later only when measurements demand it |
| Web framework | Next.js with server-side rendering | Google search is the main source of classifieds traffic, so pages must render on the server |
| Database | PostgreSQL 17+ with PostGIS | Single source of truth; flexible category fields; radius search |
| Search | Meilisearch | Good Arabic-script tokenization, typo tolerance, filters, geo search; rebuildable from the database |
| Cache and jobs | Redis (Valkey) + BullMQ | Rate limits, caching, background work |
| Images | EU object storage + imgproxy + CDN | Browser uploads directly; images resized to AVIF/WebP |
| Edge | Cloudflare | DDoS protection, firewall, bot protection, caching |
| Hosting | Hetzner, Germany | GDPR-friendly, low cost |
| Language | Persian only, right-to-left, Vazirmatn font, Persian (Jalali) dates | The whole target audience reads Persian |
| AI | Claude API inside background jobs | Listing creation from photos, moderation, scam checks |

The database decisions that are hard to change later are listed in section 5. Get those right and every other part of this stack can be swapped out later. Expected running cost at launch is roughly €80–150 per month (approximate).

## How Kleinanzeigen works

Kleinanzeigen is free for private sellers. It earns money from businesses, visibility upgrades and transaction fees paid by buyers. It reaches more than 36 million monthly users ([job post](https://freehire.me/jobs/data-engineer-analytics-products-adevinta-iqsxsois)).

**Product mechanics**

- Local first: search by place and radius, then pick up in person and pay cash.
- Safe payment ("Sicher bezahlen"): a payment provider holds the buyer's money until the buyer confirms the item arrived ([t3n](https://t3n.de/news/?p=1565510)). Sellers pay nothing; the buyer pays the protection fee ([e-recht24](https://www.e-recht24.de/ecommerce/13270-ebay-kleinanzeigen-kaeuferschutz.html)).
- Integrated shipping: since December 2021 sellers can ship through Hermes and DHL from the platform, and since April 2022 buyers can pay on invoice through Klarna ([PC-Welt](https://www.pcwelt.de/article/1189429/ebay-kleinanzeigen-einfuehrung-tipps-und-tricks.html)).
- "Direkt kaufen": instant purchase at the listed price, combined with buyer protection.

**How it makes money**

| Revenue source | How it works |
| --- | --- |
| PRO packages for businesses | Since May 2026: Basic, Power and Premium tiers, split across categories such as goods, vehicles, services and jobs ([mobiFlip](https://www.mobiflip.de/?p=481086)) |
| Free quota, then fees | Businesses get up to three free listings per category ([onlinemarktplatz.de](https://onlinemarktplatz.de/267016/kleinanzeigen-pro-neue-pakete/)); job ads cost €12.99–14.99 each after one free ad per 30 days ([JobJump](https://jobjump.net/arbeitgeber/vergleich/kleinanzeigen-kosten)) |
| Low-price tier | Up to 10 listings for items up to €25 |
| Visibility add-ons | Homepage placement, permanent top listing, seller labels such as "fast shipping" ([retail-news](https://retail-news.de/pro-funktionen-kleinanzeigen-update/)); extended radius for services at €8.99 per listing per 30 days ([t3n](https://t3n.de/news/?p=1679390)) |
| Re-engagement | Power and Premium sellers can message users who saved their listing, up to three times a month ([mobiFlip](https://www.mobiflip.de/kleinanzeigen-laesst-haendler-in-merklisten-schnueffeln/amp/)) |
| Buyer protection fee | Paid by the buyer on safe-payment purchases |

**Technology**

Kleinanzeigen belongs to Adevinta, which is merging it and France's leboncoin into one shared platform and has moved most European marketplaces to Amazon Web Services ([Adevinta](https://adevinta.com/about-us/technology/)). Adevinta's engineering blog describes Kubernetes, Kafka and many microservices ([Adevinta tech blog](https://medium.com/adevinta-tech-blog/testing-mastery-fast-and-secure-application-tests-fd633c5ccb2e)). That setup suits an organisation with more than 2,500 product and technology staff. It is not a model for a one-person start.

**Lessons for us**

- Keep private listings free; charge businesses and visibility.
- Plan the payment and shipping data model from day one, even if those features launch later.
- Users complain when businesses pose as private sellers and when scams stay up ([ifun.de comments](https://www.ifun.de/neuer-einstiegstarif-kleinanzeigen-de-ueberarbeitet-pro-pakete-278830/)). Business verification and fast moderation are where we can be better.

## How Divar works

Divar is a phone-number-first, city-first, chat-centred classifieds app. It wins on speed and trust tools rather than payments. About 500,000 listings are posted every day ([Digiato](https://digiato.com/iran-technology-news/divar-kenardivar-online-authentication)), more than 139.7 million a year, and about 53.1 million users open the app annually ([Wikipedia](<https://en.wikipedia.org/wiki/Divar_(website)>)).

**Product mechanics**

- **Login by phone code.** Users sign in with a one-time SMS code and receive a session token. Every listing has a short unique public identifier called a "token" ([divar on PyPI](https://pypi.org/project/divar)). Short tokens instead of numeric IDs stop people from scraping listings by counting up.
- **City first.** Users pick a city, then browse categories: real estate, vehicles, goods, services, industrial equipment and jobs.
- **Contact without payments.** Buyers reach sellers by normal call, secure call (number hidden), internet voice call or in-app chat ([Cafe Bazaar listing](https://cafebazaar.ir/app/ir.divar?l=en)).
- **Review before publishing.** Listings appear only after approval.
- **Business pages.** "Professional Divar" gives businesses their own page, linked from every listing. Divar serves about 1.5 million business users and gave them an ad-management tool for scheduling promotions ([Similarweb news](https://www.similarweb.com/ja/company/divar.ir)).

**Trust and quality tools**

- Video identity verification for sellers, through partner services ([Digiato](https://digiato.com/iran-technology-news/divar-kenardivar-online-authentication)).
- Quality-based pricing for car ads: the more complete and accurate the listing (checked by AI), the cheaper it is to post; vague listings cost more ([Digiato](https://digiato.com/iran-technology-news/divars-new-pricing-model-for-car-ads)).
- An AI sales assistant that answers repetitive buyer messages and runs first negotiations, plus "active device management" so users can see and log out their devices ([Similarweb news](https://www.similarweb.com/ja/company/divar.ir)).
- Divar's legal team works with police against harassers ([Digiato](https://digiato.com/iran-technology-news/divar-user-harasser-arrested-following-platform-judicial-complaint)).

**How it is built**

- **Open platform ("Kenar").** Outside developers build add-ons through OAuth2 and APIs for chat and for attaching extra information to listings ([kenar example](https://github.com/Mobin-Pourabedini/kenar-divar-example)). Video verification plugs in this way.
- **Code on GitHub.** Divar's public repositories include Go services and a Go boilerplate, a server-rendered React boilerplate (elite-js) and native iOS code in Swift ([github.com/divar-ir](https://github.com/divar-ir)). That points to Go back-end services, server-rendered web pages for search engines, and native apps.
- **Data infrastructure.** Every user action is logged; the app sends actions in batches of five to a logging service running on Kubernetes ([Divar engineering blog](https://tech.divar.ir/%D9%BE%D8%B4%D8%AA-%D9%BE%D8%B1%D8%AF%D9%87-%D8%AA%DB%8C%D9%85-%D8%B2%DB%8C%D8%B1%D8%B3%D8%A7%D8%AE%D8%AA-%D8%AF%DB%8C%D8%AA%D8%A7%DB%8C-%D8%AF%DB%8C%D9%88%D8%A7%D8%B1-nnuklui8qclg)).
- **Web app.** Divar also ships a progressive web app, which kept it reachable after Google Play removed it.

Divar's engineering blog is closed to automated reading, so its full internal stack (databases, search engine) is not public.

**Lessons for us**

- Copy: short random listing tokens, hidden phone numbers, chat at the centre, review before publishing, business pages, and an add-on API later.
- Copy the idea of AI-checked listing quality, which a competitor (Pindo) also does by turning a single photo into a listing in under 30 seconds ([Digiato](https://digiato.com/iran-technology-news/artificial-intelligence-based-advertisement-process-pindo)).
- Don't copy: Go microservices and Kubernetes. Divar needed them at 500,000 listings a day; we will not be near that for years.

## Recommended architecture

Run two processes, a Next.js app and a background worker, on Hetzner servers in Germany behind Cloudflare, with PostgreSQL as the single source of truth. Both share one TypeScript codebase, so Claude Code works in one language from end to end.

```
Users (phone / desktop browser)
        |
Cloudflare (edge cache, firewall, DDoS, bot protection)
        |
Hetzner server, Germany (Docker, Coolify)
  ├─ Next.js app      – server-rendered pages + API (login, posting, chat, payments)
  ├─ Background worker – photos, search sync, AI review, emails, alerts, sitemaps
  └─ Data layer
       ├─ PostgreSQL + PostGIS  – source of truth, backed up nightly off-server
       ├─ Redis (Valkey)        – cache, rate limits, job queue
       ├─ Meilisearch           – search index, rebuildable from PostgreSQL
       └─ Object storage + imgproxy – photos as AVIF/WebP
Outside services: Stripe (Pro subscriptions), SMS + email (login codes, alerts),
                  Claude API (AI posting, review), n8n (Telegram, Instagram)
```

**Launch setup:** everything above runs on ONE Hetzner server (2 vCPU, 8 GB RAM). Memory limits: PostgreSQL 2 GB, Meilisearch 1.5 GB, Next.js 1 GB, worker 512 MB, Coolify 1 GB, Valkey 256 MB, imgproxy 512 MB. Photos live in Hetzner Object Storage, never on the server disk. The database moves to its own server first when traffic grows.

Requests flow down from users through Cloudflare to the app. Slow work (processing photos, updating search, AI review, notifications) goes to the worker through the job queue, so pages stay fast.

**Stack**

| Layer | Choice | Why |
| --- | --- | --- |
| Language | TypeScript everywhere | One language for pages, API and worker |
| Web and API | Next.js (App Router) on Node | Server rendering for Google; Divar also renders its web pages on the server |
| Database access | Drizzle ORM with migration files | Typed, close to plain SQL, readable migrations |
| Login | Better Auth, storing data in our own PostgreSQL | No lock-in; email codes, Google and Apple, phone verification |
| Database | PostgreSQL 17+ with PostGIS | Data integrity, JSONB, radius search; runs on any host |
| Search | Meilisearch | Persian tokenization, filters, geo search |
| Queue and cache | Valkey (Redis-compatible) + BullMQ | Retries, scheduled jobs, rate limiting |
| Images | Hetzner Object Storage + imgproxy | EU storage; resizing on demand |
| Payments | Stripe | Pro subscriptions and paid bumps |
| Deployment | Docker with Coolify on Hetzner | Git push deploys; separate staging and production |
| Monitoring | Sentry (EU region), uptime checks, slow-query log | Catch errors and slow pages early |

**Changed from my earlier suggestion: no Supabase.** Supabase works best when the browser talks to the database directly, protected by row-level security rules. Moving away from that later is hard. Plain PostgreSQL behind our own server code keeps the database portable, which addresses your concern about changing it later.

**Why not microservices or Kubernetes.** They solve the problems of large teams and very high traffic, and they multiply the work of running servers. Start with one codebase organised in clear modules (listings, users, chat, payments, moderation), so any module can be split out later.

**How it grows (rough guide)**

1. **Launch:** one app server, one worker, one database server.
2. **More visitors:** more app servers behind a Hetzner load balancer (the app keeps no state on the server), and a bigger database server.
3. **Heavy reading:** a PostgreSQL read replica.
4. **Very large:** split chat and search ingestion into their own services, and partition the messages table by month.

## Database design

PostgreSQL is the single source of truth; everything else (search index, cache, CDN) can be rebuilt from it. Use fixed columns for what every listing has and one validated JSONB field for what differs by category. Benchmarks show JSONB with a GIN index matches or beats the older "entity-attribute-value" table design and uses far less storage ([Postgres Weekly](https://postgresweekly.com/link/8041/web)).

**Ten decisions that are hard to change later**

1. **IDs.** Internal primary keys are time-ordered UUIDv7. Every listing also gets a short random public token for URLs (like Divar's), so nobody can enumerate listings by counting.
2. **Users vs businesses.** Keep `users` (people) separate from `organizations` (Pro businesses), linked through `organization_members` with roles. A shop can then have several staff accounts later; adding this afterwards is painful.
3. **Countries and money from day one.** Every listing has a `country_code`. Prices are stored as integers in minor units (cents) plus a `currency` (EUR, GBP, SEK, CAD…). Never store money as decimals or floats.
4. **Location.** Store a country → region → city table and a PostGIS `geography` point per listing for radius search. Save a rounded point (about 500 m) so a seller's home address is never exposed.
5. **Category tree with attribute definitions.** `categories` is a tree (`parent_id` plus a path column). `category_attributes` defines each field: key, type, allowed options, required, filterable. Listing attributes are stored in `listings.attributes` (JSONB) and validated against those definitions on every write.
6. **Listing lifecycle.** One status field: draft → pending\_review → active → paused / sold / expired / rejected / deleted. Use soft delete, an `expires_at` date, and an append-only `listing_events` history. You need that history for disputes and for legally required explanations when you remove content.
7. **Persian text normalization at write time.** Store the original text plus a normalized copy:
   - Arabic ي and ك → Persian ی and ک
   - Persian and Arabic digits → Latin digits for numbers
   - Diacritics removed, zero-width non-joiner kept consistent

   Without this, a search for "کتاب" misses a listing typed with Arabic letters.
8. **Money tables kept separate from listings.** `orders`, `payments`, `subscriptions` and `entitlements` (what a user has paid for, e.g. a bump until a date) are updated only by payment-provider webhooks. A listing never stores "is\_featured"; it is computed from entitlements.
9. **Outbox table.** Each change writes an `outbox_events` row in the same transaction. A worker reads it to update the search index, send notifications and trigger n8n. Search never silently drifts out of sync.
10. **Time.** Store all times as `timestamptz` in UTC. Show Persian (Jalali) dates only in the interface.

**Core tables**

| Table | Holds | Notes |
| --- | --- | --- |
| `users` | Person accounts | Phone (verified), email, display name, trust score, status |
| `organizations` / `organization_members` | Pro businesses and their staff | Legal name, address, VAT ID, verification status |
| `categories` / `category_attributes` | Category tree and field definitions | Persian names; field types: number, select, multi-select, boolean, text |
| `locations` | Countries, regions, cities | Persian and native names, centre point |
| `listings` | Every ad | Token, owner, category, location point, price, currency, attributes (JSONB), status, expiry |
| `listing_images` | Photos per listing | Storage key, width and height, blur placeholder, perceptual hash for duplicate detection |
| `conversations` / `messages` | Buyer–seller chat | One conversation per listing per buyer; messages include read state |
| `favorites`, `saved_searches` | Saved listings and search alerts | Saved searches drive "new listing" notifications |
| `reports`, `moderation_decisions`, `user_sanctions` | Trust and safety | Each decision stores its reason, for the legally required explanation to the user |
| `products`, `orders`, `payments`, `subscriptions`, `entitlements` | Revenue | Filled by Stripe webhooks only |
| `outbox_events`, `audit_log` | Integration and security history | Append-only |

**Indexes to create at the start**

- `listings (status, category_id, created_at DESC)` for category pages.
- A GIST index on the location point for radius queries.
- A GIN index on `attributes` for attribute filters ([JSONB guide](https://oneuptime.com/blog/post/2026-01-21-postgresql-jsonb/markdown)).
- `messages (conversation_id, created_at)` for chat.

Full-text search does not run in PostgreSQL. It runs in Meilisearch (section 6), fed from the outbox.

## Performance

The target is a listing page that loads in under 2.5 seconds on a mid-range phone (Google's "good" threshold for Largest Contentful Paint). Most visitors are logged out, so most pages can be served from cache.

**Caching layers**

1. **Cloudflare edge cache** for logged-out pages (home, category, city and listing pages), kept for about a minute. When a listing changes, the worker purges that page's URL.
2. **Server rendering** in Next.js, so Google and slow phones get finished HTML.
3. **Redis** for hot data: category tree, city list, view counters (written to PostgreSQL in batches, never on every view), rate-limit counters.
4. **PostgreSQL** behind a connection pooler (PgBouncer), with the indexes from section 5. Add a read replica only when measurements demand it.

**Search**

- Meilisearch handles keyword search, typo tolerance, filters (category, city, price, attributes) and radius search. It has optimized tokenization for Arabic-script languages, unlike Typesense, which uses generic Unicode rules ([Meilisearch docs](https://www.meilisearch.com/docs/resources/comparisons/typesense.md)).
- Index the normalized Persian text from section 5 and add a Persian synonym list, for example ماشین / خودرو (car) and موبایل / گوشی (phone).
- Browsing a category with no keyword can come straight from PostgreSQL; send only text queries to Meilisearch.

**Images (usually the heaviest part of the page)**

- The browser uploads the original directly to object storage through a one-time signed URL; the app server never carries image bytes.
- A worker strips EXIF metadata (phone photos often contain the seller's GPS location), checks the file is really an image, and makes a perceptual hash.
- imgproxy serves resized AVIF/WebP versions on demand (thumbnail, card, full size), cached by Cloudflare.
- Pages show a tiny blurred placeholder first, then lazy-load photos below the fold.

**Persian and right-to-left**

- Set `<html lang="fa" dir="rtl">` and use Tailwind's logical spacing classes (`ms-`, `me-`, `ps-`, `pe-`), so the layout mirrors correctly.
- Self-host the Vazirmatn font (open source), subset to the characters used, with `font-display: swap`.
- Show Persian digits and Jalali dates through the browser's built-in formatting (`fa-IR-u-ca-persian`), so no extra library is needed.
- Keep all interface text in one Persian messages file. It costs nothing now and makes a second language possible later without rewriting.

**SEO (the main free traffic source)**

- Clean URLs: `/{city}/{category}` with Latin slugs, and listings at `/v/{persian-title}/{token}`.
- One sitemap per city and category, refreshed by the worker.
- Structured data (schema.org Product and Offer) on listing pages.
- Sold or expired listings return "gone" status after a grace period, so Google drops them.

## Security, fraud and legal

Scams and fake listings kill classifieds platforms faster than technical outages, so fraud prevention is a core feature, not an extra. The browser never talks to the database directly; every read and write goes through server code that checks permissions.

**Accounts and access**

- Sign in with a code sent by email, or with Google or Apple. Require a verified phone number (any country) before someone can post or send messages. This is the strongest single anti-spam measure, and Divar is built on it.
- Store sessions in secure HTTP-only cookies. Show users a list of their logged-in devices and let them log out each one (as Divar does).
- Admins and moderators must use two-factor authentication. Every admin action goes into `audit_log`.
- Hide sellers' phone numbers by default. Show them only to logged-in users, rate-limited, or offer chat only.

**Application security**

- Validate every input on the server with Zod schemas; never trust the browser.
- Use secure headers: a strict Content-Security-Policy, HSTS, same-site cookies against cross-site requests.
- Re-encode every uploaded image to strip hidden payloads, and enforce size and type limits.
- Rate-limit by user, IP and device on login, posting, messaging and "show phone number".
- Use Cloudflare's firewall and DDoS protection, plus Turnstile bot checks on signup and posting. Platforms serving the Iranian diaspora can expect hostile traffic.
- Give each component its own database role with least privilege. Keep secrets out of the code. Encrypt nightly backups and restore-test them monthly.
- Run dependency scans and Claude Code security reviews before every release.

**Fraud and scam prevention**

| Check | When | What it catches |
| --- | --- | --- |
| AI review of text and photos (Claude API) | Before publishing | Scam patterns, prohibited items, wrong category, fake prices |
| Perceptual hash of photos | Before publishing | Stolen or reused photos across accounts |
| New-account limits | First 7 days | Mass posting by throwaway accounts |
| Chat warnings | When a message contains links, payment requests or off-platform contact | Classic "pay me first by transfer" scams |
| Report button plus human queue | Anytime | Everything automation misses |
| Seller verification badge | Optional, later paid | Builds trust; Divar uses video identity checks |

**GDPR**

- Keep all personal data in the EU: Hetzner in Germany, EU object storage, and a Sentry account in its EU region.
- Sign a data processing agreement with every provider (Cloudflare, Stripe, SMS and email providers, Anthropic).
- Write a privacy policy. Show a cookie banner only if you add non-essential cookies; plain analytics without cookies avoids it.
- Let users export and delete their data. Set retention periods, for example deleting chats of deleted accounts after 90 days.

**Digital Services Act (EU)**

- Every hosting service must offer a way to report illegal content and must give users a reason when their content is removed. The `reports` and `moderation_decisions` tables cover both.
- The extra platform duties (articles 20–28) do not apply to micro and small enterprises ([DSA art. 19](https://www.springlex.eu/en/packages/dsa/dsa-regulation/article-19/)). Neither do the marketplace duties such as verifying business sellers ([DSA art. 29](https://www.springlex.eu/en/packages/dsa/dsa-regulation/article-29/)). Small means fewer than 50 employees and under €10 million turnover ([Presencis](https://presencis.com/regulations/dsa/article-19/)).
- Still collect business details for Pro accounts voluntarily. It builds trust and prepares for growth.

**Legal pages**

You need an Impressum, a privacy policy and terms of use. Write them in Persian with a German version, and have a lawyer check them before launch.

## Build roadmap with Claude Code

Plan on about 10–12 weeks of focused work to a public launch in one German city. The database and security foundations come first, because they are the parts that are expensive to redo.

**Phases**

1. **Foundation (week 1).**
   - Repository, `CLAUDE.md` rules file, product spec.
   - Hetzner servers via Coolify, Cloudflare in front, staging and production environments.
   - PostgreSQL with PostGIS, Redis, Meilisearch.
   - Backups configured and a restore tested.
2. **Data model (week 2).** Write the full schema from section 5 as migrations (Drizzle ORM), including the tables for payments and moderation that you'll only use later. Seed categories, their attribute definitions and cities, all in Persian. Have Claude Code review the schema before writing any feature code.
3. **Core marketplace (weeks 3–6).**
   - Phone-verified accounts.
   - Posting a listing with photos.
   - Category, city and listing pages.
   - Search with filters and radius.
   - Favorites, saved-search alerts, chat.
4. **Trust and safety (weeks 7–8).**
   - Report button and moderation queue for admins.
   - AI pre-review, duplicate-photo check, rate limits, new-account limits.
   - Legal pages.
5. **AI posting (week 9).** Photo plus a short Persian voice note becomes a complete listing with title, description, category, attributes and a suggested price.
6. **Pro and revenue (weeks 10–11).**
   - Business pages and Stripe subscriptions.
   - Paid bumps and featured slots through entitlements.
7. **Launch (week 12).**
   - Security review and load test.
   - Seed 20–50 Iranian businesses in Berlin with free Pro.
   - n8n auto-posting of new listings to Persian Telegram and Instagram channels.
8. **Later.** Safe payment with escrow through a marketplace payment provider, shipping labels, seller verification, mobile apps, an add-on API like Divar's Kenar.

**How to work with Claude Code**

- One feature per session: plan mode first, approve the plan, then build.
- `CLAUDE.md` fixes the rules:
  - Persian only, right-to-left.
  - All database access from server code.
  - Every input validated with Zod.
  - Every schema change through a migration.
  - Tests for permissions, payments and moderation.
- Commit after every working step; deploy to staging first.
- Before each release, ask Claude Code for a separate security and performance review of the changes.

**First prompt**

> Read docs/architecture.md and CLAUDE.md. Design the complete PostgreSQL schema for a Persian-language classifieds marketplace for Iranians in Europe: users, organizations, categories with attribute definitions, locations with PostGIS, listings with JSONB attributes and public tokens, images, conversations, reports, moderation decisions, payments, entitlements and an outbox. Explain each table and index, then wait for my approval before writing migrations.

**Monthly running cost at launch (approximate)**

| Item | Cost per month |
| --- | --- |
| Hetzner servers (app, worker, search, Redis) | €30–60 |
| PostgreSQL (self-hosted on Hetzner or managed in the EU) | €0–30 |
| Object storage and backups | €5–15 |
| Cloudflare (free or Pro plan) | €0–25 |
| SMS verification codes | €10–50, depending on signups |
| Claude API for AI posting and moderation | €20–50 at low volume |
| Email, error monitoring | €0–20 |

Total: roughly €80–150 per month until traffic grows.

**Sources**

- [Divar on Wikipedia](<https://en.wikipedia.org/wiki/Divar_(website)>)
- [Divar GitHub organisation](https://github.com/divar-ir)
- [Digiato: Divar video verification and 500,000 daily listings](https://digiato.com/iran-technology-news/divar-kenardivar-online-authentication)
- [Digiato: Divar quality-based pricing for car ads](https://digiato.com/iran-technology-news/divars-new-pricing-model-for-car-ads)
- [Digiato: Pindo AI posting](https://digiato.com/iran-technology-news/artificial-intelligence-based-advertisement-process-pindo)
- [Kenar add-on example](https://github.com/Mobin-Pourabedini/kenar-divar-example)
- [Adevinta technology](https://adevinta.com/about-us/technology/)
- [mobiFlip: Kleinanzeigen PRO 2026](https://www.mobiflip.de/?p=481086)
- [onlinemarktplatz.de: new PRO packages](https://onlinemarktplatz.de/267016/kleinanzeigen-pro-neue-pakete/)
- [PC-Welt: Kleinanzeigen shipping and payment](https://www.pcwelt.de/article/1189429/ebay-kleinanzeigen-einfuehrung-tipps-und-tricks.html)
- [Meilisearch vs Typesense](https://www.meilisearch.com/docs/resources/comparisons/typesense.md)
- [DSA article 19](https://www.springlex.eu/en/packages/dsa/dsa-regulation/article-19/) and [article 29](https://www.springlex.eu/en/packages/dsa/dsa-regulation/article-29/)

## Decisions made after the plan (October 2026)

These were decided in later discussion and override anything above that differs.

**Development and hosting**

- Develop and test everything locally first: Windows PC with WSL2 (Ubuntu 24.04) and Docker Desktop. The project lives inside the WSL file system (for example `~/projects/persian-classifieds`), not on the Windows C: drive.
- Local Docker stack mirrors production: PostgreSQL 17 + PostGIS, Valkey, Meilisearch, imgproxy, and Garage as a local S3-compatible stand-in for Hetzner Object Storage.
- Production: one Hetzner Cloud server (2 vCPU, 8 GB RAM, German location), created from Hetzner's **Coolify** app image (Ubuntu 24.04 with Docker and Coolify preinstalled). Coolify deploys automatically from GitHub on every push, runs the services, handles HTTPS, secrets and scheduled backups.
- Hetzner firewall: ports 22, 80, 443 open; Coolify's dashboard port 8000 only from the developer's IP until the dashboard has its own HTTPS domain.
- Cloudflare in front of the domain, SSL mode "Full (strict)".
- Rent the server early, around week 3–4 (when posting and search work), as a staging site, so server-only problems appear well before launch.

**Moving from local to server must need only configuration changes**

- All settings come from `.env`; commit `.env.example`, never `.env`.
- File storage only through the S3 API. The database stores file keys (e.g. `listings/ab12/1.jpg`), never full URLs.
- Categories, category attributes and cities are seed files in Git. Production starts with an empty database built by migrations plus seeds; local test data is never copied.
- SMS codes are printed to the terminal in development; Stripe runs in test mode with the Stripe CLI forwarding webhooks.

**Storage and backups**

- Hetzner Object Storage from day one in production: costs about €6.49/month including 1 TB storage and 1 TB egress. One bucket for images, one for database backups.
- Backups never only on the same server. Nightly PostgreSQL backups to Object Storage, plus Hetzner server backups; test a restore monthly.

**Memory budget on the 8 GB server (approximate)**

| Service | Limit |
| --- | --- |
| PostgreSQL + PostGIS | 2 GB |
| Meilisearch | 1.5 GB |
| Next.js app | 1 GB |
| Worker | 512 MB |
| Coolify | 1 GB |
| Valkey | 256 MB |
| imgproxy | 512 MB |
| System reserve | ~1 GB |

When traffic grows, the database moves to its own server first.

**Timeline**

- The 10–12 weeks above assumes part-time work alongside client projects. Full-time: working prototype in about 1 week, usable test version in 3–4 weeks, public launch in 6–8 weeks.

**Working with Claude Code**

- One feature per session; start fresh sessions often. Project rules live in `CLAUDE.md`, progress in `docs/progress.md`, so each new session can continue.
- Approve the database design before any feature code.
- Commit after every working step; never put secrets in Git or prompts.

**Brand (not decided yet)**

- Leading candidate: Hamsayeh (همسایه, "neighbour"); alternatives Dastbedast, Kooche, Bazarche, Tablo.
- Avoid names close to Divar, Sheypoor or Kleinanzeigen, and avoid "Iran" or political or religious words.
- Check domain availability, EUIPO/DPMA trademarks and Instagram/Telegram handles before deciding. Choose the brand before creating storage buckets (bucket names can't be changed).
