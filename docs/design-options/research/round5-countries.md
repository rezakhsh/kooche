# Peydoo: next countries, round 5 (France, Turkey, UAE, Austria, and the rest)

25 Oct 2026 · web research only, nothing in the app changed. This checks and adds to round 4 (`docs/design-options.md`, "Next countries") and `docs/strategy.md`.

**This is not legal or tax advice.** Every legal and VAT point below is background for the lawyer and the tax advisor. **[1 source]** marks a fact I could confirm in only one source.

Where I could, numbers come straight from official data: Statistik Austria's tables, Eurostat's API (residence permits, asylum, population by country of birth), INSEE and ABS.

---

## 1. Recommended order and timing

| When | Country (city) | Mode |
|---|---|---|
| **Now** (before Yalda, 21 Dec 2026) | **Germany** (Berlin, then Hamburg, Frankfurt, Cologne, Munich) | Open, seeded by hand |
| **Now** | **Austria** (Vienna) | **Waitlist on a short timer.** Open it as soon as **either** Berlin passes its first city gate **or** Vienna reaches 300 confirmed sign-ups and 15 businesses. In practice that is months 2–4 (Q1 2027). See §6. |
| Months 6–9 (mid-2027) | **Netherlands** (Amsterdam, Randstad) | Opens after its waitlist. EU, so little extra cost. |
| Months 9–12 (late 2027) | **Canada** (Toronto) | As in the strategy. Newcomers are rising. |
| Year 2, first half (2028) | **Italy** (Milan, Turin, Rome) *new*, and/or **Sweden** (Stockholm) | Opens after its waitlist. Italy is the EU's fastest-growing Iranian community and is made up of students, so it is mostly a rooms market. Sweden is larger but older, and new arrivals are falling. |
| Year 2, second half | **UK** (north-west London) | As in round 4 |
| Year 2–3 | **France** (Paris) | **Waitlist only.** Open Paris only if its waitlist passes the gate. The French terms and the mediator come first. See §3. |
| Year 3 | **US** (Los Angeles), then **Australia** (Sydney) | US newcomers are close to zero since the 2026 visa bans. Australia is growing. |
| Not planned | Belgium, Denmark, Norway, Switzerland, Spain | Too small to open on their own. Revisit as "nearby" cities (Brussels with France or the Netherlands, Zurich with Austria). Spain is worth watching (see §7). |
| **Turkey** | — | **No marketplace.** Now: a waitlist plus a static Persian guide for Turkey. Year 2: perhaps a partner-run pilot with events and verified businesses only. See §4. |
| **UAE** | — | **Keep closed**, without promoting a waitlist. Review no earlier than 2028. See §5. |

**Corrections to round 4:**
- "Vienna is already open" no longer matches the owner's plan. Austria is now a waitlist country, with the short timer above.
- "Turkey: no Stripe" was half right. Stripe has no merchant accounts in Turkey ([Stripe global](https://stripe.com/global)), but people with Turkish cards can still pay our German Stripe account. The real blockers in Turkey are something else (§4).
- On Stripe across the board: Stripe's restricted list covers anyone "located in, resident in, **or a citizen of**" Iran ([Stripe restricted businesses](https://stripe.com/legal/restricted-businesses)). This is already in `docs/payments-iran.md`. It weighs most in countries where many users hold only an Iranian passport (Turkey, the UAE, newcomers everywhere). The sanctions lawyer should look at it again before Pro sales start.

---

## 2. Country table

Iranian population figures count people *born in Iran* unless the cell says otherwise. Newcomers are Eurostat **first residence permits** to Iranian citizens in 2025 ([Eurostat migr_resfirst](https://ec.europa.eu/eurostat/databrowser/view/migr_resfirst/default/table)) and **first-time asylum applicants** from Iran: the 2025 total, then January to the latest month of 2026 ([migr_asyappctza](https://ec.europa.eu/eurostat/databrowser/view/migr_asyappctza/default/table), [migr_asyappctzm](https://ec.europa.eu/eurostat/databrowser/view/migr_asyappctzm/default/table)).

| Country | First city | Iranian population (source, year) | Newcomers | Competition | Legal and tax cost to us | Payments | Verdict |
|---|---|---|---|---|---|---|---|
| Germany (base) | Berlin | 256k Iran-born immigrants, 162k Iranian citizens ([IW 2026](https://www.iwkoeln.de/fileadmin/user_upload/Studien/Kurzberichte/PDF/2026/IW-Kurzbericht_2026-Iranische-Zuwanderer-in-D.pdf), 2024). Berlin ≈13.5k citizens ([Statista](https://de.statista.com/statistik/daten/studie/1094889/umfrage/anzahl-der-auslaender-in-berlin-nach-staatsangehoerigkeit), 2024) **[1 source, read off a chart]** | 18,718 permits (2025, 5,358 of them for study); asylum 2,270 (2025), 950 (Jan–Jul 2026) | Telegram, Kleinanzeigen | Base setup | Stripe, SEPA, PayPal | **Open now** |
| **Austria** | Vienna | **33,783** (1 Jan 2026), **Vienna 19,957**; +31% since 2022. Iranian citizens 18,976, Vienna 11,312 ([Statistik Austria tables](https://www.statistik.at/statistiken/bevoelkerung-und-soziales/bevoelkerung/bevoelkerungsstand/bevoelkerung-nach-staatsangehoerigkeit/-geburtsland)) | 1,489 permits (2025); asylum 415 (2025), 310 (Jan–Sep 2026) | Telegram, willhaben | Close to zero: DSA supervised by Germany, same German-language legal texts, EPS already in Checkout | Same as Germany | **Waitlist on a short timer (§6)** |
| Netherlands | Amsterdam | 48,447 born in Iran ([Eurostat](https://ec.europa.eu/eurostat/databrowser/view/migr_pop3ctb/default/table), 2025); 65,721 with an Iranian background ([CBS via allecijfers](https://allecijfers.nl/migratie/iran/), 2026) | 3,156 permits (2025); asylum 430 (2025), 335 (Jan–Sep 2026) | Telegram, Marktplaats | Low (EU; no language law found for consumer terms; to check) | Stripe, iDEAL | **Months 6–9** |
| Canada | Toronto | ≈281k by ethnic origin (StatCan, 2021, round 4) | Permanent residents from Iran ≈5,495 in Jan–Jul 2026, +31.6% on 2025 ([ITCI analysis of IRCC data](https://www.itciland.com/en/blog/canada-pr-admissions-by-country-jan-jul-2026)) **[1 source]**. Overall permanent residents held at 380k a year; temporary arrivals cut, students −49% ([IRCC levels](https://www.canada.ca/en/immigration-refugees-citizenship/corporate/mandate/corporate-initiatives/levels.html)) | Canadajoo, Telegram (round 4) | GST above C$30k; CASL; Quebec language law (avoid Quebec at first); 6 hours behind Germany for moderation | Stripe | **Months 9–12** |
| Italy *(new)* | Milan | 30,532 born in Iran ([Eurostat](https://ec.europa.eu/eurostat/databrowser/view/migr_pop3ctb/default/table), 2025, +53% since 2022); 23,626 citizens, doubled since 2019, mostly students; Lombardy 5,980, Piedmont 4,058, Lazio 3,044 ([Il Sole 24 Ore](https://en.ilsole24ore.com/art/iranian-community-italia-doubled-in-the-last-six-years-AIJXH9nB), 2025) | 3,645 permits (2025), **2,928 of them for study** | Telegram groups (not measured) | Low (EU). The consumer code may require information in Italian (to check). The tenants are transient students. | Stripe | **Year 2** |
| Sweden | Stockholm | 87,115 ([Eurostat](https://ec.europa.eu/eurostat/databrowser/view/migr_pop3ctb/default/table), 2025) | 1,380 permits (2025, **−50% since 2022**); asylum 220 (2025) | Blocket (strong) | Low (EU) | Stripe, Swish via Stripe | **Year 2**, after Italy |
| UK | London | ≈110k (ONS 2021, round 4) | 7,400 asylum claims in 2025, about 4,500 crossed by small boat ([Migration Observatory](https://migrationobservatory.ox.ac.uk/resources/commentaries/iranian-migration-to-the-uk-in-7-charts/)) | IraniLink | VAT from the first £ for sales to consumers ([Crunch on NETPs](https://www.crunch.co.uk/article-crunch-hub/non-established-taxable-persons-netps-and-vat-in-the-uk)); Online Safety Act risk assessments, already overdue for services in scope ([Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2025/08/the-online-safety-act-enters-phase-2)); Ofcom has fined small foreign sites ([4chan £20k](https://www.computing.co.uk/news/2025/legislation-regulation/ofcom-fines-4chan-twenty-thousand)); UK GDPR representative | Stripe | **Year 2, second half** |
| France | Paris | **26,000** Iran-born immigrants ([INSEE Première](https://www.insee.fr/fr/statistiques/8226711), 2023); 23,800 ([INSEE](https://www.insee.fr/fr/statistiques/6478089), 2019). The Paris share is not published. | 2,342 permits (2025, 986 for study); asylum 525 (2025), **570 (Jan–Sep 2026, already above 2025)**; Campus France: 2,671 Iranian students in 2022/23 ([Campus France](https://ressources.campusfrance.org/publications/mobilite_pays/fr/iran_fr.pdf)) | No Persian classifieds site found; leboncoin dominates | Medium: French versions of the terms and paid offers, a consumer mediator, CNIL cookie rules, more VAT (§2a) | Stripe, Cartes Bancaires | **Waitlist; year 2–3** |
| US | Los Angeles | ≈750k Iranian Americans (Pew 2026, round 4) | ≈0: all visas for Iranians suspended (Proclamation 10998 from 1 Jan 2026) and USCIS holds on most applications from people born in Iran ([Alston & Bird](https://www.alston.com/en/insights/publications/2025/12/us-travel-restrictions-january-2026), [Dickinson Wright](https://immigration.dickinson-wright.com/2025/12/22/updated-summary-of-the-travel-ban-and-its-impact-post-december-16/)) | Older Persian portals, Facebook | State sales tax nexus; US sanctions exposure; 9 hours behind | Stripe | **Year 3** |
| Australia | Sydney | **95,690** (30 June 2025, preliminary; 80,370 in 2022) ([ABS 3409.0 table](https://www.abs.gov.au/statistics/people/population/australias-population-country-birth/latest-release)) | Visitor visas of Iranians abroad suspended for 6 months from 26 Mar 2026 ([Mondaq](https://webiis10.mondaq.com/australia/work-visas/1765582/australia-bans-entry-for-iranian-visitor-visa-holders-for-six-months)) | Not measured | GST above A$75k; Phase 2 online safety codes from 9 Mar 2026 ([Baker McKenzie](https://www.bakermckenzie.com/en/insight/publications/alerts/2025/09/australia-phase-2-online-safety-codes-registered-by-esafety-commissioner)); the under-16 social media ban probably excludes product and service listing sites ([Clayton Utz](https://www.claytonutz.com/insights/2025/october/social-media-age-restrictions-esafety-commissioner-provides-regulatory-guidance)); 9 hours ahead | Stripe | **Year 3** |
| Turkey | Istanbul | **134,402** born in Iran ([Eurostat](https://ec.europa.eu/eurostat/databrowser/view/migr_pop3ctb/default/table), from TurkStat, 2025; 151,348 in 2023); 76,400 residence permits ([Kun.uz citing the Interior Ministry](https://monitor.kun.uz/en/news/2025/04/09/trkiye-sees-growing-uzbek-expat-community-amid-surging-regional-migration), Apr 2025) **[1 source]** | 31,486 Iranian students ([YÖK via Serbestiyet](https://serbestiyet.com/featured/turkiye-dunyada-en-fazla-uluslararasi-ogrenciye-sahip-8-ulke-337-bin-yabanci-ogrenci-turkiyede-okuyor-246061), 2024/25); 60,600 Iranians crossed the border in March 2026, most of them passing through ([ACAPS](https://www.acaps.org/en/countries/turkey)) | Instagram and Telegram agents, sahibinden | **High** (§4) | No Stripe merchant accounts in Turkey; Turkish VAT from the first lira | **No marketplace** |
| UAE | Dubai | ≈500k is an old 2012 Reuters estimate ([Wikipedia](https://en.wikipedia.org/wiki/Iran%E2%80%93United_Arab_Emirates_relations)); no current figure | Shrinking: residence permits cancelled and entry restricted in 2026 (§5) | Dubizzle | **High** (§5) | Stripe is available | **Closed** |

### 2a. VAT across all EU countries (to confirm with the tax advisor)
- **Below €10,000 a year of cross-border sales to consumers across the whole EU**, our electronic services to consumers in Austria, France, the Netherlands and the rest are taxed as German sales. The §19 UStG exemption therefore still applies. This €10k is **one shared allowance for all EU countries together**, so every EU country we open uses it up faster ([Ecovis](https://ecovis-kso.com/blog/die-kleinunternehmerregelung-ab-2025-wichtige-aenderungen-und-chancen-fuer-selbststaendige/)).
- **Above €10k**, the tax is due where the customer lives. There are two routes:
  - (a) Register for OSS and charge Austrian or French VAT (20%), while German sales stay exempt.
  - (b) Use the EU small-business scheme (§19a UStG, since 2025). It requires total EU turnover of at most €100k and staying under each country's own threshold. France's threshold for services is about €37,500, but the 2026 budget law was not confirmed ([Bpifrance](https://bpifrance-creation.fr/entrepreneur/actualites/plf-2026-franchise-base-tva-annoncee-a-37-500-eu)). Austria's is €55,000 (my figure, not checked here).
- The German limits are €25k for the previous year and €100k for the current year ([IHK](https://www.ihk.de/schwerin/recht/steuern-und-finanzen/kleinunternehmerregelung-6403002)).
- **Pro sold to businesses in other EU countries:**
  - The business pays the VAT itself under the reverse charge, and the invoice has to say so. These sales don't count towards the €10k.
  - We may treat a sale as business-to-business only if the buyer gives a valid VAT number (checked in VIES).
  - Many small Iranian businesses in France (micro-entrepreneurs) have no EU VAT number. Their purchases therefore count as consumer sales.
  - Ask the advisor two things: do we need our own VAT ID, and does a summary report (*Zusammenfassende Meldung*) apply to a Kleinunternehmer?

---

## 3. France

**Size and newcomers.**
- France has 26,000 people born in Iran (INSEE, 2023), up from 23,800 in 2019 and 19,300 in 2009. That is smaller than Austria (33.8k), Italy (30.5k), the Netherlands (48k) and Sweden (87k).
- INSEE describes the community as largely people who arrived in the 1970s and after 1979 ([INSEE Première](https://www.insee.fr/fr/statistiques/8226711)): older, settled and fluent in French.
- INSEE doesn't publish an Île-de-France breakdown for Iran, so the Paris share remains unknown. Long-distance immigrants mostly settle in Paris and the inner suburbs ([INSEE](https://www.insee.fr/fr/statistiques/2019712)), so Paris is very likely the majority. That is an inference.
- Newcomers:
  - about 2,300–2,500 first permits a year, about 40% for study;
  - 2,671 Iranian students in 2022/23, +36% in 5 years, 60% women (Campus France);
  - asylum 525 in 2025, but **570 already in January–September 2026**. France is one of the few EU countries where Iranian asylum is rising in 2026.

**Competition.**
- I found no Persian classifieds site for France, and I couldn't measure Telegram or Facebook groups. TGStat's search needs a login, and nothing came up in web search.
- leboncoin (Adevinta) is the default.
- The older community is likely served by leboncoin in French. The opening is newcomers and students: rooms, first jobs, Persian-speaking services.

**Legal costs.** Not legal advice.
- **DSA:** supervised by Germany (the country of main establishment), not by Arcom. This adds no cost.
- **Loi Toubon:**
  - The culture ministry says websites are not "places open to the public" for its signage rule ([Ministère de la Culture](https://www.culture.gouv.fr/thematiques/langue-francaise-et-langues-de-france/agir-pour-les-langues/garantir-l-emploi-du-francais)).
  - But Article 2 (offering and presenting goods and services, advertising) applies to distance contracts made over the internet ([Assemblée nationale answer](https://www.assemblee-nationale.fr/dyn/15/questions/QANR5L15QE2838.pdf)).
  - The law allows a translation *next to* the French text, so Persian can stay. Our paid offers to consumers in France (Pro, bumps, featured listings), their prices and the terms that go with them should also exist in **French**.
  - Users' own Persian listings are their speech, not our commercial offer; this probably needs no translation, but the lawyer should confirm.
  - Whether the law reaches a German-established site is not settled in the sources I found. Penalties exist: the DGCCRF sent 53 cases to prosecutors in 2023.
  - Cost estimate: a French translation of the terms, privacy policy and paid-service pages plus a review by a French lawyer, about €1.5–3k (my estimate).
- **Consumer mediator (L.612-1):**
  - French professionals must offer a listed consumer mediator and name it on the site ([economie.gouv.fr](https://www.economie.gouv.fr/node/3234440)).
  - Whether this binds a trader established elsewhere in the EU is unclear: one source says it covers traders "established in France", while L.611-2 covers cross-border disputes.
  - It is cheap to comply (a mediator subscription), so plan for it.
  - The EU ODR link is no longer required since 20 July 2025 ([CMS](https://cms.law/en/deu/legal-updates/the-odr-platform-is-closing-what-businesses-need-to-know)).
- **Platform information duties (L.111-7, D.111-6 ff.):**
  - These require clear information on ranking, delisting and paid influence on ranking ([CMS](https://cms.law/fr/fra/a-la-une/plates-formes-numeriques-la-start-up-nation-ne-se-fera-pas-au-detriment-des-consommateurs)).
  - This largely overlaps with what the DSA (Art. 27) and the German UWG already require, so we need a French paragraph, not new features.
  - The heavier good-practice duties apply above a visitor threshold (reportedly 5 million a month **[1 source]**).
- **CNIL cookies:**
  - France does not use the GDPR one-stop shop for cookies, so the CNIL itself enforces them, under Article 82 of the Informatique et Libertés law. The Conseil d'État confirmed this against Google and Amazon in 2022 ([Siècle Digital](https://siecledigital.fr/2022/06/28/la-sanction-de-la-cnil-contre-amazon-validee-par-le-conseil-detat/)), although those cases relied on a French establishment, which we don't have.
  - CNIL also requires "refuse" to be as easy as "accept".
  - On today's facts (only strictly necessary cookies, no analytics) **this costs nothing**. It becomes a cost the day we add analytics or a pixel; CNIL's exemption for audience measurement is narrower than people expect.
- **VAT:** see §2a. France speeds up the €10k cross-border limit.

**Verdict:**
- France is not a near-term market. The community is small and French-speaking (26k, smaller than Austria's), we found no Persian supply to win over, and France has extra one-off costs (French texts, mediator).
- Put Paris on the waitlist page now, at no cost. Open it in year 2–3 only if the waitlist passes the gate, with the French texts done first.
- Watch the 2026 asylum rise.

---

## 4. Turkey: honest picture, options, recommendation

**Who is there:**
- 134k people born in Iran (TurkStat via Eurostat, 2025), falling from 151k in 2023;
- about 76–81k residence permits (Interior Ministry figures quoted in the press, 2024–25);
- 31.5k Iranian university students, the fourth-largest group (YÖK 2024/25);
- Iranians were the **second-largest foreign buyers of homes** in 2025, with 1,878 purchases ([BirGün citing TÜİK](https://www.birgun.net/haber/turkiye-de-en-cok-konut-satin-alan-yabancilar-belli-oldu-685675)).

Many are in transit or circular: since the war began, most border crossers went on via Van airport, and on some days more people returned than left ([AP via DT Next](https://www.dtnext.in/news/world/irans-border-with-turkey-offers-way-out-but-few-leaving-for-good)). Cities: Istanbul, Ankara, Van, and the satellite cities where asylum seekers must register (Ağrı, Erzurum, Kayseri; Denizli and Eskişehir in older reports).

**What they need:**
- rentals and room shares;
- jobs (but work permits are hard to get, so informal work is common);
- residence-permit (*ikamet*) renewals, which are being refused more often in 2026, with some people ordered to leave ([Iran International](https://www.iranintl.com/en/202607026567));
- university admission, translation and notary help;
- a way onward to Europe or Canada.

**Risks for us:**
1. **Turkish law blocks our main category.**
   - Since the 2023 change to the property trading regulation, ad platforms must verify the advertiser's identity, and from 1 Jan 2025 their *authority* too, through e-Devlet's EİDS. This applies to rental ads (sale ads followed) **and vehicle ads**, "including social media".
   - Only the owner, close relatives, or a licensed agent the owner has authorised in e-Devlet may post. Fines start at about TRY 100k ([Log](https://www.log.com.tr/ticaret-bakanligi-eids-sistemi-kiralik-tasinmaz-ilanlari-icin-zorunlu-olacak/), [CNN Türk](https://www.cnnturk.com/ekonomi/galeri/konut-ilanlarinda-yeni-donem-resmen-basladi-artik-cezasi-en-az-100-bin-lira-2213399)).
   - A foreign Persian site can't plug into e-Devlet. Tenants subletting rooms, the typical Iranian listing, may not post at all.
   - So **legal housing and car listings in Turkey are close to impossible for us.**
2. **The scams target exactly these needs.**
   - Fake *ikamet* and visa services take fees and deliver nothing ([IranWire, Feb 2025](https://iranwire.com/en/features/139259-scammers-target-desperate-iranians-as-t%C3%BCrkiye-tightens-immigration/)).
   - A university-admission scam took $45–150k per family, with 17 suspects, 15 of them Iranian ([VisaVerge](https://www.visaverge.com/news/stricter-immigration-in-turkiye-fuels-rise-in-scams-targeting-iranians/)).
   - Add the resale of Schengen appointments, people smuggling to Greece, and havaleh and money changing. Turkey is also a known route for trade that evades the Iran sanctions.
   - The moderation load would be of a different kind than in Germany, and in Turkish as well as Persian.
3. **Law 5651:**
   - A local representative, 48-hour removals and the advertising-ban and 90% throttling penalties apply only to "social network providers" with more than 1M daily users from Turkey ([CMS](https://cms.law/en/tur/legal-updates/turkey-adopts-strict-new-regulations-for-foreign-social-media-platforms), [Gün + Partners](https://gun.av.tr/insights/updates/amendments-to-the-law-no-5651-concerning-social-media)). That is not us.
   - But blocking orders against any site are routine: 1,505,484 domains were blocked in total by the end of 2025, 82% of the 2024 orders by the BTK head without a court ([İFÖD EngelliWeb 2025](https://ifade.org.tr/en/reports/engelliweb-2025/01-introduction/)).
   - Persian political or opposition content, and events by dissidents, can trigger this.
4. **KVKK:**
   - Foreign data controllers without a Turkish entity must appoint a representative in Turkey and register in VERBIS ([Prighter](https://prighter.com/resources/turkey-data-protection-landscape-in-2025)).
   - Since the 2024 reform, transfers abroad (to our EU servers and US providers) need standard contracts notified to the KVKK within 5 working days ([Digital Policy Alert](https://digitalpolicyalert.org/event/24042-adopted-kvkk-standard-contract-notification-module-for-cross-border-data-transfer)).
   - Cost: a representative service at roughly €1–3k a year (estimate) plus a lawyer.
   - Whether KVKK reaches a German site that targets Turkey is debated (to check).
5. **Payments and VAT:**
   - Stripe has no merchant accounts in Turkey ([Stripe global](https://stripe.com/global)), but Turkish cards can pay us.
   - Foreign providers of electronic services to Turkish consumers must register for VAT (20%) **from the first sale**, monthly returns ([Avalara](https://www.avalara.com/vatlive/en/country-guides/asia/turkey/turkish-vat-registration.html), [Kintsugi](https://trykintsugi.com/sales-tax-guides/middle-east/turkey)); the Kleinunternehmer status doesn't help there.
   - The digital services tax applies only above €750M worldwide **[1 source]**.
   - Stripe's "citizen of Iran" clause matters here, because many users have only an Iranian passport.
6. **User safety:** Turkey is where Iranian intelligence has acted against dissidents. A Persian site with chat and accounts creates a data trove we would have to protect.

**Options:**

| Option | What it is | For | Against |
|---|---|---|---|
| (a) Free, limited section | Housing, jobs, services, events; stricter moderation; no Pro | Meets real demand; no VAT | **Housing (and cars) run against EİDS.** Jobs mostly mean informal work. "Services" means *ikamet* and visa agents, the main scam category. KVKK representative needed. Turkish-language moderation. Blocking risk. The worst risk-to-value ratio. |
| (a′) "Turkey lite" | Only **events** and **verified businesses** (Turkish tax plate *vergi levhası*, address, Impressum-style details) with read-only listings and chat to businesses; a static guide; no P2P listings, no payments | Low scam surface; real use (concerts, restaurants, lawyers, translators); no VAT | Still KVKK and 5651 exposure. Needs verification work, ideally by a partner. Limited liquidity. |
| (b) Waitlist only | City card and email, double opt-in | No cost; measures demand | Gives nothing to people who need help now |
| (c) Local partner | A registered association or chamber in Istanbul runs verification and first-line moderation | Local knowledge, Turkish language, legitimacy | Hard to vet (politics, regime links); our liability stays |
| (d) Keep closed | — | No cost | Ignores a large community |

**Recommendation:**
- **Now: (b) plus a static, account-free "Turkey guide" page in Persian.**
  - It links official sources: [goc.gov.tr](https://www.goc.gov.tr) for permits, UNHCR Türkiye, bar-association legal aid.
  - It warns against named scam patterns: *ikamet* "fixers", visa appointment sellers, university placement agents, deposit-first landlords, smugglers.
  - It lets Turkey-based Iranians use the **online events** and **online services** listings from the open countries.
  - Plus a Turkey waitlist without a promised date.
- **Year 2: perhaps pilot (a′) with (c)** if a vetted partner exists and the lawyer confirms the KVKK and 5651 setup.
- **Never** P2P housing, cars, jobs or residence-permit "services" in Turkey without an EİDS-capable Turkish entity. That is a different company, not Peydoo's one-person setup.

---

## 5. UAE

**Situation, 2026:**
- **28 Feb 2026 onwards:** Iranian strikes on the UAE.
- **About 28 March:** the UAE began **cancelling residence permits** of Iranians who were abroad, including some golden visas ([Iran International](https://www.iranintl.com/en/202603290959)).
- **15 March and after:** licences of five Iranian schools revoked (4,000+ pupils). The Iranian hospital, the Iranian Club and the Azad University branch were suspended. Dozens of IRGC-linked money changers were arrested ([Wikipedia: relations](https://en.wikipedia.org/wiki/Iran%E2%80%93United_Arab_Emirates_relations), [Wikipedia: strikes](https://en.wikipedia.org/wiki/2026_Iranian_strikes_on_the_United_Arab_Emirates)).
- **1 April:** Emirates and Etihad stopped Iranian nationals entering or transiting, with exemptions for golden visa holders, professionals and families ([Al-Monitor/Reuters](https://www.al-monitor.com/originals/2026/04/airline-emirates-says-iranian-nationals-barred-entering-or-transiting-uae)). The UAE foreign ministry called the reports "inaccurate". By September a blanket ban could not be verified ([Wego, 7 Sep 2026](https://blog.wego.com/did-uae-ban-iranian-nationals-from-entry-and-transit/)).
- **18 August 2026:** the UAE "halted all trade, exchange, and financial transactions with Iran until further notice" (Wikipedia) **[1 source]**.
- **Population:** the only figure, about 500k, dates from 2012. The real number in late 2026 is unknown and very likely falling.

**Costs and risks for us:**
- **VAT:** non-residents making taxable supplies must register **with no threshold** (5%) ([Avalara](https://www.avalara.com/vatlive/en/country-guides/africa-and-middle-east/united-arab-emirates.html), [Kintsugi](https://trykintsugi.com/sales-tax-guides/middle-east/united-arab-emirates)). The penalty for not registering is reportedly AED 10k **[1 source]**. Whether a tax agent is required was not confirmed.
- **Media law (Decree-Law 55/2023):** in force since Dec 2023. It covers content delivered into the UAE from abroad, requires licences, and sets content standards (respect for religion and the state) ([Pinsent Masons](https://www.pinsentmasons.com/out-law/news/media-law-brings-uae-into-digital-age), [u.ae](https://u.ae/en/Media/Media-In-The-UAE/Media-regulation)). It sits alongside the cybercrime and rumours law (Decree-Law 34/2021).
  - Our events (diaspora politics, memorials, LGBT-friendly parties) and user speech would conflict with these standards.
- **Property ads:** in Dubai, every property ad needs a DLD Trakheesi permit number, applied for by a registered broker with the owner's consent ([Bayut](https://www.bayut.com/mybayut/trakheesi/)). As in Turkey, P2P room ads are a legal problem.
- **Sanctions:** the UAE is the classic hub for re-exports to Iran and for exchange houses, and is under heavy OFAC attention.
- **Payments:** Stripe is available in the UAE ([Stripe global](https://stripe.com/global)), but the "citizen of Iran" clause bites there too.

**Recommendation: keep closed.**
- The community is under pressure and shrinking.
- VAT applies from the first dirham, and the media law sets content rules our users would break.
- Property ads need permits we can't get.
- And it is the region with the highest sanctions risk.
- Show the UAE neither as a country nor as a waitlist. Review no earlier than 2028, and only if residence and banking for Iranians have normalised.

---

## 6. Austria: "Germany open, Austria waitlist" or "both open"?

**Size:** 33,783 people born in Iran (1 Jan 2026), 19,957 of them in Vienna. That is +31% since 2022 and growing faster than Germany. Vienna has 11,312 Iranian citizens; Berlin had about 13,500 (Statista, a single figure read off a chart). **Vienna is roughly as large an Iranian city as Berlin**, and larger than Hamburg or Frankfurt on their own. Newcomers: 1,489 first permits in 2025 and 310 asylum applications in January–September 2026, more than half of 2025's total already.

**Cost of keeping Austria open:** close to nothing. Not legal advice.
- **DSA:** supervised by Germany, our country of main establishment. KommAustria is Austria's coordinator, but it doesn't supervise us. The old KoPl-G was repealed on 17 Feb 2024 by the DSA-BegG ([BGBl. I 182/2023](https://ris.bka.gv.at/Dokumente/BgblAuth/BGBLA_2023_I_182/BGBLA_2023_I_182.pdf)).
- **E-Commerce law:** the ECG's country-of-origin principle means our German Impressum (§ 5 DDG) is enough for the information duties.
- **Media law:** whether we also need a disclosure under § 25 MedienG is a lawyer question (round 3 noted it). It is one line in the footer either way.
- **Consumer law:** Austrian consumer contract law (KSchG, FAGG) can apply to Austrian consumers we target. The lawyer is already asked "does Austria need anything extra" (`docs/setup.md`).
- **Language:** German and Persian, the same texts.
- **Tax and payments:** VAT under the same €10k EU allowance (§2a); EPS already works in Checkout.
- **Already built:** cities, postal codes, events and tests.

**Liquidity:**
- The real cost of "both open" is not legal. An **open but empty Vienna page** says "dead site" to the first visitors, and the owner's seeding hours go to Berlin.
- A waitlist with an honest count turns the same visitors into sign-ups and invitations (the round 4 waitlist research).
- Vienna has its own culture scene (Iranisches Kulturhaus, readings, concerts), so events can seed it cheaply through organisers.

**Recommendation:**
- **Germany open now, Austria on a waitlist with a short timer.**
- Open Austria as soon as **one** of these is true: Berlin passes its first city gate (`docs/strategy.md`), **or** Vienna reaches 300 confirmed sign-ups and 15 businesses (about 25 founding Pro places).
- Start with 2–3 Vienna event organisers and the founding businesses, invited 1–2 weeks before the public opening.
- Expect months 2–4. Because it costs so little, **Austria should open before any non-German-speaking country.**
- If the owner can line up Vienna organisers and businesses before launch, opening both on day one is defensible too. The deciding question is whether there will be ≥30 real Vienna listings or events on day one.

---

## 7. Others, briefly

- **Canada:**
  - The intake of Iranians is up (permanent residents +31.6% in January–July 2026 **[1 source]**). IRCC has 2026 temporary measures for Iranians already in Canada ([IRCC bulletin](https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/operational-bulletins-manuals/updates/2026-iran-temporary-measures.html)).
  - Canada is cutting temporary residents (students −49%), and its embassy in Tehran has been closed since 2012.
  - Still the second country.
- **Netherlands:** stable. 66k with an Iranian background, about 3.2k permits a year. Asylum is falling (1,125 → 430 between 2023 and 2025).
- **Sweden:** large (87k) but new permits have halved since 2022, and Blocket is strong. Move it behind Italy.
- **UK:**
  - Still the largest newcomer flow in Europe (7.4k asylum claims in 2025).
  - The costs are concrete: Online Safety Act illegal-content and children's-access assessments, VAT from the first £, and a UK GDPR representative.
  - Ofcom fines small overseas sites. It fined a US suicide forum £950k ([LBC](https://www.lbc.co.uk/tech/ofcom-online-safety-fine/)).
- **US:** very large but closed to newcomers: visas fully suspended since 1 Jan 2026 and USCIS holds by country of birth. A market of the settled community only. Year 3.
- **Australia:** 95.7k, +19% in three years. But the visitor-visa suspension (Mar–Sep 2026) shows how volatile it is. GST A$75k; online safety codes. Year 3.
- **Not listed in round 4:**
  - **Italy** (30.5k, the fastest growth in the EU, students in Milan, Turin and Rome; added to year 2).
  - **Spain**: 3,616 first permits in 2025, +43% in a year, mostly family. Population not checked. Watch.
  - **Belgium** 17.5k, **Norway** 20.5k, **Denmark** 17.8k (2022), **Switzerland** (not checked): too small for a full country launch. Revisit as nearby cities.
  - Switzerland's VAT for foreign e-services reportedly starts only at CHF 100k worldwide turnover (my figure, not checked here), so it may be cheap later.
- **EU asylum overall:** Iranian applications in the EU+ were about 3,600 in H1 2026, flat on H1 2025 ([EUAA](https://www.euaa.europa.eu/node/32233)). The war has not (yet) caused a large outflow to Europe: Germany is falling, while France and Austria are rising.

---

## 8. Questions for the lawyer and tax advisor (additions)

1. **France:**
   - Does Loi Toubon Art. 2 reach our Persian paid offers to consumers in France? Which texts must be in French?
   - Must a German trader name a French consumer mediator?
   - What do L.111-7 and D.111-7 require below the visitor threshold?
2. **Austria:** is a § 25 MedienG disclosure needed? What do KSchG and FAGG add to our terms?
3. **VAT:**
   - OSS or §19a EU small-business scheme once the €10k is passed?
   - Invoice wording for reverse-charge Pro sales.
   - Do we need a VAT ID, and a summary report (ZM) as a Kleinunternehmer?
   - How to treat EU businesses without a VAT number.
4. **Turkey (only if the a′ pilot goes ahead):**
   - Does KVKK apply to us, and do we need a representative and VERBIS?
   - Does EİDS bind a foreign platform?
   - 5651 duties as a content and hosting provider.
5. **Stripe:** how the "citizen of Iran" clause applies to Iranian-passport holders resident in the EU, Turkey or the UAE.

## Weak evidence

- No Paris share for France.
- No current UAE population.
- Turkish permit counts only from press quotes of ministry data.
- Canada's 2026 permanent-resident figure is from one third-party analysis.
- Berlin's Iranian citizen count was read off a Statista chart.
- No member counts for Telegram or Facebook groups in France or Turkey.
- Italian consumer-code language rule and the Swiss VAT threshold not checked.
