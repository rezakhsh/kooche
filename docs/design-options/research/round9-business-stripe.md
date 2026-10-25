# Research 9: private vs business listings, and Stripe with Iranian customers abroad

25 Oct 2026. Research only. No code was changed. **This is not legal or tax advice.** It is background for the lawyer and the tax advisor.

- **[1 source]** marks a fact found in only one source.
- **[assessment]** marks my own reasoning.
- Quotes from Stripe, the ITSR (31 CFR 560), the UWG, the BGB, the EGBGB, the PStTG and the platforms' terms were checked word for word on the live pages today.
- **Limits:** the web-search budget ran out near the end. Three points therefore rest on my knowledge of the texts and were not re-fetched today: CJEU *Kamenova* (C‑105/17), the P2B Regulation (EU) 2019/1150 and the GPSR (EU) 2023/988. Each is marked where it is used. A Cloudflare challenge blocked the Subito help centre. Marktplaats help needs JavaScript, and Blocket refused our user agent, so for those three the facts come from search extracts or from secondary sources.

---

## Summary

**Part A: private vs business**

1. **Every big platform does the same three things:**
   - a declaration of private or business at sign-up (Kleinanzeigen, Marktplaats, willhaben, Leboncoin);
   - low free limits per category where businesses cluster (cars, rentals, services, jobs);
   - a cheap entry package for businesses (Kleinanzeigen PRO Basic €15 a month; Marktplaats Basis €19.95 per 4 weeks, €7.50 for the first 4).

   Detection is mostly volume per category plus user reports. Subito also refuses ads whose text is identical apart from the product name. Penalties are graduated: a forced switch or reclassification, listings held, then a block.
2. **The law splits the duties.**
   - **The seller:** must not pose as a consumer. This is a per se banned practice: UWG Anhang **Nr. 22** today (it was Nr. 23 before the 2022 renumbering).
   - **The platform:** if it is an "online marketplace", it must show whether each seller is a trader *according to the seller's own declaration* (§ 312l BGB with Art. 246d § 1 Nr. 4–5 EGBGB, and § 5b Abs. 1 Nr. 6 UWG). It must also disclose paid ranking (UWG Anhang Nr. 11a).
   - **No checking duty:** there is no duty to verify the declaration. Peydoo is exempt from the DSA's trader-traceability rules (Art. 30–32) as a micro enterprise (Art. 29).
   - **Tax:** a listing-only site without payments between users is outside DAC7 (§ 3 Abs. 1 PStTG).
3. **Recommendation for Peydoo:**
   - **Seller label:** a "private / business" label on every listing, with a one-line declaration when posting privately.
   - **Limits:** free private limits by category, counted as *new listings per rolling 30 days or 12 months*, not only active ones.
   - **Review queue:** a weekly "probably a business" queue fed by rules and the LLM check Peydoo already runs.
   - **A business route people want:** a free, verified business profile.
   - **For a detected business:** ask, then hold new listings, then restrict. Never auto-reclassify on volume alone: *Kamenova* says volume alone doesn't make someone a trader.

**Part B: Stripe**

4. **Stripe's wording is real.** The Restricted Businesses list (updated 22 Sep 2026) bars dealings with "Persons located in, resident in, or a citizen of" Iran.
   - **"Ordinarily resident"** appears only in the Services Agreement, § 11.6 "Trade Control" (access to Stripe Technology).
   - **The merchant warranty** in the same section uses "located in", not "citizen of".
5. **Stripe does not collect a cardholder's nationality.** It sees the card's country, the IP, the billing address, the name and email, and it screens names against lists. US law (ITSR) and EU law (Reg. 267/2012) test residence or location, and listed persons. They don't test nationality.
6. **No 2023–2026 report of Stripe acting on a customer's or a founder's Iranian nationality was found.** The known cases are about residence, IP or content: a 2019 hold on a Utah nonprofit because of the word "Iranian" in its name; Notion and GitLab in 2025.
7. **The "Stripe risk (high)" label in round 7 was overstated for customers who live abroad and pay with local cards.**
   - **New rating:** low likelihood, but a high impact if it happens. The realistic triggers are different:
     - the site's Iran content and Iran-facing features;
     - paid promotion of goods of Iranian origin;
     - Turkish sole traders with Iranian citizenship;
     - the owner's own citizenship, if Iranian.
   - **Cheap steps:**
     - never ask customers' nationality;
     - Radar rules for IR IP, card and billing country;
     - no paid extras for Iran accounts or Iranian-origin goods;
     - keep the payout balance small;
     - Mollie or bank transfer ready;
     - a short, factual written question to Stripe before paid volume starts.

---

# Part A: how to tell private from business listings

## A1. What other platforms do

| Platform | Declaration | Free limits for private sellers | Business packages | Business-only / detection / penalties |
|---|---|---|---|---|
| **Kleinanzeigen (DE)** | At sign-up: an account is "ausschließlich für die private Nutzung oder ausschließlich für eine gewerbliche bzw. freiberufliche Nutzung". At most two accounts (one private, one business) ([Nutzungsbedingungen](https://themen.kleinanzeigen.de/nutzungsbedingungen/)). You can't switch; you open a new account ([sign-up page](https://www.kleinanzeigen.de/m-benutzer-anmeldung-inapp.html)). | Up to 50 ads in 30 days free for both kinds, then €0.95 each. Cars and certain property categories pay from the third ad ([sign-up page](https://www.kleinanzeigen.de/m-benutzer-anmeldung-inapp.html)) [1 source]. Deleted and wanted ads count too ([mobiFlip](https://www.mobiflip.de/?p=192366), older). | Since 4 May 2026: PRO Basic / Power / Premium, Basic €15 a month. Business users without PRO: "up to three" free ads "depending on the category" ([onlinemarktplatz.de, 29 Apr 2026](https://onlinemarktplatz.de/267016/kleinanzeigen-pro-neue-pakete/); [mobiFlip, 29 Apr 2026](https://www.mobiflip.de/?p=481086)). | Its own test of "gewerblich": items bought or made to sell, services, large quantities regularly, similar goods over a long time, buying or selling for a company ([sign-up page](https://www.kleinanzeigen.de/m-benutzer-anmeldung-inapp.html)). Business users get 30 days' notice before a block (the P2B rule) ([Nutzungsbedingungen](https://themen.kleinanzeigen.de/nutzungsbedingungen/)). |
| **willhaben (AT)** | You must register the account as "gewerblich" if you are a business. Business-only ad products must be used where they exist ([Anzeigenrichtlinien](https://www.willhaben.at/iad/anzeigenrichtlinien) § 2). One account per person ([§ 1.1](https://www.willhaben.at/iad/anzeigenrichtlinien)). | Private marketplace ads are free. | Package contracts for businesses ([AGB 5.3.3, as of 30 Sep 2026](https://www.willhaben.at/iad/agb)). | "Regardless of tax status or trade licence", anyone who posts "regelmäßig bzw. in hohem Volumen oder mit Gewinnabsicht" counts as a business. **Always business:** animals, services, self-made or processed products, firewood, business closures, industrial goods, among others ([§ 1.7](https://www.willhaben.at/iad/anzeigenrichtlinien)). It may ask for ID or invoices; multiple accounts are deactivated ([§ 1.1](https://www.willhaben.at/iad/anzeigenrichtlinien)). |
| **Marktplaats (NL)** | "Alle Adverteerders dienen hun hoedanigheid (zakelijk of particulier) … correct door te geven" (terms dated 22 Jul 2026, [search extract of the terms](https://www.marktplaats.nl/i/help/over-marktplaats/voorwaarden-en-privacybeleid/)). | Most categories are free. Some allow only 1–2 free active ads; an ad runs 28 days with 3 free renewals ([secondary](https://webwoordenboek.nl/kenniscentrum/wat-mag-je-niet-verkopen-via-marktplaats)) [1 source]. | Pro, pay per click from €0.01 ([marktplaatszakelijk](https://www.marktplaatszakelijk.nl/ondernemers/pro-adverteren/)). Basis €19.95 per 4 weeks (first 4 weeks €7.50) and Plus €49.95, both with a "Gecontroleerde verkoper" sticker ([packages](https://www.marktplaatszakelijk.nl/ondernemers/pakketten-en-boosters/adverteren-met-pakketten-en-boosters/)). | Radar found little checking of Pro accounts. Marktplaats said it removes fraudulent Pro accounts after checks and reports ([Radar](https://radar.avrotros.nl/artikel/reactie-marktplaats-op-fraude-53878)) [1 source]. |
| **Leboncoin (FR)** | A pro account is required for professionals (forum quotes of a Leboncoin message, 2018, [Que Choisir forum](https://forum.quechoisir.org/post1249058.html)) [1 source, anecdotal]. | The CGV say posting is free in principle, but some categories charge above a number of ads over a *rolling 12 months* ([CGV](https://leboncoin.fr/dc/cgv)). Cars and vans: 2 free per rolling 12 months, then fees ([mac4ever](https://www.mac4ever.com/auto/188731-leboncoin-commence-a-faire-payer-les-vendeurs-un-peu-trop-actifs); [presse-citron](https://www.presse-citron.net/vendre-sa-voiture-sur-leboncoin-devient-payant-etes-vous-concerne/)). | Pro offers (not researched in detail). | Users report automatic blocks without clear criteria (forum, anecdotal). |
| **Subito (IT)** | Users are "privati o professionali" ([condizioni generali](https://info.subito.it/policies/condizioni-generali.htm)). | A maximum number of free ads per category over a period. Motori has an extra yearly cap over a rolling 365 days ([condizioni generali](https://info.subito.it/policies/condizioni-generali.htm)). Help-centre extracts: limits from 1 to 250 by category (flats 1, cars 4 a year, motorbikes 2). Services are always paid ([help centre, search extract](https://assistenza.subito.it/hc/it/articles/115005659445)). | SubitoPro for dealers, price not public ([aziende.subito.it](https://aziende.subito.it/)). When the limit is reached, a form asks for the company name and Partita IVA ([soglia raggiunta](https://aziende.subito.it/soglia_raggiunta)). | Subito "decides when a user falls into the Aziende category based on the number of ads in each category". It refuses ads whose text is identical except for the product in the title ([help centre, search extract](https://assistenza.subito.it/hc/it/articles/360001165425)) [1 source]. |
| **Blocket (SE)** | Not reachable. | Private ads in Home, Personal, Electronics, Leisure and Other became free in 2022 ([M3](https://www.m3.se/article/1860339/)) [1 source]. A private car ad costs from 249 SEK ([Vi Bilägare, Feb 2026](https://www.vibilagare.se/nyheter/traderas-nya-biltjanst-ska-utmana-blocket)) [1 source]. | Not found. | Not found. |
| **Kijiji (CA)** | Users may declare themselves business sellers. | Personal accounts get **1 free** ad per category in rentals, property, cars, RVs and boats, heavy equipment, Business & Industrial, vehicle parts and Jobs. They get **0 free** in all Services, Tickets and dog or cat adoption ([Kijiji admin, 21 May 2026](https://community.kijiji.ca/t/category-pricing-overview-listing-fees/141)). | Pay per listing per 31 days. | Above the limit an account "may be assigned a high-volume seller status" (Professional Landlord, Car Dealer, RV Dealer). Multiple accounts are "strictly prohibited"; Kijiji "actively monitors" ([paid-category rules, 20 May 2026](https://community.kijiji.ca/t/policies-for-paid-categories/57)). |
| **Gumtree UK** | Trade vs private. | Private car ads are free. They are for "individuals selling a single vehicle on an infrequent basis". Accounts with several vehicles "will be automatically reclassified as trade sellers or risk being restricted or blocked" ([Gumtree](https://www.gumtree.com/info/life/advertise-with-us-cars-vehicles/)) [1 source]. | Dealer packages from £78 a month ([same page](https://www.gumtree.com/info/life/advertise-with-us-cars-vehicles/)). | It may charge "if you are a business"; reported ads can be removed ([terms](https://www.gumtree.com/termsofuse)). |
| **Gumtree AU** | Not found. | One free ad at a time in boats, real estate, services, most jobs and most cars. Pets always pay ([help](https://help.gumtree.com.au/AU/articles/en_US/KB_Article/Which-categories-have-a-listing-fee-AU)). | Plus, Featured and Premium packages. | Not found. |
| **Craigslist** | "By owner" vs "by dealer". | $5 for US by-dealer for-sale ads, cars by dealer and by owner, services and some housing; jobs $10–75 ([fees](https://www.craigslist.org/about/help/posting_fees)). | Paid posting accounts for high-volume posters. | "Misrepresenting your identity or affiliation" carries $1,000 per violation in liquidated damages ([terms](https://www.craigslist.org/about/terms.of.use)). |
| **Facebook Marketplace** | Personal profiles. | No public number. | Shops and business tools elsewhere. | Marketplace is for "consumer-to-consumer sales". In the EEA, businesses and people acting commercially "may be subject to restrictions", up to losing Marketplace access. No services, no animals ([Commerce Policies](https://www.facebook.com/policies_center/commerce)). |
| **Divar (IR)** | Not found. | Since Jun 2024: **73 free ads a year per national ID**, only for use that counts as personal ([Zoomit, 11 Tir 1403](https://www.zoomit.ir/tech-iran/423310-free-advertisement-on-divar-platform)) [1 source]. Fees for «افراد و کسب‌وکارهایی که استفاده تجاری دارند», with dynamic pricing ([Zoomit](https://www.zoomit.ir/tech-iran/417988-dynamic-pricing-to-set-service-rates-on-divar-platform)). | A panel for licensed estate agents (page, package discounts, no daily cap) ([Eghtesad Online](https://www.eghtesadonline.com/fa/news/569948/)) [1 source]. | Many property ads in a month → treated as an estate business and pays per ad. In Tehran the line was about one a month ([Fararu, 2020](https://fararu.com/fa/news/463380/), old) [1 source]. |
| **Sheypoor (IR)** | Not found. | Ads are free; paid boosts ([FAQ](https://www.sheypoor.com/faq)). | «فروشگاه» shops for property, cars and other trades: cheaper boosts, a "more credible" listing, an adviser; price not public ([form](https://sheypoor.landin.ir/offline_shop_request/)). | Not found. |

**Patterns [assessment]:**
- **The declaration is the legal anchor.** Volume per category is the main detector.
- **Counting:** limits are counted as *new* ads per rolling window (30 days, 12 months), and deleted ads count. This stops delete-and-repost.
- **Where the line falls:** cars, rentals, services and jobs are where businesses hide. Ordinary goods get generous limits.
- **Penalties are graduated:** reclassify or ask, then charge or hold, then block. Nobody publishes an automatic "you are now a business" rule except Gumtree for cars and Kijiji's "high-volume seller status".
- **Badges:** "verified" badges (Marktplaats, Subito) are the carrot.

## A2. The law (Germany and the EU)

### What the seller must do

- **No posing as a consumer.** UWG Anhang (the "always unfair" list), **Nr. 22**, "Irreführung über Unternehmereigenschaft": "die unwahre Angabe oder das Erwecken des unzutreffenden Eindrucks, der Unternehmer sei Verbraucher oder nicht für Zwecke seines Geschäfts, Handels, Gewerbes oder Berufs tätig" ([UWG](https://www.gesetze-im-internet.de/uwg_2004/BJNR141400004.html)).
  - The brief said "Nr. 23". That was the old numbering; today Nr. 23 is about after-sales service in other member states.
- **No hidden commercial purpose.** § 5a UWG (misleading by omission; Abs. 4 covers an unstated commercial purpose).
- **Labelling.** Commercial ads must say "gewerblich" or "Firma" clearly; unclear abbreviations are not enough (IHK Schwaben guidance, 03.01.2025, seen as a search extract; the PDF link is now 404).
- **Trader duties.** An Impressum (§ 5 DDG), the right of withdrawal, the statutory warranty, price rules, and trade registration (GewO).
- **Who decides who is a trader:** courts and tax offices, not the platform.
  - Examples cited: LG Dessau-Roßlau 3 O 36/16 (15–25 sales a month as an indicator); BFH XI R 43/13 (140 fur coats in two years); BFH V R 19/20 (3,000 items in five years) ([Vodafone business blog, updated Nov 2025](https://www.vodafone.de/business/blog/ebay-kleinanzeigen-gewerblich-97116/)) [1 source for the summary].
  - The CJEU in *Kamenova* (C‑105/17, 4 Oct 2018) says the question is decided case by case: is the selling organised, for profit, frequent, of new goods bought for resale, VAT-registered. It held that someone who posts eight ads at once for new and used goods is not a trader *on that basis alone* (judgment not re-fetched today; [EUR-Lex CELEX 62017CJ0105](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62017CJ0105)).
  - **[assessment]** Peydoo's signals should trigger a *question*, not an automatic reclassification.

### What the platform must do

| Duty | Applies to Peydoo? | What it needs |
|---|---|---|
| **Seller status per listing** (§ 312l BGB + Art. 246d § 1 Nr. 4–5 EGBGB; also § 5b Abs. 1 Nr. 6 UWG; from the Omnibus Directive 2019/2161) | Yes if Peydoo is an "Online-Marktplatz": "ein Dienst, der es Verbrauchern ermöglicht, durch die Verwendung von Software … Fernabsatzverträge mit anderen Unternehmern oder Verbrauchern abzuschließen" ([§ 312l BGB](https://www.gesetze-im-internet.de/bgb/__312l.html)). **[assessment]** A chat where buyer and seller agree a deal is a means of distance communication, so it is safer to assume Peydoo is one. This is a lawyer question. | Show "whether the provider … *according to its own declaration to the marketplace operator*" is a trader. For non-traders, show that consumer-contract rules don't apply. Main ranking parameters must be given before the consumer's contract declaration ([Art. 246d EGBGB](https://www.gesetze-im-internet.de/bgbeg/BJNR006049896.html)). **The law relies on the seller's declaration. There is no duty to verify it.** |
| **Disclose paid ranking** (UWG Anhang Nr. 11a) | Yes: bumps and featured | Results promoted for payment must be "eindeutig offengelegt" ([UWG](https://www.gesetze-im-internet.de/uwg_2004/BJNR141400004.html)). The «ویژه» badge does this; bumped ads need a mark too **[assessment]**. |
| **DSA Art. 30** trader traceability (KYBC: name, address, phone, email, ID, payment account, register number, self-certification), **Art. 31** compliance by design, **Art. 32** right to information | **No.** Art. 29: "This Section shall not apply to providers of online platforms allowing consumers to conclude distance contracts with traders that qualify as micro or small enterprises". The exemption lasts until 12 months after losing that status, and doesn't cover very large platforms ([Art. 29](https://www.eu-digital-services-act.com/Digital_Services_Act_Article_29.html); [Art. 30](https://www.eu-digital-services-act.com/Digital_Services_Act_Article_30.html)) | Nothing is required. A light voluntary version is still useful (below). The DSA duties that do apply (notice and action, statements of reasons, contact points, terms) are already in the plan. |
| **DSA Art. 6(3)** | Yes | The hosting liability shield fails under consumer law if the average consumer would think the platform itself offers the item. A clear seller label protects Peydoo **[assessment]**. |
| **P2B Regulation 2019/1150** (business users of online intermediation services) | Yes for business profiles (not re-fetched today) | Terms for business users; a statement of reasons when restricting or suspending; **30 days' notice** before terminating a business user (Kleinanzeigen's terms reflect this). Small enterprises are exempt from the internal complaint system (Art. 11) and the mediation duty. |
| **GPSR 2023/988 Art. 22** (online marketplaces and product safety) | Possibly, if businesses sell *new products* to consumers through Peydoo (not re-fetched today) | A lawyer question. As far as I know there is no micro exemption **[assessment]**. |
| **Tax: DAC7 / PStTG** | **Probably not.** § 3 Abs. 1 PStTG: there is no platform "wenn die Software ausschließlich ermöglicht: … 2. das Auflisten einer relevanten Tätigkeit oder die Werbung für eine relevante Tätigkeit durch Nutzer" ([§ 3 PStTG](https://www.gesetze-im-internet.de/psttg/__3.html)). Reporting also assumes the operator knows the payment amount (the reading of the BMF letter of 2 Feb 2023, as summarised in [PCWelt](https://www.pcwelt.de/article/1470092/neues-gesetz-melden-ebay-co-sie-jetzt-beim-finanzamt-das-mussen-sie-wissen.html)) [1 source]. | Stay listing-only: no payments between users, and no knowledge of deal prices beyond the asking price. If Peydoo ever adds payments between users ("sicher bezahlen"), DAC7 reporting starts. Hidden-business detection creates no tax duty for Peydoo. |

**[assessment] In short:**
- **The platform must:** offer the private / business choice, show it on each listing, tell buyers what "private" means, mark paid placement, and give business users fair procedures (statement of reasons, 30 days before termination).
- **The platform need not:** verify the declaration.
- **The seller must:** make the declaration true, provide the Impressum and meet consumer law.
- **Why act on obvious cases anyway:** Peydoo's DSA notice duties still apply, and an obviously false "private" label under Peydoo's name is bad for trust.

## A3. Recommended design for Peydoo

What is in the code today:
- **Private posting:** free, at most 2 active service or lesson offers (`PRIVATE_SERVICE_OFFERS`).
- **Job offers:** need a business. **Tax and accounting:** business-only.
- **Business limits:** 3 active listings without Pro, 25 with Pro, 100 with Pro Plus.
- **New accounts:** 3 listings a day in the first 7 days.
- **Rule:** listings already live are never taken down by these rules.
- **Where:** `src/modules/organizations/limits.ts`, `src/modules/listings/limits.ts`, `seed/products.ts`.

The design below keeps all of that and adds the missing pieces. Every item is a build proposal, not a change.

### 1. Account types and labels

- **One login, two "posting identities":** *private* (the person) and *business* (an `organization` they own or manage). This matches today's «پست به‌عنوان» choice. It is simpler than Kleinanzeigen's two separate accounts, and the verified phone ties both to one person.
- **Label on every card and listing page:**
  - «فروشنده: شخص» or «فروشنده: کسب‌وکار · نام کسب‌وکار» (with «تأییدشده» when verified).
  - On private listings, one line: «فروشنده شخص است؛ قوانین حمایت از مصرف‌کننده (مثل حق انصراف) شامل این خرید نمی‌شود.» This is the Art. 246d § 1 Nr. 5 notice.
- **Declaration at private publishing:** one checkbox, stored with a timestamp as evidence: «این آگهی شخصی است؛ آن را برای کسب‌وکار یا برای فروش دوباره عرضه نمی‌کنم.»
- **Business listings show:** name, address, email, phone, and register / VAT number where one exists. These are the seller's Impressum fields. It is a light, voluntary Art. 30 and 31.
- **Filter in search:** «فقط شخصی / فقط کسب‌وکار».

### 2. What counts as business, per category

| Category | Private allowed | Free private limit (proposal) | Always business |
|---|---|---|---|
| Items (goods) | Yes | 30 active, and 40 *new* per rolling 30 days. Deleted and re-posted ads count (as Kleinanzeigen does). | New goods in quantity («عمده», «موجود در انبار»), shop clearances |
| Cars | Yes | 2 per rolling 12 months (like Leboncoin; Kijiji 1, Subito 4) | Dealers, car rental, import services |
| Rooms and flats | Yes | 2 active offers (your own room or flat, a sublet) | Estate agents (Makler), landlords with 3+ units, short-stay operators |
| Services and lessons | Yes, occasional | **2 active (today's rule)**, and 4 new per rolling 30 days | Regulated or clearly professional work: tax and accounting (today), legal and immigration advice, translation by sworn translators, health, driving schools, removals companies **[assessment: owner to confirm the list]** |
| Jobs (offers) | No (today) | — | Employers. Optional exception **[assessment]**: one private ad for household help (babysitter, cleaner) |
| Events | Yes, free or small private ones | 3 paid-ticket events per rolling 90 days | Promoters, venues, ticketed series |
| Wanted ads | Yes | Spam limits only | — |

**Why rolling windows [assessment]:** today's service limit counts only *active* offers. A provider can delete and re-post, or rotate two offers forever. A "new per rolling 30 days" counter stops that, and it is one extra SQL count in `postingRefusal`.

### 3. Signals and the "probably a business" queue

Peydoo already runs rules, then OpenAI moderation, then an LLM scam check on each listing. The cheapest addition is **one more field in the same LLM call**: `commercial_likelihood` (0–1) and `commercial_reasons`. That costs almost nothing extra **[assessment]**. Add these rule signals:

| Signal | Weight (proposal) |
|---|---|
| Hits a free limit, or tries to post past it | strong |
| The verified phone or email also belongs to a business profile, or another account | strong |
| The display name looks like a company (GmbH, UG, e.K., شرکت, گروه, فروشگاه, Shop, Studio, Salon) | medium |
| Keywords in Persian, German or English: فاکتور، گارانتی، ضمانت، فروشگاه، عمده، قیمت همکار، نمایندگی، موجود در انبار، ارسال به سراسر اروپا، سفارش پذیرفته می‌شود، ساعات کاری؛ Rechnung, MwSt, Garantie, Gewährleistung, Händler, Großhandel, Shop, auf Lager; invoice, warranty, wholesale, in stock | medium (the LLM sorts out "I lost the invoice") |
| Many listings in "new" condition; the same title pattern or price; text identical except the product (Subito's rule) | medium |
| The same photo, or near-identical photos, across several listings (the duplicate-photo check exists); product shots on white, logos or watermarks | medium |
| A webshop or Instagram shop link, or opening hours, in the text | medium |
| A user report with a new reason: «این آگهی‌دهنده کسب‌وکار است» | medium, strong at 2+ reporters |
| Buys many bumps on private listings | weak; never a penalty on its own |

- **Queue rule:** an account enters the queue when its score passes a threshold. It then waits for one of the four daily sweeps. In the owner's weekly sweep, the AI pre-writes a summary: "12 phone cases, all new, same photos, text 'گارانتی ۶ ماه'".
- **[assessment] Expected load:** about 3–10 accounts a week at 50 listings a day. That is roughly 15–30 minutes a week, inside the round 8 moderation budget. Tune the threshold so the queue stays below about 15 a week.

### 4. What happens to a detected business

1. **Nudge (automatic, at posting time).** When a limit or a strong signal fires, show «به نظر می‌رسد کسب‌وکار دارید» with the benefits (below). Two buttons:
   - «ساختن پروفایل کسب‌وکار رایگان» (one tap; the draft moves to the business);
   - «نه، این شخصی است» (repeats the declaration, which is logged). Above a hard limit this button only offers "wait until …".
2. **Ask (the owner, one click from the queue).** A message with the evidence summary and 14 days to switch or explain. Meanwhile *new* private listings in the affected categories are **held** (not published). Live listings stay, as today's rule says.
3. **Restrict (after 14 days of silence, or a repeated false declaration).** Existing private listings in those categories are hidden, with a DSA statement of reasons (section 4.1 of the terms on false information). Private posting in those categories stays blocked until the user switches. Other categories are not touched.
4. **Ban:** only the owner bans, and only for deception or abuse, never for volume alone.
5. **Moving listings:** a one-time action, «انتقال این آگهی‌ها به پروفایل کسب‌وکار». Today "post as" is fixed once a listing is out, so this is a build item. Allow private → business only.
6. **Once someone is a business user,** P2B applies: give reasons for restrictions, and 30 days' notice before ending the account.

### 5. Make the business route the easy choice

- **Free Basic business profile:**
  - a page, logo, address, opening hours and a website link (private listings get no links);
  - 3 active listings (today; consider **5 for verified** businesses);
  - job ads, unlimited wanted ads;
  - a place in a «کسب‌وکارهای ایرانی در [شهر]» directory;
  - organiser pages for events.
- **The «کسب‌وکار تأییدشده» badge:**
  - **What is checked:** the verified phone, plus a Gewerbeanmeldung, a register extract, a VAT ID checked in VIES, or a freelancer's tax number letter with the number covered.
  - **Who does it:** the owner checks once and the AI pre-reads the document.
  - **Comparison:** Marktplaats and Subito use the same carrot.
- **Pro at €24** stays the paid step, with founding Pro free for 6 months. **[assessment]** Kleinanzeigen PRO Basic is €15 a month and Marktplaats Basis €19.95 per 4 weeks, so €24 is fine *if* the free Basic profile is good. Don't make Pro the only way to be "legal".
- **Placement:** no hidden ranking boost for businesses. Use the badge, the directory and the seller-type filter. Any paid or verified boost must be named in the ranking parameters (Art. 246d § 1 Nr. 1 EGBGB; UWG Anhang Nr. 11a).
- **Wording on the private limit screen:** say what it is, not "you're cheating": «حساب شخصی برای فروش گاه‌به‌گاه است. برای فروش منظم، پروفایل کسب‌وکار رایگان بسازید؛ نشان تأیید و صفحهٔ خودتان را می‌گیرید.»

### 6. Questions for the lawyer (Part A)

1. Is Peydoo, with its chat, an "Online-Marktplatz" under § 312l BGB / § 2 Abs. 1 Nr. 6 UWG?
2. Does GPSR Art. 22 apply if businesses list new products?
3. Is the private-listing notice wording enough?
4. Do the P2B notice periods apply to free Basic business profiles?
5. Check the always-business list of services.

---

# Part B: Stripe and Iranian citizens living abroad

## B1. Stripe's exact wording

**Restricted Businesses list** ([stripe.com/legal/restricted-businesses](https://stripe.com/legal/restricted-businesses), "Last updated: 2026-09-22"), section "High-Risk Jurisdictions and Persons":

> "Use of Stripe's services for any dealings, engagement, or sale of goods or services either directly or indirectly with the following are prohibited:
> **High-risk jurisdictions** — Persons located in, resident in, or a citizen of, or products or services originating from jurisdictions that Stripe has determined for various reasons, including legal, contractual, and commercial reasons, to be prohibited, including, Cuba, Iran, North Korea, and Syria, and the Crimea, Donetsk, and Luhansk regions.
> **High-risk persons** — Persons Stripe has determined … to be prohibited, such as those individuals or entities named to a restricted person or party list of, or otherwise restricted by, the United States, United Kingdom, European Union, or United Nations …"

- **The German version:** "Personen, die sich in Gebieten aufhalten, dort ansässig sind oder deren Staatsbürger sind sowie Produkte oder Dienstleistungen, die aus Gebieten stammen …" ([stripe.com/de/legal/restricted-businesses](https://stripe.com/de/legal/restricted-businesses)).
- **So yes:** "a citizen of" is there, on the restricted list, in English and German.

**Stripe Services Agreement** ([stripe.com/legal/ssa](https://stripe.com/legal/ssa), General Terms "Last modified: September 28, 2026"). German accounts contract with Stripe Payments Europe, Limited.

- **§ 1.2(a)(ix):** the user must not "use the Services to conduct a Prohibited or Restricted Business, transact with any Prohibited or Restricted Business, or enable any individual or entity … to operate or benefit from any Prohibited or Restricted Business, unless Stripe has pre-approved [it] in writing."
- **Definitions:** "High-Risk Jurisdiction" and "High-Risk Person" mean whatever Stripe lists on the Restricted Businesses page.
- **§ 11.6 Trade Control,** the only place "ordinarily resident" appears:
  > "User must not use or otherwise export, re-export, or transfer the Stripe Technology except as authorized by United States law and the laws of the jurisdiction(s) in which the Stripe Technology was distributed and obtained, including by providing access to Stripe Technology (a) to any individual or entity **ordinarily resident in a High-Risk Jurisdiction**; or (b) to any High-Risk Person. By using the Stripe Technology, User represents and warrants that User is not (i) **located in** or organized under the laws of any High-Risk Jurisdiction; (ii) a High-Risk Person; or (iii) owned 50% or more, or controlled, by individuals and entities (x) **located in** or, as applicable, organized under the laws of any High-Risk Jurisdiction; or (y) any of whom or which is a High-Risk Person."

**What "ordinarily resident" means here [assessment].** It is US export-control language. It means the place where someone normally lives (their home base), not their passport. An Iranian citizen living in Hamburg is ordinarily resident in Germany. A person in Tehran who is visiting Germany is still ordinarily resident in Iran. OFAC's FAQ uses it the same way (B3).

**The tension [assessment]:**
- The contract's own trade-control clause and the merchant warranty use *residence and location*.
- The incorporated restricted list adds *citizenship*, as a business policy ("legal, contractual, and commercial reasons").
- Stripe can rely on the stricter list text whenever it wants, but it has no data to apply it to cardholders (B2).

**Stripe Identity** ([docs](https://docs.stripe.com/identity/use-cases?locale=en-GB)) may not be used for "verifying anyone who is linked directly or indirectly with" Iran, among other listed places. **[assessment]** Don't use Stripe Identity to verify business owners. Use the manual check from A3.5.

**Stripe's sanctions support page** ([support.stripe.com](https://support.stripe.com/embedded-connect/questions/understanding-sanctions)) only says Stripe complies with sanctions and points to the restricted list. It says nothing about how screening works.

## B2. Whom Stripe screens

| Who | What Stripe has | Source |
|---|---|---|
| **The merchant (the owner as a sole trader)** | KYC on the representative and owners: name, date of birth, address, ID document, phone. The Persons API has a `nationality` field ("The country where the person is a national"). "We also use and share Representatives' Personal Data to conduct due diligence, including … anti-money laundering and sanctions screening". | [Persons API](https://docs.stripe.com/api/persons/object.md); [Privacy Policy, 28 Apr 2026](https://stripe.com/privacy) |
| **The merchant's website and content** | Stripe flags "website and social media content" that relates to activities in restricted countries. This is a church-software help article describing Stripe's practice. | [Tithely](https://help.tithe.ly/hc/en-us/articles/37146111062551-Stripe-Restricted-Country-Policy) (via search extract) [1 source] |
| **Customers (cardholders)** | "Transaction Data": "your name, email address, contact number, billing and shipping address, payment method …". Also device and IP data, used for fraud and compliance. **No nationality field is collected at Checkout** [assessment from the listed data]. | [Privacy Policy](https://stripe.com/privacy) |
| **Radar (rules the merchant can set)** | `:card_country:` (the issuer's country, set on every card payment), `:ip_country:`, billing country; for example `Block if :card_country: IN (…)` | [Radar rules reference](https://docs.stripe.com/radar/rules/reference.md) |

**[assessment]** Stripe can see where a card was issued, where the IP is, the billing address, and whether a name matches a sanctions list. It cannot see that a German-resident cardholder named "Mohammadi" holds an Iranian passport, unless the merchant tells it or the site's content suggests it.

- **Iranian cards:** cards issued in Iran don't work on Visa or Mastercard abroad. Iranian banks have been cut off since the 2018 sanctions, and the Shetab network is domestic; there is an ATM link to Russia's Mir ([peacediplomacy.org](https://peacediplomacy.org/?p=4809); [The New Arab](https://www.newarab.com/news/iran-russia-link-bank-card-systems-counteracting-sanctions)). An "IR card" rule is therefore close to theoretical, but it is free to add.

## B3. The law: nationality or residence?

**US: the ITSR, 31 CFR part 560** ([eCFR, version of 1 Oct 2026](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-V/part-560)):

- **§ 560.204** bans the export of services "to Iran or the Government of Iran", including through third countries with knowledge they are meant for Iran.
- **§ 560.410(a):** the services ban covers services "performed on behalf of a person in Iran … or where the benefit of such services is otherwise received in Iran".
- **§ 560.304** "Government of Iran" means the state, its agencies, the Central Bank, and persons owned, controlled by or acting for them.
- **§ 560.314** "United States person" means "any United States citizen, permanent resident alien, entity organized under the laws of the United States …, or any person in the United States". Peydoo, a German sole trader, is not one; Stripe's US parent is.
- **§ 560.320** "Iranian accounts": "accounts of persons who are **ordinarily resident in Iran, except when such persons are not located in Iran**".
- **§ 560.306(c):** Iranian-origin services include services performed "by a citizen, national or permanent resident of Iran **who is ordinarily resident in Iran**".
- **OFAC FAQ 118:** "I have a client that is in Iran to visit a relative. Do I need to restrict the account? No. As long as you are satisfied that the client is not ordinarily resident in Iran…" FAQs 37 and 54 deal with people *living* in Iran ([OFAC Iran FAQs](https://ofac.treasury.gov/faqs/topic/1551)).
- **Result:** an Iranian citizen ordinarily resident in Germany or Canada is **not** a "person in Iran" and is **not blocked**, unless they are on the SDN list or are part of the "Government of Iran". The ITSR test is **location and residence plus listing**, not nationality.

**EU: Reg. 267/2012** (reinstated in full after the UN snapback, 29–30 Sep 2025):

- Art. 1(o): an "Iranian person" includes "any individual **in, or resident in,** Iran" ([Mayer Brown, 3 Oct 2025](https://www.mayerbrown.com/en/insights/publications/2025/10/eu-reintroduces-sanctions-against-iran-following-un-snapback)).
- Asset freezes cover *listed* persons (Annexes VIII and IX). Fund-transfer notification and authorisation thresholds apply to transfers *to or from Iranian persons*: none below €10,000 ([same source](https://www.mayerbrown.com/en/insights/publications/2025/10/eu-reintroduces-sanctions-against-iran-following-un-snapback)).
- There is no nationality-based ban. A €24 Pro payment from a Berlin resident with an Iranian passport is not restricted by EU law.

**[assessment]** The owner is right about the **law**: residents and refugees abroad are not sanctioned as such. He is wrong that the **Stripe text** is limited to residence. The citizen clause is a contract term that goes beyond the law. In practice it is enforced only where Stripe has a reason to look.

## B4. Real-world reports (2023–2026)

| Case | What happened | Basis | Date and source |
|---|---|---|---|
| Iranian American Society of Utah (a nonprofit) | Stripe held ticket income for about 2 weeks. It asked about links to "individuals or entities in Iran" and released the money after answers. The group believed the word "Iranian" in its name triggered it. | Content and name, not nationality | 2019, [Salt Lake Tribune](https://sltrib.com/news/politics/2019/11/10/utah-nonprofit-says-it) [1 source; older than the 2023 window] |
| Notion, GitLab, GitHub, Microsoft Store | Notion deleted the data of users *living in* Iran. GitLab suspended accounts used from Iranian IPs. Microsoft removed an Iranian developer's app. | Residence or IP | 24 Sep 2025, [Gigazine](https://gigazine.net/gsc_news/en/20250924-iran-user-sanctions) [1 source] |
| PayPal | Forum claim that "any related info about being Iranian" gets an account banned | Anecdote | [Udemy community](https://community.udemy.com/en/discussion/65163/questions-about-iranian-instructors) [1 source, anecdotal] |
| Stripe and generic risk | "Stripe withheld $85k from our EU platform", a Hacker News thread unrelated to Iran. It shows that any processor can hold funds after a review. | Generic risk | [HN](https://news.ycombinator.com/item?id=47565502) [1 source] |
| Stripe and **customer** nationality | **None found** | — | Searches in English and Persian (Reddit and HN through the search engine) |
| Stripe and **founder** nationality (resident abroad) | **None found.** Third-party guides say Stripe looks at the business and residence, not nationality (unofficial). | — | e.g. [Foundeck](https://foundeck.com/blog/can-foreigners-open-stripe-accounts/) [1 source, unofficial] |

**Limits of this check:** Reddit and X were not searchable directly, and the search budget ran out. "None found" means no public report surfaced, not that it never happened.

**For comparison:**
- **PayPal (Germany):** the German user agreement (7 Sep 2026) and the Acceptable Use Policy (17 Jul 2023) contain no Iran or citizenship clause in the text I could fetch ([user agreement](https://www.paypal.com/de/legalhub/paypal/useragreement-full?locale.x=en_DE); [AUP](https://www.paypal.com/de/legalhub/paypal/acceptableuse-full?locale.x=en_DE)). PayPal is not available in Iran. Anecdotes say it is strict on links to Iran.
- **Mollie:** the user agreement has no sanctions, Iran or nationality clause. Mollie may terminate at once when a merchant doesn't meet "Mollie's internal policies or risk appetite" ([user agreement](https://www.mollie.com/en/user-agreement)). Its prohibited-products page returned 403. **[assessment]** As an EU (Dutch) institution, Mollie follows EU sanctions (residence and listing based). No public citizenship rule was found, so Mollie is the better fallback for this issue.

## B5. Conclusion: the realistic risk and what to do

**Risk by scenario [assessment]:**

| Scenario | Likelihood that Stripe acts | Why |
|---|---|---|
| A German or Canadian resident of Iranian origin pays for Pro or a bump with a local card from a local IP | **Low** | Stripe has no nationality data. The law allows it. No reports were found. |
| The Peydoo account is reviewed because of site content (Persian, "Iran" on the site, the Iran read-only mode, `iran_message_only` accounts, Telegram) | **Low to medium** | Stripe scans content [1 source]. The Utah case shows content triggers. The outcome is usually questions and a temporary hold, which a good answer resolves. |
| Paid bumps, featured ads or Pro for sellers of **goods of Iranian origin** (saffron, carpets, pistachios, sweets imported from Iran) | **Medium** | Stripe's text: "products or services originating from" Iran. This is legal in the EU, but it is exactly what the clause names. |
| **Turkish sole traders who are Iranian citizens** (round 7's Istanbul plan) | **Medium to high** | They are natural persons who are "a citizen of" Iran, living next to Iran. Keep round 7's rule: bank transfer until Stripe answers in writing. |
| **The owner himself is an Iranian citizen** (dual or only) | Unknown; it depends on the KYC data | The only place where the citizen clause meets data Stripe actually holds (the ID document and nationality field). If this applies, put it in the written question. |
| Anyone in Iran pays | Must not happen | The plan already gives Iran accounts no payment. Add Radar rules. |

**Overall:** low likelihood, high impact (the account closed, funds held). **The round 7 "Stripe risk (high)" label and the review's "H" (5.1) were overstated** for Peydoo's core case of residents abroad with local cards. The review's premise was that "Peydoo's Pro buyers are mostly Iranian citizens" so "the whole German Stripe account is at stake". That premise treats a contract term Stripe cannot apply to cardholders as if it were a live screening rule. The real exposure is narrower: content reviews, Iranian-origin goods, Turkish Iranian sole traders, and possibly the owner's own KYC. It is worth a few hours of mitigation, not a redesign. Downgrade to **medium-low, with a fallback ready**.

**What to do (all cheap):**

1. **Never ask customers' nationality.** There is no legal need, and GDPR data minimisation applies. Asking would create exactly the knowledge the citizen clause turns on. Refusing people over their origin also raises discrimination questions. Ask only country of *residence* (already needed for prices and VAT) **[assessment]**.
2. **Radar rules** (one-time, free):
   - `Block if :ip_country: = 'IR'`
   - `Block if :card_country: = 'IR'`
   - block a billing country of IR.
   Also no checkout for `iran_message_only` accounts or while the travel rule is active (already planned).
3. **No paid extras on Iranian-origin goods.** Bumps, featured ads and Pro for shops whose main line is goods imported from Iran should be refused or not offered. An LLM tag at listing time can flag them. Money transfer to Iran is already banned (`src/modules/moderation/terms.ts`).
4. **Keep the payout balance low:** daily automatic payouts, so a hold traps days of income, not months **[assessment]**.
5. **Fallback ready:**
   - Mollie with an approved account, set up but dormant;
   - bank-transfer invoices for yearly plans (both already in round 7).
   Connect Mollie **before** founding Pro turns paid (around May 2027).
6. **A short written question to Stripe.** Send it through Dashboard support, so the answer is on the account record, before paid volume starts. Facts only:
   - a Persian-language classifieds site run from Germany;
   - customers live in the EU, UK, Canada, Australia and the US, many of Iranian origin, some possibly holding Iranian citizenship;
   - no service or payments to anyone in Iran (IP, card and billing blocks);
   - businesses screened against the EU, UN, OFAC and UK lists;
   - money transfers to Iran banned;
   - no paid promotion of goods of Iranian origin;
   - (if true) the owner's own citizenship.

   Ask whether this is supportable under the "High-Risk Jurisdictions and Persons" section. **[assessment] The trade-off:** asking draws attention and may get a "no". Not asking leaves the account exposed to a later review with money in it. Asking early, before revenue depends on it, is the better choice. If the answer is "no", move to Mollie. Send the same question to Mollie at the same time.
7. **Stripe Identity:** don't use it for business verification (B1).
8. **Have the sanctions lawyer** (already planned) read the Stripe question before it is sent.

---

## Notes for the plan page (corrections)

- **Round 7 "Stripe risk (high)"** → "Stripe: medium-low. The citizen clause exists, but Stripe has no nationality data on cardholders. The triggers are content, Iranian-origin goods, Turkish Iranian sole traders, and the owner's own KYC. Mitigate and ask in writing."
- **Round 7 review 5.1 ("H")** → "M/L". The text quote stays correct.
- **The brief's "UWG Anhang Nr. 23"** → **Nr. 22** in the current numbering.
