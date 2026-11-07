# SEO: audit and strategy (Nov 6, 2026)

The owner asked: "Is peydoo.com SEO friendly? Indexable? What is the best strategy?" This is the answer: an audit of the code (`/root/classifieds` at `d522289`), of production (`https://peydoo.com`, release `dce2c2f`) and staging, research on how Iranians abroad search and what works for classifieds sites, and a build plan. **Nothing has been changed**: no code, no setting, nothing on Cloudflare or Google. Every step in "Build plan" waits for the owner's approval.

Sources are linked inline. "Judgment" marks a conclusion of ours rather than a documented fact.

## 1. Verdict in plain English

**Is it indexable today? No, on purpose.** Three locks keep Google out of production until launch:
1. `robots.txt` is answered by the Cloudflare Worker `peydoo-robots-prelaunch`: Facebook's link preview may read pages, every other robot (Google included) is told `Disallow: /`.
2. Every page sends `X-Robots-Tag: noindex, nofollow` (`src/proxy.ts`, because `SEARCH_INDEXING` is unset on production).
3. `/sitemap.xml` answers 404 (`src/app/sitemaps/serve.ts`).

**What turns on at go-live** (`docs/setup.md` → "Production" → "Go-live", step 2): deleting the Worker route and the Worker, and setting `SEARCH_INDEXING=on` on production's web. Then `robots.txt` comes from the app (`src/app/robots.ts`): everything allowed except `/my/`, `/account`, `/chat`, `/login`, `/new` and `/events/new`, with the sitemap named; the `X-Robots-Tag` header disappears; `/sitemap.xml` serves the index the worker builds every hour (one file per open country with its browse and events pages, one or more files with every active listing and event). Step 5 adds the site to Google Search Console.

**Staging stays out of Google for good.** `SEARCH_INDEXING` defaults to `off`, and `src/lib/env.ts` refuses to start with `SEARCH_INDEXING=on` while `TEST_ACCOUNT_CODE` is set, which staging always has. Checked today: staging's `robots.txt` is `Disallow: /`, its pages send `X-Robots-Tag: noindex, nofollow`, its sitemap is 404.

**Is it SEO-friendly? Mostly yes: the foundation is better than most new classifieds sites, with a few real gaps to fix before go-live.** Good already: pages are rendered on the server in Persian with `lang="fa" dir="rtl"`; every page type has its own title, description and canonical address; filters, sorting, paging and empty pages are `noindex, follow` with the plain page as canonical, and unknown parameters redirect to the clean address; browse addresses are short Latin paths (`/germany/berlin/real-estate`); listing and event pages carry structured data; test accounts' content never reaches visitors or the sitemap; signed-out pages are fast through Cloudflare's cache; nobody is redirected by IP except visitors from Iran (crawlers never come from Iran).

The gaps that matter most (details in section 2):
1. **Google would index the home page as "Peydoo is coming to the USA".** Googlebot crawls from US addresses, and the home page shows a visitor from a planned country that country's «پیدو به‌زودی» page.
2. **Every page's content is in the raw HTML twice** (a loading wrapper renders it once as a fallback and once for real): two `<h1>` and two copies of the structured data for robots that don't run JavaScript, and about 100 KB more HTML on the Berlin page.
3. **Thin pages are open to Google:** every «پیدو به‌زودی» page of a country or city that is not open yet, and any city × category page with a single listing.
4. **Redirects are temporary** (302/307) where they should be permanent: `www` → apex, `http` → `https`, and cleaned-up addresses.
5. **Few pages answer what people actually type.** Titles say «املاک در برلین» where people search «اجاره خانه برلین»; there is no content for the moments when the diaspora searches most (Yalda, Nowruz, first weeks in Berlin: Anmeldung, Jobcenter, WG).

## 2. Findings

Severity: **High** = fix before go-live, **Medium** = in the first weeks, **Low** = when convenient. Effort: S = under half a day, M = a day or two, L = several days.

### What is already good

| Area | What we found |
| --- | --- |
| Rendering | Server-rendered HTML, Persian, `<html lang="fa" dir="rtl">`, Vazirmatn self-hosted |
| Titles and descriptions | Per page type: home, country, city, category × city, events, listing (its title), event, business, help, legal. Example: «آگهی‌های برلین \| پیدو», «رویدادهای ایرانیان در برلین، آلمان \| پیدو» |
| Canonicals | Browse pages, listings, events, businesses, help, legal pages. Listing addresses ignore the title part, so a renamed listing keeps working; the canonical carries the current title |
| Duplicate control | Filters, sorting, keyword search, map/layout switches, paging and places → `noindex, follow`, canonical to the plain page; parameters the page doesn't know redirect to the clean address; empty browse pages are noindex |
| Sitemaps | Built hourly by the worker; only plain country, city and city × category pages that have listings, events pages with upcoming events, and every active listing and event; never a filtered, sorted or paged address; test accounts left out |
| Structured data | Listing: Product + Offer (price, currency, condition, availability, place, seller). Event: Event (dates, status, attendance mode, place, organizer, performers, languages, offers). Business: LocalBusiness (address, hours, phone, social links). Browse: BreadcrumbList + ItemList |
| Removed content | Deleted listings → 404; sold, expired and paused listings stay visible with `noindex` and their availability marked SoldOut/Discontinued; private sellers' profiles are noindex; every personal page is noindex |
| Languages | `/terms` ↔ `/terms/de` and `/privacy` ↔ `/privacy/de` carry `hreflang` both ways; the German text is marked `lang="de"` |
| Share previews | Open Graph and Twitter cards on every page, the listing's or event's first photo when it has one |
| Speed | Signed-out browse, listing and event pages are kept by Cloudflare (`s-maxage=60` with background refresh); see "Speed" below |
| Region handling | No redirect by IP for anyone but Iran; crawlers see the site as a visitor from their country would |

### What is missing or wrong

| # | Finding | Evidence | Severity | Effort |
| --- | --- | --- | --- | --- |
| 1 | **Home page for Googlebot = the US «پیدو به‌زودی» page.** `src/app/page.tsx` shows a visitor from a planned country (not open, waitlist cities) that country's coming-soon page instead of the home page. Googlebot crawls mostly from US addresses ([Google: locale-adaptive pages](https://developers.google.com/search/docs/specialty/international/locale-adaptive-pages)), so Google would index peydoo.com as «پیدو به‌زودی در آمریکا». | Code; not reproducible with curl from this server (Finland) | **High** | S–M |
| 2 | **Page content twice in the HTML.** `NavFeedback` (`src/components/nav-feedback.tsx`) wraps every page in a `Suspense` whose fallback renders the page too; the server sends the fallback copy and a hidden finished copy that a script swaps in. Measured: two `<h1>` and two JSON-LD blocks on home, Berlin, listing, event and business pages; on staging Berlin's HTML is 370 KB uncompressed, of which the second copy is about 100 KB. Google renders the page and ends with one copy, but robots that don't run JavaScript (Bing in part, AI search crawlers, link previews) see both, and every visitor downloads and parses twice the HTML | curl on staging and production | **High** | S–M |
| 3 | **Waitlist pages indexable.** «پیدو به‌زودی در کانادا» (`/canada`) and «پیدو به‌زودی در هامبورگ» (`/germany/hamburg`) have no `noindex`. Every country and city that is not open yet (most of the 37 countries and 81 cities): almost the same text with another name, which Google's spam policy calls doorway-like ("pages targeted at specific regions or cities that funnel users to one page", [spam policies](https://developers.google.com/search/docs/essentials/spam-policies)) | curl on staging | **High** | S |
| 4 | **Thin city × category pages.** A page with one listing is indexable and in the sitemap. Common practice is a minimum (1–5 listings; Kleinanzeigen and Gumtree also cap paging depth) | `indexable()` in `browse-page.tsx` | Medium | S |
| 5 | **Temporary redirects.** `www.peydoo.com` → 302 (GET) / 307 (HEAD); `http://peydoo.com` → 302/307 (both from Traefik, since "Always Use HTTPS" is off for Let's Encrypt). Unknown parameters → 307 to the clean address (with a 60 KB body). Permanent (301/308) passes signals reliably and tells Google which address to keep | curl | Medium | S |
| 6 | **Sold and expired listings never leave.** They stay 200 + noindex forever. The architecture plan said "gone after a grace period". Google: 404 and 410 are equivalent for removal; a page that says "not available" with 200 is a soft 404 ([HTTP errors](https://developers.google.com/search/docs/crawling-indexing/http-network-errors)). Practice: keep the page for the seller and visitors for a while, then 410 with similar listings | Code | Medium | S–M |
| 7 | **Product markup on every listing.** Rooms, flats, jobs, services, lessons and «خواهان» (wanted) ads all claim to be a Product with an Offer. Google's product snippets are for products; markup that doesn't describe the page is a structured-data policy risk ([guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)). Merchant listings don't apply (nothing is bought on Peydoo) | Code | Medium | S |
| 8 | **Structured data that's missing.** No BreadcrumbList on listing, event and business pages (only on browse pages); no Organization + WebSite on the home page (WebSite is how Google picks the site name «پیدو» shown in results, [site names](https://developers.google.com/search/docs/appearance/site-names)) | Code and curl | Medium | S |
| 9 | **Sitemap leaves out pages worth finding:** the home page, business pages `/b/…` (the best local pages we have), `/help`, `/safety`, `/pro`, `/business/compare` | `src/modules/search/sitemap.ts` | Medium | S |
| 10 | **Titles miss the words people type.** Category × city titles use the category's name: «املاک در برلین \| پیدو»; people search «اجاره خانه برلین», «اتاق در برلین», «کار در برلین». Descriptions are one template for every category. No unique text on browse pages (only listings) | Code and research (section 3) | Medium | M |
| 11 | **No content beyond listings.** One FAQ page about using Peydoo. Nothing for "how to find a room in Berlin", Anmeldung, Jobcenter forms, Yalda or Nowruz in Berlin: the searches with the most volume and the least competition in Persian | Site | Medium | M per piece |
| 12 | Home page has no canonical (`?ref=` links would compete); `/cities` is titled «شهر شما» without the brand and with the site's general description; `/[country]/[city]/founding` has no canonical or description | curl | Low | S |
| 13 | Listing cards and the gallery's small photos have empty `alt` (fine for screen readers, since the title is next to them; the listing's main photo already carries the title). Event and business photos could carry the title or the business name too | curl, browser | Low | S |
| 14 | `/privacy/tr` is not in the `hreflang` set of `/privacy` and `/privacy/de` | Code | Low | S |
| 15 | Listing addresses with a wrong title part answer 200 with a canonical instead of redirecting to the right one. Correct for Google, but a 308 is cleaner for shared links | curl | Low | S |
| 16 | `og:locale` is `fa_IR` everywhere. Harmless for ranking; `fa` alone would describe the audience better | curl | Low | S |
| 17 | No IndexNow: Bing, Yandex, Seznam and Naver take new and removed URLs within minutes ([IndexNow](https://www.indexnow.org/)); Google doesn't use it. Bing also feeds ChatGPT search and DuckDuckGo | Code | Low | S |
| 18 | Staging blocks robots in `robots.txt` **and** sends `noindex`. A blocked URL can still appear as a bare address if someone links to it (Google never sees the noindex). Not urgent: nobody links to staging | curl | Low | — |

### Speed (Core Web Vitals)

Lighthouse is not installed on the server (and nothing was installed), so the numbers come from headless Chromium's own measurements (Playwright, fresh profile, signed out), run from this server in Helsinki. "Phone" = Pixel 7 screen, 4× slower processor, 1.6 Mbit/s and 150 ms extra delay, about what Lighthouse calls a slow phone. Google's "good" limits: LCP under 2.5 s, CLS under 0.1.

| Page | Computer: LCP / CLS | Phone: LCP / CLS | HTML (compressed) | JavaScript |
| --- | --- | --- | --- | --- |
| Home (production) | 0.60 s / 0.004 | 1.56 s / 0.002 | 17 KB | 228 KB |
| Berlin (production) | 0.82 s / 0 | 2.02 s / 0.019 | 23 KB | 230 KB |
| Berlin real estate (production) | 0.40 s / 0.001 | 1.49 s / 0.021 | 25 KB | 230 KB |
| Listing (production) | 0.30 s / 0 | **3.17 s** / 0.007 | 59 KB | 230 KB |
| Event (staging) | 0.58 s / 0 | 1.41 s / 0.003 | 31 KB | 529 KB |
| Help (production) | 0.29 s / 0 | 1.26 s / 0.001 | 18 KB | 224 KB |
| Business (staging) | 0.37 s / 0 | 1.63 s / 0.029 | 17 KB | 227 KB |

Server answers in about 0.1 s (Cloudflare's cache). Layout shift is near zero everywhere. Only the listing page on a slow phone is over 2.5 s: the main photo is the largest element and arrives late, although it is already loaded first with high priority; worth checking that phones get a phone-sized photo (step 5 of the plan). The event page loads about 300 KB more JavaScript than the others (worth a look when the street map is on, not an SEO blocker). After the browser runs the page there is one `<h1>` and one JSON-LD block, so Google's rendered view is clean; the duplicate in finding 2 is in the raw HTML. Real-user numbers will come from Search Console's Core Web Vitals report once there is traffic.

### How Googlebot sees the site

- **From the US** (where most crawling comes from): the home page as a US visitor (finding 1); every other page the same as anyone else, because nothing else depends on the visitor's country.
- **Iran:** only visitors from Iran are redirected (home → the first open city) and limited to reading and messaging; Googlebot never comes from Iran, so this is not the IP redirect Google warns against.
- **Signed out, no cookies:** Googlebot always is. Signed-out pages are the cached, public versions; test accounts' listings, events and businesses are hidden from them (and from the sitemap).
- **JavaScript:** not needed for content; everything is in the server's HTML (twice, see finding 2).

## 3. How Iranians abroad search, and who ranks

**No hard search volumes exist for these queries.** Google Trends refused automated reads from this server and keyword tools give no free numbers for Persian. What we measured instead: Google's autocomplete for Germany (`gl=de`; a suggestion proves people type it, not how many), and Wikipedia page views for the seasonal curve. Search Console will give real numbers from the first week after go-live.

### What people type (autocomplete, measured Nov 6, 2026)

- **Housing:** «اجاره خانه برلین», «اجاره خانه در برلین آلمان», «اجاره آپارتمان در برلین», «اجاره اتاق در برلین», «اجاره استودیو در برلین». The word is **اجاره** (rent), not «املاک» or «آگهی».
- **Work:** «کار در برلین», «کار دانشجویی در برلین», «کار جنرال در برلین», «جستجوی کار در برلین».
- **Doctors and services, the richest set:** «دکتر ایرانی برلین» + پوست، زنان، عمومی، ارتوپد، چشم، دندانپزشک، روانشناس، قلب. Also «وکیل ایرانی …» (Düsseldorf, Berlin, Stuttgart, Hamburg), «آرایشگاه ایرانی …», «سوپرمارکت ایرانی برلین», «رستوران ایرانی در برلین» (completed with restaurant names).
- **Community:** «ایرانیان برلین تلگرام», «گروه ایرانیان برلین», «انجمن ایرانیان برلین». People look for the Telegram groups: that is the habit Peydoo replaces.
- **Events:** «شب یلدا برلین», «جشن/پارتی شب یلدا برلین», «نوروز برلین», «جشن نوروز برلین», «نوروز ۱۴۰۵ برلین», «چهارشنبه سوری برلین», «کنسرت برلین» + singer (ابی، معین، شادمهر…).
- **Buy and sell:** «سایت خرید و فروش آلمان», «خرید و فروش ماشین در آلمان». «آگهی برلین» has **no** suggestions: low volume.
- **German and English:** «iranisches/persisches Restaurant Berlin», «persischer Supermarkt Berlin», «Frauenarzt/Zahnarzt persisch Berlin», «persisch sprechender Psychologe», «Nowruz Berlin 2026», «persian party Berlin», «Persian events Berlin».
- **Finglish** («ejare khane berlin»): no sign of use. Not worth targeting.
- Some people type Arabic letters («شب يلدا», «وكيل ايراني»), and autocomplete keeps them as separate queries. Peydoo's own search already normalizes both (`normalizePersian`); our pages should keep writing Persian ی/ک.

### When interest peaks (Wikipedia page views, 2024–25)

| Moment | Rise compared with a normal week | Peak |
| --- | --- | --- |
| Yalda (Dec 21) | 6× by mid-November, 18× late November, 62× in the week of Dec 9 | **202× in the week of Dec 16**, back to normal in January |
| Nowruz (Mar 20/21) | 5× mid-February, 10× early March | 31× (Persian) and 123× (German «Nouruz») in the week of Mar 17 |
| Chaharshanbe Suri | | 15× on the day itself |

A new page needs days to weeks to be crawled and longer to rank ([Google](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)). **For Yalda 2026 Google has to be let in by about Dec 1**; publishing event pages 8–10 weeks ahead is what organisers usually do, so this year is already late, and Nowruz 2027 pages should be up in early January.

### Who ranks today

| Site | What it is | Strength (judgment) |
| --- | --- | --- |
| [kojast.de](https://kojast.de) | Directory of Persian-speaking businesses in Germany, German with a Persian mirror (`hreflang`), city × category pages and guide posts; Berlin 235 entries, sitemap updated daily | **The main rival on "doctor / lawyer / restaurant + city".** No classifieds, no events |
| [nazdikia.com](https://nazdikia.com/directory/berlin/) | Worldwide Persian business directory, Persian with Latin slugs and JSON-LD; Berlin about 120–130 entries | Medium: good structure, thin entries |
| [berlinerhilfe.com](https://berlinerhilfe.com) | Persian classifieds for Berlin («برلینا هیلفه»), WordPress, Persian slugs | **The only direct rival, and small:** 53 ads in its sitemap (Oct–Nov 2026), 45 users |
| Telegram groups and channels | Where Berlin's ads really circulate today | The real competitor is habit, not a website |
| Divar, Sheypoor | Iran only | Shape what users expect («دیوار برلین») |
| Kleinanzeigen | Germany's classifieds, German only | Owns German buy and sell; Peydoo wins on Persian |
| Event sites (ra.co, Uber Music Hall, Humboldt Forum, HKW) | Single Persian events, German or English pages | **Nobody owns Yalda or Nowruz in Berlin in Persian** |

Google in Germany: about 85–88% of searches, Bing 6–9% (and Bing feeds DuckDuckGo) ([StatCounter](https://gs.statcounter.com/search-engine-market-share/all/germany)). Yandex is irrelevant for this audience.

### What works for classifieds sites (practice, with sources)

- **City × category pages are the heart.** Kleinanzeigen keeps category and city paths crawlable and blocks sorting, most filters, map view and paging past page 5 ([robots.txt](https://www.kleinanzeigen.de/robots.txt)); Gumtree blocks combinations of parameters ([robots.txt](https://www.gumtree.com/robots.txt)). Peydoo's noindex on filtered pages does the same job.
- **Thin city pages are the classic mistake.** Google's spam policy names city pages that funnel to one page; common practice is to index a city × category page only above a minimum number of live listings.
- **Expired ads:** 404 and 410 are equivalent for Google; a 200 "no longer available" page is a soft 404; redirecting many ads to one category page is also read as a soft 404 ([Google](https://developers.google.com/search/docs/crawling-indexing/http-network-errors), [Mueller](https://www.seroundtable.com/google-expired-page-redirects-404-22456.html)). Practice: keep the ad visible for a short while marked sold, then 410 with similar listings.
- **Crawl budget is not a concern** below a million pages ([Google](https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget)); an up-to-date sitemap is enough.
- **Structured data today:** Product snippets are for products (not rooms, jobs or services); merchant listings need a purchase on the site, so not Peydoo. Event markup needs a physical place and Google's event results list languages per country (Persian not among them), so expect understanding, not rich cards. Breadcrumbs and Organization/WebSite are still used. The sitelinks search box was retired in Nov 2024, vehicle listings in June 2025 ([Google](https://developers.google.com/search/blog/2025/06/simplifying-search-results)). JobPosting brings Google for Jobs, but only for real employer ads with an apply route and a strict end date; misuse brings manual actions.
- **User content:** Google suggests keeping posts from new, untrusted users out of the index until they prove themselves ([prevent abuse](https://developers.google.com/search/docs/monitor-debug/prevent-abuse)). Peydoo's review before publishing, phone verification and new-account limits already cover most of this.
- **AI search:** Google's AI answers need nothing extra beyond normal indexing ([Google](https://developers.google.com/search/docs/appearance/ai-features)). `llms.txt` is not used by any AI system (Mueller). ChatGPT search has its own crawler (OAI-SearchBot) and reportedly leans on Bing.
- **Google Business Profile:** only for businesses customers can visit or that travel to customers; an online marketplace is not eligible ([Google](https://support.google.com/business/answer/3038177)).

## 4. Strategy

### The idea in one paragraph

Win the **Persian** searches in Berlin that nobody owns well: rooms and flats («اجاره اتاق/خانه در برلین»), Persian-speaking doctors and services («دکتر ایرانی برلین»), work, and above all **Yalda and Nowruz events**. Do it with the pages Peydoo already has (city × category, listings, events, business pages), made to speak the searcher's words, plus a small set of hand-written pages for those moments. Don't chase German-language searches yet, don't mass-produce city pages, and let Telegram and partners bring the first visitors and links while Google learns the site.

### Decisions (from practice, with reasons)

| Question | Decision | Why |
| --- | --- | --- |
| Persian only, or German/English pages too? | **Persian only** at launch; look again at day 90 with Search Console data | All content is Persian; translated copies would be thin. The German queries (restaurant, doctor) are kojast's ground; Persian queries have almost no competition |
| `hreflang`? | Only on the legal pages (as now); no `fa-DE` variants | Google uses the page's visible language; one Persian version per address needs no `hreflang` ([Google](https://developers.google.com/search/docs/specialty/international/localized-versions)) |
| Persian or Latin addresses? | **Keep both as built:** Latin for browse (`/germany/berlin/real-estate`), the Persian title in listing addresses | Google accepts percent-encoded Persian ([URL structure](https://developers.google.com/search/docs/crawling-indexing/url-structure)) and Divar does the same; browse paths stay short to share. No change, no redirects to maintain |
| Which city × category pages go to Google? | **Every page with content** (owner, Nov 7, 2026): from the first live listing, plus every events page with upcoming events. Empty pages, filtered/sorted/paged copies and «به‌زودی» pages stay out | The owner wants every page with content in Google. Practice is 1–5; a one-ad page is still a real page, and Search Console will show if Google ignores many of them |
| Waitlist countries and cities? | `noindex, follow` until they open; into the sitemap the day they open | They are the same page with another name; indexing them invites the doorway label |
| Sold and expired listings? | Visible with «فروخته شد» / «منقضی شده» and similar listings, noindex, for **30 days**; then **410** with the same helpful body | Google treats 404/410 alike; 30 days lets buyers and the seller see what happened (Kleinanzeigen-style), then the address is cleanly gone |
| Product markup? | Only on goods (buy and sell). Rooms, flats, services, lessons and wanted ads: no Product; jobs: no JobPosting for now | Markup must match the page. JobPosting can follow once employer ads have an apply route and strict end dates |
| AI crawlers? | **Allow** (as the go-live `robots.txt` already does); no `llms.txt` | A new brand gains from being known to ChatGPT, Perplexity and Gemini; `llms.txt` is unused |
| Bing? | Bing Webmaster Tools (import from Search Console) + IndexNow | 6–9% of German searches, DuckDuckGo, likely ChatGPT search; 30 minutes of setup |
| Google Business Profile for Peydoo? | **No** | Not eligible (no place customers visit). Encourage Peydoo's businesses to keep theirs, linking to their Peydoo page |

### Before go-live (now → about Dec 1)

- Fix the High findings (home page for Googlebot, duplicate HTML, waitlist noindex) and the quick Medium ones (redirects, thresholds, structured data, sitemap). See "Build plan" steps 1–3.
- Word the pages for searchers: category × city titles, H1s and descriptions from the words people type (step 4). Examples: real estate in Berlin → «اجاره و خرید خانه و اتاق در برلین»; jobs → «کار در برلین: آگهی‌های استخدام ایرانیان»; services → «خدمات ایرانی در برلین: پزشک، وکیل، مترجم…».
- **Let Google in by about Dec 1** if the launch date allows, so the Yalda pages can rank before Dec 16 (the peak week).

### First 30 days after go-live

- Owner: Search Console (domain property), submit the sitemap, Bing import (section 6).
- **Yalda hub** `/germany/berlin/events` already exists; add a seasonal page «شب یلدا ۲۰۲۶ در برلین» (Latin "2026" in the title, ۱۴۰۵ in the text) listing every Yalda event in Berlin, with a short text on Yalda in Berlin. Same address every year (step 5).
- Ask the event organisers in `docs/research/berlin-contacts.md` (21 organisers, 16 venues) to post their Yalda events on Peydoo and link to their event page from Instagram and Telegram: every event is a page Google can show for «یلدا برلین».
- Founding businesses (79 doctors, 38 dentists, 13 lawyers among the contacts): each joined business gets a LocalBusiness page; ask them to link to it ("find us on Peydoo" badge).
- Telegram @peydooapp and Instagram post new events and featured listings with links: not Google links, but visits, brand searches and fast discovery.
- Watch weekly: pages indexed, "crawled – not indexed", impressions for «اجاره … برلین», «یلدا برلین», «دکتر ایرانی برلین».

### Days 31–90

- **Guides** (راهنما), hand-written in Persian, reviewed by a native speaker, each linking to the matching city × category pages: finding a room or flat in Berlin (and rental scams, with the safety page), Anmeldung, help with Jobcenter and Ausländerbehörde forms, finding a Persian-speaking doctor in Berlin, student jobs (Werkstudent, Minijob), Nowruz and Chaharshanbe Suri in Berlin. About 6–8 pages, one a week. No AI mass production: Google's helpful-content questions reward original, first-hand pages.
- **Nowruz 1406 hub** up by early January (interest rises from February, peaks the week of Mar 17).
- **Businesses by kind in Berlin** («پزشک و دندانپزشک فارسی‌زبان در برلین», «وکیل ایرانی در برلین», «رستوران ایرانی در برلین»): a page per kind once 5 or more businesses of that kind have joined. This is where kojast ranks; Peydoo's pages add listings, events and opening hours.
- Links: associations, student groups (FU, TU, HU), Persian radio and podcasts, a launch story in diaspora media and Berlin city magazines. No bought links, no link swaps.
- Day 90 review with Search Console data: which queries bring visitors, whether German pages for businesses and events are worth it, next city.

### Keywords for Berlin (priority judged from autocomplete)

| Priority | Persian | German / English |
| --- | --- | --- |
| High | اجاره خانه برلین · اجاره اتاق در برلین · اجاره آپارتمان در برلین · شب یلدا برلین · جشن یلدا برلین · نوروز برلین · جشن نوروز برلین · دکتر ایرانی برلین (+ زنان، دندانپزشک، پوست، روانشناس) · رستوران ایرانی برلین · کار در برلین · کار دانشجویی در برلین | — |
| Medium | ایرانیان برلین · گروه ایرانیان برلین · وکیل ایرانی برلین · آرایشگاه ایرانی برلین · سوپرمارکت ایرانی برلین · کنسرت ایرانی برلین · چهارشنبه سوری برلین · سایت خرید و فروش آلمان · خرید و فروش ماشین در آلمان | Nowruz Berlin · Persian events Berlin · persian party Berlin · persischer Supermarkt Berlin · Zahnarzt persisch Berlin |
| Low | آگهی برلین · سیزده بدر برلین · Finglish | iranisches Restaurant Berlin (kojast's ground) |

### What success looks like (judgment)

- 30 days after go-live: every open-city page and live listing indexed; first impressions for Persian Berlin queries.
- 90 days: Peydoo on page one for «یلدا برلین», «نوروز برلین» and at least one housing query («اجاره اتاق در برلین»); search brings a steady share of new visitors next to Telegram.

## 5. Build plan (approved Nov 7, 2026)

**Status (Nov 7, 2026).** The owner approved the plan with "every page with content" (section 4, decisions), verified `peydoo.com` in Search Console, and asked for a release to production with production kept `noindex` until they say go. Built:
- **1, home page:** the same for everyone; a visitor from a planned country gets the open country's home page with a strip on top, «پیدو به‌زودی در … — در فهرست انتظار بنویسید», linking to its «به‌زودی» page. Canonical `/`, Organization + WebSite JSON-LD.
- **2, the page once in the HTML:** the Suspense boundary in `NavFeedback` now wraps only the part that reads the query (`SearchWatch`), not the page.
- **3, housekeeping:**
  - `noindex, follow` on «به‌زودی» countries, waiting cities and their founding pages, and events pages without upcoming events.
  - City × category pages are indexed from the first listing (no threshold, the owner's choice).
  - Parameter clean-up answers 308.
  - Descriptions and canonicals for `/cities` and the founding pages.
  - `/privacy/tr` has no `hreflang` set: it is its own notice, not a translation.
  - Organiser and business logos have `alt` text.
  - Sitemap: a `site` file (home, help, safety, Pro, compare, legal pages) and active business pages in each country's file.
  - A wrong title part in a listing or event address isn't redirected: the token finds the page and the canonical names the right address.
- **4, words people type:** `messages.browse.seo` gives each top category a search title and description («اجاره و خرید خانه، آپارتمان و اتاق در برلین», «کار در برلین: آگهی‌های استخدام ایرانیان»…). Plain city and country pages are titled «آگهی‌های ایرانیان برلین: …». The headings on the pages keep the approved short names.
- **5, structured data:**
  - Product only for goods offered (`src/modules/listings/seo.ts`).
  - BreadcrumbList on listing, event and business pages.
  - Event images as 1200-wide 16:9, 4:3 and 1:1 crops.
  - The listing's main photo at 800 px on phones.
- **6, gone listings:** 404 (not 410: Google treats them alike, and Next.js can't send 410 from a page) 30 days after a listing is sold or expired, or an event's last date ended; the seller still sees it.
- **7, IndexNow:** built in the worker; it stays off until `SEARCH_INDEXING=on` and `INDEXNOW_KEY` are both set (docs/setup.md, "Go-live").
- **10, permanent redirects:** done Nov 7, 2026, after the owner gave the Cloudflare token Single Redirect › Edit: `www` and `http` → `https://peydoo.com` as 301 in one hop, the Let's Encrypt path left alone (docs/setup.md, "Cloudflare for production").
- **8, seasonal pages, and 9, businesses by kind:** not started; 8 is needed by about Dec 1 for Yalda.


Each step is built on staging, checked with curl and the headless browser (phone and computer), and reaches production with the next release. Nothing here changes what visitors see, except step 1 (the home page) and the wording in step 4.

| Step | What | Findings | Effort | When |
| --- | --- | --- | --- | --- |
| 1 | **Home page the same for everyone.** A visitor from a planned country (and Googlebot from the US) gets the normal home page, with a strip on top: «پیدو به‌زودی در آمریکا — در فهرست انتظار بنویسید» linking to that country's page. Changes the approved home-waitlist mockup, so it needs the owner's yes and a mockup check | 1 | S–M | Before go-live |
| 2 | **Each page once in the HTML.** Rework the loading wrapper (`NavFeedback`) so the server sends the page once and the smooth-loading behaviour stays; check `<h1>` and JSON-LD appear once and the HTML shrinks | 2 | S–M | Before go-live |
| 3 | **Thin pages and housekeeping:** `noindex, follow` on «به‌زودی» country and city pages; city × category indexed and in the sitemap from 3 listings; home page canonical; `/cities` and founding page titles, descriptions, canonicals; `/privacy/tr` in the `hreflang` set; event and business photos' `alt`; wrong listing title part → 308; parameter clean-up → 308 instead of 307; sitemap adds the home page, business pages, help, safety, pro and compare | 3, 4, 9, 12–15 | M | Before go-live |
| 4 | **Words people type:** a search title per top category (`seo_title` in the seed's Persian names: real estate → «اجاره و خرید خانه و اتاق»), used in category × city titles, H1 and descriptions; descriptions per category instead of one template | 10 | M | Before go-live |
| 5 | **Structured data:** Product only for goods; BreadcrumbList on listing, event and business pages; Organization + WebSite on the home page; event images in the sizes Google asks for (16:9, 4:3, 1:1); a phone-sized main photo on listing pages (phone LCP 3.2 s) | 7, 8, speed | S | Before go-live |
| 6 | **Expired and sold listings:** 30 days after a listing is sold, expires or is removed by its seller, the page answers **410** with the notice and similar listings; the sitemap drops it at once (already) | 6 | S–M | First weeks |
| 7 | **IndexNow:** the worker tells Bing and others when a listing or event is published, changed or gone (it already purges Cloudflare at those moments) | 17 | S | First weeks |
| 8 | **Seasonal and guide pages:** a simple, staff-written content page type (title, text, links to listings/events, «آخرین بروزرسانی»), first «شب یلدا ۲۰۲۶ در برلین», then the guides and Nowruz. Text drafted with the owner, reviewed by a native speaker | 11 | M (page type) + S per page | Yalda page by ~Dec 1 |
| 9 | **Businesses by kind per city** («پزشک فارسی‌زبان در برلین»), shown once 5 or more businesses of that kind joined | — | M | Days 31–90 |
| 10 | **Permanent redirects** `www` → apex and `http` → `https` as 301 with a Cloudflare Redirect Rule, leaving `/.well-known/acme-challenge/` alone (Cloudflare change: the owner's token, after approval) | 5 | S | Before go-live |

Steps 1–5 and 10 are about 4–6 working days together; 6–7 about 1–2; 8 is a day for the page type plus the writing; 9 later. Before any push: the deploy checks (`free -m`, load, `peydoo-docker-cleanup`, `df -h`).

Go-live itself stays as written in `docs/setup.md` ("Go-live" step 2 and 5); add there: after the switch, check `robots.txt`, one page per type for the missing `X-Robots-Tag`, `/sitemap.xml` and its files, and the Rich Results Test for a listing, an event and a business page.

## 6. What only the owner does

- **Decide:** approve the build plan (or parts of it); the home page change in step 1; and whether go-live can happen by about **Dec 1** so Google has time before Yalda.
- **Google Search Console** at go-live: add `peydoo.com` as a **domain property** (verified with a DNS TXT record in Cloudflare; Claude can add the record with the owner's go), submit `https://peydoo.com/sitemap.xml`, and give Claude read access if you want weekly reports (a Search Console user with "Restricted" permission).
- **Bing Webmaster Tools:** sign in, "Import from Google Search Console" (takes the site and sitemaps, no second verification).
- **No Google Business Profile for Peydoo** (not eligible). Optional: a Business Profile for your own businesses as usual.
- **Write or approve** the Yalda page text and the guides (or have the native speaker review drafts Claude writes).
- **Partners:** the first contacts from `docs/research/berlin-contacts.md` (organisers for Yalda events, associations, student groups, Persian radio) — a link from their site or channel to Peydoo is worth more than any code change.
- **Telegram and Instagram:** the @peydooapp channel posting new events and listings with links (the channel strategy decision in `docs/setup.md`, launch checklist).
