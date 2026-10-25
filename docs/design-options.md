# Design options

Oct 24–25, 2026 · research only, no app changes. The owner chose direction B «صیقل‌خورده» (today's look); round 2 made it easier to use, round 3 added events, Pro and business, the multi-country first page, footer and legal, Gregorian dates and dark mode. Round 4 answered questions on events, cookies, the waitlist, founding Pro, countries and Iran; round 5 revised the country order, Austria, Turkey, the UAE and Iran; round 6 puts every country live within a year in tiered modes; the final plan (round 7) supersedes them where they differ, round 8 changes phone verification, Iran, the legal minimum and moderation, round 9 drops SMS, explains the waitlist, adds private vs business rules, brings Turkey forward and re-rates Stripe, round 10 proposes a partly active Iran without events in Iran, and round 11 (top) lets everyone post from a country's start (the gate becomes the city launch) and records the Telegram login test. Waiting for the owner's decisions, then a build plan for approval.

**Page with mockups and staging screenshots:** https://claude.ai/artifact/HqNDhAzv3SHSbbVCDmsQkQ (private until the owner shares it). The final proposal is on top; round 1 (three directions) is folded below it. The Oct 17 brand plan (https://claude.ai/artifact/TgjPF24NJujB7bQAYnz3AK) could not be opened from this session's account ("not found"); its decisions were taken from `docs/setup.md`, "Brand and design".

## Round 11 (Oct 25, 2026): nobody waits for a city, Telegram login tested, private vs business made simple

**Plan page version 5 (Persian).** Research: `research/round11-business-verify.md`. The test script is `research/telegram-login-test/server.mjs`.

- **City rule changed (the owner's point: a seller won't wait for a city to open):**
  - From a country's start date everyone can post everything: items, rooms, cars, services, jobs, events.
  - While a city is small, its page also shows the whole country ("3 in Toronto, 40 across Canada"), with city and distance filters.
  - **The city gate no longer opens posting.** It sets the city's "launch" (جشن شهر): its own default page, local promotion, the pioneer badge for everyone active before the launch, and founding Pro places.
  - The gate counts **live** listings, not drafts. Drafts remain only for the known pre-start weeks before a country's fixed date.
  - Rooms and cars from new accounts keep the night hold, and the category × city pause stays as an emergency switch.
  - This replaces round 6/7 "Open per city" as a permission. It is simpler to build.
- **Telegram OIDC login tested on 25 Oct 2026, and it works:**
  - **Setup:** the staging bot was switched to OpenID Connect in BotFather. BotFather refuses `localhost` and `http`, so the redirect was the 404 path `https://staging.peydoo.com/tg-oidc-test` and the owner pasted the URL back.
  - **What came back:** scope `openid phone` returned `phone_number` (digits, no "+") with `phone_number_verified: true`. The RS256 id_token checked out against the JWKS, and the nonce matched.
  - **Also returned unasked:** `name`, `given_name`, `family_name`, `picture` and `preferred_username` (discard them).
  - **Code lifetime:** codes expire within a couple of minutes (one `invalid_grant` after a slow paste).
  - **Consent screen:** it says the site wants your number. The owner worries people refuse. Put one sentence before it ("once, against scams, never shown").
  - **Recommendation:** OIDC becomes the main Telegram path (it can also be the sign-in), with the bot `request_contact` as a fallback. The same +98 / +888 / allowlist refusal applies to both.
  - **Cleanup:** the test server and the credentials file were deleted. The owner should remove the test redirect and regenerate the staging client secret, which was pasted in chat.
- **Private vs business, simpler:**
  - **How it works:** the seller chooses and ticks a box; private accounts have small limits; suspicious accounts go to a queue.
  - **Services in three groups:**
    - licensed, business only with a licence check: tax, legal, immigration, health, estate agents, sworn translators, driving schools, finance;
    - business by default, with 2 active / 4 new a month for private people;
    - open to everyone: tutoring, babysitting, household help, pet sitting, a hand with moving.
  - **What a business page offers:** directory and SEO page, social and messenger buttons, a menu or price list, opening hours, events and jobs, an Impressum block, 5 free listings once verified, reviews and statistics.
  - **Kleinanzeigen:** its sign-up text calls service offers commercial, but about 159k private service ads are live. Since 1 Sep 2026 businesses get 1 free service ad a month; PRO costs from €39 net (research 9's €15 was wrong). willhaben requires business for all services. Marktplaats keeps tutoring and babysitting free.
- **Business verification by country:**
  - **Free official sources:** ABN Lookup (AU), Companies House + HMRC VAT (UK), VIES (EU), recherche-entreprises (FR), KVK search (NL), GISA (AT), Skatteverket (SE), Handelsregister (DE, manual), GST/HST registry (CA), state registers (US), TTSG (TR).
  - **Levels:** 0 is self-declared; 1 is «تأییدشده» (a document plus a register check, 2–10 minutes); 2 adds sanctions checks for Turkey and risky categories (15–20 minutes).
  - Paid KYB services aren't worth it at this size. Keep no ID copies, and delete uploaded documents 7 days after the decision.

## Round 10 (Oct 25, 2026): Iran partly active, and events in Iran

**Plan page version 4 (Persian), section "ایران".** Research: `research/round10-iran-partial.md`. The owner asked what can be switched on for Iran, and whether events in Iran are a good idea.

- **What changed since round 8:**
  - **War:** the US and Israel have been at war with Iran since 28 Feb 2026.
  - **US:** on 24 Aug 2026 OFAC stayed 560.544, 560.550 and 560.554, and GLs F and G (Federal Register 2026-17426, checked). 31 CFR 560.540 is unchanged since May 2024 (checked on Cornell LII). Its exclusion is web hosting for "commercial *entities* located in Iran"; round 8 said "endeavours".
  - **EU:** listed the IRGC as a terrorist organisation (Feb 2026).
  - **Iran:** a whitelist internet; more than 6,000 arrests; a "hostile" list of 44 outlets, 61 people and 310 pages (Jul 2026).
  - **Germany:** the Auswärtiges Amt asks Germans to leave Iran.
- **Events in Iran: no, in any form** (Iranian organisers or diaspora organisers, free or ticketed).
  - **US providers:** the benefit is received in Iran, which is outside 560.540.
  - **Stripe:** bars services "originating from" Iran, directly or indirectly.
  - **Iranian law:** events need an Ershad permit, and companies may not advertise on foreign platforms.
  - **Safety:** event pages identify organisers and venues, and an Iran section raises the risk of the hostile list.
  - **Practical:** Evand, Tiwall and others already serve this. No demand evidence was found.
  - **Instead:** free online events run from abroad.
- **Ranked options:**
  - **Yes, now:**
    - Peydoo-written guides («کارهای ایران از خارج», newcomer city guides);
    - a "relocation / visa sponsorship" job filter.
  - **Later, after the lawyer:**
    - wanted posts by people about to emigrate (one each, pre-moderated, verified viewers only, 30 days, payment block);
    - a «از ایران هم رایگان قابل شرکت» badge on free online events from abroad;
    - email alerts for the destination city.
  - **No:**
    - a Nowruz visit guide (only a safety box);
    - remote work done from Iran;
    - free listings inside Iran;
    - teachers or freelancers in Iran selling to the diaspora.
- **Proposed mode:** an admin switch `iran_mode = read_only | message_only | partial`.
  - **Principles:** nothing located in Iran, nothing sold from Iran, no money, everything points abroad.
  - **New content rule for everyone:** no events in Iran, no services carried out inside Iran, no jobs aimed at people in Iran.
  - **Kill switch:** step the mode down if 560.540 changes, if Peydoo is listed as hostile, if Stripe or Cloudflare ask, or if scam reports rise.
  - **Lawyer:** nine new questions are in the research.

## Round 9 (Oct 25, 2026): no SMS, Telegram bots, the waitlist explained, private vs business, Turkey earlier, Stripe

**Plan page version 3 (Persian):** https://claude.ai/artifact/1ZzHVpR7EvAdsPudG6Qbaw (copy: `docs/design-options/launch-plan.html`). Research: `research/round9-whatsapp-nosms.md`, `research/round9-business-stripe.md`, `research/round9-turkey.md`. Round 9 changes round 8 only where stated here.

The owner asked:
- to avoid SMS, with users sending a code to us on WhatsApp;
- whether Telegram's limits apply per bot or per account;
- for a simpler explanation of the waitlist, the pre-start and city openings, and what happens when a city misses;
- how to tell private from business listings;
- how sanctions checks work when people can lie;
- for private listings in Turkey, Turkey earlier, and cheaper checks;
- whether Stripe is really a problem for Iranians who live abroad.

- **Phone verification without SMS:**
  - **WhatsApp:** the user sends us a one-time code. Meta doesn't charge for messages from users, and we don't reply. With no payment method on the Meta account, paid messages are never sent, so the cost stays at €0. The only cost is a dedicated number (€0–10 a month).
  - **Usernames (2026):** if the number is hidden, we answer with `request_contact_info`, which is inside the 1,000 free messages a month.
  - **Phishing:** codes expire in 10 minutes, are single-use and tied to the session, and the prefilled text is explicit.
  - **Order:** Telegram (with the +98/+888 refusal), then WhatsApp, then a limited email-only account. SMS is built but off.
  - **SMS trigger:** over 4 weeks, at least 5% of people starting verification (or more than 50 a month) fail every messenger, or one country reaches 10% (switch on for that country only), or more than 5 complaints a week. Log the reason for every refusal per country from day one.
  - **New:** Telegram's official OIDC login has a `phone` scope; worth a prototype.
- **WhatsApp and Iran:**
  - No Meta rule bans a business outside Iran from receiving +98 messages, and no ban case was found. Twilio says +98 numbers can't message business numbers at all.
  - The documented trigger is running the business account from Iran or through an Iranian VPN.
  - Rules for us: a dedicated verification-only number; never send to +98; the account managed only from outside Iran; Meta's `account_update` alerts on. Risk: low, or low to medium for some restriction within a year.
- **Telegram:**
  - Limits are per bot (Bot Developer Terms §6.2.5). An account can own 20 bots, or 40 with Premium.
  - Separate staging and production bots are right. Using several bots to evade limits is forbidden (§5.2(f)) and doesn't work anyway, because a bot can only message users who started it.
  - Bots belong in a dedicated owner account with 2FA.
- **The waitlist, explained (plan page "باز شدن کشورها، به زبان ساده"):**
  - **Four stages:** waitlist, pre-start (businesses and organisers only, 4–6 weeks before), Starter, then Open per city.
  - **Why people sign up:** a concrete reward (prepared listings, 48 h early), status (the pioneer badge), the goal-gradient progress bar, control through invites, social proof, scarcity of founding places, and effort already invested.
  - **When a city misses:** nothing closes. There is no date before 75%; a date moves once, by up to 4 weeks.
  - **New proposal:** after 6 months below 50%, merge the city with neighbours into a region.
- **Private vs business:**
  - **Labels:** a private or business declaration on every listing (one logged checkbox), a seller label and a search filter.
  - **Free private limits, counted as new per rolling 30 days, not only active:** goods 30 active / 40 new; cars 2 per 12 months; rooms 2; services 2 active / 4 new.
  - **Detection:** a "probably a business" queue (rules plus one LLM field), about 3–10 cases a week.
  - **Steps:** a nudge, then the owner asks with 14 days to answer, then a restriction in those categories. Only the owner bans, and never for volume alone (*Kamenova*).
  - **Build items:** a "move to business" button, and a free basic business profile as the easy route.
  - **Law:** a trader posing as private breaks UWG Anhang Nr. 22. The platform shows the seller's declaration and doesn't have to verify it. DSA Art. 30–32 don't apply to Peydoo (micro, Art. 29).
- **Turkey:**
  - **The war effect is companies, not residents:**
    - new companies with an Iranian partner: 431 in Jan–Sep 2026 against 184, 74% in Istanbul;
    - residence permits steady at 74,537 (Oct 2026);
    - visitors: 3.05M in 2025.
  - **Housing (rooms included) and cars are never possible** on Peydoo: EİDS e-Devlet verification is required, only owners may post, and there is no route for a foreign platform.
  - **Safe private categories** (items, giveaways, lost and found, wanted, community events, pet adoption) are allowed from May 2027, with +90 numbers verified through WhatsApp.
  - **Phased plan:**
    - January: KVKK representative and VERBIS, before the first Turkish account (this changes round 8's "before the first payment");
    - 1 Feb 2027: Istanbul businesses;
    - 1 Mar: Nowruz events;
    - May: private listings;
    - Sep: jobs and services.
  - **Sanctions:** no guarantee is possible or required. EU 267/2012 Art. 42 gives "did not know and had no reasonable cause to suspect". The written process:
    - partners from the TTSG trade-registry gazette, free barcode checks;
    - every partner and manager screened against all four lists, with Persian and Turkish spellings and the 50% rule;
    - payment only from the company account;
    - a signed declaration and forbidden sectors;
    - an A.Ş. only by video;
    - records kept 5 years.
  - **Cheaper checks:** 15–20 minutes and €10–14 per Ltd company.
  - **Prices:** verification €49 (or €29 for an Ltd) now includes a free profile, 2 featured events and the Nowruz and Yalda guides. Private users pay nothing. Turkey costs about €3–4.5k in year 1 and breaks even in year 1 in the mid case.
- **Stripe:**
  - The "citizen of Iran" wording is real (22 Sep 2026), but the law tests residence, and Stripe has no customer nationality data. No case was found.
  - **Re-rated medium-low.** The real triggers are Iran content, Iranian-origin goods, Turkish sole traders with Iranian citizenship, and possibly the account holder's own ID.
  - **To do:** never ask nationality; Radar rules (IR IP, card, billing address); Mollie and bank invoices before May 2027; the written question is no longer urgent.
- **Build:** 48–65 days. The waves are renumbered:
  - 3 is Turkey businesses, by January;
  - 4 is safety at scale, including Iran accounts;
  - 5 is Turkey private listings.
- **Costs:** about €10–16k one-time and about €60–180 a month.
- The plan page ends with 13 decisions.

## Round 8 (Oct 25, 2026): phone verification costs, Telegram limits, Iran messaging, soft legal, solo moderation

**Plan page, now in Persian (version 2):** https://claude.ai/artifact/1ZzHVpR7EvAdsPudG6Qbaw (copy: `docs/design-options/launch-plan.html`). Research: `research/round8-phone.md`, `research/round8-soft-legal.md`, `research/round8-iran-messaging.md`. Round 8 changes round 7 only where stated here. The calendar, gates, resilience rules and Turkey prices stay.

The owner said the plan is good and asked about:
- SMS costs, cheaper options and WhatsApp;
- the Telegram bot's limits;
- letting people in Iran sign up with email and send messages;
- a softer legal approach, "soft but inside a safe zone";
- no Minijob or contractors: the owner moderates alone.

The owner asked for the final plan in Persian.

- **Phone verification ladder** (cheapest first):
  1. Telegram bot (free). It needs the +98 / +888 / allowlist refusal.
  2. WhatsApp started by the user: a wa.me link with a token. Incoming messages are free; replies are free up to 1,000 a month. When a username hides the number, we ask for it with `REQUEST_CONTACT_INFO` and accept only `origin: contact_request`.
  3. SMS: GatewayAPI in Europe (DE €0.072, UK €0.038, most others about €0.04). For +1 numbers, a verification API (Prelude about €0.036, Twilio Verify about $0.058) instead of 10DLC registration. Turkey stays closed for SMS.
  4. Optional: Telegram Gateway ($0.01) or WhatsApp codes sent by us (US/CA $0.0034, TR $0.0009).

  seven.io (flat €0.075) is dropped. Estimated monthly cost at 1k / 5k / 20k verifications: about €9 / €44 / €175, against €94 / €469 / €1,875 all by SMS through seven.io.
- **Code finding:** the bot path (`telegramNumberToE164()` in `src/modules/users/phone-number.ts`) accepts any number, including +98 and +888. Only SMS refuses Iran. The fix is a wave 0 item.
- **Telegram limits:** about 1 message a second per chat, 20 a minute per group and about 30 a second overall; 429 comes with `retry_after`. Paid broadcast needs 100k Stars and 100k monthly users, so it is out of reach. Verification is fine: about 500 a minute. The digest needs a queue at 25 a second or less: about 7 minutes for 10k people.
- **Iran:** read-only for listings, plus an email account that can only message (`iran_message_only`). Grounds: EU law doesn't restrict messaging, and US 31 CFR 560.540 names chat and email (for AWS and Cloudflare). The rules:
  - **Who gets one:** self-declaration, prompted by an IR IP or the Tehran time zone.
  - **Shown to others:** the label «از ایران», and a setting to refuse messages from Iran accounts.
  - **What they can do:** message only, not in goods categories. No posting, payment or phone reveal.
  - **Limits:** 3 new chats a day in the first week, then 10 (30 a week); 2 messages before the other side replies; 60 a day; auto-pause after 2 reports or 3 blocks.
  - **The key rule:** cards, IBANs, payment requests and links are blocked both ways in Iran chats.
  - **Data:** chat contents deleted 90 days after the last message; no real name; notifications without message text; the full IP kept 7 days.
  - **.ir email:** still refused, now for the user's safety.
  - **Travel:** verified users visiting Iran become message-only.
  - **Timing:** built in wave 3 after the sanctions lawyer confirms. The Persian copy and the lawyer questions are in the research.
- **Soft legal:**
  - **EU:** micro enterprises are exempt from most of the DSA (Art. 15, 20–32). The German establishment covers Austria, the Netherlands and Sweden. Italy and France need nothing if paid offers go to businesses only.
  - **UK:** self-written risk and children's access assessments, plus the UK GDPR representative.
  - **US:** DMCA agent ($6) and paragraphs in the terms.
  - **Canada:** paragraphs, and no Quebec.
  - **Australia:** eSafety notices within 24 h and a self-assessment.
  - **Turkey:** VERBIS and a representative before the first Turkish payment, and "hide in Turkey" for 4-hour orders.
  - **New duty:** the withdrawal button (§ 356a BGB, since 19 Jun 2026) if anything is sold to consumers.
  - **Cost:** legal one-time spending falls from about €6–14k to about €1.5–4k, plus the sanctions lawyer.
  - The red lines stay (sanctions, official orders, Impressum, GDPR basics, scams held before publishing).
- **Solo moderation:**
  - **Screening:** rules first, then OpenAI moderation, then an LLM scam check (about $3–4 a month).
  - **Trust tiers:** high-risk posts are held for the owner.
  - **Night mode** and **four sweeps** (07:30, 13:00, 18:00, 23:00 Berlin): the longest wait is about 8.5 h.
  - **Reports:** a listing is auto-hidden after 3 reports.
  - **Emergencies:** a P0 alert, and safe mode while the owner is away.
  - **AI may hold or hide.** Only the owner bans.
  - **Owner's time:** about 4–6 h a week at 50 listings a day, 11–16 h at 200.
  - **When to get help:** moderation over 15 h a week for 4 weeks. This replaces "moderator hours covered" in the capacity check.
- **Build:** 46–62 days. The new parts:
  - **Wave 0:** the bot refusal and SMS through GatewayAPI.
  - **Wave 2:** WhatsApp, a verification API for +1 numbers, and the digest queue.
  - **Wave 3:** the moderation setup and Iran accounts.
- **Costs:** about €8–14k one-time and about €50–500 a month by month 12. Round 7 estimated €12–25k and €1.8–4.3k a month, mostly moderators.

The plan page ends with 12 decisions for the owner.

## Final plan (round 7, Oct 25, 2026): supersedes earlier rounds where they differ

**Plan page:** https://claude.ai/artifact/1ZzHVpR7EvAdsPudG6Qbaw (a copy is in `docs/design-options/launch-plan.html`). Research: `research/round7-fast-resilient.md`, `research/round7-turkey-money.md`; the independent review of rounds 1–6: `research/round7-review.md`.

The owner approved the one-year plan, asked to hurry Canada, Australia and the US (copycats), wanted no single point where every country fails, wanted Turkey to make money, decided to close Austria for now and follow the gate plan, and asked for a review of everything said so far.

- **Calendar:**
  - Berlin Open (go-live date still the owner's, before Yalda).
  - Yalda: online layer everywhere, Austria and Netherlands Starter, pre-Starter in CA, US and AU (waitlists, business and organiser sign-ups, Nowruz event drafts).
  - Starter: Canada 12 Jan, Australia 19 Jan, US 2 Feb, UK Feb, Italy and Sweden Apr, Paris May.
  - Open cities only at their gates: targets Vienna Mar, Hamburg Apr, Toronto May, LA Jun (cars Sep), Sydney Jul, Melbourne, Vancouver, Randstad, Milan and London rooms Aug, Cologne Jun, Frankfurt and Munich Sep.
  - Fallbacks: Toronto Aug, LA Sep, Sydney Feb 2028.
  - Turkey: guide; a Nowruz events page; Istanbul paid B2B in June after four preconditions.
  - UAE: hidden, review Oct 2027. Iran: read-only.
- **Resilience (replaces the Berlin brake):**
  - Each country has its own health check; one that misses stays in a quiet Starter and is never closed.
  - A capacity check pauses only new openings: review under 12 h in every region for 4 weeks, moderator hours covered, server under 70% at peak, a restore drill within 90 days, and the owner's weekly cap.
  - Fallbacks: point-in-time recovery and a warm standby; Mollie and bank-transfer invoices next to Stripe; live SMS next to Telegram; a deputy; moderators (German Minijob, Toronto contractor from January, Vancouver when LA opens; none in LA because of AB5).
- **Gate:**
  - One table: big 1,000 / 30 / 150, medium 500 / 20 / 100, small 300 / 15 / 60 (people, businesses, prepared listings); founding places 50 / 30 / 20.
  - The date is announced at 75% with the capacity check green, 3–8 weeks ahead. Seven days before, all three must be at 85% or more, or the date moves once, by up to 4 weeks.
  - After opening, the strategy's health gate (≥100 live listings, ≥50% with a chat in 7 days, ≥30 weekly posters, 4 weeks) must hold before the same country's next city.
  - Pages only for planned countries plus one «کشور من» form. Unconfirmed sign-ups are deleted after 30 days; lists for countries with no plan after 12 months.
- **Copycats:**
  - Irania (app since Aug 2026, says 57 cities in 26 countries) and IraniLink (UK and Turkey); both figures are self-reported.
  - Claim now: EU trademark ≈€900 by 30 Nov, Madrid for US, CA, AU and UK ≈CHF 2,690, handles, domains; ≈€4.2–4.5k in total.
- **Turkey makes money:**
  - Prices: verification €49 a year, Pro Turkey €190 a year, featured event €9.99, Nowruz or Yalda sponsor €150–300; founding first 20 at €29 / €95.
  - Companies with VKN and MERSİS only; reverse-charge VAT; plan on 85% after the 15% withholding.
  - Free official sanctions lists with a daily local diff, plus a paid check at sign-up (≈€0.40), always before any money.
  - Year 1 Istanbul ≈€1.8–7.4k gross (estimate); break-even in year 2.
- **Stripe risk (high):** Stripe bars persons "located in, resident in, or a citizen of" Iran. Ask Stripe in writing before founding Pro turns paid (around May 2027), add Mollie, and have the lawyer check.
- **Build:** about 40–55 working days in five waves:
  0. before go-live: close Austria, founding Pro without automatic charge, live SMS and zones, Iran read-only;
  1. the redesign;
  2. many countries;
  3. safety at scale;
  4. paid Turkey.

  Recommendation: Berlin live with wave 0 and today's look in late Nov or early Dec, the redesign in parts before 12 Jan.
- **Costs (estimate):** ≈€12–25k one-time, ≈€1.8–4.3k a month by month 12.
- **Corrections from the review:** in the plan page's "Corrections" table. Fixed in this file: Vienna +29%, US visa dates, SMS countries, cross-border "today", and "normally €24" marked superseded. Fixed in mockups: weekday in `post3`, Iran wording, badge year, footer and chooser countries, US cities, the Turkey event, and the admin countries example.
- **CLAUDE.md conflicts to resolve on approval:** Gregorian dates (CLAUDE.md says Jalali), French texts for paid offers in France ("Persian only"), "for Iranians in Europe" (also the first page's «ساکن اروپا»).
- **Decided by the owner:** close Austria now and follow the gate plan; it is the first item of wave 0, built with the first approved build.
- **Open for the owner:**
  1. calendar and resilience rules;
  2. launch order;
  3. spending now;
  4. Turkey prices;
  5. the Stripe question;
  6. founding Pro after 6 months (ends unless yes, then €12 a month for a year);
  7. the cross-border rule and the Turkey events policy;
  8. one combined list for the lawyer and the tax advisor.

## Round 6 (Oct 25, 2026): the country gate, every country within a year, posting across borders

The owner asked how the country gate works and when a country is announced, whether every country has a waitlist, said events and businesses would suit Turkey and the UAE, said the US in year 3 is too late ("open all countries in one year"), and asked whether someone with a German number can post in Austria, or with a Turkish number in the EU. Research with sources: `docs/design-options/research/round6-expansion.md` and `round6-turkey-uae.md`. Not legal or tax advice.

**Two switches.** A *country* starts in Starter mode on a planned date (events, verified businesses, jobs and services; no gate). A *city's* gate opens the person-to-person categories (rooms and flats, items, cars).

**The city gate:**
- Three goals: confirmed people (double opt-in, counted once), verified businesses, and reviewed opening-day listings. Progress is the lowest of the three.
- Our conditions: listings reviewed within 12 hours in the city's own time zone for 4 weeks, and the country's legal checklist done.
- Stages:
  1. anyone can join, no number shown;
  2. 25%: the bars appear;
  3. 50%: email and Telegram, pioneers prepare listings, businesses invited to verify;
  4. 75%: the owner presses «اعلام تاریخ» in the admin; the date is 3–7 weeks later, on a cultural moment when one is near, and holds;
  5. the last 14 days: prepared listings reviewed, pioneers re-confirm 72 hours before;
  6. pioneers enter 48 hours early;
  7. opening day.
- Never a date below 75%. Under 50% for 6 months: tell the list honestly.
- Sizes: small 250–300 / 12–15 / 60 (Vienna 300 / 15 / 60), medium 500 / 20 / 100, big 1,000 / 30 / 150.
- Mockups: `final/waitlist-announced` (Vienna after the date) and `final/admin-countries` (modes, the three bars, «اعلام تاریخ», the Berlin brake, category switches per country).

**Waitlists:** every listed country has one automatically, and anyone from anywhere can join any city. Countries in the plan show goals; the rest just collect sign-ups by city (a demand signal). Exceptions: Iran (read-only) and the UAE (hidden).

**Every country within a year** (replaces round 5's order; departs from `docs/strategy.md` "deep, not wide": the UK, the US and Turkey move into year one, and the "next country" gate becomes a "next Open city" gate):
- Modes:
  - **online layer** everywhere from Yalda (online services, online events, remote jobs);
  - **Starter** per country;
  - **Open** per city at its gate;
  - **Guide** (Turkey now).
- Calendar:

| When | What |
| --- | --- |
| Nov 2026 | Berlin Open |
| Dec (Yalda) | Online layer everywhere; Austria and the Netherlands Starter; Turkey guide |
| Jan–Mar 2027 | Vienna Open (example: date 20 Mar, announced 28 Jan) |
| Feb | Hamburg Open; UK (London) and Canada (Toronto, Vancouver; not Quebec) Starter |
| Mar (Chaharshanbe Suri, Nowruz) | US (LA, Bay Area, DC, NY) and Australia (Sydney, Melbourne) Starter |
| Apr (Sizdah Bedar) | Italy and Sweden Starter |
| May | Paris Starter (French texts for paid offers first); Cologne–Bonn–Düsseldorf Open |
| Jun | Randstad and Toronto Open; Istanbul events and businesses if the lawyer agrees |
| Jul–Sep | Frankfurt, Munich Open; rooms in Milan and London; LA rentals and cars in September, only with a moderator in the Americas |
| Oct 2027 (Mehregan) | Review; Sydney, Stockholm, Paris Open in year 2 unless their gates are met sooner; UAE review |

- Preconditions:
  - Dec–Jan: availability switches (country × city × category), per-city waitlists with pre-listings, AI pre-screening.
  - Feb–Mar: UK Online Safety Act assessments and a UK GDPR representative; a WCAG 2.2 AA pass (US accessibility lawsuits, about 5,000 in 2025); a US DMCA agent; a tested restore.
  - Mar–Apr: a part-time Persian moderator in the Americas (5–10 h a week).
  - Later: volunteer city ambassadors; an Asia-Pacific moderator before Sydney opens.
- Outside the EU, Pro is sold to businesses only at first.
- Cost (estimate): €9–21k one-time and €1.8–4.3k a month by month 12.
- **Brake:** if Berlin misses its first gate by the end of February 2027, no new Starter countries after March and no Open cities outside Germany and Austria.
- **US:** Starter at Nowruz 2027 (≈750k Iranian Americans, 12,656 students, the best Pro market). Risks: accessibility suits, and US rules on Iranian-origin goods (a goods rule in the US terms, lawyer). Sober Nowruz copy (UCLA's 2026 festival was cancelled). Mockup `final/us-starter`.

**Turkey: events and verified businesses** (go, with conditions):
- Outside e-Devlet's EİDS, which covers property and car ads only.
- Free, with no payments. Chat only with businesses and organisers. Ticket links only to known ticket sites.
- Verification: vergi levhası, MERSİS and partners; sanctions screening of every business and partner (OpenSanctions API, about €0.10 a check).
- Forbidden: exchange and havaleh, trade or freight to Iran, oil, electronics and dual-use, gold, crypto, visa and residence fixers, university agents, recruitment and company formation. Estate agents and car dealers come later, case by case.
- Needs VERBIS and a Turkish representative, plus the lawyer.
- Proposal: no political or LGBTQ events on Turkey pages (safety), which is the owner's call.
- Timing: a Nowruz 2027 events page as a test, then Istanbul in June 2027. Mockup `final/turkey-starter`.
- Most Iranian-linked companies in Turkey (7,300–12,000) are traders, logistics firms and money changers. The consumer-facing part is a few hundred in Istanbul (estimate).

**UAE:** hidden. Since 18 Aug 2026 all trade and financial dealings with Iran are halted, Persian concerts are cancelled, a media licence is needed even for free advertising platforms, and there is a record of abductions. Review in Q4 2027; if ever, events only with DET permit numbers.

**Posting across borders.** Today any verified number can post in any open country (within the existing business-only rules for job offers and private service offers); the listing's country comes from the posting page and a postcode there; Telegram accepts any number, SMS the 36 seeded countries other than Turkey (+90 is refused; SMS is not live yet). Proposal: the listing's country is where the thing is, and the phone's zone decides what may be posted there. Zones: Europe (EU, EEA, CH, UK), North America, Australia, Turkey, UAE.
- Same zone (a German number in Austria): everything; the listing shows «شمارهٔ آلمان», and the rental safety note starts with it. Kleinanzeigen reportedly accepts any EU number ([PCWelt](https://www.pcwelt.de/?p=1198601), [Mimikama](https://www.mimikama.org/?p=246359)).
- Another zone (a Turkish number in Germany): wanted posts, events, verified businesses and online services; renting out, selling and job offers only after verifying a number from the zone. "Landlord abroad" is the classic deposit scam ([EVZ](https://www.evz.de/en/shopping-internet/internet-fraud/rental-fraud.html), [Stuttgart](https://www.studierendenwerk-stuttgart.de/fileadmin/Mediendatenbank_Studierendenwerk/02_Wohnen_WOW/026_PDF/2015_Stadt_Stgt_Flyer_Whgbetrug_ENG.pdf)).
- First week: one listing outside the number's country. Cross-zone posts go to the new-listings review. IP only a soft signal.
- Mockups: `final/post-crossborder` and `final/listing-crossborder`.

**Open for the owner:** the one-year plan and the brake; the cross-border rule; no political or LGBTQ events on Turkey pages; budget for a moderator in the Americas; and from round 5, closing Austria on staging, the €12 founding price, the lawyer and the tax advisor (now including the UK, the US and Turkey).

Artifact version 7.

## Round 5 (Oct 25, 2026): countries again, Austria, Turkey, Iran read-only, light or dark

The owner asked: which of light and dark is friendlier; France, Turkey ("find a solution") and the UAE; Germany first with Austria on a waitlist; pioneer rewards and how many listings open a country; Iran read-only with no sign-up and +98 blocked even with a VPN; telling businesses about free founding Pro on the site; the country order again. Full research with sources, in `docs/design-options/research/`: `round5-countries.md`, `round5-iran.md`, `round5-dark-waitlist-pro.md`. None of it is legal or tax advice.

**Light or dark:** light reads better for most people (Piepenbrock et al. 2013, 2014; the gap grows with smaller text); about 22% of Chrome traffic asks for dark; NN/g: offer dark, don't make it the default. So «خودکار» (follow the device, light if no setting) is the default; «حساب من» → «تنظیمات» → «ظاهر» and the footer offer automatic, light and dark. Dark: off-white on dark grey, body at least 16px regular, photos never dimmed. It ships with the redesign if every screen passes the contrast check, otherwise within 60 days. Mockup `final/appearance`.

**Country order** (replaces round 4's):

| When | Country (first city) | Notes |
| --- | --- | --- |
| Now | Germany (Berlin) | 256k born in Iran; 18,718 first permits to Iranians in 2025 |
| Months 2–4 | Austria (Vienna), waitlist on a short timer | Vienna 19,957 born in Iran (+29% since 2022; Austria +31%); almost no extra cost. Opens when Berlin passes its first city gate, or Vienna reaches 300 confirmed people, 15 verified businesses and 60 prepared listings. Austria is open on staging today (`seed/countries.ts`), so closing it is a build item |
| Months 6–9 | Netherlands (Amsterdam) | 48k born in Iran, 66k with Iranian background; 3,156 permits a year |
| Months 9–12 | Canada (Toronto) | ≈281k; Iranian permanent residents up about 32% in 2026 (one source) |
| Year 2 | Italy (Milan, Turin, Rome), then Sweden | Italy 30.5k (+53% since 2022, mostly students); Sweden 87k but arrivals halved, Blocket strong |
| Late year 2 | UK (London) | 7,400 asylum claims in 2025; VAT from the first £; Online Safety Act |
| Year 2–3 | France (Paris), waitlist first | 26k born in Iran (INSEE 2023), older; French terms and offers, consumer mediator, ranking text, VAT |
| Year 3 | US (LA), then Australia (Sydney) | US visas for Iranians suspended since 9 Jun 2025, tightened 1 Jan 2026; Australia suspended Iranians' visitor visas for 6 months from 26 Mar 2026 |
| Guide only | Turkey | No marketplace (below) |
| Closed | UAE | No waitlist; review in 2028 at the earliest |

EU VAT: the €10,000 limit for B2C sales to other EU countries is one shared allowance; above it OSS or the EU small-business scheme (§19a UStG). Pro to EU businesses is reverse charge. For the tax advisor before a second EU country sells Pro.

**Turkey:** 134k born in Iran (2025, falling), 31.5k students, many in transit. Blockers: since 2025 every rental, sale and car ad in Turkey must be verified through e-Devlet (EİDS), and only owners, relatives or licensed agents may post (fines from about TRY 100k); the main scams target exactly these needs (ikamet fixers, visa appointments, university places, smugglers); Turkish VAT from the first lira; a KVKK representative; frequent blocking. Solution: now an account-free Persian guide page (official links, named scams, online events and online services from the open countries) plus a waitlist with no date (mockup `final/turkey`); maybe in year 2 a pilot with only events and verified businesses through a vetted local partner; never P2P housing, cars, jobs or permit services there.

**UAE:** closed. In 2026 residence permits were cancelled and Iranian schools closed, entry restricted; one source reports all trade with Iran halted in August; VAT from the first dirham, a media licence, broker permits for property ads.

**Austria on the waitlist:** agreed, with the short timer above. Opening-day listings and the gate are shown in `final/home-waitlist` (now Austria).

**Pioneer rewards and the opening gate:**
- People: a dated «پیشگام وین، ۲۰۲۶» badge (never like «تأییدشده»), entry 48 hours before the public opening, up to 3 opening-day listings with 3 free bumps, 3 more bumps for 3 friends. No cash, no prize draws.
- Invitations only through a personal link the user shares; Peydoo never emails friends (BGH I ZR 208/12). Promotion terms on one page (§ 6 DDG).
- Businesses: founding Pro.
- Opening-day listings are drafts reviewed in the 14 days before opening, re-confirmed by their owner 72 hours before.
- Gate: all goals met and held for 7 days, then 14 days' notice; the date is announced at 75%; below 50% after 6 months, tell the list. Vienna 300 people / 15 businesses / 60 listings; Netherlands 500 / 20 / 100; Toronto 1,000 / 30 / 150 (proposals, not benchmarks), plus the strategy's next-country gates.
- Growing fast: Telegram partner channels, invite rewards, 5 businesses a week by hand, events as the weekly engine, Persian city and category pages. Moderation time is the brake.

**Founding Pro on the site:** in context first: the business panel as progress (`final/business-dashboard`), the Pro page, one quiet line on the first page («۳۱ جا مانده»), the waitlist, the footer, Telegram, a notice after the 2nd and 3rd listing, email only with a separate opt-in. The places-left count comes from the database, places and deadline are fixed in advance, no countdowns (UWG Annex No. 7). Wording: "Pro costs €24 a month", not "normally €24" (never sold at that price); free means no card and no automatic renewal. Proposal: afterwards €12 a month for a year, only with a yes.

**Iran: read-only, no sign-up, +98 refused** (owner's decision; replaces round 4's full block):
- Iranian IP (`CF-IPCountry = IR`): read-only site with one notice (`final/iran`); sign-in, phone verification, posting, chat, phone reveal, favorites, saved searches, waitlist, business invites and checkout off; `/report` open (DSA Art. 16). Logged-out pages are cached at the edge, so the notice must not leak to other visitors: take IR out of the cache rule or render it client-side. A free Cloudflare WAF rule blocks POST from IR except `/report` and the Sentry tunnel.
- Phone: +98 refused in the Telegram bot and SMS (`final/iran-phone`); only numbers from the seeded countries (37 seeded; SMS covers 36, Turkey excluded, and isn't live yet; this also refuses +888). Must ship together with a live SMS provider, because many diaspora users still have Telegram on a +98 number.
- At sign-in: browser time zone `Asia/Tehran`, `.ir` email addresses and Tor are refused. VPN checks (proxycheck.io or IPinfo) only combined with another Iran signal.
- Later: IR on 7 of 30 days → admin review; 21 of 30 days or a stated Iran residence → restriction decided by a person, with a DSA Art. 17 statement and appeal. A signed-in user seen in Iran gets a read-only "travelling" notice; listings stay up.
- Limits, stated honestly: a VPN plus a foreign number can't be stopped; an email account can still be made with a VPN but can't post or chat. Regulators expect the signals to be used across the account's life (OFAC: Kraken 2022, Poloniex 2023, Interactive Brokers 2025). No wording or support answer may mention VPNs (Exodus 2025).
- Safety applies to everyone, not just Iranian IPs: a "sensitive event" option (address, organiser and photos of people only for verified members), consent for faces, nicknames, photo metadata stripped, no tracking. Drop Iranian browser error events before Sentry.
- Eight questions for the sanctions lawyer: `round5-iran.md`, last section. The strategy's "geoblock Iran" line changes once the owner confirms.

**Open for the owner:** the country order; closing Austria on staging and opening its waitlist; the €12 founding price after the free period; booking the lawyer (cookies, Iran read-only, Turkey guide) and the tax advisor (EU VAT).

Artifact version 6.

## Round 4 (Oct 25, 2026): the owner's questions answered

**Decided by the owner:** waitlist count shown, founding Pro per city, event saves with reminders and organiser follows built with the redesign.

**Event filters:** yes. The one-tap chips and the 14-day strip stay. «فیلترها» opens a sheet with:
- where: only the city, up to 100 km, or all of the country (concerts draw people from other cities)
- days, type, price, language
- suits: family, 18+, step-free
- in person or online
- a count on the button

Mockup: `final/events-filters.html`.

**Cookie banner in Germany: not needed on current facts.** I measured staging logged out in headless Chromium:
- **Cookies:** only `country` and `view`, both 1 year, both the visitor's own choice.
- **Browser storage:** nothing in local storage, session storage or IndexedDB.
- **Outside hosts:** only `challenges.cloudflare.com` (Turnstile on login), which set no cookies.
- **Signed in:** adds the session and login-step cookies, and `pending_favorite` (30 min). All are strictly necessary (§ 25 (2) Nr. 2 TDDDG).

The privacy policy must list each of them. Anything added later (analytics, Meta pixel, YouTube embeds, Sentry Replay) needs a check first. Add this point to the lawyer's pre-launch review.

**Waitlist** (research: Nextdoor threshold, Groupon tipping point, goal-gradient studies, Robinhood and Monzo queues):
- people sign up when the count is honest and moving
- count only confirmed (double opt-in) sign-ups; BGH I ZR 164/09 requires stored proof of consent
- show the number from about 25% of the goal; before that, «از نخستین‌ها باشید»
- make the goal two-sided («۵۰۰ نفر و ۲۵ کسب‌وکار») so a city never opens empty
- reward invites with an earlier invitation, Telegram first
- ask one question: looking, selling privately, business
- a list goes cold after about 3 months, so open in waves, businesses 1–2 weeks first

Mockup updated: `final/home-waitlist.js`.

**Founding Pro:** a good idea with guardrails. Businesses are the hard side (Chen; Airbnb photography; Thumbtack; Etsy). Groupon is the warning: 27% of businesses lost money.
- Places: 50 in Berlin and Hamburg; 30 in Frankfurt, Munich and Cologne; 15–20 elsewhere.
- A sign-up deadline, then 6 months free counted from approval, so end dates are spread.
- Verified first: phone, registration or Impressum, a real address.
- At least 3 active listings within 30 days, or the place goes to the next business.
- The «بنیان‌گذار» badge forever, and a founding price afterwards.
- ~~Always worded "Pro, normally €24, free for founding businesses".~~ Superseded in round 5: "Pro costs €24 a month". No automatic charge without a yes; listings stay live after the free period.
- Measure: verified and active at day 30, leads per business, paid at month 6–7.

Mockup updated: `final/pro.js`.

**Next countries (research report, official census APIs where possible):**

| # | Country (first city) | Iranians | Why |
| --- | --- | --- | --- |
| 1 | Canada (Toronto, then Vancouver) | ≈281k by ethnic origin (2021); Toronto ≈89–125k | Newcomers about 10k/yr; @toronto_iranians has 14,760 members; thin Persian competition (Canadajoo); GST above C$30k; costs: −6 h, CASL |
| 2 | Netherlands (Amsterdam/Randstad) | ≈66k of Iranian origin, +26% since 2022 | 31% arrived within 5 years; housing crisis; same EU setup (DSA, GDPR, OSS, euro, iDEAL, CET) |
| 3 | Sweden (Stockholm, Gothenburg) | ≈87k born in Iran | Dense in Stockholm county (33k); same EU setup; but settled and older, and Blocket is strong |
| 4 | UK (north-west London), year 2 | ≈110k born in Iran; London 44k | Many newcomers (8k asylum claims in 2024); but VAT from the first £, Online Safety Act duties, and IraniLink as a competitor |
| 5 | US (Los Angeles) | ≈750k Iranian Americans; LA ≈230k | Largest and richest, but visas frozen since 2025, an older community, −9 h, more US sanctions exposure |
| 6 | Australia (Sydney) | ≈86k born in Iran | Growing; GST above A$75k; +9 h |

- **Avoid:** Turkey (no Stripe, transit population, sanctions-trade listings, site blocking under Law 5651), the UAE (VAT from the first dirham with a tax agent, no safe harbour, an airport ban on Iranians), Armenia and Georgia (small, no Stripe).
- **Already open:** Vienna (18.5k born in Iran) is a real fourth city.
- **Watch:** EU asylum data monthly, because the 2026 war can shift flows.
- **Changes to the strategy:** add the Netherlands and Sweden as low-cost EU additions; move the UK ahead of the US.

**Iran (research report):**
- The earlier warning was half right.
  - EU sanctions (reimposed 27–30 Sep 2025, Regs. 2025/1975, 1980, 1982) are by list and by sector. Reading a German site from Iran is probably not prohibited (a lawyer must confirm).
  - The real risks: listed persons; payments (notification or authorisation above €10k); listings that help export restricted goods (§ 18 AWG, prison).
  - US providers' terms: Stripe prohibits anyone located in Iran and indirect dealings; AWS, Cloudflare and Sentry put compliance on us. OFAC GL D-2 covers communications, not commerce.
  - User safety: the October 2025 espionage law; the internet cut off for about 70% of 2026; phones checked at the border (Auswärtiges Amt, 23 Oct 2026).
  - Abuse: deposit scams, fake jobs, sourcing of banned goods, money mules.
- **Decision:**
  - Keep the block, the +98 refusal and the havaleh, parcel and export bans at launch.
  - Later, maybe a separate static guide site for people preparing to move: no accounts, forms, chat, payments or tracking, and no event photos. Only with a lawyer's sign-off and a check with Cloudflare.
  - Then maybe a read-only main site.
  - Never accounts, contact with sellers, or payments from Iran.
- **Questions for a sanctions lawyer:**
  1. Is a free read-only Persian site reachable from Iran prohibited under 267/2012, 359/2011 or the AWV?
  2. Is a free account "economic resources" for a listed person, and which screening is adequate?
  3. Are we liable for users' listings of restricted goods bound for Iran, and what moderation counts as due diligence?
  4. Do GL D-2 and § 560.210(c) cover Cloudflare, SES and Sentry serving readers in Iran?
  5. Would an Iran-facing static site risk the Stripe account?
  6. § 19 AWG fines, and the EU sanctions-crime directive 2024/1226.
  7. How to answer requests from Iranian authorities (Art. 48 GDPR), and which logs to keep.
  8. Does geoblock plus terms plus screening count as reasonable steps despite VPNs?

**Dark mode:** ten screens rendered, shown in their own section on the page. Still open: with the redesign or after launch.

**Still open for the owner:**
1. Dark mode now or after launch.
2. The country order (Canada → Netherlands and Sweden → UK → US → Australia).
3. A lawyer's pre-launch review covering cookies and Iran too.

**Sources** (full lists on the page):
- **Countries:** StatCan 98-10-0356, ONS Nomis TS012, SCB, CBS 85458NED, Pew 2026, ABS 2021, wien.gv.at, EUAA, Federal Register 2026-17426.
- **Iran:** Mayer Brown on the EU snapback, OFAC GL D-2, 31 CFR 560.204, Stripe restricted businesses, AWS customer agreement, § 18 AWG, Auswärtiges Amt.
- **Waitlist and founding:** Hu & Winer 2017, Kivetz et al. 2006, Chen (The Cold Start Problem), BGH I ZR 164/09.

## Round 3 (Oct 25, 2026): events, Pro, business, countries, legal, dates, dark mode

**Asked by the owner after round 2:**
- Events need real attention.
- Also cover `/business/new` and `/pro`.
- Peydoo will open more countries (the US, Canada, Australia, Turkey…), so the first page must work for many countries.
- Show the footer and the Impressum, and design a cookie banner if one is needed.
- Dates always Gregorian; Jalali only where it is clever.
- Show what dark mode means.
- Admin shortcuts: yes.
- The rest of round 2 is good.

**How round 3 was done:**
- **Production** (`peydoo.com`) is behind Cloudflare Access, so staging was used. It runs the same code.
- **Staging screenshots:** events (empty: no events on staging), Pro, `/canada` (404) and the signed-in event form from round 2.
- **Business pages:** `/business/new` was judged from the code, since the session was already signed out. It is one long form with German legal fields (Gewerbeamt, Handelsregister, USt-IdNr).
- **Research:** two agents. Sources are on the page and summarised below.

**Decisions taken (mine, to be confirmed by the owner):**
- **Dates.**
  - Always Gregorian with Persian month names and Persian digits: «۸ نوامبر ۲۰۲۶», `fa-u-ca-gregory`, standalone month names.
  - Relative dates («۲ ساعت پیش») for the first 7 days.
  - Jalali only as a second label on cultural dates (Nowruz, Yalda, Chaharshanbe Suri), e.g. «شب یلدا: دوشنبه ۲۱ دسامبر (۳۰ آذر)».
  - "Member since", listing, chat and admin dates switch to Gregorian. Today all non-event dates go through `src/lib/format.ts` with `fa-IR-u-ca-persian`, so that file is the main change, plus the chat day dividers and the admin charts.
  - Checked with ICU: 30 Azar 1405 is Monday 21 December 2026, and 1 Farvardin 1406 is 21 March 2027.
- **First page for many countries.**
  - `/` never redirects (Google advises against redirects by IP). It suggests the country from `CF-IPCountry` (all plans), and the city from the "Add visitor location headers" managed transform (very likely on Free; turn it on to check).
  - Copy: «به نظر می‌رسد در آلمان هستید» with that country's cities and counts, and «کشور دیگر».
  - A country that isn't open gets a waitlist card instead of a page: city plus email, double opt-in (Canada's CASL needs a consent record), the city's count against the opening gate, Telegram invite, and links to online events and the open countries. `/canada` stays 404 until it opens.
  - The header's place chip opens a chooser: open countries with counts, then «به‌زودی» with «خبرم کن».
  - Iran gets a short static page (451), knowing most Iranian users have VPNs.
  - Per-country currency, postcode and address order, phone formats; miles and square feet in the US; a currency policy for Turkey before opening.
  - Paths on one domain as today (`/germany/berlin`).
- **Footer and Impressum.**
  - A footer on every browsing page, flat on phones and never folded away (NN/g).
  - Groups:
    - **Help:** guide, safe trading, report, contact.
    - **Legal:** «Impressum (اطلاعات ناشر)», «شرایط استفاده (AGB)», «حریم خصوصی و کوکی‌ها (Datenschutz)», the DSA contact point.
    - **Peydoo:** about, Pro, events, Telegram.
    - **Countries:** open and coming.
  - The Impressum stays reachable within two taps from task pages (chat, posting) through «حساب من» → «Impressum، شرایط و حریم خصوصی» (BGH I ZR 228/03; OLG Hamm says an unlabelled mobile icon is not enough).
  - Possibly add a § 25 MedienG disclosure line for Austria.
- **Cookie banner: none on current facts.** Session, login steps, `country`, `view`, `pending_favorite` and Turnstile are all strictly necessary or requested by the user (§ 25 (2) Nr. 2 TDDDG); GitHub dropped its banner the same way.
  - The privacy policy lists every cookie and storage key; Sentry Replay stays off.
  - Analytics, if ever: storage-free first.
  - If a banner is ever needed, it is designed (`final/cookie.js`): «فقط ضروری» and «قبول همه» with the same weight on the first screen, details one tap away, nothing pre-ticked, no wall (EDPB taskforce 2023).
- **Dark mode.**
  - It follows `prefers-color-scheme`, with «روشن / تیره / خودکار» in settings, stored like `view`.
  - The tokens are redefined for dark:
    - surfaces: #0f1716 / #16211f;
    - turquoise text and buttons lighter: #5cc0c7 with dark text on buttons;
    - saffron: #f5c862.
  - Photos are left alone. #0B6E77 on dark is only 3.1:1.
  - Preview in `final/dark.css`.

**Events (the "weekly traffic engine" in `docs/strategy.md`):**
- **List** (`final/events.js`):
  - a season strip when there is one (Yalda, with the date in both calendars);
  - 14 days with dots where something happens;
  - type chips that apply at once: concert, party, literary and cultural, meetup, workshop, **memorial and solidarity** (Nowruz 2026 was quiet because of the war), children;
  - free and online;
  - a «ویژه» paid slot, labelled;
  - events grouped by week with a 4:5 poster, day and time, place, price, tour badge and "interested" count;
  - «خبرم کن» weekly by Telegram or email.
- **Event page** (`final/event.js`):
  - the poster whole on a blurred copy;
  - date, place and tickets as three rows with their actions: calendar, route, tickets. The date row also gets a relative label («۱۴ روز دیگر»);
  - the tour's other cities, performers, then details (language, age, seating, access, refund, door sales);
  - a verified organiser with «دنبال کردن» and their number of events;
  - a ticket-scam warning naming PayPal «دوستان و خانواده» and bank transfers;
  - similar events;
  - «خرید بلیت» fixed at the bottom on phones, under the poster on computers.
- **Posting** (`final/post-event1.js`, `post-event2.js`):
  - The poster first (the Instagram 4:5 one).
  - «متن پست اینستاگرام یا تلگرام را بچسبانید» fills title, date, city, venue and price for checking. This can come with the AI-posting step.
  - Type as chips; the date with Persian month names; time as hours; repeats as chips.
  - The venue with suggestions from earlier events.
  - «افزودن شهر و تاریخ دیگر» for tours: one page per city, linked. Today a series is the same place with more dates.
  - Step 3 is tickets and publishing.
- **Research:**
  - No Persian diaspora event calendar was found: events live on Instagram, Telegram, artists' sites and Eventbrite tags.
  - Eventbrite: saves with reminders, and organiser followers notified with a cap of 2 a day.
  - Bandsintown: tours by city. RA: lineup and a venue list. Luma: clone instead of complex series.
  - Google Event markup: one URL per date, and no rich results for online-only events.
  - German consumer advice on ticket scams.

**Pro and businesses:**
- **Pro** (`final/pro.js`):
  - The founding offer first, dated, with the code field on it.
  - A monthly / yearly switch: «۲ ماه رایگان», €48 or €118 less.
  - Three plans with «پیشنهاد ما» on Pro, prices final under §19 UStG, and a short FAQ.
- **New business in 3 steps** (`final/business-new.js`, `business-legal.js`):
  1. Name, category, city and logo; the page address comes from the name.
  2. Contact and hours.
  3. The legal details for that country: Impressum fields in Germany, others elsewhere. They can wait until the "verified" badge or the first payment.
  
  Etsy and Shopify also ask legal and tax details last. Divar's business panel has manager and staff roles.
- **Business page** (`final/business-page.js`):
  - cover, logo, verified, one line, languages, «الان باز است»;
  - message, call and route;
  - listings, events and about tabs;
  - follow;
  - the Impressum folded at the bottom.

**Size added by round 3:**

| Part | Days |
| --- | --- |
| Events | 3–4 |
| First visit, footer and dates | 2 (plus a small waitlist table) |
| Pro and business | 2 |
| Dark mode, optional | 1–2 |

With round 2's parts, about 15–18 working days. Optional extras: event saves and organiser follows (two small tables and a notification job), "where did you sell it?" (one column).

**Four decisions for the owner:**
1. **Founding Pro:** "free until 31 Dec 2027 for the first 50 businesses per city" (the mockup), or 12 months as in the strategy?
2. **Waitlist count:** show «۳۱۲ نفر منتظرند؛ با ۵۰۰ نفر باز می‌کنیم», or collect without showing a number?
3. **Event saves with reminders and organiser follows:** now (recommended) or after launch?
4. **Dark mode:** with the redesign, or after launch?

Round 2's "the rest is good" is taken as yes to the 4 posting steps, keeping «آگهی‌های من» in the bottom bar, and admin shortcuts.

**Round 3 sources** (full list on the page):
- **Events:** [Eventbrite followers](https://www.eventbrite.com/help/en-us/articles/783059/), [Eventbrite postponed/cancelled](https://www.eventbrite.com/help/en-us/articles/895183/), [Bandsintown](https://artists.bandsintown.com/support/blog/youve-heard-of-follow-like-and-share-now), [RA submitting events](https://support.ra.co/article/12-submitting-events), [Luma recurring](https://help.luma.com/p/multi-session-recurring-events), [Google Event markup](https://developers.google.com/search/docs/appearance/structured-data/event), [Mimikama ticket scams](https://www.mimikama.org/?p=351737), [The Local: Nowruz 2026](https://www.thelocal.de/20260320/nowruz-how-iranian-new-year-is-celebrated-in-germany)
- **Pro and businesses:** [Smashing: pricing pages](https://smashingmagazine.com/2022/07/designing-better-pricing-page), [Kleinanzeigen PRO packages](https://onlinemarktplatz.de/267016/kleinanzeigen-pro-neue-pakete/), [Zoomit: Divar for businesses](https://www.zoomit.ir/tech-iran/428232-divar-new-options-for-businesses)
- **Countries:** [Google multi-regional](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites), [Cloudflare location headers](https://developers.cloudflare.com/rules/transform/managed-transforms/reference/), [Craigslist sites](https://www.craigslist.org/about/sites), [Kodoom](https://www.kodoom.com/), [CASL consent records](https://www.torys.com/insights/publications/2016/07/crtc-releases-guidelines-on-casl-consent-records)
- **Legal and cookies:** [§ 5 DDG](https://www.gesetze-im-internet.de/ddg/__5.html), [two clicks](https://www.e-recht24.de/impressum/4911-impressum-2-klicks.html), [OLG Hamm mobile](https://www.ra-plutte.de/olg-hamm-pflichtangaben-im-mobile-commerce/amp/), [NN/g footers](https://www.nngroup.com/articles/footers/), [§ 25 TDDDG](https://www.gesetze-im-internet.de/ttdsg/__25.html), [EDPB cookie banners](https://www.edpb.europa.eu/system/files/2023-01/edpb_20230118_report_cookie_banner_taskforce_en.pdf), [GitHub: no cookie banner](https://github.blog/2020-12-17-no-cookie-for-you)
- **Dates and dark mode:** [CLDR fa Gregorian](https://cdn.jsdelivr.net/npm/cldr-dates-full@46.0.0/main/fa/ca-gregorian.json), [web.dev dark mode](https://web.dev/case-studies/terra-dark-mode), [Kleinanzeigen dark mode](https://www.netzwelt.de/anleitung/229011-kleinanzeigen-dark-mode-aktivierenso-gehts.html)

## Final design: «صیقل‌خورده», made easier to use (round 2)

**The owner's choice (Oct 24, 2026):** keep today's look (turquoise, saffron, Vazirmatn, rounded cards; "this is my style"), make it much more user-friendly, and include the admin panel. Round 1's recommendation (A) was not taken.

**How round 2 was done.**
- **Signed-in pages:** captured on staging with the owner's account.
  - The owner requested the email code on their phone, because Turnstile shows the interactive check to headless Chromium. I typed the code in.
  - For the admin panel, the owner sent a TOTP code. The first one expired on the way; the second worked.
  - Screenshots: posting steps and form, my listings, saved items, saved searches, chat inbox and thread, account, notifications, business page, event form and Pro, phone and computer. Names, emails, phones, IPs and chat texts were replaced before each shot.
  - Nothing was posted, sent or changed. The session was signed out afterwards and its file deleted.
- **Admin:** the overview, queue, new listings, listings, users, businesses, payments, audit log, system status and staff pages, plus one listing and one user page.
- **Research:** a second agent (sources below and on the page).

**What round 2 found, besides round 1's list:**
1. **Posting form:** a WG room's form is about 9 phone screens (photos, kind, title, description, ~8 fields, price type and amount, place with map, "publish as", contact, Turnstile).
   - Date fields are native `<input type=date>`, which shows «mm/dd/yyyy». The browser's language decides that, not the page's (MDN).
   - Radio buttons use the browser's blue.
2. **My listings:** five buttons per listing (pause, sold, promote, edit, delete), so two listings fill a phone screen. Views, chats and phone reveals are only shown on the business page.
3. **Chat thread:** keeps the site header on phones and has a report flag beside every incoming message.
4. **Account:** one flat list of 13 rows that mixes settings and "my things".
5. **Admin panel:**
   - It sits inside the public header and footer, and on phones it shows the public bottom bar.
   - The item decision form preselects «برداشتن آگهی» and the first reason (`useState(0)` in `admin/items/decision-form.tsx`). The required facts text prevents an accidental submit, but a destructive default is the wrong default.
   - System status shows 4 unapplied payment webhooks in plain grey, and the queue table cuts off the "failed" column at 1280px.
   - On phones the overview's stat cards are 250px tall each.

**The proposal (34 screens, phone and computer, on the page):**

- **Everywhere:**
  - Prices as «۸۷۰ €».
  - «،» instead of «·».
  - Nothing under 12px, 44px targets.
  - The bottom bar only on browsing pages.
  - Dark mode optional.
- **Finding:**
  - **First visit:** asks for the city (Berlin highlighted, with counts), offers search at once and says what Peydoo is in one line.
  - **Browse pages:** one search field and one chip row (results from y≈220), applied filters as removable chips.
  - **Filter sheet:** buttons instead of selects, a typical-price hint, «نمایش ۲۳ آگهی» on the button.
  - **Result line:** «خبرم کن» saves the search.
  - **Rooms and flats:** a rent-scam warning on those pages.
- **Listing page:**
  - On phones, a fixed bar with chat, phone and save. Back, share and save sit over the photo.
  - On computers, title, price and contact sit beside a shorter photo.
  - Rent shown in full (cold, with costs, deposit).
  - A category-specific safety box, the seller with response time, and similar listings.
- **Posting:**
  - 4 steps on the existing draft: category (search with suggestions), photos and text, details and price, place and check.
  - Autosave after each step; optional fields marked «(اختیاری)»; choices as buttons.
  - Dates as day / Persian month name / year with the Jalali date beneath, plus «از همین حالا» / «اول ماه بعد».
  - Photos moved with ⋯, no dragging.
  - A check-answers page with «تغییر», and Turnstile only there.
  - A published page with Telegram and WhatsApp sharing first and the bump (€1.99) second.
- **My listings:**
  - One button that fits the state (rented or sold, renew, continue), edit, and «بیشتر ⋯» opening a labelled sheet.
  - Views, saves and chats per listing.
  - Tabs by status.
- **Chat:**
  - Full screen with the listing bar.
  - Report and block in ⋯ (and long press) instead of a flag on every message.
  - One safety note per conversation, quick replies.
- **Account:** a hub with a profile card, «فعالیت من» tiles with counts, the business only when there is one, one row into Settings (account, notifications, security and devices, privacy and data), help, sign out.
- **Admin:**
  - Its own dark bar with «پنل مدیریت» and the environment.
  - Review one item at a time: large photos with a greyscale switch, risky phrases highlighted, reports, and the seller's history (account age, number origin, similar text). Nothing preselected; options from mild to severe; keys ۱–۵, J/K, Enter for «ثبت و بعدی»; reason chips that pick the terms section; the 24-hour clock on top.
  - Overview: "needs attention" first, the week with its change, and Berlin against the gates in `docs/strategy.md`.
  - System status: problems first and in red with what to do, and a table that scrolls.

**Size: about 8–10 working days in five parts,** each deployable alone:

| Part | Days | Main files |
| --- | --- | --- |
| Everywhere | 1 | `listing-card.tsx`, `bottom-nav.tsx`, price formatting, `globals.css` |
| Finding | 2–3 | `src/app/page.tsx`, `[country]/_browse/*`, `v/[slug]/[token]/page.tsx`, `contact.tsx` |
| Posting | 3 | `new/*`, `my/listings/[id]/*`, `messages/fa.ts` |
| Me | 1–2 | `my/listings/page.tsx`, `chat/[id]/*`, `account/page.tsx` |
| Admin | 2 | `admin/layout.tsx`, `admin/items/*`, `admin/page.tsx`, `admin/system` |

No schema change is needed. "Where did you sell it?" would add one column and is optional.

**Five decisions for the owner:**
1. **First visit:** ask for the city (recommended), or go straight to Berlin?
2. **Posting:** 4 steps (recommended), or one shorter page in sections?
3. **Bottom bar:** keep «آگهی‌های من» (recommended), or swap it for «نشان‌ها» like Divar?
4. **Admin:** keyboard shortcuts, yes or no?
5. **Dark mode:** now, or after launch?

**Round 2 sources:**
- **Forms:**
  - NN/g: [wizards](https://www.nngroup.com/articles/wizards/), [required fields](https://www.nngroup.com/articles/required-fields/), [form errors](https://www.nngroup.com/articles/errors-forms-design-guidelines/), [contextual menus](https://www.nngroup.com/articles/contextual-menus-guidelines/)
  - GOV.UK: [form structure](https://www.gov.uk/service-manual/design/form-structure), [check answers](https://design-system.service.gov.uk/patterns/check-answers/), [date input](https://design-system.service.gov.uk/components/date-input/), [radios](https://design-system.service.gov.uk/components/radios/) ("do not pre-select"), [confirmation pages](https://design-system.service.gov.uk/patterns/confirmation-pages/)
  - Baymard: [required and optional fields](https://baymard.com/blog/required-optional-form-fields), [inline validation](https://baymard.com/blog/inline-form-validation)
  - [MDN: input type=date](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/date)
- **Marketplaces:**
  - Kleinanzeigen help: [drafts](https://hilfe.kleinanzeigen.de/hc/de/articles/17083044980764), [renewing](https://hilfe.kleinanzeigen.de/hc/de/articles/17042140225948), [chat report and block](https://hilfe.kleinanzeigen.de/hc/de/articles/17153500099868)
  - Vinted: [uploading](https://www.vinted.com/help/375), [bumps](https://www.vinted.co.uk/help/450)
  - Divar: [Zoomit: hidden conversations](https://www.zoomit.ir/tech-iran/429579-hidden-conversations-on-divar-platform), [anti-fraud](https://www.zoomit.ir/tech-iran/417701-measures-to-deal-with-fraudsters)
  - Rental scams: [Verbraucherzentrale](https://www.verbraucherzentrale-niedersachsen.de/wissen/vertraege-reklamation/kundenrechte/sechs-miese-maschen-bei-der-wohnungssuche-120143)
  - [Airbnb account settings](https://www.airbnb.com/help/article/280), [Telegram share link](https://core.telegram.org/widgets/share)
- **Moderation and monitoring:**
  - [TSPA: setting up moderators](https://www.tspa.org/curriculum/ts-fundamentals/content-moderation-and-operations/setting-up-a-content-moderator-for-success/), [moderation tooling design](https://vale.rocks/posts/moderation-tooling-design)
  - [Das et al. 2020 (blur and greyscale)](https://ischool.utexas.edu/ml/papers/das_hcomp20.pdf)
  - [Stripe test mode](https://docs.stripe.com/test-mode), [Google SRE monitoring](https://sre.google/sre-book/monitoring-distributed-systems/)
  - [DSA Art. 17](https://www.eu-digital-services-act.com/Digital_Services_Act_Article_17.html)
- **Persian Gregorian month names (CLDR):** ژانویه، فوریه، مارس، آوریل، مه، ژوئن، ژوئیه، اوت، سپتامبر، اکتبر، نوامبر، دسامبر.

## Round 1: three directions

**Round 1 recommendation (not taken):** Direction A «آشنا» (Divar's layout in Peydoo's colours). Optionally add two parts of C: the intent tiles on the city page and a category suggested from the title when posting. Do the eight shared fixes whichever direction is chosen.

## How this was done

- Staging, logged out, in headless Chromium (Playwright image `v1.63.0-noble`, `--memory=1g`, one browser at a time), phone 390×844 @2x and computer 1280×800. 16 pages, the two phone sheets and the photo viewer. Seller names, emails and phone-like numbers were replaced on the page before each shot.
- Not captured: the posting form, chat, account and business pages. Sign-in is by email code only, with no test inbox. These were judged from the code (`src/app/new/`, `src/app/my/listings/[id]/`).
- Staging content: 4 listings, all in Berlin; none in Austria; no events.
- Research by two agents: marketplaces (live HTML of Divar, Sheypoor, Kleinanzeigen, Vinted and Airbnb fetched with an iPhone user agent, plus articles), and Persian typography, RTL and accessibility (competitors' live CSS, W3C, Material, Apple, WCAG 2.2, the EAA). Leboncoin and OLX returned 403 and Avito 429, so those rest on articles.
- Mockups: HTML with Tailwind's play CDN, logical classes only, Vazirmatn (A, B) or Estedad (C), rendered in the same Chromium at the same two sizes. Sources are in `docs/design-options/mockups/`; how to render them is in its README.

## Staging today

What works:
- The turquoise and saffron stand apart from Divar's red and Sheypoor's blue.
- The logo reads at 36px.
- The bottom bar with its raised post button.
- The category sheet has icons and counts; the filter sheet has a sticky apply bar.
- The photo viewer works with swipe, the back button and the keyboard.
- Breadcrumbs, warm and cold rent, and the details table.
- Saved searches.
- Correct RTL: logical classes, chevrons, photo order, Persian digits, `<bdi>` around Latin text.
- One pasteable code field (`autocomplete="one-time-code"`, WCAG 3.3.8).
- Photo order is changed with buttons, so no dragging is needed (2.5.7).

What doesn't:
1. **Controls before content.** On a phone the first listing starts at y≈356 on `/germany` and at y≈485 on a category page, out of 844px. Up to nine rows come before it: header, categories, subcategories, filters and near me, the search box, title with the view switch, city, save search, and sort. The header's search button only jumps to a box that is already on screen.
2. **No contact on the first screen.** On phones, chat sits in the seller box below the photo, title and price. The bottom bar takes the place where Divar, Kleinanzeigen, Airbnb and Vinted put the contact bar. At 1280×800 the 750×560 photo pushes the title and price below the fold.
3. **Cards.** The `min-h-12` on titles leaves an empty band under one-line titles. The price comes second. The place shows «Berlin» in Latin.
4. **Prices** render as «€۸۷۰», which is ICU's default for `fa`. The Persian pattern is «۸۷۰ €».
5. **«·» next to Persian digits reads as zero**: «۳ · ۶ عکس» looks like «۳۰۶». This was found in the mockups; the card meta line uses the same separator.
6. **Small text:** 20 places use 10–11px, including the bottom bar labels and badges.
7. **The home page is only a country choice.** It has no search, categories or listings.
8. **Posting** is a category tree with one page per level, then one long form with no sense of progress.
9. **Empty states keep the full controls.** On events: four chips, two selects, two checkboxes and a button above «رویدادی با این انتخاب پیدا نشد». On Austria: sort and the view switch above an empty box.

## The three directions (ranked)

Ranked by how quickly a newcomer coming from Divar or Telegram finds and posts something on a phone, then by look.

### A «آشنا» Familiar: Divar's layout, Peydoo's colours

- **Structure:**
  - **Phone header:** logo, a search field and a city button. On a computer: logo, city, search, «پیدوی من», «پیام‌ها», «ثبت آگهی».
  - **City page:** 8 category tiles, the next event, then the newest listings.
  - **Listing rows:** text at the start and a square photo at the end, as on Divar (a 136px photo on the left in RTL). Badges on the photo: Anmeldung, «احراز شده».
  - **Category pages:** one chip row. «فیلترها ۲» comes first, then each applied filter, then the common filters, with sort last. «خبرم کن» saves the search. The first result is at y≈194.
  - **Bottom bar:** آگهی‌ها · دسته‌ها · ثبت آگهی · پیام‌ها · پیدوی من. «پیدوی من» is a new `/my` page with my listings, saved items, saved searches and the account.
  - **Listing page:** the photo under a thin bar (back, share, save), then time and district, the safety row before the details, label–value rows, and a fixed bar with «چت» and «اطلاعات تماس». On a computer the details sit on the start side and the photos on the end side.
  - **Posting:** the open draft first, then a category list with a search box.
- **Look:** the same tokens and Vazirmatn. Flatter, with hairlines instead of boxed cards, 8px corners and 16px titles.
- **Why:** nothing to learn for Divar users. It is the densest option, with about 3½ rows on the first screen. Rows also suit listings without photos (services, jobs, lessons).
- **Risk:** it can read as a Divar copy. The brand then rests on the colour, the logo and the content.
- **Cost:** medium, about 4–6 days, no schema change. Files: `site-header.tsx`, `bottom-nav.tsx`, `listing-card.tsx`, `[country]/_browse/browse-page.tsx`, `chips.tsx`, `filter-form.tsx`, `category-sheet.tsx`, `v/[slug]/[token]/page.tsx`, `contact.tsx`, `new/page.tsx`, a new `/my` page, `messages/fa.ts`.

### B «صیقل‌خورده» Refined: today's look, the problems fixed

- **Structure:**
  - One sticky search field and one chip row replace the stack of rows.
  - Title, count, sort and the view switch sit on one line. Applied filters show as removable chips.
  - Grid cards show the price first, with no empty band.
  - **Listing page on phones:** a fixed bar with chat, phone and save takes the place of the bottom bar. Facts appear as tiles, and room listings get a box warning about deposit scams.
  - **Listing page on a computer:** title, price, contact and seller sit beside a shorter photo, all on the first screen.
  - **Posting:** a 4-step bar, the fixed country, a category search with suggestions, then the list.
- **Look:** unchanged. Text is 12px at the smallest.
- **Why:** it keeps the look the owner likes. Results start at y≈222–257, and contact is always one tap away.
- **Weaker than A:** the grid stays the default, which suits text-heavy listings less well, and it is less familiar to Divar users.
- **Cost:** small, about 2–3 days, no schema change. Files: `browse-page.tsx`, `chips.tsx`, `listing-card.tsx`, `bottom-nav.tsx` (hidden on listing pages), `v/[slug]/[token]/page.tsx`, `contact.tsx`, `new/page.tsx`, `site-header.tsx`, `messages/fa.ts`.

### C «محله» Neighbourhood: a city hub, photo-first

- **Structure:**
  - **Hub page:** a tiled band with a headline and one search pill, then six intent tiles from the launch strategy (rooms, work, Persian-speaking services, buy and sell, lessons, events).
  - **Hub rows:** new rooms with Anmeldung, this week's events and the newest listings. Empty rows hide.
  - **Bottom bar:** خانه · جستجو · ثبت آگهی · پیام‌ها · من, with a raised saffron post button. Search opens full screen.
  - **Category pages:** large photo cards.
  - **Listing page, in Airbnb's style:**
    - A rounded sheet over the photo.
    - Highlight tiles.
    - The seller as a "host", with response time.
    - A price bar with «پیام بده».
    - On a computer, a photo mosaic and a sticky price card.
  - **Posting:** photos first (they can be skipped), then a title that suggests the category, in 3 steps.
- **Look:**
  - Estedad replaces Vazirmatn. Estedad is OFL and maintained (v8.5, March 2026) and has its own Latin.
  - Saffron is used as a fill with dark text.
  - A deep turquoise band with a girih tile pattern, 20px corners and a tinted page background.
- **Why:** it is the most distinctive option. It leads with what Telegram serves worst (strategy, recommendation 4) and copes well with thin supply.
- **Downsides:**
  - More scrolling before the listings.
  - Big photo cards look empty for services and jobs.
  - Photos before the category needs drafts without a category.
- **Cost:** large, about 2–3 weeks.
  - **Migration:** `listings.category_id` becomes nullable for drafts.
  - **New work:** the hub page and its section queries, the search overlay, fonts (`layout.tsx`, `scripts/subset-font.sh`), `globals.css`, every card, the listing page and gallery, the posting flow (`new/`, `my/listings/[id]/editor.tsx`, `form.tsx`), and `messages/fa.ts`.

## Eight fixes for any direction

1. A fixed contact bar on listing pages on phones, and contact on the first screen on computers.
2. One chip row with filters, applied values and sort, so results start within the top ~250px.
3. Prices as «۸۷۰ €», built from `Intl.NumberFormat('fa')` parts in a fixed order.
4. No «·» next to Persian digits. Use «،» instead.
5. Nothing below 12px.
6. The filter sheet's button shows the live count: «نمایش ۲۳ آگهی».
7. Empty pages hide sort, the view switch and filters, and offer «خبرم کن» and a wider area.
8. Dark mode at launch. `#0B6E77` on a dark background is 3.0:1, so dark mode needs a lighter turquoise (e.g. `#4FB3BC`, 7.4:1).

## Research notes

**Marketplaces** ([V] = checked in the live HTML on Oct 24, 2026):
- **Divar [V]:**
  - Bottom bar: آگهی‌ها · نشان‌ها · ثبت آگهی · چت و تماس · دیوار من.
  - The phone home page has a search field, a location chip and a 10-category icon grid.
  - List cards have a 136×136 photo on the left, a 2-line title (16/28), a condition line, the price, and «لحظاتی پیش در …».
  - Category pages have a chip row starting with «۱ فیلتر», one chip per filter, and sort last.
  - On the listing page the safety row («زنگ خطرهای قبل از معامله») comes before the details, then label–value rows, and a fixed bar with «چت» and «اطلاعات تماس».
  - Red (#C32E2E) is used only for buttons; the font is IRANSans.
  - Since Nov 2024 the home feed is personalised (Zoomit: 20% less time to the wanted ad).
- **Sheypoor [V]:** blue (#3e7bfa), IRANYekanX. Uses «توافقی», «عضو شیپور از مهر ۱۴۰۴» and a similar-ads block.
- **Kleinanzeigen:**
  - Search-first header with place and radius; category counts; Privat/Gewerblich; «Suche speichern»; «Aktiv seit».
  - Smiley ratings that can only be given from a chat.
  - AI posting from one photo since Nov 2025 (GIGA). It is not available for cars, services or jobs.
- **Vinted:** photos first, «Vorgeschlagen» categories, a price hint, and drafts. Pratt's critique faults required fields that aren't marked.
- **Leboncoin and OLX:** Leboncoin takes the title first and suggests the category from it. OLX's photo recognition cut posting time by more than half (2016).
- **Airbnb [V]:** the filter button shows the result count («Show 1,000+ places»), and there is a sticky price bar under 744px.
- **Baymard and NN/g:** show applied filters as removable chips above the results; a sheet that keeps results visible beats a full page; label the filter button with text.

**Persian type, RTL and accessibility:**
- **Fonts:** Divar uses IRANSans, Sheypoor IRANYekanX, Digikala its own variable font, Snapp IRANSansX, and Basalam Dana; the paid fonts come through fontiran or noonfont.
  - Vazirmatn is OFL. Its Latin comes from Roboto, and the Non-Latin variable file is 48 KB. It hasn't had a release since 2022.
  - Estedad is the maintained OFL alternative.
- **Type sizes:** body text 16px at line-height 1.8, headings at 1.4–1.5, nothing below 12px. Digikala uses 180% line-height, Divar mostly 2.
- **Letter-spacing and italics:** never on Persian (CSS WG, W3C i18n).
- **Mirroring:** mirror arrows, progress bars and photo order. Never mirror play buttons, clocks, checkmarks, logos, photos or digits (Material, Apple HIG).
- **Contrast:** saffron on white is 2.18:1, so use it only as a fill with dark text (8:1). Turquoise on white is 5.98:1.
- **Touch targets:** 44px. Sticky bars must never hide the focused element (WCAG 2.4.11, `scroll-padding`).
- **Screen readers:** TalkBack doesn't list Persian, so set `lang` correctly (`lang="de"` on German strings).
- **EAA:** micro-enterprises providing services (fewer than 10 staff and €2M or less) are exempt. Build to WCAG 2.2 AA anyway (interpretation, not legal advice).
- **One-handed use:** Hoober (2013) found 49% one-handed use, with 67% of those using the right thumb. Taps favour the centre, so bottom bars and sticky actions work.
- **Colour:** turquoise and saffron are distinct from every major competitor. Avoid green, white and red combinations (politics).

## Sources

- **Live pages:**
  - divar.ir/s/tehran
  - divar.ir/s/tehran/mobile-phones
  - divar.ir/v/gadXiYXd
  - sheypoor.com/s/tehran
  - kleinanzeigen.de/s-berlin/l3331
  - vinted.de/catalog
  - airbnb.com/s/Berlin/homes
  - The CSS of digikala.com, basalam.com and app.snapp.taxi
- **Divar:**
  - https://www.zoomit.ir/tech-iran/428709-fraud-prevention-on-divar-platform/
  - https://www.zoomit.ir/tech-iran/430156-new-feature-divar-front-page
  - https://digiato.com/article/2017/11/22/
- **Kleinanzeigen:**
  - https://www.giga.de/tech/kleinanzeigen-neue-app-funktion-nimmt-euch-die-arbeit-ab--01KABB1FRKNGA414346KH57RRV
  - https://www.giga.de/apps/ebay-kleinanzeigen/tipps/ebay-kleinanzeigen-nutzer-bewerten-so-funktioniert-es/
  - https://www.monsterdealz.de/magazin/kleinanzeigen-sicher-bezahlen
- **Vinted and Facebook Marketplace:**
  - https://www.vinted.co.uk/help/375
  - https://ixd.prattsi.org/2026/09/design-critique-vinted-mobile-app/
  - https://ixd.prattsi.org/2026/09/design-critique-facebook-marketplace-ios-app-2/
- **Leboncoin and OLX:**
  - https://siecledigital.fr/2024/12/16/leboncoin-annonce-de-nombreuses-nouveautes-et-ambitionne-de-devenir-le-leader-du-e-commerce/
  - https://iphonesoft.fr/2017/05/02/leboncoin-4-0-retour-tabbar-chiffres-fous-2016
  - https://www.digit.in/press-release/apps/olx-updates-app-adds-image-recognition-technology-32242.html
- **Filters and empty states:**
  - https://baymard.com/research-articles/how-to-design-applied-filters
  - https://www.nngroup.com/articles/mobile-faceted-search/
  - https://nngroup.com/articles/empty-state-interface-design
- **Fonts:**
  - https://github.com/rastikerdar/vazirmatn
  - https://fontsource.org/fonts/estedad/about
  - https://fontiran.com/fonts/iransans
- **Typography and RTL:**
  - https://m1.material.io/style/typography.html
  - https://m1.material.io/usability/bidirectionality.html
  - https://developer.apple.com/design/human-interface-guidelines/right-to-left
  - https://w3c.github.io/i18n-drafts/articles/inline-bidi-markup/index.en
  - https://www.w3.org/International/track/issues/333
- **Accessibility:**
  - https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
  - https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
  - https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html
  - https://support.google.com/accessibility/android/answer/11101402
  - https://www.legislation.gov.uk/eudr/2019/882/article/4/adopted/data.htm
- **One-handed use:**
  - https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php
  - https://www.uxmatters.com/mt/archives/2017/03/design-for-fingers-touch-and-people-part-1.php

**Photo credits** (example listings in the mockups, Wikimedia Commons):
- Peugeot 208 PureTech 130 (© M 93, CC BY-SA 3.0 de)
- Back of the iPhone 13 Pro (Hajoon0102, CC BY-SA 4.0)
- Setar Body (Ghazy Kelay, GFDL)
- Pomegranate02 edit (Fir0002, GFDL 1.2)

The room and rug photos are from the two staging listings.
