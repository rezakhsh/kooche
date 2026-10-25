# Research 11: services on Kleinanzeigen, business profiles, and cheap business verification in 11 countries

25 Oct 2026. Research only. No code was changed. **This is not legal or tax advice.**

- **[1 source]** marks a fact found in only one source.
- **[assessment]** marks my own reasoning.
- **[not re-checked today]** marks a fact from my general knowledge that I did not confirm on a live page today.
- Live tests run today: the Kleinanzeigen search pages with the private-seller filter, the EU VIES REST API (6 countries) and the French *API Recherche d'entreprises*. The willhaben rules page was fetched with curl.
- **Limits:**
  - I could not test Kleinanzeigen's posting flow, because it needs a logged-in account.
  - Marktplaats help pages need JavaScript. The Marktplaats facts come from its static "Diensten en Vakmensen" hub pages, which carry no date.
  - The German VIES node was down at the time of the test (about 01:20 CET), so the German VIES result is untested.
  - Many professional-register facts (Part 2.4) are marked [not re-checked today].
- Background I built on: `research9-business-stripe.md` part A and `research9-turkey.md` section 3. Two facts in research 9 are corrected below: the Kleinanzeigen PRO price, and the Didit prices.

---

## Summary

1. **"Every Kleinanzeigen service listing must be commercial" is true on paper and false in practice.**
   - **On paper:** the sign-up page says "Du handelst gewerblich auf Kleinanzeigen, wenn du … Dienstleistungen anbietest".
   - **In practice:**
     - Today the *Dienstleistungen* category holds **159,001 private offers**, against about 201,000 commercial ones, and it has a "Privat / Gewerblich" filter.
     - Kleinanzeigen's own guide (19 Dec 2025) says occasional private help is "meist unproblematisch".
     - Tutoring (*Nachhilfe*) is not in *Dienstleistungen* at all. It sits in *Unterricht & Kurse*, with 24,100 private ads.
   - **No technical block, no list of exceptions and no start date were found.**
   - **willhaben is the strict one:** "Immer gewerblich zu schalten sind: … Dienstleistungen".
   - **Marktplaats:** posting in *Diensten en Vakmensen* is paid, except babysitting, household help, pets, tutoring, private lessons and language lessons, which are free.
2. **What a commercial account on Kleinanzeigen gets:**
   - a public "Gewerblicher Anbieter" label and a public Impressum;
   - a Business Portal;
   - from 1 Sep 2026, **only 1 free service ad per 30 days**, then €3.99–8.99 each.
   - **PRO now starts at €39 a month net** (Power €59, Premium €99). Research 9's "€15" is only a goods-under-€25 tariff.
   - PRO adds: a company page with logo and website link, a monthly auto-bump, app homepage slots, statistics, and Top ads (Power and Premium).
   - **What it must provide:** an Impressum (name, address, phone or email). "Eine Steuernummer oder Gewerbeanmeldung ist dafür nicht erforderlich."
   - **Checks:** no business check was found, only SMS verification of the phone.
3. **Peydoo recommendation, services:** don't make all services business-only. Split them three ways:
   - **business-only, with a licence check:** tax, legal and immigration advice, health, estate agents, sworn translation, driving schools, money and finance;
   - **business by default, with a small private allowance:** trades, beauty, catering, removals, IT, photography;
   - **private-friendly:** tutoring, language lessons, babysitting, household help, pet sitting, a hand with moving.
4. **The business profile has to be worth having.** What small Iranian businesses abroad want most [assessment]:
   - to be found in Persian in their city (a directory and an indexable page);
   - trust (a «تأییدشده» badge that says what was checked);
   - their real channels (Instagram, WhatsApp and Telegram buttons, which private ads don't get);
   - a menu or price list that doesn't use up listings;
   - events (Nowruz, Yalda) and job ads;
   - an Impressum done right (it protects German sellers from *Abmahnungen*).
5. **Free official checks exist almost everywhere.**
   - **Best:** Australia (the free ABN Lookup API covers sole traders and GST), France (a free API with no key; it covers micro-entrepreneurs), the UK (Companies House API, the HMRC VAT API) and the EU VIES REST API (free, no key; the tests worked).
   - **Middle:** NL (KVK web search is free; the API is €6.40 a month plus €0.02 a profile), AT (GISA is free and covers sole traders), SE (Skatteverket's free F-skatt and VAT lookup, answered by email).
   - **Weakest:** Germany for *Freiberufler* and the US (no EIN check; registers are state by state).
6. **Paid KYB isn't worth it at Peydoo's size [assessment].** Didit is the only cheap pay-as-you-go option: $2 for a register lookup, but its KYB is still "staging". Middesk's median contract is about $11.9k a year; Sumsub's minimum is $149 a month; KYB prices at Veriff, Persona, Kyckr and Creditsafe are quote-only.
7. **The proposed tiers:**
   - **Level 0, self-declared:** free, 0 minutes.
   - **Level 1, «تأییدشده»:** a register or VAT check plus one document, which the AI pre-reads. **3–10 owner minutes, €0–€0.10 in cash.**
   - **Level 2 (Turkey and high-risk categories):** adds sanctions screening, a callback and a payment-name match. **15–20 minutes, about €0.50–1 in cash.**
   - **Load:** about 2–4 hours a month at 20–30 businesses a month.
8. **Data protection:**
   - don't store ID or document images: delete uploads within 7 days of the decision;
   - store only the register type and number, the VAT ID, the result, the date, who checked and the register's answer;
   - for tax numbers, keep only the last 4 digits;
   - no ID copies at Level 1 at all.

---

# Part 1. Services and business accounts on Kleinanzeigen, willhaben and Marktplaats

## 1.1 Kleinanzeigen: must every service listing be commercial?

### What the texts say

| Source | Text | Date |
|---|---|---|
| Sign-up page, "when are you commercial" ([kleinanzeigen.de](https://www.kleinanzeigen.de/m-benutzer-anmeldung-inapp.html)) | "Du handelst gewerblich auf Kleinanzeigen, wenn du … **Dienstleistungen anbietest**" (one of five criteria; the others are buying or making goods to sell, regular large quantities, similar goods over a long time, and buying or selling for a company) | Not dated. Already quoted in 2025 secondary sources. |
| Help: "Was muss ich als gewerblicher Anbieter beachten?" ([hilfe.kleinanzeigen.de](https://hilfe.kleinanzeigen.de/hc/de/articles/17127959144476-Was-muss-ich-als-gewerblicher-Anbieter-beachten)) | To offer goods or services *as a business* you "musst … mit einem gewerblichen Nutzerkonto registriert sein". Commercial ads may not be placed from a private account. | Not dated |
| Terms § 2 Nr. 5 ([Nutzungsbedingungen, in force since 17 Feb 2024](https://themen.kleinanzeigen.de/nutzungsbedingungen/)) | "Es ist ausdrücklich untersagt, ein privates Nutzerkonto für gewerbliche bzw. freiberufliche Zwecke" zu nutzen. At most one private and one commercial account per person. | 17 Feb 2024 |
| "Gewerblich handeln" ([themen.kleinanzeigen.de](https://themen.kleinanzeigen.de/gewerblich-handeln/)) | Commercial means "planmäßig und dauerhaft Waren und/oder Dienstleistungen gegen Entgelt". "Dienstleistungen anbieten" is listed as a *typical sign*. The list "is not exhaustive". | Current (it shows the 1 Sep 2026 fees) |
| PRO guide "Dienstleistungen online anbieten" ([themen.kleinanzeigen.de](https://themen.kleinanzeigen.de/pro-infopoint/ratgeber/dienstleistungen-online-anbieten/)) | "**Gelegentliche Hilfen im privaten Umfeld sind meist unproblematisch.** Sofern Sie jedoch regelmäßig und mit Gewinnerzielungsabsicht arbeiten, gelten Sie in der Regel als gewerblich tätig." | Updated 19 Dec 2025 |

### What the site shows today (live search, 25 Oct 2026)

| Search | Result |
|---|---|
| [Dienstleistungen, Anbieter: Privat, Angebote only](https://www.kleinanzeigen.de/s-dienstleistungen/anbieter:privat/anzeige:angebote/c297) | **159,001 private offers.** The filter shows Privat 187,207 and Gewerblich 201,204 (those two counts include wanted ads). Sample titles: "Haushaltshilfe und mehr", "Beiladung … Umzug Transport", "Zaun Bauer". Some results are goods placed in the wrong category. |
| Subcategories (whole category; the counts are not split by seller type) | Haus & Garten 126,464; Auto, Rad & Boot 63,511; Weitere 55,180; Altenpflege 40,761; Reise & Event 35,754; Umzug & Transport 19,730; Elektronik 16,959; Künstler & Musiker 16,587; Tierbetreuung 7,638; **Babysitter & Kinderbetreuung 5,827** |
| [Unterricht & Kurse, Privat](https://www.kleinanzeigen.de/s-unterricht-kurse/anbieter:privat/c235) | **35,064 private**, against 28,698 commercial. **Nachhilfe 24,100 private.** Sample: "Iranischer Musikunterricht – Privat, Gruppen & Online". |

### Answers to the owner's questions

| Question | Answer |
|---|---|
| Is it true? | **In wording, partly. In practice, no.** The sign-up text lists "offering services" as a commercial sign, but private service offers are allowed to exist and run in large numbers. The private filter is a standard feature of the category. The company's own Dec 2025 guide accepts occasional private help. |
| Since when? | **No start date found.** No press release introduces a "services are commercial-only" rule. The 2025 and 2026 changes (24 Feb 2025, 29 Apr 2026, 1 Sep 2026) changed only **commercial** quotas and fees ([PR 24 Feb 2025](https://themen.kleinanzeigen.de/medien/pressemitteilungen/kleinanzeigen-passt-konditionen-fur-gewerbliche-anbieter-an/): "Die Änderungen betreffen ausschließlich gewerbliche Anbieter"). |
| Which subcategories? | No subcategory is formally closed to private users. |
| Exceptions (tutoring, babysitter, moving helper, household help)? | **There is no written exception list**, because there is no formal ban. In practice all four have private ads. Tutoring is in a different top category (*Unterricht & Kurse*). Babysitter, household help and moving and transport are subcategories of *Dienstleistungen*, with private ads. |
| What happens when a private user posts there? | **No block was found.** The ad is published, labelled "Von Privat" or "Privater Nutzer". Then the risk is:<br>• another user reports it as commercial and Kleinanzeigen deletes it (forum report, [community.ebay.de](https://community.ebay.de/t5/Archiv-Verkaufen-bei-eBay/Versehentlich-Privat-verkauft-bei-Ebay-Kleinanzeigen-Was-bl%C3%BCht/qaq-p/1028579)) [1 source, anecdotal];<br>• a warning or a block under § 6 of the terms for breaking § 2 Nr. 5.<br>I could not test the posting flow while logged in. |

**[assessment] Why the owner believes it:** the sign-up sentence reads like a rule. Kleinanzeigen uses it as a *definition* that puts the risk on the user, and enforces it on reports and volume.

## 1.2 Kleinanzeigen: commercial versus private, in 2026

| Feature | Private account | Commercial account, no PRO | Commercial + PRO |
|---|---|---|---|
| Label | "Privater Nutzer" / "Von Privat" | **"Gewerblicher Anbieter"**, with the "Rechtliche Angaben" (company name, full address) public ([help](https://hilfe.kleinanzeigen.de/hc/de/articles/17148795879580-Unterschied-von-privaten-und-gewerblichen-Nutzerkonten)) | Same |
| Free ads | Free. "Sowohl gewerbliche als auch private Nutzer können weiterhin gebührenfrei Anzeigen aufgeben" up to the category limits ([fees page](https://themen.kleinanzeigen.de/gebuehren-kleinanzeigen-gewerbliche-nutzer/)). The sign-up page still says 50 ads per 30 days, then €0.95. | **From 1 Sep 2026, new ads per 30 days, deleted ones included:** goods 2; **services 1**; jobs 0; vehicles 3; cars 2; property 0. Ads run 30 days (before: 60). ([fees page](https://themen.kleinanzeigen.de/gebuehren-kleinanzeigen-gewerbliche-nutzer/)) | The package volume |
| Price of extra ads | — | **Services €3.99–8.99**, goods €3.49–4.49, jobs €12.99–26.49, cars €9.99, property €21.99–24.99 (VAT included). A renewal costs the same as a new ad. | Included up to the package volume |
| History of the service quota | — | Up to 2 free from 3 Mar 2025 (fee €3.99/€4.99, before €1.95) ([PR 24 Feb 2025](https://themen.kleinanzeigen.de/medien/pressemitteilungen/kleinanzeigen-passt-konditionen-fur-gewerbliche-anbieter-an/)). "Up to three, depending on category" from 4 May 2026 ([PR 29 Apr 2026](https://themen.kleinanzeigen.de/medien/pressemitteilungen/kleinanzeigen-modernisiert-pro-branchenspezifische-pakete-und-neues-angebot-fur-kleine-budgets/)). **1 from 1 Sep 2026.** | — |
| PRO packages | — | — | Booked **per category group** (goods, vehicles, vehicle parts, **services**, jobs) × ad volume × tier, since 4 May 2026 ([Händlerbund](https://ohn.haendlerbund.de/themen/marktplaetze/kleinanzeigen-pakete-gewerbliche-haendler-buchen-kategorie)). Existing PRO customers keep their old packages until the end of 2026. |
| PRO prices (VAT extra) | — | — | **Basic from €39 a month; Power from €59; Premium from €99.** "Preis auf Anfrage" for the exact category and volume. Separate goods tariff: 10 ads with prices up to €25 for **€15** ([PRO page](https://themen.kleinanzeigen.de/pro-infopoint/mit-pro-umsatz-steigern/)). No published price was found for services. In Dec 2025, larger Basic packages rose by up to 24% ([t3n, 11 Dec 2025](https://t3n.de/news/?p=1721243)). |
| Company page, logo | Profile only | Business Portal for managing ads | **Basic:** company page with logo, contact details, website link and services; own PRO URL; logo on ad pages. **Premium:** cover image, gallery, personal profile, no ads from others on the ad page. |
| Bumps | Paid extras | Paid extras | **Basic:** monthly auto-bump of all ads. **Power:** 1 permanent Top ad. **Premium:** 2 Top ads. |
| Homepage placement | — | — | **Basic:** app category homepage carousel "Lokal einkaufen – Shops aus der Region" (only in some categories in Dec 2025). **Power:** two slots in the first ten. |
| Statistics | — | — | Monthly download of clicks, enquiries and reach (Basic) |
| Buyer messages | — | — | **Power and Premium:** message people who saved an ad, or followers; AI reply drafts |
| Sales labels | — | — | **Basic:** optional "seller guarantee" or "fast shipping" labels ([t3n](https://t3n.de/news/?p=1721243)) [1 source] |
| Ratings | Both kinds of account show user ratings ([third-party FAQ](https://www.kuechenfibel.de/faq/was-bedeutet-der-kleine-stern-bei-ebay-kleinanzeigen)) [1 source, may be out of date] | Same | Same |
| "Sicher bezahlen" (Kleinanzeigen's escrow payment, through OPP) | Yes, for shipped goods | **No.** Commercial sellers can't offer it ([e-recht24](https://www.e-recht24.de/ecommerce/13270-ebay-kleinanzeigen-kaeuferschutz.html)) [1 source] | No |
| Invoices | — | Not documented. **[assessment]** fee invoices are issued; they are not a selling point. | — |
| Ranking | The terms § 1 Nr. 8 rank by "Datum der Anzeige, Preis und Entfernung", with paid highlighting disclosed ([terms](https://themen.kleinanzeigen.de/nutzungsbedingungen/)) | **No ranking boost for being commercial was found.** The extra visibility is paid (bumps, Top ads, homepage). | Same |
| Seller procedures | — | 30 days' notice before a block; an internal complaints system (terms §§ 6–7, the P2B rules) | Same |

### What a commercial account must give, and what Kleinanzeigen checks

- **Must give:**
  - an Impressum under "Rechtliche Angaben": name and legal form (a sole trader's full name), a street address (no PO box), and two ways to contact;
  - plus terms (if any), privacy notice and withdrawal notice ([help search extract](https://hilfe.kleinanzeigen.de/hc/de/articles/17043695285148-Rechtliche-Angaben-hinzuf%C3%BCgen); [terms § 4 Nr. 3](https://themen.kleinanzeigen.de/nutzungsbedingungen/));
  - **no VAT ID field in the terms.** A VAT ID belongs in the Impressum only if one exists (§ 5 DDG).
- **"Eine Steuernummer oder Gewerbeanmeldung ist dafür nicht erforderlich"** ([Gewerblich handeln](https://themen.kleinanzeigen.de/gewerblich-handeln/)).
- **Checks:**
  - an SMS check of the phone at registration (terms § 2 Nr. 2);
  - Kleinanzeigen *may* make features depend on "der Vorlage bestimmter Nachweise" (§ 2 Nr. 6).
  - **No routine business check was found.** It disclaims the accuracy of the Impressum ("keine Gewähr").
- **Switching:** a private account can't be converted. You open a second, commercial account with another email address.

## 1.3 willhaben (AT) and Marktplaats (NL)

| | willhaben | Marktplaats |
|---|---|---|
| Services rule | **Strict.** Anzeigenrichtlinien § 1.7: "Unabhängig von Steuerpflicht und Besitz eines Gewerbescheins" a regular, high-volume or profit-seeking poster is commercial. "**Immer gewerblich zu schalten sind:** Tieranzeigen …, Brennholz, …, **Dienstleistungen** sowie selbst hergestellte oder verarbeitete Produkte" ([Anzeigenrichtlinien](https://www.willhaben.at/iad/anzeigenrichtlinien), fetched today). **No exception for tutoring or babysitting is written there.** | **Paid by default.** In *Diensten en Vakmensen* you pay for a package before the ad goes live. Free categories: "**Oppas en Kinderopvang, Huishoudelijke hulp, Dieren en Bijles, Privéles en Taalles**". Paid ads appear above free ones ([hub page](https://statisch.marktplaats.com/html/hubs/diensten-vakmensen/advertentie-maken.html), undated). Standard ad €21 for 3 months or €54 for 12 months (search extract) [1 source]. |
| Private allowed? | Not for services | Yes. Private and business are both declared ("hoedanigheid (zakelijk of particulier)", terms). The free categories are the private-friendly ones. |
| Business perks | Package contracts; one account per person | Basis €19.95 per 4 weeks (first 4 weeks €7.50); Plus €49.95 (€14.95). Both: **"Gecontroleerde verkoper" sticker** (phone, bank account and ID checked by an independent partner), seller page with logo (Plus adds a website link), highlight stickers ([packages](https://www.marktplaatszakelijk.nl/ondernemers/pakketten-en-boosters/adverteren-met-pakketten-en-boosters/)). Also an automatic **free "basisvermelding"** for businesses, built from public data, KVK number included ([hub](https://statisch.marktplaats.com/html/hubs/diensten-vakmensen/basis-vermelding.html)). |
| Checks | May ask for "Lichtbildausweis, Rechnung, etc." (§ 1.1) | The sticker check is outsourced. In the past Radar could open business accounts with a random KVK number ([Radar](https://radar.avrotros.nl/artikel/zet-marktplaats-poort-open-voor-fraudeurs-53867)) [1 source, older]. |

**From research 9, for comparison:** Kijiji gives personal accounts **0 free** ads in all Services. Subito charges for all services. Gumtree AU allows one free ad at a time in services.

**[assessment] The pattern:** no big platform bans private service ads *and* leaves them free. The options are:
- business-only (willhaben);
- paid for everyone except the "neighbourly" subcategories (Marktplaats, Kijiji, Subito);
- allowed but discouraged by definition (Kleinanzeigen).

Marktplaats's free list (babysitting, household help, pets, tutoring, lessons) is the clearest model of what "private-friendly" means.

## 1.4 Recommendation for Peydoo: services

### Don't make all services business-only

Reasons [assessment]:
1. **Volume and fit.** Much of the Iranian diaspora's service supply is people, not firms: students who tutor, people who help with moving, babysitters, someone who translates a letter for a neighbour. A business-only rule pushes them to Telegram groups, where Peydoo can't moderate.
2. **The law doesn't require it.** The platform's duty is to show the seller's declared status (research 9, A2). It has no duty to force businesses.
3. **The real risks are in a few categories,** the regulated ones. That's where scams hurt Iranians most: fake immigration consultants, tax "advisers", "certified" translators.

### Three groups (a proposal for the owner to confirm)

| Group | Categories | Private allowed? | Business needs |
|---|---|---|---|
| **A. Business-only, licence checked** (Level 1 + a licence register) | Tax and accounting advice (DE: only authorised persons may give tax help commercially, [§ 5 StBerG](https://www.gesetze-im-internet.de/stberg/__5.html)); **legal and immigration advice** (DE: out-of-court legal services are "unzulässig, soweit sie nicht erlaubt" ([§ 3 RDG](https://www.gesetze-im-internet.de/rdg/__3.html)); UK IAA, CA CICC, AU OMARA registers, see 2.4); health, therapy, psychology; estate agents and letting agents; **sworn or certified translation**; driving schools; insurance, loans, financial brokering | No | A register check, plus a licence number checked in the official register. **The badge must say "licence checked".** |
| **B. Business by default** | Trades and repairs, renovation, removals *companies*, transport, catering, beauty and hair, photography and video, IT, web design, music and DJ for events, cleaning *companies*, car services | **Yes, limited:** 2 active offers and 4 new per rolling 30 days (today's rule plus the rolling window from research 9), with the declaration «گاه‌به‌گاه، نه شغل اصلی». At 2 hits of the "probably a business" queue, nudge to a business profile. | Level 0 free; Level 1 badge optional |
| **C. Private-friendly** (the Marktplaats free list) | Tutoring and private lessons, language lessons and exchange, babysitting, household help, pet sitting, elder company (non-medical), a hand with moving (*Umzugshelfer*, a person), plain translation help (not certified) | **Yes**, same limits; never nudged on the first offer | — |
| Already today | Job offers: business-only. Tax and accounting: business-only. | | |

**Edge cases [assessment]:**
- **"Umzugshelfer" vs "Umzugsfirma":**
  - **Group C:** a person with no van offering hands.
  - **Group B:** anything with a vehicle, insurance or "nationwide".
- **Translation:**
  - **Group C:** plain translation help.
  - **Group A:** the words «رسمی», «مترجم رسمی», «beeidigt», «ermächtigt», «certified», «sworn», «NAATI», or anything "for the Ausländerbehörde, court or embassy". The LLM check can sort these by keyword.
- **Immigration:** any offer to *advise* on visas or residence, or to fill in residence forms for money, is Group A in every launch country. Free help among friends is a different case: DE § 6 RDG allows unpaid legal help in close personal relationships [not re-checked today]. Peydoo can't police that line, so **keep immigration advice business-only and licence-checked**.
- **Shipping to Iran, currency exchange (حواله، ارز), gold:** not "services" for Peydoo. They belong in the sanctions and forbidden list (research 9 Turkey; Level 2 or banned).

### What a Peydoo business profile should give (so that honest businesses want it)

What Kleinanzeigen charges €39–99 a month for, Peydoo can give partly for free, because its value is the **Persian community audience**, not reach [assessment].

| Benefit | Free business (Level 0) | Verified «تأییدشده» (Level 1, free) | Pro €24 / Pro Plus €59 | Who it motivates |
|---|---|---|---|---|
| **Being found in Persian in their city:** «کسب‌وکارهای ایرانی در [شهر]» directory, map, category | Yes | Yes, with a "verified only" filter | Top of the directory **only if labelled «ویژه»** | Everyone; restaurants and hairdressers most |
| **Own indexable page** `peydoo.com/b/<slug>` (Persian + German/English) | Yes | Yes | Custom slug, cover image | Restaurants, translators, IT (Google in Persian and in German) |
| **Real channels:** Instagram, WhatsApp, Telegram, website, booking link (private ads get none) | Website only | **All links** | All | Hairdressers, beauticians, tutors: Iranian small businesses live on Instagram and Telegram |
| **Menu, price list or service list** on the profile; it **doesn't count as listings** | 10 items | 30 items | Unlimited, with photos | Restaurant menu, hairdresser prices, removals rates |
| Opening hours, branches, languages spoken (فارسی، Deutsch، English، Türkçe) | Yes | Yes | Several branches (Pro Plus) | Restaurants, salons |
| **Impressum block** filled in correctly (§ 5 DDG fields) and shown on every listing | Yes | Yes, plus "register checked" | Same | **German** businesses: it protects them from *Abmahnungen*. Kleinanzeigen makes them do this by hand. |
| Active listings | 3 (today) | **5** | 25 / 100 | — |
| **Events pages** (Nowruz, Yalda, Chaharshanbe Suri, concerts, Iranian film nights) | 1 at a time | 3 | More, plus a featured slot | Restaurants, venues, promoters |
| **Job ads** (cook, hairdresser, driver) | 1 | 2 | Included in the listing quota | Restaurants, salons, removals |
| **Reviews or recommendations** (from verified-phone users, after a chat) | — | Yes | Yes, with a reply | Hairdressers, tutors, removals, IT. **[assessment]** UWG § 5b Abs. 3 requires saying *how* reviews are checked; take that into account. |
| Statistics (views, contacts, saves) | Totals | Per listing | Monthly report | IT, removals |
| Bumps | Paid | Paid | **Monthly auto-bump**, labelled | Removals, trades |
| **A licence badge** («مجوز بررسی‌شده: Steuerberater / RCIC / NAATI …») | — | Group A only | — | Tax, immigration and translation: in this community this is the biggest trust driver |
| Several managers (staff accounts) | — | — | Pro Plus | Restaurants, agencies |
| Invoices | — | — | A proper invoice (Peydoo is a § 19 UStG Kleinunternehmer, so no VAT shown) | Businesses that book costs |

**What not to do [assessment]:**
- **No hidden ranking boost** for businesses or verified ones. Any boost must be disclosed among the ranking parameters (research 9, A2).
- **No "Peydoo guarantees" wording.** The badge text must say exactly what was checked:
  - «پیدو در تاریخ [date] بررسی کرد که این کسب‌وکار با همین نام در [Handelsregister / KVK / ABN …] ثبت است. کیفیت کار را بررسی نمی‌کنیم.»
  - A vague "verified" that people read as a quality seal risks being misleading (UWG § 5).

**Pricing check:** Kleinanzeigen gives 1 free service ad, then €3.99–8.99 each, or PRO from €39 net. Peydoo gives 3 free (5 when verified) and Pro at €24. That is fine and doesn't need lowering [assessment].

---

# Part 2. Verifying a business in each country, cheaply, by one owner

## 2.1 Overview table: official sources

"Free" means no fee per check. "API" means an official machine interface.

| Country | Company register | Free? | API | VAT / tax-ID check | Sole traders and freelancers |
|---|---|---|---|---|---|
| **DE** | [Handelsregister](https://www.handelsregister.de) (GmbH, UG, AG, e.K., OHG, KG) | **Free since 1 Aug 2022**, documents included | **None official.** The terms allow at most **60 searches or retrievals an hour** (whitelisted IPs on request) ([bundesAPI notes](https://github.com/bundesAPI/handelsregister)) | **VIES** (free REST, no key) says valid or invalid; German numbers reportedly come back without name or address [third-party sources; DE node down during the test]. BZSt **qualified** check (name + address) is free, but **only for checking *foreign* VAT IDs, and the request must carry your own German VAT ID**. Online only since 20 Jul 2025 ([steuerschroeder](https://www.steuerschroeder.de/blog/neue-regelung-zur-ust-idnr-bestaetigung-nur-noch-online-abfrage-ueber-das-bzst/)). A new REST API from Jul 2025 ([evatr wrapper](https://root.packagist.org/packages/rechtlogisch/evatr)) [1 source]. **Many Kleinunternehmer have no VAT ID.** | **Gewerbetreibende:** the *Gewerbeanmeldung* (paper). Basic data (name, business address, activity) "dürfen allgemein zugänglich gemacht werden" ([§ 14 Abs. 5 GewO](https://www.gesetze-im-internet.de/gewo/__14.html)). The simple query is **free online in Berlin** ([service.berlin.de](https://service.berlin.de/dienstleistung/326157/)) and **€15 in Munich** ([stadt.muenchen.de](https://stadt.muenchen.de/service/info/auskunft-aus-dem-gewerberegister/1064030/)); other cities vary. **Freiberufler** (tutors, translators, IT consultants, doctors, lawyers): **no trade register**. The Finanzamt letter allotting a tax number can't be checked by anyone; use the professional register where one exists. |
| **AT** | Firmenbuch | **Free "Kurzinformation"** (name, form, seat, address, FN, business, representatives, insolvency) ([e-Justice](https://e-justice.europa.eu/topics/registers-business-insolvency-land/business-registers-eu-countries/at_de)). Partial extract about €1.52, full extract €4.89 ([finfo](https://www.finfo.at/business/firmenbuch/)) [1 source] | HVD API "free, needs ID Austria" (Kyckr) [1 source, unclear] | VIES returns name + address (tested: SPAR) | **GISA**, the trade-licence register: **free, no registration**; shows firm, location and the wording of the licence ([BMWET](https://www.bmwet.gv.at/Themen/Unternehmen/GISA_Gewerbeinformationssystem/GISA_Abfragen.html)). **It covers sole traders.** Regulated trades (e.g. *Immobilientreuhänder*) appear there too. |
| **NL** | KVK Handelsregister | Web search free. Online extract €2.95; certified €9.60 ([KVK tariffs 2026](https://production-site-nl.kvk.bloomreach.cloud/binaries/content/assets/kvkwebsite-nl/categorie/handelsregister/tarievenoverzicht_1_januari_2026.pdf)) | **Yes:** €6.40 a month per key; *Zoeken* €0.00; Basisprofiel €0.02; Vestigingsprofiel €0.02 (same PDF; [developer pricing](https://developers.kvk.nl/nl/pricing)) | VIES returns name + address (tested: Booking.com) | **Sole traders (*eenmanszaak*) are in KVK.** Since 2022, home addresses are shielded [not re-checked today]. |
| **IT** | Registro Imprese (InfoCamere) | Basic search free; *visura* about €3–5 ([Fiscozen](https://www.fiscozen.it/guide/visura-camerale-gratis-online/)) [secondary] | Paid (InfoCamere) [not re-checked today] | **Agenzia delle Entrate "Verifica Partita IVA"**: free, with a captcha ([money.it](https://www.money.it/Verifica-partita-IVA-online)). VIES returns name + address (tested: TIM S.P.A.) | Every self-employed person has a *Partita IVA*, so the AdE check and VIES work for sole traders. *Ditte individuali* are also in the Registro Imprese. |
| **SE** | Bolagsverket | "Sök företag" free [not re-checked today] | **HVD API free**, commercial reuse allowed ([zephira guide](https://zephira.ai/swedish-company-registry-data-a-complete-guide-to-bolagsverket/)) [secondary]. The full profile API is paid. | **Skatteverket "Hämta företagsinformation":** free, no e-ID; shows **F-skatt, VAT and employer registration**; by organisation number or name; **answered by email** ([Skatteverket](https://skatteverket.se/hamtaforetagsinfo)). VIES returns name + address (tested: Saab). | *Enskild firma* uses the personal number as its organisation number. **The Skatteverket F-skatt lookup covers it.** |
| **FR** | SIRENE (INSEE) and RNE (INPI) | Free | **[API Recherche d'entreprises](https://recherche-entreprises.api.gouv.fr): free, no key** (tested today). About 7 calls a second (third-party figure). INSEE Sirene API: free key, 30 calls a minute [secondary]. | VIES returns name + address (tested) | **Micro-entrepreneurs have a SIREN** and appear in the API, except those who chose *non-diffusion* [secondary]; ask them for a SIRENE notice in that case. |
| **UK** | Companies House | Free | **Yes, free key**, 600 requests per 5 minutes ([CH](https://developer-specs.company-information.service.gov.uk/guides/rateLimiting)) | **HMRC "Check a UK VAT number" API v2:** name, address, and a reference number for a verified check. Needs Developer Hub registration (about 2 weeks reported). **v1 was removed on 17 Feb 2025** ([HMRC](https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/vat-registered-companies-api/2.0)). Free web checker too. | **No public register of sole traders.** The UTR is not checkable. Use the professional and AML-supervisor registers, plus the light signals. |
| **US** | 50 state Secretary of State business searches | Free web, state by state | Few states; none national. OpenCorporates from £2,250 a year ([pricing](https://opencorporates.com/pricing/)) | **No public EIN check.** The IRS TIN matching is for payers only ([legalclarity](https://legalclarity.org/how-to-look-up-a-business-official-databases-and-records/)) [secondary]. No VAT. | **DBA / assumed-name filings at county or state level.** A sole trader in their own name may have no filing at all. Ask for the DBA certificate or a state licence. |
| **CA** | Corporations Canada (federal) plus provincial registries (Ontario OBR, Québec REQ, BC Registries …) | Federal search free; Ontario name search free ([ontario.ca](https://www.ontario.ca/page/companies-service-standards-and-fees)); a profile report costs a fee | **Federal Corporation API** on the GC API Store, key needed; it covers federal corporations only, not provincial ones ([ISED](https://ised-isde.canada.ca/site/corporations-canada/en/node/269)) | **CRA GST/HST Registry:** free; needs the 9-digit BN, the name and a transaction date ([CRA](https://www.canada.ca/en/revenue-agency/services/e-services/e-services-businesses/confirming-a-gst-hst-account-number.html)). No API. An old test found it matched only the first 10 characters of the name ([taxtips](https://taxtips.ca/gst/gstregistry.htm)) [1 source, around 2012]. | **The BN is not public.** Sole proprietorships with a trade name register provincially (Ontario $60); Québec's REQ lists them [not re-checked today]. Small suppliers under C$30k may have no GST number. |
| **AU** | ASIC companies register; ABR (ABN) | **ABN Lookup free**; ASIC basic search free; extracts paid ([ASIC](https://www.asic.gov.au/about-asic/news-centre/news-items/asic-launches-refreshed-companies-search-service)) | **ABN Lookup web services free** with a GUID ([ABR](https://abr.business.gov.au/Documentation/WebServiceRegistration)) | **The ABN record shows GST registration** and its date [third-party docs] | **Sole traders have ABNs**, and ABN Lookup shows "Individual/Sole Trader", the name and business names. **The best sole-trader coverage of the 11.** |
| **TR** | MERSİS (no public search); **TTSG** gazette | TTSG free after sign-up; certified copy TRY 75 (research 9 TR §3.3) | None. Bulk data TRY 1.43M a year. | **Vergi levhası** barcode via e-Devlet Belge Doğrulama (free); ITO *faaliyet belgesi* barcode check (free) | *Şahıs şirketi* (sole trader): vergi levhası + chamber registration (esnaf or ITO). See research 9 TR §3.3–3.6. |

## 2.2 Free APIs we can automate

| API | Cost | Key | What it gives | Tested today |
|---|---|---|---|---|
| **EU VIES REST** `ec.europa.eu/taxation_customs/vies/rest-api/ms/{CC}/vat/{num}` | Free | None | Valid / invalid; name and address for most countries (not DE). A status endpoint shows which national nodes are up. | **Yes:** NL, IT, AT, SE and FR valid with names; DE "MS_UNAVAILABLE" at 01:20 CET |
| **France API Recherche d'entreprises** | Free | None | SIREN, name, address, NAF code, status, officers | **Yes** |
| **UK Companies House** | Free | Free key | Company, officers, persons with significant control (PSC), status | No (needs a key) |
| **UK HMRC VAT v2** | Free [assessment: no fee found] | Developer Hub app | Name, address, verified reference | No |
| **Australia ABN Lookup** | Free | GUID | Entity, sole trader name, GST, business names | No (needs a GUID) |
| **NL KVK** | €6.40 a month + €0.02 per profile | Key | Name, KVK number, SBI codes, addresses | No |
| **SE Bolagsverket HVD** | Free | Registration [secondary] | Basic company data | No |
| **CA Federal Corporation API** | Free [not confirmed] | API Store key | Federal corporations only | No |
| **OpenSanctions /match** (for Level 2) | €0.10 a query; prepaid bundles €0.03–0.10 ([metering FAQ](https://www.opensanctions.org/faq/api/metering/); [changelog](https://www.opensanctions.org/changelog/51/)) | Key | Sanctions and PEP candidates | No |

**No API, manual only:**
- the German Handelsregister (60 an hour; scraping is a bad idea);
- the German Gewerbeauskunft (city by city);
- the Italian AdE check (captcha);
- the Swedish Skatteverket lookup (email reply);
- the Canadian GST/HST registry;
- US state searches;
- the Turkish e-Devlet and TTSG.

## 2.3 Paid KYB vendors (public prices only)

| Vendor | Public price | Notes |
|---|---|---|
| **Didit** | KYB registry lookup **$2 "Lite"**, $4 shareholders, $5 UBO (EU and UK); US, CA, AU and TR $2 / $5 / $9. KYB documents $0.20 a step. Entity or person AML $0.20. ID check $0.15; KYC bundle $0.33, with 500 free a month. No minimum. ([pricing](https://didit.me/pricing), fetched today) | **The KYB table is "staging retail catalog, pending production rollout".** Research 9 quoted TR at $2 / $5 / $9: unchanged. The EU and UK tiers are cheaper than I expected. |
| Sumsub | KYC $1.35 (minimum $149 a month) or $1.85 (minimum $299). **KYB: custom plan, no price.** 14-day trial with 50 checks ([pricing](https://sumsub.com/pricing/)) | Too expensive at our volume |
| Veriff | $0.80 / $1.39 / $1.89 per check, minimums $49 / $99 / $209. PEP and sanctions +$0.64. **KYB listed, no price** ([pricing](https://www.veriff.com/pricing)) | — |
| Persona | Essential from **$250 a month**, 12-month minimum; about $1.50 a check (third-party). KYB by quote ([Signzy summary](https://www.signzy.com/blogs/kyc-pricing-us-cost-per-verification)) [secondary] | — |
| Middesk (US KYB) | Sales-led. **Median contract $11,875 a year**, range $10k–186k ([Vendr](https://www.vendr.com/marketplace/middesk)) [1 source] | Built for US fintech; far too big for us |
| Onfido (Entrust) | Quote only [not re-checked today] | — |
| Kyckr | Credits; a "customer success manager" handles top-ups; no public price ([help](https://help.kyckr.com/hc/en-ie/articles/13937092577309-Overview-of-Kyckr-credits)) | — |
| Creditsafe | No public price. Small plans about $99–249 a month (unofficial); median contract $25.8k a year ([Vendr](https://www.vendr.com/marketplace/creditsafe)) | — |
| OpenCorporates | From £2,250 a year, 500 calls a month ([pricing](https://opencorporates.com/pricing/)) | — |

**[assessment]** At 20–50 businesses a month, the free registers plus 3–10 owner minutes cost **€2–7 of time per check**. Vendors cost $2–5 per check plus minimums, and they don't cover sole traders better than ABN, GISA, KVK, SIRENE or Skatteverket already do. **Re-test Didit when its KYB leaves staging**, mainly for Turkey and US shareholders.

## 2.4 Regulated trades: licence registers

Group A categories need a licence register check. Most registers are free web searches with no API. Rows marked † were confirmed in today's searches; the rest are **[not re-checked today]**. Confirm each URL once before the first check.

| Country | Lawyers | Doctors, health | Tax advisers, accountants | Estate agents | Sworn translators | Immigration advisers |
|---|---|---|---|---|---|---|
| DE | † BRAK Bundesweites Amtliches Anwaltsverzeichnis ([rechtsanwaltsregister.org](https://www.rechtsanwaltsregister.org)) | Landesärztekammer doctor search; psychotherapist chambers | Steuerberaterverzeichnis (BStBK) | **† No public register** for § 34c GewO; the permit comes from the IHK or local authority, so ask for the permit and check with the issuer ([IHK München](https://www.ihk-muenchen.de/berufszugang/gewerbeerlaubnisse/34c-erlaubnis/)) | Justiz Dolmetscher- und Übersetzerdatenbank (justiz-dolmetscher.de) | Lawyers only (RDG) |
| AT | ÖRAK lawyer search | Ärztekammer doctor list | KSW (Kammer der Steuerberater und Wirtschaftsprüfer) | † GISA (Immobilientreuhänder is a regulated trade) | Gerichtsdolmetscher list (justiz.gv.at) | Lawyers |
| NL | NOvA Advocatenzoeker | BIG-register (has a web service) | NBA (accountants); tax advice is unregulated | Unregulated (NVM membership) | † **Rbtv** (Bureau Wbtv), by name, number or language ([bureauwbtv.nl](https://www.bureauwbtv.nl/opdrachtgevers-intermediairs/register-beedigde-tolken-vertalers)) | Lawyers |
| IT | CNF Albo nazionale | FNOMCeO register | CNDCEC Albo commercialisti | Registro Imprese / REA (the old *ruolo* was abolished) | No national register (sworn per translation at court) | Lawyers |
| SE | Advokatsamfundet | Socialstyrelsen HOSP licence search | Revisorsinspektionen (auditors) | Fastighetsmäklarinspektionen register | † Kammarkollegiet register of authorised translators (required by law, [förordning 1985:613](https://lagen.nu/1985:613)) | Lawyers |
| FR | CNB annuaire | Annuaire Santé (RPPS) | Ordre des experts-comptables | CCI *carte professionnelle* | Court of appeal lists of *experts judiciaires* | Avocats |
| UK | SRA register (has an API) | GMC register | ICAEW, ACCA, CIOT; † HMRC AML Supervised Business Register | Redress-scheme membership (TPO, PRS); HMRC AML | NRPSI, CIOL | † **IAA Adviser Finder** (formerly OISC) ([gov.uk](https://www.gov.uk/find-an-immigration-adviser)) |
| US | State bar lookups | FSMB DocInfo; state boards | CPAverify; IRS PTIN directory | State real-estate commission (ARELLO) | ATA certified directory; court interpreter lists | Attorneys + EOIR accredited representatives |
| CA | Provincial law societies (LSO …) | Provincial colleges (CPSO …) | CPA provinces | RECO (ON), BCFSA (BC) … | ATIO, OTTIAQ … | **CICC register** (RCIC numbers) |
| AU | State law society registers | AHPRA register | Tax Practitioners Board register | State licence registers (NSW Fair Trading …) | **NAATI** online directory | **Register of migration agents** (MARN) |
| TR | TBB / bar *levha* search, by name or sicil number ([secondary](https://hukukcularevi.com/avukatim-gercek-mi-sahte-avukat-sahte-dava-duyurusu-dogrulama-baro-levhasi-av-k-35-63-vekaletname-sorgulama-uyap-fon-magduru/)) | e-Devlet doctor query | TÜRMOB | † **Emlak yetki belgesi** check at [ttbs.gtb.gov.tr BelgeSorgula](https://ttbs.gtb.gov.tr/Home/BelgeSorgula) | Through notaries; no central list | Lawyers |

**[assessment] Immigration advice is the riskiest service category for an Iranian audience.** Every launch country has a licence register for it, or limits it to lawyers. Check the licence number every time, and put the number on the badge («شماره مجوز RCIC: …»).

## 2.5 Light extra signals (all free)

| Signal | How | Weight | Owner minutes |
|---|---|---|---|
| **Payment from a business account with the matching name** | Pro by SEPA transfer or a company card: the payer or cardholder name equals the register name | **Strong** (banks have done KYC) | 0–1 |
| **Callback to the *public* number** | The number from the website, Google Maps or the register, never the one on the form. WhatsApp call: «سلام، از پیدو تماس می‌گیرم برای تأیید پروفایل…» | Strong against impersonation | 2–3 |
| **A code sent to the domain email** | info@theirdomain, where the domain matches the name | Medium | 0 (automatic) |
| **Website Impressum matches** (DE and AT) | Name, address and register number on their own site | Medium | 1 |
| **Google Business profile** | Exists, same address, reviews older than 6 months | Medium | 1 |
| **Instagram or Telegram age** | An account with history, the same name and phone | Weak to medium | 1 |
| **Address type** | Not a virtual office or PO box (AI check on the address) | Medium for Group A | 0 |

## 2.6 The tiered Peydoo verification

### Level 0: self-declared business (free, automatic)

- **Input:**
  - business name, legal form, address, phone (verified by SMS or WhatsApp), category;
  - register or VAT number (optional), Impressum fields (DE and AT);
  - the self-declaration.
- **Automatic:** VIES if a VAT ID is given; FR SIRENE, AU ABN and UK Companies House where there are APIs. A match **pre-fills Level 1**, but no badge yet.
- **Shown as** «کسب‌وکار» (no badge).
- **Group A categories can't publish at Level 0.**

### Level 1: «تأییدشده» (a document plus a register or VAT check, 3–10 minutes)

1. **The business uploads one document** (see the table). The AI pre-reads it: OCR plus an LLM extracting name, address, number, issue date and issuer, with a crude edit check (fonts, metadata).
2. **A register or VAT check:** automatic where an API exists; otherwise the owner clicks the link that Peydoo builds with the number filled in.
3. **The AI shows one screen:**
   - document fields | register fields | profile fields;
   - mismatches in red;
   - the light signals.
4. **The owner decides** (approve / ask / refuse) and logs the result.
5. **Group A also needs a licence register check** (+2–4 minutes).
6. **Re-checks:**
   - automatic VIES or API re-check every 90 days;
   - a full re-check every 12 months, or on a change of name, address or legal form.

### Level 2: Turkey and high-risk categories (adds sanctions, about 15–20 minutes)

- **When:**
  - all of Turkey;
  - anywhere: travel agencies selling Iran flights, freight or shipping, import and export, currency exchange, gold, property sales in Turkey or Dubai, and any business that pays from a non-EU account.
- **Steps:**
  - Level 1 steps;
  - **name screening of the company, owners and managers** (OpenSanctions /match about €0.10 a name, or Didit AML $0.20), plus the daily diff of the free EU, UN, UK and OFAC lists;
  - ownership from a public record (UK PSC; TTSG for a Turkish Ltd);
  - a callback to the public number;
  - **payment only from the company's own account**;
  - the signed declaration;
  - the research 9 TR §3.5 records.

### Minutes and cash per check (owner at €40 an hour [assessment])

| Country | Level 1 document (one of these) | Register / VAT step | Auto? | Level 1 minutes | Level 1 cash | Level 2 adds |
|---|---|---|---|---|---|---|
| **DE company** (GmbH, UG, e.K.) | Handelsregister printout (from the free portal) | Handelsregister search by name (manual, 1–2 min) + VIES if a VAT ID | Partly | **5–7** | €0 | +8–10 min, €0.30–0.80 |
| **DE Gewerbe sole trader** | Gewerbeanmeldung (personal data covered except name, business address, activity) | VIES if any; a Berlin eAuskunft is free; other cities ask the doc + callback | Partly | **7–10** | €0 (Munich query €15: don't routinely) | same |
| **DE Freiberufler** | Finanzamt letter allotting the tax number (number covered except the last 4 digits) **or** a chamber ID | **Not checkable.** Use the professional register (Group A) or 2 strong signals (payment name + callback) | No | **8–10** | €0 | same |
| **AT** | GISA extract or Firmenbuch Kurzinformation | GISA (free, 1–2 min) + VIES (automatic) | Partly | **4–6** | €0 | same |
| **NL** | KVK extract (they can download it) | KVK API (€0.02) or free web search + VIES | **Yes** with the API | **3–5** | €0–0.02 (+€6.40 a month) | same |
| **IT** | Visura camerale or the Partita IVA certificate | AdE Verifica PI (captcha) + VIES (automatic, with name) | Mostly (VIES) | **4–6** | €0 | same |
| **SE** | Registration certificate (*registreringsbevis*) or F-skatt certificate | Skatteverket lookup (email reply; finish the next sweep) + VIES + Bolagsverket API | Partly | **4–6** (in two sittings) | €0 | same |
| **FR** | Avis de situation SIRENE or Kbis | API Recherche d'entreprises (**automatic**) + VIES | **Yes** | **3–4** | €0 | same |
| **UK Ltd** | Certificate of incorporation or CH printout | Companies House API (**automatic**, officers + PSC) + HMRC VAT API if VAT-registered | **Yes** | **3–5** | €0 | +5–8 min (PSC already pulled) |
| **UK sole trader** | A utility or bank letter with the business name, or HMRC self-assessment letter (UTR covered) | **No register.** Licence or AML register (Group A) + payment name + callback | No | **8–10** | €0 | same |
| **US** | State formation certificate or DBA certificate | State SoS search (find the state; 2–4 min) or county DBA | No | **6–10** | €0 | +8–10 min |
| **CA** | Federal or provincial registration or master business licence | Corporations Canada / OBR / REQ search + GST/HST registry (needs BN + name + date) | Partly (federal API) | **6–10** | €0 (avoid paid profile reports) | same |
| **AU** | None needed: the ABN is the document | **ABN Lookup API (automatic)**, sole traders + GST | **Yes** | **2–3** | €0 | same |
| **TR** | Vergi levhası + faaliyet belgesi (barcodes) | e-Devlet + ITO barcode checks (captcha) | No | **5–8** | €0 | **Level 2 is mandatory:** TTSG partners (Ltd) + screening + callback; **15–20 min, about €0.50–1** (research 9 TR §3.6) |
| Group A, any country | + licence number | Licence register search (+2–4 min) | No (SRA has an API) | **+2–4** | €0 | — |

**Monthly load [assessment]:**
- 20 Level 1 checks at about 6 minutes = **2 hours**;
- 5 Level 2 checks at about 18 minutes = **1.5 hours**;
- total **about 3.5 hours a month**.
- Batch them into the existing weekly sweep. Promise «بررسی تا ۷ روز» (within 7 days), so nobody expects instant approval.
- Above 50 a month, buy the KVK and Didit APIs first, then reconsider.

### Where the AI pre-reads (and where it must not decide)

- **Yes:**
  - extracting fields from uploaded documents in DE, AT, NL, IT, FR and TR (Gewerbeanmeldung, extracts, visura, Kbis, vergi levhası);
  - comparing them with the API result;
  - flagging mismatches, virtual-office addresses and edited PDFs;
  - drafting the "ask" message in Persian;
  - classifying a service into group A, B or C;
  - spotting licence words («رسمی», "beeidigt", "RCIC").
- **No:**
  - approving on its own;
  - clearing a sanctions hit;
  - judging an ID photo.
- **The owner makes every badge and Level 2 decision.** That is also the DSA and P2B record of a human decision.

## 2.7 Data protection (GDPR; for the lawyer to confirm)

1. **Don't collect ID at Level 1.** Business registers prove the *business*. Only Level 2, and only on a red flag, uses a live video look at an ID. **Nothing is stored except "ID seen, name matched, date, by whom".**
   - **[not re-checked today]** In Germany, copying an identity card needs the holder's consent and must be marked as a copy (PAuswG § 20).
   - Peydoo has no GwG duty that would justify keeping copies.
2. **Uploaded documents:**
   - store them encrypted;
   - visible only to the owner;
   - **deleted automatically 7 days after the decision.**
   - **Keep:**
     - document type;
     - issuer;
     - issue date;
     - register type and number;
     - VAT ID;
     - the register's answer (name, address, status, as text);
     - the VIES or API request ID;
     - date;
     - reviewer;
     - decision and reason.
3. **Tax numbers (Steuernummer, UTR, SSN-based EIN for US sole traders, Turkish TCKN): never stored in full.** Ask people to cover them except the last 4 digits. Store the last 4 only.
4. **Sole traders' register data is personal data.** Company register numbers and VAT IDs are public, but they are linked to a person, so:
   - the legal basis is Art. 6(1)(b) (the business-profile contract) and (f) (fraud prevention);
   - put it in the privacy notice;
   - Art. 5(1)(c) minimisation: only what you need;
   - (e) retention: verification records for the life of the profile + 3 years; **Level 2 sanctions records 5 years** (research 9 TR §3.5).
5. **The AI processor:** document images go to the LLM provider under its DPA, with no training on API data and the shortest retention offered. Send only the document, not the user's chat history. Record it in the processing register.
6. **The badge text and its removal:**
   - say exactly what was checked and when;
   - removing a badge or refusing Level 1 is a restriction of a business user, so give a statement of reasons (DSA Art. 17; P2B).

---

## Questions for the lawyer (new)

1. Is a «تأییدشده» badge wording that says "registration checked, quality not checked" enough to avoid UWG § 5 risk? Must the ranking-parameter disclosure mention verified status if there is a "verified only" filter but no boost?
2. Group A: may Peydoo require a licence for legal, immigration and tax advice listings, and refuse unlicensed ones as "illegal content" under the DSA (RDG, StBerG)? Or only as a terms rule?
3. Is storing the last 4 digits of a tax number, plus the register answers, proportionate? Is the 7-day deletion of uploads fine as evidence?
4. Reviews on business profiles: what does § 5b Abs. 3 UWG require us to state about checking reviews?

## Weak evidence and gaps

- **Kleinanzeigen:**
  - the posting flow for private users in *Dienstleistungen* was not tested while logged in;
  - the start date of the sign-up sentence is unknown;
  - ratings and "Sicher bezahlen" facts are [1 source] each;
  - no PRO price for the services group is published.
- **willhaben:** the rules page carries no version date in the text we extracted.
- **Marktplaats:**
  - the hub pages carry no date;
  - the €21 / €54 price is a search extract.
- **VIES Germany:** name and address withheld, per third parties only; the DE node was down during the test.
- **Austria:** whether the Firmenbuch HVD API is free without ID Austria is unclear.
- **Sweden:** the Bolagsverket HVD API facts are secondary.
- **France:** the Recherche d'entreprises rate limit is a third-party figure.
- **Canada:** the BC Registries fees were not found. The GST/HST name-match weakness is from around 2012.
- **Vendors:** Didit KYB is "staging"; the Middesk, Creditsafe and Persona figures are third-party.
- **Section 2.4:** most licence-register rows are [not re-checked today]. Check each URL once before the first Group A check.
