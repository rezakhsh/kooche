# Research 5: dark mode, country waitlists and opening rules, founding-Pro placement

Peydoo · 2026-10-25 · web research only, no code changes. Background: `docs/design-options.md` (Round 4) and `docs/strategy.md` (gates). Legal points are background, **not legal advice**; a UWG/IT lawyer should check them. (1src) marks a claim with only one source. (2nd) marks a claim found only in secondary write-ups, not the primary source.

---

## A. Dark mode or light mode?

### Evidence

**Reading performance favours light mode (dark text on a light background).**
- Piepenbrock, Mayr, Mund & Buchner (2013, *Ergonomics*): light mode was better on visual-acuity and proofreading tasks for both younger and older adults. Older adults gained less from it ([catalogue record](https://documentacion.fundacionmapfre.org/documentacion/bib/143702.do), [NN/g summary](https://www.nngroup.com/articles/dark-mode/)).
- Piepenbrock, Mayr & Buchner (2013, *Human Factors*): the light-mode advantage grows as the font gets smaller. Participants did not *feel* any difference ([NN/g](https://www.nngroup.com/articles/dark-mode/)).
- Piepenbrock et al. (2014, *Ergonomics* 57(11)): light mode gave smaller pupils and better proofreading. This supports the "more light gives a sharper retinal image" explanation ([record](https://documentacion.fundacionmapfre.org/documentacion/publico/en/bib/150136.do)).
- Buchner & Baumgartner (2007, *Ergonomics* 50(7), DOI 10.1080/00140130701306413): the polarity effect holds whatever the room lighting or colour contrast (title-level evidence only, [citation](https://ouci.dntb.gov.ua/works/73o6PyQ7)).
- Listing pages are exactly the task these studies measured: small text such as prices, deposit amounts, addresses and dates, read for detail.

**Exceptions.**
- People with cloudy ocular media, such as cataracts, read faster in dark mode (Legge 1985). Some low-vision users prefer it ([NN/g](https://www.nngroup.com/articles/dark-mode/)).
- Older adults also suffer more from glare.
- NN/g's conclusion: don't make dark the default for a general audience, but "strongly recommend" offering it, and use the operating system's dark-mode setting where one exists ([NN/g](https://www.nngroup.com/articles/dark-mode/)).

**Astigmatism and halation.**
- Light text on a dark background seems to "bleed" for many people with astigmatism. The effect is worst with pure white on pure black, and the usual advice is off-white on dark grey ([Walter](https://stephaniewalter.design/blog/dark-mode-accessibility-myth-debunked/), [Trimble Modus](https://modus.trimble.com/foundations/dark-mode)).
- The pupil-size mechanism is plausible but contested, and I found no controlled study (design sources only).

**What the platforms say.**
- **Apple HIG:** "Avoid offering an app-specific appearance setting". People "generally expect all apps … to respect their preference" ([Apple](https://developer.apple.com/design/human-interface-guidelines/dark-mode)).
- **Android:** offer Light, Dark and "System default (the recommended default option)" ([Android Developers](https://developer.android.com/develop/ui/views/theming/darktheme)).
- **Material:** use dark grey (#121212) rather than black, desaturated accents, and 87%/60% white for text ([Material 2](https://m2.material.io/design/color/dark-theme)).

**How many people use dark mode.**
- Android Authority reader polls: 81.9% in 2020 ([poll](https://www.androidauthority.com/dark-mode-poll-results-1090716)) and about 73% "always on" later ([survey](https://androidauthority.com/dark-mode-survey-results-3682352)). Both are self-selected enthusiasts, so they overstate use.
- Measured on the web, about **22% of Chrome traffic** has "prefer dark" set (Dec 2021) ([web.dev Terra](https://web.dev/case-studies/terra-dark-mode)). The BBC saw 20–25% and NC State Libraries 38% ([summary](https://www.portent.com/?p=54036), [NCSU](https://www.lib.ncsu.edu/node/68686)).
- Terra, a site with heavy phone use, served a proper dark theme to users who prefer dark. Their pages per session went from 2.47 to 5.24 on Android ([web.dev](https://web.dev/case-studies/terra-dark-mode)). This is a single case study (1src).
- **Plan for about 1 visitor in 4 to 1 in 3 asking for dark mode**, more at night.

**What marketplaces do.**

| App | Dark mode | Follows system | Default |
| --- | --- | --- | --- |
| Kleinanzeigen app | yes, Meins → ⚙ → Design | "Systemeinstellungen verwenden" ([netzwelt](https://www.netzwelt.de/anleitung/229011-kleinanzeigen-dark-mode-aktivierenso-gehts.html)) | light; web not confirmed |
| Vinted app | yes: On / Off / System setting ([help](https://www.vinted.co.uk/help/392/402-change-your-profile-details-and-settings), [Mobbin](https://mobbin.com/explore/flows/64e6a0ee-2d21-48c3-9f61-89afa2080e05)) | yes | website is light only (userscripts exist) |
| Facebook / Marketplace | yes: Light / Dark / System, desktop "Automatic" ([SlashGear](https://www.slashgear.com/1488018/how-to-turn-on-dark-mode-facebook-app-browser)) | yes | system |
| Airbnb | no official dark mode found; users have asked for years ([community](https://community.withairbnb.com/t5/Support-with-your-bookings/When-are-we-getting-Dark-Mode-on-the-Airbnb-app/td-p/1645793)) | — | light (2nd) |
| Divar | **could not confirm** either way | — | — |

The pattern: the classifieds apps closest to Peydoo offer dark mode as an option that follows the system, with light as the base. Photo-led travel (Airbnb) stays light.

**Photos.**
- White-background product photos lose edges and shadows on dark surfaces ([tenten](https://tenten.co/shopify/shopify-dark-mode/)) (2nd).
- One-click "invert" tools damage photos ([review](https://appnavigator.io/app/one-click-dark-mode)).
- web.dev's demo desaturates images by 50% ([web.dev](https://web.dev/articles/prefers-color-scheme)). That is wrong for a marketplace, because colour is product information (cars, clothes, flats).

**Battery.**
- Purdue (2021) found dark mode saves only **3–9% of OLED power at 30–50% brightness**, and 39–47% only at 100% ([Purdue](https://www.purdue.edu/newsroom/releases/2021/Q3/dark-mode-may-not-save-your-phones-battery-life-as-much-as-you-think,-but-there-are-a-few-silver-linings.html)).
- Battery is not a reason to choose a default.

**Persian script.** This part is inference; I found no study.
- Persian tells letters apart by dots (ب پ ت ث, ج چ ح خ) and has thin joining strokes and small marks (ـِ, ‌ZWNJ gaps).
- Halation and blur on light-on-dark text attack exactly those features.
- The irradiation illusion makes light text look heavier, so designers usually *reduce* weight in dark mode ([nerdy.dev](https://nerdy.dev/adjust-perceived-typepace-weight-for-dark-mode-without-layout-shift), [Dalton Maag](https://www.printmag.com/design-news/type-tuesday-dalton-maag-s-dark-mode/)). In Persian, thin weights break up the dots. So keep body text at regular weight or above, and reduce only bold.

### Recommendation

1. **Default: follow the system** (`prefers-color-scheme`, plus `<meta name="color-scheme" content="light dark">`). With no preference, or an old browser, show **light**. Never force dark.
2. **Override with three options**, «خودکار (مثل گوشی) / روشن / تیره»:
   - Put it in the account menu (signed in) and in the footer next to country/language (signed out).
   - Keep it out of the header. Apple advises against app-level toggles, so this is an escape hatch, not a feature.
   - Store the choice in a `theme` cookie the user set themselves. It is a preference cookie (§ 25 (2) Nr. 2 TDDDG, not legal advice) and must be listed in the privacy policy with the existing `country`/`view` cookies.
   - Use a server-rendered class so the page doesn't flash.
3. **Dark tokens:**
   - background #121212–#1A1D1F rather than black; cards one step lighter;
   - text #E6E6E6 (about 87% white), secondary about 60%;
   - turquoise #5cc0c7 or #4FB3BC for links, as already in `final/dark.css`;
   - saffron only as a fill with dark text.
4. **Persian type in dark mode:**
   - body at least 16px and weight 400 (never 300);
   - bold 700 down to 600;
   - line-height +0.1;
   - no pure white;
   - check ب/پ/ت and price digits (۰–۹) at 14px on a real phone at night.
5. **Photos:** never invert or desaturate. Put them on dark-grey cards with a 1px border so white product shots keep their edges. Optional: `brightness(.92)` on hover-free thumbnails only.
6. **Timing:** ship with the redesign *only if* all ten screens pass a contrast check (WCAG AA 4.5:1). Otherwise launch light-only with `color-scheme: light`, so the browser doesn't half-darken the page, and add dark in the first 60 days. It is "nice for 20–30%", not a launch blocker.

---

## B. Country and city waitlists: rewards, pre-listings, opening rule, speed

### What the cold-start evidence says

- **Start with an atomic network smaller than you think.** Andrew Chen calls it the smallest stable group that sustains itself, and says a first network is usually "on the order of hundreds of people". Slack works at 5–10 people; Tinder needed about 500 per campus ([Lenny/Chen](https://www.lennysnewsletter.com/p/atomic-network), [FoodOnDemand interview](https://foodondemand.com/01062022/andrew-chen-examines-the-cold-start-problem-for-platforms-like-uber-snackpass/)) (2nd for the figures).
- **Thresholds before a page goes live.**
  - Nextdoor neighbourhoods only went live with **10 verified households within 21 days**. Founders could name the neighbourhood and draw its borders. The rule existed to avoid "dead" pages ([Wikipedia](https://en.wikipedia.org/wiki/Nextdoor), [Rough Draft 2014](https://roughdraftatlanta.com/2014/09/18/dunwoody-police-join-brookhaven-local-cities-nextdoor/)). Sources are from 2013–2016.
  - Groupon deals only "tipped" at a set number of buyers, for example 35 for one lobster deal ([AP via Gazette 2009](https://gazette.com/2009/10/16/for-online-bargains-working-together-yields-deals/)).
  - Groupon is also a warning: 27% of merchants lost money (Dholakia, already cited in Round 4).
- **Supply first, and constrained.** In Lenny Rachitsky's study, **14 of 17 marketplaces seeded supply first** and **16 of 17 constrained by place or category**. Most growth came from 2–3 levers ([summary](https://kjlabuz.substack.com/p/98-marketplace-liquidity-from-the), [Lenny part 2](https://www.lennysnewsletter.com/p/how-to-kickstart-and-scale-a-marketplace-9ee)) (2nd for the exact counts).
- **Founders did the supply side by hand.**
  - Thumbtack emailed pros by hand ([Jarvis](https://www.alexanderjarvis.com/thumbtack-doing-things-that-dont-scale)) (2nd).
  - Uber "launchers" recruited drivers before opening a city. A former launch lead says 6–10 drivers online could cover weekdays early on ([City A.M.](https://www.cityam.com/how-uber-takes-over-city-just-four-days/), [Gorlick](https://www.recall.it/summary/startup/scott-gorlick-how-uber-acquired-1m-drivers-and-the-ubers-expansion-playbook-or-e1196)) (1src).
- **Classifieds advertise to sellers.** OLX India's long-running TV campaign "Bech De" means "sell it" ([exchange4media](https://www.exchange4media.com/advertising-news/olx-strengthens-bech-de-brand-proposition-45045.html)). Avito paid for TV because word of mouth was too slow ([Moscow Times](https://www.themoscowtimes.com/2012/05/02/avitoru-gets-75m-in-additional-funding-a14511)). Neither is affordable for Peydoo, but the lesson holds: market to the *posting* side.
- **Waitlist mechanics.**
  - Robinhood: each referral moved you up the queue, and the list reached about 1M before launch ([Growth Playbook](https://thegrowthplaybook.substack.com/p/how-robinhood-turned-a-landing-page)) (2nd).
  - Monzo: the queue existed because of real capacity (cards posted by hand), referral links skipped it, and it was removed in May 2018 ([Monzo](https://monzo.com/blog/2018/05/24/no-more-monzo-waiting-list)).
  - Superhuman: the waitlist was set by onboarding capacity, with a survey to decide who to let in first ([TechCrunch](https://techcrunch.com/?p=2004990), [Gainsight](https://www.gainsight.com/blog/5-lessons-i-learned-from-superhumans-onboarding/)).
  - Lists go cold. Roughly half convert when people get in within a month, and much less after 3 months ([Venture Crew](https://theventurecrew.substack.com/p/whats-a-good-waitlist-conversion)). These numbers conflict and trace back to Lenny (2nd).
- **Progress motivates.** A 12-stamp coffee card with 2 stamps pre-filled was completed faster than a 10-stamp card ([Kivetz et al. 2006](https://business.columbia.edu/faculty/research/goal-gradient-hypothesis-resurrected-purchase-acceleration-illusionary-goal)). This supports a visible two-sided goal bar.
- **Liquidity.** It means the probability that a listing or search ends in a match. Point Nine measures it as search-to-fill and utilisation ([Point Nine](https://writing.pointnine.com/p/wtf-is-marketplace-liquidity)). Gurley's ten factors list liquidity, frequency and fragmentation ([Hustle Fund summary](https://www.hustlefund.vc/post/angel-squad-bill-gurley-investments-what-the-uber-backer-teaches-about-market-analysis-done-right)). **I found no published "healthy %" benchmark.** The strategy's "≥50% of new listings get a chat within 7 days" is our own proposal; keep it as one.

### Pioneer rewards: cheap for us, valuable to them

**Private users** (one question at sign-up: looking / selling privately / business):

| Reward | Cost to us | Value to them | Rule |
| --- | --- | --- | --- |
| «پیشگام تورنتو» badge with the year, on profile and listings | zero | status, trust in a new place | Only for confirmed (double opt-in) sign-ups before opening. Must not look like a verification badge (§ 5 UWG; DSA Art. 25). |
| Early door: in **48 h before public opening** | zero | first pick of rooms and items | Real capacity reason: moderation of opening-day listings. |
| Up to 3 **opening-day listings** (see below) | moderation time | their item is seen on the busiest day | Re-confirm 72 h before opening. |
| **3 free bumps** usable in the first 60 days | small cannibalisation of paid bumps | visibility | Not "featured for everyone"; featured loses meaning if all have it. |
| Referral: each *confirmed* friend moves you up; at 3, +3 bumps; at 10, «سفیر» badge and the founders' Telegram group | zero | status, access | Cap rewards. No cash, no prize draw. A draw needs clear terms (§ 6 (1) Nr. 4 DDG). |
| Invite to the opening meetup or online event | event cost, shared with organiser | social | Only where an event is really planned. |

**Businesses:** founding Pro as in Round 4:
- 6 months from approval;
- places per city, with a sign-up deadline;
- verified;
- ≥3 listings;
- «بنیان‌گذار» badge forever;
- after the free period, a founding price (suggestion: **€12/month for 12 months**, half of €24), only with an explicit yes;
- pre-listings made during the waitlist count toward the 3.

**Legal guardrails** (not legal advice):
- **Waitlist consent:** count and email only double-opt-in sign-ups, and store the proof (BGH I ZR 164/09).
- **Referrals: users share, we don't send.**
  - Use a personal link via the phone's share sheet (Telegram, WhatsApp).
  - Never a form where users type friends' emails and Peydoo sends them. BGH I ZR 208/12 "Tell-a-friend" treats such mails as *our* advertising without consent ([Plutte](https://www.ra-plutte.de/bgh-faktisches-verbot-von-tell-a-friend-werbung), [IT-Recht](https://www.it-recht-kanzlei.de/tell-a-friend-bgh.html)).
  - Store only the referral code, not invitees' contacts.
  - Canada: CASL consent applies to our emails in the same way.
- **Promotion terms:** state the conditions of every promotion clearly and in an easy-to-find place, per § 6 (1) Nr. 3 DDG ("Zugaben und Geschenke … Bedingungen … leicht zugänglich … klar und unzweideutig"). Use one «شرایط پیشگامان» page.
- **"Free":** must mean no costs at all, so no card on file and no automatic renewal (UWG Annex Nr. 20).
- **The €24 comparison:** if Pro has never been sold at €24, don't write "normally €24". Write "Pro costs €24/month; founding businesses get 6 months free". This avoids an implied struck-through price.
- **Don't promise:**
  - an opening date before the gate is met (say «وقتی به هدف برسیم»);
  - buyer numbers;
  - "forever" perks except the badge.

### Opening-day listings (pre-listings)

**Yes, do it.** It is supply-first seeding (14/17) applied to a launch day. Uber recruited drivers before opening a city ([City A.M.](https://www.cityam.com/how-uber-takes-over-city-just-four-days/)). Vinted opened Ireland already connected to the French catalogue ([TheJournal](https://www.thejournal.ie/article.php?id=6539263)) and had Australian listings live before its official launch ([FashionUnited](https://fashionunited.uk/news/business/vinted-expands-into-australia/2026062688880)). The point is that a country opens full.

It also turns the opening-day moderation spike into **two weeks of steady review**.

Unlike invented listings, these are real people's real offers, so it fits the strategy's "no fake listings" rule.

Rules:
- **Drafts only, invisible to the public until opening.** Go through normal moderation in the 14 days before opening.
- **72 h before opening, one tap «هنوز موجود است؟»** confirms each draft. Unconfirmed drafts stay drafts.
- **Housing:** availability date must be on or after opening day. Show the deposit-scam banner. Price visible.
- **Jobs:** need a named employer, or a founding business.
- **Services:** come mostly from founding businesses.
- Normal expiry (e.g. 30 days) counts from opening, not from drafting.
- Each draft shows «آگهی روز افتتاح» on day 1, so it is honest that it was prepared.

### Opening rule

**Gate = people + businesses + prepared listings + operations, held for 7 days.** Then announce a date about 14 days out and open in waves:
- businesses on day −14 (drafts into review);
- pioneers and top referrers on day −2;
- everyone on day 0.

| | Big: **Canada / Toronto** | Medium: **Netherlands / Randstad** | Small: **Austria / Vienna** |
| --- | --- | --- | --- |
| Iranian base | ≈89–125k in Toronto; @toronto_iranians 14.8k | ≈66k nationally; the Randstad is one ~1 h commuter region | 18.5k born in Iran |
| **N confirmed people** | **1,000** (≈1% of base, ≈7% of the main channel) | **500** | **250** (≈1.4%) |
| **M verified businesses** (≥3 drafts each) | **30** of 50 places | **20** of 30 places | **12** of 20 places |
| **K prepared listings**, total | **150** | **100** | **60** |
| of which housing / jobs / services | ≥25 / ≥15 / ≥60 | ≥15 / ≥10 / ≥40 | ≥10 / ≥6 / ≥25 |
| **distinct private posters** | ≥60 | ≥40 | ≥25 |
| Show the count from | 250 | 125 | 60 |

**Why these numbers.**
- N is "hundreds" (Chen) scaled to the size of the community. Smaller cities need a higher share to reach the same density.
- At about 50% activation within a month, N gives roughly 500 / 250 / 125 active people.
- K is the strategy's "≥100 live listings" gate, scaled ±50%. Opening at the "next city" level means the city passes its first gate check on day 1.
- Distinct posters stop one business from filling the page.
- Services carry the most weight because founding businesses supply them (≥3 each), so M × 3 ≈ the services minimum.

**Operational gates** (all must be green):
1. **Moderation:** the 2-week pre-review must clear within 24 h, and launch-week volume must be manageable at about K × 2 in week 1.
   - Toronto is −6 h from Germany, so it needs an evening shift or a paid local moderator for about 5 h/week.
   - Moderators need Persian plus the local language (Dutch/German/English).
2. The strategy's "next country" gates: two German cities passing; queue <24 h for 6 weeks at under 5 h/week; server headroom.
3. **Country checklist:**
   - Canada: CASL consent records, GST above C$30k.
   - Netherlands: Dutch consumer law and ACM, iDEAL.
   - Austria: ECG/Impressum, already in the EU setup.
4. One **local partner** channel or organisation signed. One real **opening event** booked with the organiser's consent.
5. **Time box:**
   - If 75% of the gate is reached, set the date; don't let the list sit longer than about 3 months.
   - If less than 50% after 6 months, email the list honestly. Either open "small" with honest empty states and online events, or pause.
   - Never pad the counts.

### Five fast-growth tactics for one person

1. **Telegram partner channels.**
   - What: a ready-made post per listing, partner feeds, and a weekly events digest, with referral deep links. Start with the @berlin_online family, then @toronto_iranians for the Canada waitlist.
   - Evidence: trade lives where groups already are. Facebook built Marketplace on 450M monthly visits to buy-and-sell groups ([Meta 2016](https://about.fb.com/news/2016/10/introducing-marketplace-buy-and-sell-with-your-local-community/)). Airbnb's Craigslist cross-posting is the classic case ([Chen](https://andrewchen.com/how-to-be-a-growth-hacker-an-airbnbcraigslist-case-study/)), but do it **only where invited**: Airbnb broke Craigslist's terms.
   - Target: 5 partner channels per city; clicks tracked per channel.
2. **Invite rewards inside the product**, not cash.
   - What: queue position, bumps and badges (as above), shared from the user's own phone.
   - Evidence: Dropbox's two-sided storage reward reportedly lifted sign-ups 60% for good ([Mention Me](https://www.mention-me.com/blog/en/en/referral-success-story-dropbox)) (2nd). Robinhood and Monzo show the same pattern.
   - Target: 1 in 3 waitlist sign-ups from referrals.
3. **Concierge supply.**
   - What: the founder onboards **5 founding businesses a week** and posts their first 3 listings with them, with consent and labelled.
   - Evidence: 14/17 went supply-first; Thumbtack, DoorDash and Uber all did this by hand.
   - Target: Berlin 50 places filled in about 10 weeks.
4. **Events as the weekly traffic engine.**
   - What: organisers post for free. Do saves and reminders, and plan around Yalda (21 Dec), Chaharshanbe Suri, Nowruz and Sizdah Bedar. Co-host one meetup per opening.
   - Evidence: Tinder seeded campuses through parties (Chen, [FoodOnDemand](https://foodondemand.com/01062022/andrew-chen-examines-the-cold-start-problem-for-platforms-like-uber-snackpass/)). Eventbrite says discovery drives 1 in 4 tickets ([Eventbrite](https://www.eventbrite.com/organizer/features/community-engagement/)) (self-reported, 1src).
   - Online events also serve the waitlist countries before they open.
5. **Persian city × category landing pages** (e.g. «اتاق در برلین با امکان Anmeldung»), indexed and honest about empty states.
   - Evidence: about 40% of the marketplaces Lenny studied used SEO, and SEO unlocked Thumbtack's demand ([summary](https://kjlabuz.substack.com/p/98-marketplace-liquidity-from-the), [Thumbtack episode](https://player.fm/1BMqUEM)) (2nd).
   - Persian competition is thin, but keyword volumes are unknown (strategy, weak evidence), so treat this as a test.

**Brake:** "fast" is limited by moderation (DSA Art. 16/17) and trust. Growth that outruns moderation produces scams in the housing category, which costs more than it gains.

---

## C. Where to tell businesses about free founding Pro

**Principle:** show it *in context, at the moment of intent*, not as ad-like banners. NN/g's banner-blindness research (three decades): users skip top banners and the right rail, ignore inline promos styled "differently", and ignore content placed near ads. "Do not make content look like ads." ([NN/g](https://www.nngroup.com/articles/banner-blindness-old-and-new-findings/)).

Placements, in order of expected value:

| # | Placement | Who sees it | Content |
| --- | --- | --- | --- |
| 1 | **Posting-done page** after a listing in a business category (services, jobs, shop items), or when the poster ticked "business" | intent is highest | «کسب‌وکار دارید؟ Pro در برلین برای کسب‌وکارهای بنیان‌گذار ۶ ماه رایگان است · ۱۸ از ۵۰ جا باقی‌مانده · مهلت ثبت‌نام: …» plus one button |
| 2 | **Account / business dashboard** | posters | progress bar «۲ از ۳ آگهی» (goal gradient), verification steps, places left |
| 3 | **Pro page** | anyone curious | founding offer first, dated, with full terms, the places-left counter per city and the code field (as in `final/pro.js`) |
| 4 | **Business category pages** (services and jobs lists) | business browsers | one card in the list with the same style as listings, labelled «برای کسب‌وکارها» (§ 6 (1) Nr. 1 DDG: recognisable as promotion), not a top banner |
| 5 | **Message after the 2nd listing** («یک آگهی دیگر تا عضویت بنیان‌گذار») **and after the 3rd** («درخواست دهید») | business posters | in-app notice always; **email only with consent** (see below) |
| 6 | **Home page strip for logged-out visitors** in an open city | first-time visitors | one quiet line under the search, dismissible, hidden once places run out |
| 7 | **Footer** «برای کسب‌وکارها» | findability, SEO | link to the Pro page |
| 8 | **Telegram partner posts and the bot** | the community | one post per city per month with the real count |

**Email** (not legal advice): Pro is promotional, so email needs consent (§ 7 (2) Nr. 2 UWG).
- The existing-customer exception, § 7 (3), requires the address to come "im Zusammenhang mit dem Verkauf". A free account may not qualify.
- So add an unticked «خبرها و پیشنهادهای پیدو» checkbox with double opt-in at sign-up.
- Otherwise use only in-app notices and the bot.

**Honest scarcity rules:**
1. The counter is **computed from the database**: places = cap − approved − pending holds. Log it daily so it can be proved later. Never typed in by hand.
2. Caps and the deadline are fixed **before** publishing (Berlin and Hamburg 50, Frankfurt, Munich and Cologne 30, others 15–20).
   - **If you extend, say so openly** («ظرفیت به ۷۰ رسید»), and never re-run a "last chance".
   - Places freed by businesses that miss the 3-listing rule make the counter go *up*. Explain that in the terms.
3. **No countdown timers that reset**, and no "only today".
   - UWG Annex Nr. 7 bans false claims that an offer is available "nur für einen sehr begrenzten Zeitraum" to rush a decision.
   - The Annex protects consumers. Businesses are covered by the general misleading-practice rule (§ 5 UWG), and the DSA Art. 25 dark-pattern ban applies to Peydoo as a platform either way.
   - Regulators look for this: the EU's 2023 sweep found fake countdown timers on **42 of 399** shops ([European Commission IP/23/418](https://ec.europa.eu/commission/presscorner/api/files/document/print/en/ip_23_418/IP_23_418_EN.pdf)).
4. **Show the counter only where places are real.** Use a per-city number. Not a country total, and not before a city has a cap.
5. When a city is full: «تکمیل شد». Offer the founding price list only if one is really planned.
6. A study found countdown timers raise frustration more than quantity cues do ([Tuncer et al. 2023 via UX Psychology](https://uxpsychology.substack.com/p/the-use-of-scarcity-cues-in-e-commerce)) (2nd, 1src). A real places-left count with a fixed date is the safer form.
