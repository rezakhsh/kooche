# Wave 2 build plan: many countries, and the admin tools first

Oct 28, 2026 · for the owner's approval · no app code changed for it yet · branch `wave0` (`/root/classifieds-wave0`)

Sources: `docs/roadmap.md` (wave 2), the launch plan page `docs/design-options/launch-plan.html` (version 6, wave 2, 10–14 days), `docs/design-options.md` (rounds 6, 9, 11, 12 and the owner's decisions), the mockups in `docs/design-options/mockups/final/`, the owner's requests of Oct 28 (admin tools now, a test account per country, the founders rules, wave 2 before the Berlin launch), and a read of today's code.

## In short

The owner decided on Oct 28 to finish wave 2 on staging first and then launch Berlin with everything. Part 1 is the admin tools the owner asked for; the rest makes the site ready for the next countries (Austria and the Netherlands are planned for Yalda, Dec 21).

| # | Part | Days (estimate) | Mockups (`final/`) |
| --- | --- | --- | --- |
| 1 | Admin: see the site as others (test accounts, view as a country, sign in as a user), founders rules | 3–3.5 | `admin-viewas`, `viewas-banner` |
| 2 | Country modes, admin «کشورها و شهرها», emergency pause per category × country or city | 2.5–3 | `admin-countries`, `admin-cities` |
| 3 | Everyone posts in an open country; small cities show the whole country; city launch | 2–2.5 | `city-chooser`, `city-waitlist` |
| 4 | Private or business: the choice, three service groups, limits, review queue, verification levels | 3–3.5 | `private-vs-business` |
| 5 | Posting across borders (phone zone vs the listing's country) | 1.5 | `post-crossborder`, `listing-crossborder` |
| 6 | Online layer (online services, online events, remote jobs in every open country) | 1–1.5 | — |
| 7 | Money and time: Pro and bumps in $, £ and other currencies; weekly digest in each country's time | 1.5 | `us-starter` (prices) |
| 8 | A new country's first pages: starter page, «به‌زودی» countries with «خبرم کن», date announced | 2 | `us-starter`, `countries`, `home-waitlist`, `waitlist-announced` |
| 9 | Telegram channel posting (n8n) and the waitlist reward | 1–1.5 | — |
| 10 | Phone-size check of every new page (light and dark), tests, docs | 1.5 | — |
| | **Total** | **19–22.5** | |

The launch plan said 10–14 days. It grew with the admin tools and test accounts (the owner moved them into wave 2's first part), the founders rules, and round 11's "everyone posts from a country's start date" (part 3, dropped on Oct 29: round 12 wins). Turkey stays wave 3; the Iran mode is not part of this wave.

**Build order:** the parts in the table's order. Each part: tests, commit, Docker cleanup (`/usr/local/bin/peydoo-docker-cleanup`, owner, Oct 28), push to `main` (staging deploy), then a short list for the owner of what to look at on staging. Production gets nothing until the owner asks (`peydoo-promote`; wave 0, wave 1, the street map and wave 2 together).

## 1. Admin: see the site as others, and the founders rules (3–3.5 days)

Mockup `admin-viewas` («دیدن سایت از نگاه دیگران»), with three tools from safest to strongest, and `viewas-banner`.

- **«جزئیات کامل» on a user's page:** fixed and deployed on Oct 28 (the link pointed to the same page).
- **Test accounts, one per country** (37 seeded countries plus Iran):
  - `germany@peydoo.com`, `austria@peydoo.com`, `us@peydoo.com`, `uk@peydoo.com`, … `iran@peydoo.com` (the country's web address; `us` and `uk` short, as the owner wrote).
  - Each has a verified phone number of its own country (a number from the range kept for tests and films where the country has one), so it posts like a person there. Marked «آزمایشی» (`users.is_test`, one migration).
  - Their listings, events and businesses are seen only by staff. They are never counted in city goals, statistics, search, the sitemap or digests, and get no emails, Telegram notices or SMS.
  - **Staging:** sign in with the email and the fixed code `123456` (our codes have 6 digits). The code comes from a setting (`TEST_ACCOUNT_CODE`), which the app refuses to start with on a production address, like the Turnstile test key today (`src/lib/env.ts`).
  - **Production:** the same accounts, but no fixed code (a known code on the live site is a back door). The owner opens them from admin with «ورود به‌جای این حساب» (below), protected by the two-step code.
- **View as a country:** pick a country in admin; the site shows as for a visitor from there (no account): first page, waitlists, prices, what may be posted. A staff banner on every page says so, with «پایان». Only for staff.
- **Sign in as a user:**
  - Only the owner (admin role), with a fresh two-step code and a written reason.
  - Read-only by default: every change (posting, chat, payments, settings) is refused while the banner shows. «اجازهٔ تغییر» needs its own reason.
  - Ends after 30 minutes or with «پایان»; the owner's own session comes back.
  - Every start, end and change goes to the audit log. The user is not notified for read-only looks; a change made for them is (our rule: staff changes to an account are always told to its owner).
  - Never into another staff account.
  - The privacy policy (German and Persian) says staff may look at an account to help or to check a report, and that it is logged.
- **Founders rules (بنیان‌گذار):**
  - The business owner's verified phone number must be from the business's country (`phone_verifications.number_country` = `organizations.country_code`).
  - One founding place per person, across all businesses they own.
  - Checked when admin offers the place (with the reason shown when refused) and again when the owner starts the free months.

## 2. Country modes and the admin countries page (2.5–3 days)

Mockups `admin-countries` and `admin-cities` (the cities page exists since wave 1).

- **A country's mode** instead of on/off (`countries.mode`, migration; `is_active` follows from it): hidden (UAE), waitlist (anyone can join a city's list, nobody posts), pre-start (businesses and organisers prepare drafts for a fixed date), guide (Turkey now: guide pages only), open.
- **Admin «کشورها و شهرها»:** every country with its mode, its cities' waitlists and business counts, and «باز کردن کشور» that really opens a closed country (today it only opens cities of an already open country). Changes go to the audit log and purge Cloudflare's cache.
- **Emergency pause per category × country or city:** for example rooms in Hamburg off for a week after a scam wave. Publishing refuses with a clear line; browse shows what is already live. In admin, on the country's page.

## 3. Everyone posts in an open country: dropped (owner, Oct 29, 2026)

Planned from round 11 by mistake: round 12 (Oct 26) is newer and is the owner's launch strategy. Asked on Oct 29, the owner chose round 12: only the Berlin area takes listings at launch; Hamburg, Cologne–Bonn, Frankfurt and Düsseldorf open when they reach their number of verified businesses; events and business pages work everywhere in an open country. This is what wave 0 built (`src/modules/launch/cities.ts`) and what the mockups `city-chooser` and `city-waitlist` show, so part 3 needs no code.

## 4. Private or business (3–3.5 days)

Round 11 decisions; mockup `private-vs-business`.

- **The choice:** an account says person or business; each listing has a tick «آگهی کسب‌وکار».
- **Services in three groups:** licensed (tax, legal, immigration, health, estate agents, sworn translators, driving schools, finance): business only, with a licence check; business by default, with 2 active / 4 new a month for private people; open to everyone (tutoring, babysitting, household help, pet sitting, help with moving).
- **Limits per category for private people** (today only services and job offers have them, `src/modules/organizations/limits.ts`).
- **«احتمالاً کسب‌وکار» queue:** accounts that look commercial (many similar listings, business words, a company name) get 14 days to switch, then the limits apply. In admin, one item at a time like the review queue.
- **Moving listings to a business:** a person who opens a business can move their own listings to it.
- **Verification levels:** 0 self-declared; 1 «تأییدشده» (a document plus a free register check: VIES for EU VAT numbers automatically, links to the national registers for the rest); 2 adds sanctions checks for risky categories. Documents deleted 7 days after the decision.

## 5. Posting across borders (1.5 days)

Mockups `post-crossborder`, `listing-crossborder`; round 6 proposal, **approved by the owner on Oct 29, 2026** (the zone rule below).

- Zones: Europe (EU, EEA, Switzerland, UK), North America, Australia, Turkey.
- Same zone (a German number in Austria): everything; the listing shows «شمارهٔ آلمان», and the rental safety note starts with it.
- Another zone (a Turkish number in Germany): wanted posts, events, verified businesses and online services; renting out, selling and job offers only after verifying a number from the zone.
- First week: one listing outside the number's country; cross-zone posts go to the new-listings review.

**Built Oct 29, 2026** (docs/setup.md, "Posting across borders"). Online services are a service or lesson with «امکان انجام آنلاین» or held online, until part 6 adds «آنلاین»; the first week doesn't count events; the pill is on private listings only.

## 6. Online layer (1–1.5 days)

- Online services, online events and remote jobs are shown in every open country (today online events show only within their own country; businesses have a badge only).
- A listing in these categories can say «آنلاین»; it then appears in each open country's «آنلاین» section and search.

## 7. Money and time (1.5 days)

- Listing prices are already in the country's currency. Pro, Pro Plus, bumps and founding Pro get Stripe prices in USD, GBP, CAD, AUD, CHF and the Nordic currencies (today Stripe prices are EUR only, `seed/products.ts`). Outside the EU, Pro is sold to businesses only at first (round 6).
- The weekly events digest goes out Monday 8:00 in each country's own time (today Berlin time for all).

## 8. A new country's first pages (2 days)

- **Starter first page** for a country in its first weeks (mockup `us-starter`): events, verified businesses, jobs and online services first, prices in its currency, venue time zones.
- **Country chooser «به‌زودی»** with «خبرم کن» per country (moved here from wave 1 part 2), and the first visit from a closed country (`home-waitlist`).
- **Date announced** (`waitlist-announced`): the timeline, pioneers' opening-day drafts in review, the remaining goals.

## 9. Telegram channel and the waitlist reward (1–1.5 days)

- The weekly digest and new verified businesses are posted to the country's Telegram channel by n8n (the queue is written today, nothing posts it).
- The waitlist reward (free bumps for early sign-ups who post) promised on the waitlist pages, granted when the city launches.

## 10. Final check (1.5 days)

Every new page at phone size and on a computer, light and dark; tests for every permission (test accounts, sign in as, view as, founders, modes, pauses, cross-border, private limits); `docs/setup.md`, `docs/schema.md`, `docs/progress.md`.

## Decisions for the owner

1. **Test accounts:** fixed code `123456` on staging only (codes have 6 digits), none on production, where admin «ورود به‌جای این حساب» opens them. Email names as above. Recommended.
2. **Country modes and the city rule:** decided Oct 29, 2026: round 12 wins (Berlin first, each other city at its business goal); round 11's "everyone posts from a country's start date" is not built. Part 3 dropped.
3. **Posting across borders (part 5):** decided Oct 29, 2026: the zone rule, as written in part 5.
4. **Free listings for a business:** decided Oct 29, 2026: keep 3 without Pro for every business, verified or not; Pro stays the way to more. Round 11's "5 once verified" is not built.
5. **Launch:** wave 2 complete on staging, then Berlin launches with everything (the owner's choice on Oct 28).
