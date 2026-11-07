# Business page: three designs and reviews (Nov 7, 2026)

The owner asked: "How can we make the business page more elegant? Do you have some ideas? Show your 3 top designs. Also, does it make sense to let people put comments on the business account (not their listing, just the business)?"

This is research and mockups only. No app code changed.

- **Mockups:** `docs/design-options/business-page/` (`a.html`, `b.html`, `c.html`, shared `bp.js` and `bp.css`).
- **Pictures:** `docs/design-options/business-page/shots/`.
- **Comparison page for the owner:** https://claude.ai/artifact/LVBEtUST4pivxyEnLEtXxP (side by side, open states, reviews).
- **Copies of every picture:** `/root/peydoo-media/wave2/business-page/` (`mockup/`, `staging/`, `today/`, `research/`).

"Judgment" marks a conclusion of ours, not a documented fact.

## 1. In short

- **Recommended design: A «ویترین»** (the storefront).
  - A photo cover, then the name with one line of facts.
  - One page that scrolls, with section links that stay at the top.
  - A contact bar fixed at the bottom on phones, and a contact card that stays beside the page on computers.
  - It takes the price list from C and the trust lines from B.
  - It works for every type of business. A business with no photos gets a patterned cover, not an empty band (see the "plain" pictures).
  - It is the closest to what Yelp, Google Maps, Etsy and Doctolib do.
- **Reviews: yes, as «پیشنهاد می‌کنم / نمی‌کنم» (recommend or not) plus a few words. No stars.**
  - Only people who had a real chat with the business on Peydoo can review.
- Every business, doctors and lawyers included (owner's decision, Nov 7).
  - The business can reply once, in public.
  - Anyone can report a review.
  - A short note next to the reviews says how we make sure they are real. German law (UWG §5b(3)) asks for this note.
  - Reviews show only once a page has 3 of them.
  - This is how Facebook (since 2018) and Kleinanzeigen (ratings only after a chat) work. The chat log answers the German courts' "this person was never my customer" test from our own records.
  - Effort: about 6–8 working days, including the legal texts and tests.

## 2. Today's page

Today's `/b/<slug>` page (code: `src/app/b/[slug]/page.tsx`; mockup: `docs/design-options/mockups/final/business-page.*`) has, from top to bottom:
- a cover gradient;
- a logo, then the name with the verified and founding badges;
- the tagline;
- chips: district, languages, member since, online, open now;
- message, call and route buttons;
- three tabs: listings, events and «دربارهٔ ما» (description, hours, contact, map);
- the Impressum, folded;
- a report link.

Pictures, signed out, with emails and phone numbers masked: `shots/today-parsian-{phone,computer}-{light,dark}.jpg`, `shots/today-parsian-about-phone-dark.jpg`, `shots/today-taskpilot-about-computer-dark.jpg`.

**What works:**
- The verified badge, the open-now chip and the languages are good trust signals.
- The Impressum fold is right.
- The structured data is right (LocalBusiness, hours).

**What makes it feel plain:**
1. **No real cover.** The gradient has no photo. In dark mode it turns into a flat, pale turquoise slab (computer, dark), the brightest thing on the page.
2. **The useful facts hide behind a tab.** Hours, address, map, Instagram and Telegram sit under «دربارهٔ ما». On the first screen a visitor sees badges and chips, but not *when* the business is open or *where* it is.
3. **No photos except listing photos**: no gallery of the food, the salon or the office.
4. **No services or prices.** Treatwell lists prices and durations, and Doctolib warns that profiles without fees lose patients. Our businesses can only say this through listings.
5. **Listings without photos turn into identical turquoise tiles.** Three in a row look like placeholders.
6. **When there is no pin, the map is an outline of Germany with a dot.** It says nothing about the street.
7. **Five chips on two lines** compete with each other. The follow button floats alone under the cover, away from the other buttons.
8. **"Message" exists only through a listing.** A business with no live listing has no message button at all.
9. **"Verified" doesn't say what was checked.** Yelp, Airbnb and kojast.de say what they checked and when.

## 3. What others do

Live pages were partly blocked to automated reading: Yelp, Etsy, Leboncoin and Doctolib's help returned 403. Three live pages were read in full: a Kleinanzeigen PRO shop, a kojast.de profile and the nazdikia home page. The rest comes from official help pages and press coverage. "(n.v.)" = not verified this session.

| Site | How the business page is built | What we take |
| --- | --- | --- |
| **Divar** («دیوار حرفه‌ای», since late 2024) | One page per business, mostly a list of its listings. A link to it on every listing it posts. No cover, hours or about found. ([zoomit](https://www.zoomit.ir/tech-iran/428232-divar-new-options-for-businesses), [digiato](https://digiato.com/iran-technology-news/professional-divar-panel-introduced)) | The link from every listing to the business page (we have it) |
| **Kleinanzeigen PRO** (read live) | Logo and name, **no cover**. Then trust facts: "TOP Zufriedenheit", "Aktiv seit 2016", "49 Anzeigen", "331 Follower", **"Antwortzeit unter 6h"**. Then Folgen and Teilen, address and short hours *before* the tabs. Tabs: Anzeigen / Über uns / **Rechtliche Angaben**. ([example shop](https://www.kleinanzeigen.de/pro/GLJ-Shop), [retail-news](https://retail-news.de/pro-funktionen-kleinanzeigen-update/)) | Response time; hours and address on the first screen |
| **Leboncoin Pro** «boutique» | Logo, description, contact block, SIRET (company number), hours and address. Banner on paid plans. ([guide](https://localbooster.fr/compte-pro/compte-pro-leboncoin-guide/)) | Legal details one tap away |
| **Facebook Pages** (2021) | Followers instead of likes. **One main button the business chooses** (message, book, call). The cover can be a slideshow or video. Intro text kept short. Since 2018 **"Recommend? Yes/No" instead of stars**. ([Meta](https://about.fb.com/news/2021/01/introducing-the-new-page-experience/), [BrightLocal](https://www.brightlocal.com/2018/08/22/facebook-switching-reviews-to-recommendations/)) | The main button per business type; recommendations instead of stars |
| **Instagram business** | Avatar with numbers, bio, link, then Follow / Message / Contact, then round **highlights** (Menu, Prices, Team), then pinned posts and the grid (4:5 tiles since Jan 2025). ([help](https://help.instagram.com/ipad-app/122793804938499)) | Highlights → design B |
| **Google Business Profile** | Photo strip, name, rating, category, **"Open · closes 22:00"** that unfolds to the week. **Round icon buttons**: route, call, save, share. Tabs: Overview / Menu / Reviews / About. Attributes (wheelchair, delivery). Q&A was removed in late 2025. ([help](https://support.google.com/business/answer/3039617)) | Open-now line, round buttons, attributes → A and C |
| **Yelp** | **Big photos at the top** (up to 6), then essential facts, then review highlights. "Claimed" and **"Verified License"** badges. "Responds in about X hours". A sticky side card on computers. ([Search Engine Land](https://searchengineland.com/yelp-supersizes-profiles-makes-less-busy-184075)) | Photos first → C; sticky side card → A, C |
| **Airbnb host** (2023) | A "passport" card with numbers beside the photo. **Short facts with an icon each** (languages, work, where they live). **"Identity verified" with the month.** ([help](https://www.airbnb.com/help/article/3386)) | Icon facts, "verified in month X" → B, and A's trust box |
| **Etsy shop** | **One scrolling page**: banner, icon and name, listings in sections, announcement, reviews, about, policies. Star Seller badge at the top. ([seller handbook](https://www.etsy.com/seller-handbook/article/your-shop-home-in-a-brand-new-design/39964431073)) | One scroll → A |
| **Doctolib** | **Booking first**, with a fixed button on phones. Then essentials, map, hours, **languages spoken**, services and **fees**. **No patient reviews** (France: the medical ethics code). ([profile guide PDF](https://media.doctolib.com/image/upload/mkg/file/fiche_pratique_profil_doctolib_medecin.pdf)) | Fixed contact bar; no reviews for doctors |
| **Treatwell** | Gallery, name, rating, address and today's hours. **Service rows with price ("from £X") and duration**, popular services first. Team cards. Reviews marked verified. ([example](https://www.treatwell.co.uk/place/sali-beauty-aesthetic/)) | Services with prices → A and C |
| **kojast.de** (Iranian directory, read live) | Name, a descriptive subtitle, **"Zuletzt geprüft: Oktober 2026"** (last checked). Route / Anrufen / Website, open now, **languages "Deutsch, Persisch, Dari"**, services as tags, nearby stops. Tabs: Beschreibung / Öffnungszeiten / Route / Kommentare / FAQ. No real cover or logo. ([example](https://www.kojast.de/service/brandenburg/potsdam/beauty-wellness/mahsa-hair-beauty/)) | "Last checked", nearby stop, languages up top |
| **nazdikia.com** | A directory of Iranian businesses abroad (Toronto, London, Dubai, Hamburg). Listings are reviewed before they go live. No business page could be reached. | — |

### Patterns that make a small business page feel trustworthy and elegant

1. **A real photo at the top**, with a pattern when there is none. Kleinanzeigen has no cover and looks the most dated.
2. **Name, then one line of facts:** type · district · open now · recommendations (Google, Treatwell, kojast).
3. **Verification that says what was checked and when** ("documents seen, Nov 2026"), not just a tick (Yelp, Airbnb, kojast).
4. **A fixed contact bar on phones** with 2–3 buttons, the main one first (Doctolib, Treatwell).
5. **Open now, unfolding to the week**, and special days (Google).
6. **Services or menu with prices** (Treatwell, Doctolib).
7. **Response time and activity:** "answers within 1 hour", member since, followers (Kleinanzeigen).
8. **Languages spoken, on the first screen.** For the diaspora this is often *the* reason to choose (Airbnb, Doctolib, kojast).
9. **A recommendations summary near the top**, with the full reviews lower down and marked as coming from real customers.
10. **A calm about section**: short text, facts with icons (vegetarian, delivery, wheelchair, card payment), then the Impressum.

**What matters most, by type** (judgment, from the sites above):
- **Restaurant:** photo cover and gallery, open now, menu with prices, call and route, recommendations, attributes.
- **Doctor or therapist:** call or message first, languages, specialties, Kasse/privat, address and accessibility, hours, verified licence. **No reviews** (section 7).
- **Salon:** services with prices and durations, before-and-after photos, team, recommendations, a "message to book" button.
- **Lawyer or sworn translator:** the licence or register clearly verified, languages, practice areas, "answers within X h", a first-consultation or per-page price, Impressum. Photos matter less, so the patterned cover must look good.
- **Event organiser:** upcoming events first, past events as photos, follow, number of events held.

## 4. The three designs

Every design uses the same invented restaurant, «سفرهٔ نیلوفر» in Schöneberg:
- menu with prices, 6 food photos, 2 events and 4 listings;
- recommendations from invented people with first name and initial, and an invented address and number.

Photos are from Wikimedia Commons; credits are in `docs/design-options/business-page/img/CREDITS.md`. No photo shows a person.

Each picture comes at phone (390 px) and computer (1280 px) width, in light and dark. File names follow `shots/<design>[-<state>]-<phone|computer>-<light|dark>.jpg` (first screen). The whole page is `…-full.jpg` for `a`, `a-plain`, `b` and `c`.

### A «ویترین»: photo cover, one scroll, sticky contact bar (recommended)

`shots/a-*.jpg`, `shots/a-plain-*.jpg` (a sworn translator with no photos), `a-contact-*`, `a-gallery-*`, `a-rec-*`

**Phone, top to bottom:**
1. **Cover photo** with share and save buttons, and «۱۲ عکس» to open the gallery.
2. **Logo** overlapping the cover.
3. **Name** with the verified and founding badges, and the tagline.
4. **One line of facts:** «باز است، تا ۲۲:۰۰» (open, until 22:00) · district · «۹۶٪ پیشنهاد» (96% recommend), then languages · «جواب در کمتر از ۱ ساعت» (answers within 1 hour).
5. **Four round buttons** (Google-style): follow, route, Instagram (or website), send.
6. **Section links that stay at the top:** about · menu · photos · events · listings · reviews · hours and address. They jump down the page; they are not tabs, so nothing is hidden.
7. **Sections in order:**
   - **About:** 3 lines, facts with icons, and a box that says what was verified and when.
   - **Menu or price list:** the most popular items first, then «همهٔ منو (۲۴)» (full menu, 24).
   - **Photos:** 4:5 tiles, with «+۸» on the last.
   - **Upcoming events.**
   - **Listings:** a swipe row.
   - **Recommendations.**
   - **Hours, address with map, contact links.**
   - **Impressum and report.**
8. **Fixed bottom bar:** «پیام» (message), with «جواب در کمتر از ۱ ساعت» under it, plus «تماس» (call) and «⋯». The ⋯ opens the **contact sheet**: Peydoo chat first («شمارهٔ شما دیده نمی‌شود», your number stays hidden), then phone, WhatsApp, Telegram, Instagram, website and email.

**Computer:** the cover is 1104×288 with rounded corners. Below it are two columns:
- **Content column:** the same sections.
- **Side card, sticky on the left:**
  - open now and today's hours;
  - message, call and route buttons;
  - response time;
  - follow (with the number of followers);
  - the week's hours;
  - map, address and links.

**No photos** (`a-plain-*`): the cover becomes a deep turquoise khatam pattern with a saffron dot, and it stays deep in dark mode. The logo becomes the initial. Sections without content (photos, events) disappear from the page and from the section links. The price list leads.

**Open states:**
- contact sheet (`a-contact-*`);
- photo viewer: black, «۲ از ۱۲», caption, thumbnails, arrows on computers (`a-gallery-*`);
- writing a recommendation (`a-rec-*`).

**Pros:**
- Everything is on one page, so hours and address are no longer behind a tab.
- The cover makes the page look like a brand.
- It works for every type, with or without photos.
- The bottom bar matches our listing page.
- Closest to Yelp, Google, Etsy and Doctolib.

**Cons:**
- A long page on phones; the section links solve most of that.
- Needs a good cover photo to shine (the pattern is the fallback).

### B «کارت پروفایل»: profile card with tabs (Instagram, Airbnb, Doctolib)

`shots/b-*.jpg`, `b-about-*` («دربارهٔ ما» tab), `b-recs-*` (reviews tab), `b-story-*` (a highlight open)

**Phone, top to bottom:**
1. **No cover.** A soft turquoise wash behind a profile card.
2. **Logo inside a saffron-to-turquoise ring**, with three numbers beside it: listings · events · followers.
3. **Name, type and district, tagline.**
4. **Five trust lines with icons:** open now · 96% recommend (26) · languages · response time · "business registration seen, Nov 2026".
5. **Buttons:** message · follow · call, then round link buttons (Instagram, Telegram, WhatsApp, website, route).
6. **Round "highlights":** photo albums the business picks, such as منو، کباب‌ها، کترینگ، یلدا (menu, kebabs, catering, Yalda). They open full screen like a story, with a «پیام برای سفارش» (message to order) button.
7. **Sticky tabs:**
   - **همه** (all): pinned event, listings, photo grid;
   - **listings**;
   - **events**;
   - **reviews**;
   - **about**: text, facts, hours, map with nearest stop, menu highlights, Impressum.
8. The normal bottom navigation stays.

**Computer:** the profile card sits on the right (the start side) and stays put. Highlights, tabs and content fill the rest.

**Pros:**
- Familiar to everyone who uses Instagram, which is how most Persian small businesses present themselves today.
- Compact.
- The numbers and trust lines are very visible.
- Good for event organisers and salons.

**Cons:**
- Hours, map and price list hide behind a tab again: the main weakness of today's page.
- The highlights need the business to curate albums, and most won't.
- It looks less like a "real place" than a cover photo does.
- Without photos the highlights row disappears and the page looks empty.

### C «کاتالوگ»: photos and price list first (Airbnb, Yelp, Treatwell, Google panel)

`shots/c-*.jpg`, `c-hours-*` (hours unfolded), `c-gallery-*`

**Phone, top to bottom:**
1. **Swipe gallery** (1 / 12, dots).
2. **Small logo, type and district, name and badges**, recommendations · followers, tagline.
3. **A facts card in Google Maps style.** Each row has an icon and an action:
   - open now with «ساعت‌ها» (hours), which unfolds the week and special days;
   - address with the nearest stop and «مسیر» (route);
   - phone with «تماس» (call);
   - languages;
   - response time;
   - Instagram, Telegram, WhatsApp and website;
   - verification.
4. Call, route and follow buttons.
5. **Menu or price list by group**, with category chips that stay at the top while scrolling: popular, kebab, stew, starters, catering. Item, description, price and a photo on the side (Wolt/Treatwell).
6. Photo grid, events, listings, recommendations, about, Impressum.
7. **Bottom bar:** «پیام برای رزرو یا سفارش» (message to book or order) and call.

**Computer:**
- an **Airbnb-style 1+4 photo mosaic** with «همهٔ ۱۲ عکس» (all 12 photos);
- below it, two columns: menu and the rest, and a sticky side card with the main button, call, follow, the facts rows and the map.

**Pros:**
- The most "shop-like."
- Best for restaurants and salons with good photos and a long price list.
- The facts card answers every practical question at once.

**Cons:**
- **It falls apart without photos.** The mosaic needs at least 5, and most translators, lawyers and doctors have none. It would need a second layout for them.
- The most work for the business: photos, price groups, item photos.
- The most work to build.

### Effort to build (judgment, working days of one session, including tests and the mockup check)

| | A | B | C |
| --- | --- | --- | --- |
| Cover photo (upload, crop 4:1 / 2.4:1, dark-safe pattern fallback) | 1 | – | – |
| Photo gallery (up to 12, order, captions, viewer) | 1.5 | 1.5 | 1.5 + mosaic 0.5 |
| Highlights (albums, story viewer) | – | 2 | – |
| Services or menu with prices (groups, optional photo, "popular"), editor and page | 1.5 | 0.5 (about tab only) | 2 |
| Page layout: section links / tabs, sticky bar or side card, plain fallback | 1.5 | 1 | 2 |
| Business chat (message the business without a listing), contact sheet, WhatsApp link | 1 | 1 | 1 |
| Response time (median first reply, last 30 days), "verified: what and when" | 0.5 | 0.5 | 0.5 |
| **Total** | **≈ 7** | **≈ 6.5** | **≈ 7.5** |

### What the business owner fills in

**Already asked today:** name, type, logo, tagline, description, address (and pin), hours, phone, email, website, Instagram, Telegram, languages, online service, legal details.

**New, all optional:**
- **Cover photo.** One wide photo: the dining room, the food, the salon chair, the office sign. Without one, the pattern is used.
- **Photos.** Up to 12, with an optional short caption each. On Pro the limit could be higher.
- **Services or menu.** Group (optional), name, one line, price («از ۳۵ €», "from €35", allowed), optional photo, and a "popular" switch. It is a single list in the dashboard («خدمات و قیمت‌ها», services and prices), with a ready template per type: menu for restaurants, services and durations for salons, a price list for translators.
- **WhatsApp number.** It may be the same as the phone. It is not shown to visitors from Iran ([Iran access rule](../design-options.md)).
- **Facts** (tick boxes per type): vegetarian, takeaway, delivery, table booking, wheelchair access, card payment; for doctors Kasse/privat, for translators beeidigt.
- **Special days** (closed 24–25 Dec, Nowruz hours).
- **Main button** (later): message / call / booking link, as on Facebook and Instagram.

**Computed, nothing to fill in:** open now, response time, followers, recommendations, member since, verified date, nearest stop (later, from OpenStreetMap stops if wanted).

## 5. Recommendation: A

1. **It fixes the biggest problem of today's page.** The answers people come for (when, where, how much, how to reach them) are on the first two screens, not behind a tab. B keeps the tab problem, and C solves it only for businesses with many photos.
2. **It works for every founding business.** Restaurants get the photo cover. Doctors, lawyers and translators get the dark-safe pattern and a price list, and still look finished (`a-plain-*`). C needs 5+ photos, and B needs curated albums.
3. **It is what people already know.** Its pieces come from Yelp, Google Maps, Etsy and Doctolib: photo top, facts line, sticky contact, one scroll, side card on computers.
4. **It stays in our style.** It uses the same cards, buttons, turquoise and saffron, and the same bottom bar as the listing page, so nothing new needs to be learned.
5. **It is not the most expensive.** About 7 days, close to B. Each part (cover, gallery, price list) is useful on its own, and they can ship one by one.

**Taken from the others into A:** C's price list with groups and the unfolding hours row, and B's "what was verified and when" line (already in the drawings).

**Order to build A (if approved):**
1. Layout with section links, sticky bar and side card, the plain fallback, the contact sheet, and the verified line.
2. Cover photo.
3. Services and prices.
4. Gallery.
5. Business chat and response time.

Then the reviews (section 7), if approved.

### Owner's feedback (Nov 7, 2026)

The owner prefers **B «کارت پروفایل»** ("Instagram style, shows how many people follow and how many listings they have") and asked to see the three side by side before deciding; the comparison page has a side-by-side section for that. If B is chosen, its main weakness gets fixed: the address and today's hours go into the card itself, the «همه» tab starts with the menu or price list, and a business without highlights gets an automatic «عکس‌ها» highlight from its photos.

### Owner's decision (Nov 7, 2026, after the side-by-side check): A «ویترین»

"ویترین is better", with **followers visible**. A now has an Instagram-style row of numbers under the facts line: **followers · listings · events** (reviews in place of events when a business has none). Pictures: `shots/a-*.jpg` (renewed).

### How a business adds its menu or prices («منو و قیمت‌ها»)

A new card in the business panel opens `m.html`. The steps, each drawn at phone and computer width, light and dark (`shots/m-<state>-*.jpg`):

| Step | State | What happens |
| --- | --- | --- |
| 1 | `panel` | A saffron «منو و قیمت‌ها» card, marked «تازه» (new), at the top of the business panel |
| 2 | `empty` | First visit: «هنوز منویی ندارید» (you have no menu yet), with two ways in: **from a photo of the menu** or **by hand** |
| 3 | `kind` | The list type, preset from the business type and changeable: restaurant menu · services with duration · price list · services without prices |
| 4 | `photo` | Photograph the paper menu or price board (several pages possible). AI reads the rows and groups: «۶ ردیف در ۳ گروه» (6 rows in 3 groups) |
| 5 | `review` | The draft. Rows whose price wasn't readable are yellow with «قیمت؟» (price?). Nothing is public until «انتشار در صفحه» (publish to page) |
| 6 | (none) | The list: groups, rows with photo, name, one line and price. A **star** marks «پرطرفدار» (popular), and up to 5 starred rows lead on the page. Saved as you go |
| 7 | `add` | Add one item: photo (optional), name, one line, price (with «از», "from"), group, popular |
| 8 | `drag` | Reorder by dragging, also into another group |
| 9 | `a.html?state=menu` | On the public page: «پرطرفدارهای منو» (popular items) and «همهٔ منو (۲۴)» (full menu, 24) |
| 10 | `a.html?state=fullmenu` | The whole menu, with group chips |

**Other businesses** (`t.html`, `shots/t-*.jpg`): the same list for everyone; the title, columns and template change with the business type.
- **Salon:** «خدمات و قیمت‌ها» (services and prices), with duration and price.
- **Translator:** a price list.
- **Doctor:** «خدمات» (services) with insurance chips (Kasse, private, none); prices optional.
- **Lawyer:** «زمینه‌ها و مشاوره» (practice areas and consultation), with areas as chips and a first-consultation price.
- **Event organiser:** no such section; «رویدادهای پیش رو» (upcoming events) leads instead.

An empty list hides the section on the page.

**Effort** (part of A's ≈ 7 days): reading a menu from a photo adds about 1 day. It uses the AI already used for pre-screening; the owner reviews every row before publishing.

**Video guide:** `/root/peydoo-media/wave2/business-page/video-menu-guide/` holds the numbered pictures (`phone-light/`, `phone-dark/`, `computer-light/`, `computer-dark/`), `steps.md` (Persian steps) and `VIDEO-GUIDE.md` (the brief for the video session). It is not in Git.

## 6. Comments/reviews: practice

| Site | Who may review | Format | Business reply | Notes |
| --- | --- | --- | --- | --- |
| Google Business Profile | Anyone with a Google account, no customer check | 1–5 stars + text | Yes, public | Removed only for policy breaches (fake, off-topic, conflict of interest), never just for being negative |
| Trustpilot | Anyone; "Verified" label when invited or the contact is confirmed | Stars + text | Yes | Every review screened by software. In Germany a whole legal industry deletes reviews where the reviewer can't prove contact ([rosepartner](https://www.rosepartner.de/trustpilot-bewertung-loeschen-anwalt.html)) |
| Yelp | Anyone; software hides "not recommended" reviews | Stars + text | Yes | Staff can't override the software ([widewail](https://www.widewail.com/blog/what-are-yelp-not-currently-recommended-reviews)) |
| **Kleinanzeigen** | **Only after both sides wrote in the in-app chat** (button after ~24 h, for 30 days) | 3 smileys; text only for a bad rating, seen only by Kleinanzeigen | – | Anonymous; badges like "besonders freundlich" ([GIGA](https://www.giga.de/apps/ebay-kleinanzeigen/tipps/ebay-kleinanzeigen-nutzer-bewerten-so-funktioniert-es/)). 5 stars with text announced in 2024 ([mobiflip](https://www.mobiflip.de/shortnews/das-neue-kleinanzeigen-kommt-auch-freitext-bewertungen-werden-moeglich/), n.v. live) |
| Airbnb | Only after a stay, within 14 days | Stars + text | Yes | Double-blind |
| Etsy | Only buyers, within 100 days | Stars + text | Yes | Reviews can't be deleted |
| **Facebook Pages** | Anyone | **Recommend yes/no + text and tags** (stars dropped in 2018) | Yes | Old 1–2★ became "not recommended", 4–5★ "recommended" |
| **Doctolib** | – | **No reviews** | – | France: the medical ethics code forbids rating doctors ([CNOM](https://www.conseil-national.medecin.fr/print/2043)) |
| Jameda (doctors, DE) | Anyone | Grades + text | Yes | Doctors must accept being reviewed. The BGH (Federal Court of Justice) let a doctor delete her profile because Jameda showed paying rivals' ads on it (VI ZR 30/17, 2018) |
| Divar | No public seller reviews found (n.v.) | – | – | – |
| kojast.de | Comments tab, plus the Google rating shown | – | – | – |

## 7. Comments/reviews: the law

- **UWG §5b(3) (since 28 May 2022, from the EU Omnibus directive 2019/2161).**
  - A business that shows consumer reviews must say **whether and how** it makes sure they come from people who really used the service. It is a duty to *inform*, not to verify.
  - A link in the terms is not enough (LG Berlin, Apple App Store), so the note goes **next to the reviews**.
  - Whether it applies to a portal hosting reviews of *other* businesses is disputed ([omsels](https://www.omsels.info/die-verbote-oder-was-darf-ich-nicht/%C2%A7%C2%A7-5a-5b-uwg-informationspflichten/%C2%A7-5a-abs-1-uwg-wesentliche-informationspflichten/verbraucherbewertungen-%C2%A7-5b-abs-3-uwg)). We add the note anyway: it is one paragraph.
  - ([law](https://www.gesetze-im-internet.de/uwg_2004/__5b.html))
- **UWG Annex 23b and 23c (always banned):**
  - claiming reviews come from real customers without reasonable checks;
  - fake or commissioned reviews;
  - hiding negative reviews.
  - So **«بعد از گفتگو در پیدو» (after a chat on Peydoo) may be shown only because the chat gate really exists.** No business may write or buy its own reviews.
  - Fines up to 4% of turnover apply only in EU-wide (CPC) enforcement. The practical risk for us is warning letters (Abmahnungen) from competitors or consumer associations ([§19](https://www.gesetze-im-internet.de/uwg_2004/__19.html)).
- **DSA (EU Digital Services Act).**
  - These apply to us: a report button with reasons (Art. 16), and a reason sent to the author when we remove a review (Art. 17).
  - Micro and small companies are exempt from the internal complaint system, trusted flaggers and so on (Art. 19 → Art. 20–23) ([springlex](https://www.springlex.eu/en/packages/dsa/dsa-regulation/article-19/)). We offer a simple "ask again" anyway.
- **Host liability and defamation (German case law).**
  - No duty to check reviews before publishing. Liability starts only after a notice that we fail to handle (BGH I ZR 94/13, 2015).
  - After a complaint, we must:
    1. forward it to the reviewer;
    2. ask them to describe the contact and give proof;
    3. pass the proof on to the business, with the reviewer's identity hidden;
    4. otherwise delete the review.

    (BGH VI ZR 34/15, Jameda 2016.)
  - **A bare "this person was never our customer" is enough to start this.** If we can't show the contact, the review must go (BGH VI ZR 1244/20, 2022) ([LTO](https://www.lto.de/recht/nachrichten/n/bgh-vi-zr1244-20-online-bewertung-hotel-darlegungslast-kontakt-kunden-gaeste)).
  - **Our chat gate answers this from our own log** (a chat exists, with its date and listing), without chasing the reviewer. This is the biggest workload saver.
  - **Opinions are protected:** "rude", "too expensive", "not recommended". False facts must be removed once disputed and not proven ("they never delivered", "unlicensed"), and so must pure insults (Schmähkritik).
  - Rule of thumb for moderation: **opinions need contact, facts need proof.**
- **Privacy and names.** Show first name and initial. Pseudonymous use is protected (§19 TDDDG), and a reviewed doctor has no right to the reviewer's identity (BGH VI ZR 345/13). The privacy policy names legitimate interest. The business never sees chat contents through the review process.
- **Doctors and health (HWG §11, confidentiality).** Hosting neutral user reviews is not the doctor's advertising. But a doctor's public reply can break medical confidentiality, and Doctolib keeps reviews out entirely. We suggested leaving health and legal professions out at launch; **the owner decided to include them** (section 8, rule 9, with the extra safeguards there).
- **Neutrality (Jameda 2018).** Paid plans never change which reviews show or in what order, and a business page never shows rivals' ads.
- **Turkey** (for later): reviews only from real buyers, negatives must be published ([Dünya](https://www.dunya.com/ekonomi/ticaret-bakanligi-acikladi-sahte-yorumlara-yaptirim-uygulanacak-haberi-842114)). The chat gate is the minimum and already fits.
- **US** (for later): the FTC fake-review rule (from 21 Oct 2024) bans fake, bought and suppressed reviews ([Federal Register](https://www.govinfo.gov/content/pkg/FR-2024-08-22/html/2024-18519.htm)).

## 8. Reviews: recommendation and build

**Options weighed:**

| Option | For | Against |
| --- | --- | --- |
| (a) No reviews | No risk, no work | No trust signal. People go to Google reviews, which have no customer check |
| **(b) Recommend yes/no + tags + a few words, chat-gated** | Facebook's and Kleinanzeigen's model. Fewer emotional one-star fights and fewer factual claims, so fewer disputes. "After a chat on Peydoo" is honest. The chat log answers BGH 2022. One bad review doesn't sink a new business the way one 1★ does | Less detail than stars. Needs a chat with the business, not only with a listing |
| (c) Stars + text, chat-gated | Most familiar (Google) | One 1★ ruins a new business; a single 5.0 looks fake. More factual claims and disputes. More work for a solo moderator, and more angry emails both ways ([always notify](../design-options.md)) |
| (d) Stars only | Little to moderate | Opaque, nothing to reply to. Same legal duties as (c), less value |

**Recommendation: (b).** It is drawn in all three designs and marked «پیشنهاد: اگر تأیید شود» (proposal, if approved).

**Rules:**
1. **Who may review:** a signed-in user with a verified number who had a chat with the business in which **both sides wrote**. The button appears after 24 hours and stays open for 90 days. One review per person per business, editable.
2. **Format:** yes or no; up to 3 tags per type («غذای خوشمزه، برخورد خوب، قیمت منصفانه، سر وقت، جواب سریع», tasty food, friendly, fair price, on time, fast reply); up to 500 characters of text (optional).
3. **On the page:** «۹۶٪ پیشنهاد می‌کنند» (96% recommend), «۲۵ نفر از ۲۶ نفر» (25 of 26), tag counts and the latest reviews. **Shown only from 3 reviews.** Before that, nothing; never "0 reviews".
4. **The honesty note** next to the reviews (UWG §5b(3)): «فقط کسانی که در پیدو با این کسب‌وکار گفتگو کرده‌اند می‌توانند نظر بدهند. نظرهای مثبت و منفی هر دو منتشر می‌شوند و کسب‌وکار نمی‌تواند برای حذف آن‌ها پول بدهد.» (Only people who chatted with this business on Peydoo can review. Positive and negative reviews are both published, and the business can't pay to remove them.) It links to a help page.
5. **Business reply:** one public reply per review, editable. The business is told about each new review by email and Telegram.
6. **Report:** a button on each review, for the business and for everyone. Reasons: not a customer, false fact, insult, personal data, spam.
7. **Moderation:**
   - AI pre-screens every review for insults, personal data, threats and health details.
   - Anything flagged is held for the moderator.
   - A reported review stays up unless it is clearly against the rules.
8. **Dispute flow:**
   - **"Not a customer":** we check our own chat log and answer «گفتگو در تاریخ … ثبت شده» (a chat was recorded on …), without names.
   - **A disputed fact:** the reviewer has 14 days to give proof, which we pass on with their identity hidden. Without proof, the review is removed.
   - Both sides are told why (DSA Art. 17). Everything goes into the audit log.
9. **Every business, doctors and lawyers included** (owner's decision, Nov 7, 2026: "I want comments for every business including doctors and lawyers"; we had suggested leaving them out at launch). Two extra safeguards for health and legal professions: when they reply, a reminder says not to mention the person's illness or case (professional secrecy, §203 StGB), and the AI pre-screen holds reviews and replies that contain health or case details for the moderator. Businesses in Turkey wait until KVKK (Turkey's data protection law) is done.
10. **Never:** businesses reviewing themselves or rivals, rewards for reviews, asking only happy customers, or paid plans changing the order of reviews.

**What it needs underneath:** a **business chat** that isn't tied to a listing. The designs need this for the message button anyway. Today every chat belongs to a listing (wave 1, like Kleinanzeigen). Chats about any of the business's listings count too.

**Effort: about 6–8 working days.**
- Data, gate, write and edit: 1.5 days.
- Page block and the 3-review threshold: 1 day.
- Reply and notices: 1 day.
- Report and moderation queue with AI pre-screen: 1.5 days.
- Dispute flow, statements of reasons and audit: 1.5 days.
- Help page, notice and privacy text: 0.5 day.
- Tests for permissions and moderation: included.

The business chat is extra if it is not built for the design first.

## 9. Mockup sources

- **Pages:** `a.html`, `b.html` and `c.html` in `docs/design-options/business-page/`, plus `m.html` (the menu editor) and `t.html` (the menu for each business type). They load the approved wave 1 parts from `../mockups/` (`icons.js`, `common.js`, `final/theme.js`, `final/ui.js`, `final/dark.css`), the app's own Vazirmatn font from `src/app/fonts/`, and Tailwind's play CDN.
- **Query options:** `?dark`, and `?state=` with:
  - A: `plain`, `contact`, `gallery`, `rec`;
  - B: `about`, `recs`, `story`;
  - C: `hours`, `gallery`;
  - A also: `menu`, `fullmenu`;
  - m: `panel`, `empty`, `kind`, `photo`, `review`, `add`, `drag`.
- **Render:** `render.mjs` (in the same folder).
  1. Start the container: `docker run -d --name bp-pw -v fa-pw:/pw -e PLAYWRIGHT_BROWSERS_PATH=/pw/browsers -v /root/peydoo-media/wave2/business-page:/m -v /root/classifieds:/repo:ro mcr.microsoft.com/playwright:v1.56.1-noble sleep infinity`
  2. Render: `docker exec -e FULL=1 bp-pw node /repo/docs/design-options/business-page/render.mjs a 'a?state=contact' …`
  3. Remove the container and the image afterwards.
- **Today's page:** shot with `/root/peydoo-media/wave2/business-page/scripts/staging.mjs`, signed out, with emails and phone numbers replaced before each shot.
