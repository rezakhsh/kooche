# Design options

Oct 24–25, 2026 · research only, no app changes. The owner chose direction B «صیقل‌خورده» (today's look); round 2 made it easier to use, round 3 added events, Pro and business, the multi-country first page, footer and legal, Gregorian dates and dark mode. Waiting for four decisions, then a build plan for approval.

**Page with mockups and staging screenshots:** https://claude.ai/artifact/HqNDhAzv3SHSbbVCDmsQkQ (private until the owner shares it). The final proposal is on top; round 1 (three directions) is folded below it. The Oct 17 brand plan (https://claude.ai/artifact/TgjPF24NJujB7bQAYnz3AK) could not be opened from this session's account ("not found"); its decisions were taken from `docs/setup.md`, "Brand and design".

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
- Always worded "Pro, normally €24, free for founding businesses". No automatic charge without a yes; listings stay live after the free period.
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
