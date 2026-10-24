# Design options

Oct 24, 2026 · research only, no app changes. The owner chose direction B «صیقل‌خورده» (today's look) and asked for a second, usability-focused round; the final proposal below waits for five decisions, then a build plan for approval.

**Page with mockups and staging screenshots:** https://claude.ai/artifact/HqNDhAzv3SHSbbVCDmsQkQ (private until the owner shares it). The final proposal is on top; round 1 (three directions) is folded below it. The Oct 17 brand plan (https://claude.ai/artifact/TgjPF24NJujB7bQAYnz3AK) could not be opened from this session's account ("not found"); its decisions were taken from `docs/setup.md`, "Brand and design".

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
