# Peydoo Turkey: how business listings can make money (research 7)

25 Oct 2026. Web research and repo docs only. Nothing in the app was changed. This builds on `docs/design-options/research/round6-turkey-uae.md` (Turkey in "events + verified businesses" mode), `docs/payments-iran.md` and `docs/setup.md` ("Payments and Pro": Pro €24/month or €240/year, Pro Plus €59, bump €1.99, featured €6.99, featured event €9.99).

> **This is not legal or tax advice.** Every sanctions, Stripe, VAT and withholding point below is background for the sanctions lawyer, the tax advisor and a Turkish adviser. **[1 source]** marks a fact I found in only one source. "My estimate" marks numbers I worked out myself, not from a source. FX rate used: **€1 = 55.67 TRY** (ECB reference rate, 23 Oct 2026, fetched from ecb.europa.eu).

**The owner's request:** "Turkey should make money. Business listings there should make money for us, not that we spend money on checking whether they are on the sanctions list."

## Short answer

1. **Screening is not what costs money.**
   - The OpenSanctions API costs **€0.08–0.10 per name** ([OpenSanctions API](https://www.opensanctions.org/api/)). A business with one company name plus 3 partners or managers costs about **€0.40 to check at sign-up**.
   - Re-checking every month through the API would add about €4–5 a year per business. A **daily re-check against the free official lists on our own server** (§2) costs **€0** per check.
   - **What actually costs money** in Turkey:
     - the owner's 20–40 minutes to verify each business;
     - the fixed costs of being in Turkey at all: a KVKK representative (about €1–3k a year, round 5 estimate) and the one-off opinions from the lawyers and the tax advisor.
2. **One fee can pay for all the checks.**
   - Charge a **yearly verification fee of €49 (≈2,700 TRY)**. That is about 100 times the cost of screening, and it also pays for the owner's time.
   - Sell **Pro Turkey for €190 a year (≈10,600 TRY), with verification included**.
   - Add **featured events at €9.99** and **seasonal sponsorships** (Nowruz, Yalda) at €150–300.
3. **Year-1 revenue in Istanbul is small: about €1.8k (low), €4k (mid) or €7.4k (high)** (my estimate, §1.4).
   - That covers screening, card fees and the owner's time.
   - It roughly covers the KVKK representative.
   - It does **not** also pay back the one-off cost of the lawyers in year 1.
   - **Turkey breaks even in year 1 only if the mid case happens and the legal work stays cheap. Year 2 is realistic.**
4. **Taking the money is a bigger problem than screening.**
   - Stripe's restricted list says "Persons **located in, resident in, or a citizen of**" Iran ([Stripe, updated 22 Sep 2026](https://stripe.com/legal/restricted-businesses)).
   - Read literally, that covers **every Iranian-citizen sole trader in Turkey**, including dual Turkish–Iranian citizens.
   - Whether it covers a Turkish *company* with Iranian-citizen partners is unclear.
   - **Get Stripe's answer in writing before the first Turkish sale.**
   - The merchant-of-record alternatives don't help. Paddle forbids "Advertising Services" and marketplaces outright. Lemon Squeezy belongs to Stripe.
   - Turkish payment providers (iyzico, PayTR) need a Turkish company.
   - The fallback is an **invoice paid by bank transfer (SWIFT)**, for yearly plans only.
5. **Tax looks workable for sales to businesses (B2B), but there is one trap.**
   - **Sell only to businesses with a Turkish tax number (VKN) that file VAT returns.**
     - **Turkish VAT:** the buyer reports and pays it itself (*sorumlu sıfatıyla*, VAT return no. 2), so Peydoo doesn't register in Turkey.
     - **German VAT:** the service is supplied where the buyer is (§3a(2) UStG), so it is not taxable in Germany. I read §19(2) UStG as leaving these sales outside the €25k/€100k small-business limits.
   - **The trap: a 15% Turkish withholding tax on internet advertising.**
     - Turkish payers have to withhold it under Decision 476.
     - Under the Germany–Turkey treaty this tax should not apply (business profits, and Peydoo has no permanent establishment in Turkey). In practice Turkey takes the tax first and refunds it only on application.
     - **Plan on receiving 85% of the price from any payer that withholds.**
6. **Timing:** paid sales can start **with the Istanbul starter (mid-2027)** instead of in year 2, but only once four things are in place:
   - a sanctions lawyer's sign-off;
   - Stripe's answer in writing (or the bank-transfer route);
   - the tax advisor's sign-off (plus a Turkish adviser on VAT and withholding);
   - KVKK registration (VERBIS) and a Turkish representative.

---

## 1. Revenue products

### 1.1 What Turkish platforms charge (benchmarks)

| Platform | What businesses pay | Source and notes |
|---|---|---|
| sahibinden.com stores | **Car dealer, 15 listings: 4,409 → 7,750 TRY/month** (late 2024; about €139 at today's rate). **"Premium 15": 16,111 TRY** (2025). Parts seller, 2,000 listings: 4,900 TRY/month. The cheapest 30-day listing package jumped to 2,659 TRY in March 2026. | User complaints on [Şikayetvar](https://www.sikayetvar.com/sahibinden/zam) and [Şikayetvar](https://www.sikayetvar.com/sahibinden/sahibinden-ilan-paketi-fiyati-ani-2659-tlye-cikti). **No official price list is public** (the site returned 403 to my fetch). These are car and property categories, which are high-value and not like a restaurant. |
| Armut.com (marketplace for local service providers) | Providers pay to send offers (leads). One provider paid **1,100 TRY (≈ €20) for a single job** (Aug 2026). | [Şikayetvar](https://www.sikayetvar.com/armut) **[1 source]**. No official fee table found. |
| Google Business Profile, Yandex Business | Free listing and verification | Well known; the real competitors are these plus Instagram and Telegram. |
| Zingat / Hepsiemlak agent packages | **Not found** | Not relevant anyway: estate agents are excluded in Turkey (round 6). |
| Biletix (ticket seller) organiser fees | A "service fee" added to each ticket, which "may vary by event and by agreement with the organiser" | [Biletix help](https://help.biletix.com/hc/en-us/articles/360004040737-Why-do-I-pay-a-service-fee). No public rate. In 2021 the Competition Board told Biletix to avoid exclusivity deals with organisers ([Rekabet](https://www.rekabet.gov.tr/en/Guncel/investigation-concerning-biletix-bilet-d-aff5f00b0662eb11812a00505694b4c6)). |
| Paid verification elsewhere | **Meta Verified for business** launched at $21.99/month (later tiers $15–500) ([Website Planet](https://websiteplanet.com/news/meta-verified-for-businesses)). **X Premium Business** (formerly Verified Organizations) costs $200/month or $1,000/month ([TechCrunch](https://techcrunch.com/2025/10/07/x-splits-verified-organizations-into-premium-business-and-premium-organizations)). **Trustpilot and Google verify for free.** | Charging for verification is common for **ongoing identity products**. Directories and review sites usually verify for free and charge for visibility. |

For scale: the 2026 net minimum wage in Turkey is **28,075.50 TRY/month (≈ €504)** ([QNB](https://www.qnbinvest.com.tr/investodak/qnbarastirma/2026-asgari-ucret-aciklandi-net-28075-tl)). Peydoo's Pro at €24/month is about 1,336 TRY, roughly 5% of that.

### 1.2 Is charging for verification acceptable?

**Yes, as a B2B fee, if three rules hold** (my reading; for the lawyer):
1. **The badge says "verified on {date}" and nothing more.** Paying never guarantees approval.
2. **The fee is presented as covering the document and identity check and the ongoing screening**, not as buying trust.
3. **Rejected applicants get a full refund.**
   - **Except one case:** money that turns out to come from a listed person is frozen, not refunded, and must be reported to the Bundesbank.
   - **That's why the automated sanctions check runs before any payment is taken** (§4).

### 1.3 Products that fit "events + verified businesses"

| Product | Price | Fit |
|---|---|---|
| **Verified business, yearly** (profile, badge, events, chat, yearly re-verification and continuous screening) | **€49/year** (≈2,700 TRY) | The main source of revenue. It replaces "free with costs" with "the business pays for its own check". |
| **Pro Turkey, yearly** (verification included; Pro features as in Germany) | **€190/year** (≈10,600 TRY, about €16/month) | There is no monthly plan in Turkey: fewer card payments, fewer withholding events, and bank transfer stays possible. Pro Plus is not offered in Turkey at first. |
| **Featured event** (existing product) | €9.99 | For verified organisers. Persian events in Istanbul are irregular, and the state sometimes cancels them (round 6). |
| **Seasonal sponsorship** (one "presented by" slot on the Nowruz or Yalda collection, plus one Telegram channel post) | €150–300 per season | Sold by hand to verified businesses in the allowed categories only: language schools, licensed insurance agents for the private health insurance a residence permit needs, restaurants. |
| **Ticket affiliate links** | €0 | **No public affiliate programme found** for Biletix, Passo, Bubilet or Biletinial. Bubilet sold 4.4M tickets in 2025 ([Webrazzi](https://webrazzi.com/2025/12/11/bubilet-in-2025-performansi-ve-son-uc-yilda-one-cikan-verileri/)). A direct referral deal could be asked for, but 5% of about 100 tickets a year is about €100–300 (my estimate). Not worth building now. |
| **Excluded from paid products** | | **Lawyers:** the TBB rules ban self-promotion "paid or free", so they get a free, neutral listing, or none. **Clinics:** information only, never featured or sponsored. **Associations (*dernek*):** free; many aren't VAT-registered, which would make a sale B2C (§3). |

### 1.4 Year-1 estimate for Istanbul (my estimate)

**Assumptions:**
- About **300 consumer-facing Iranian businesses** in Istanbul (round 6).
- The owner can verify **about 50 businesses** in year 1.
- Uptake grows from the editorial Nowruz page and the waitlist.

| | Low | Mid | High |
|---|---|---|---|
| Verified-only businesses × €49 | 20 → €980 | 30 → €1,470 | 45 → €2,205 |
| Pro Turkey × €190 | 4 → €760 | 10 → €1,900 | 20 → €3,800 |
| Featured events × €9.99 | 6 → €60 | 20 → €200 | 40 → €400 |
| Sponsorships | 0 | 2 → €400 | 4 → €1,000 |
| **Gross** | **≈ €1,800** | **≈ €3,970** | **≈ €7,405** |
| Card fees (3.15% + €0.25 for non-EEA cards; [Stripe pricing](https://stripe.com/de-us/pricing), the EU page; check the German one) | −€70 | −€150 | −€280 |
| Worst case: 15% withheld on everything | −€270 | −€600 | −€1,110 |

**Conversion behind the mid case:**
- 300 businesses;
- about 25% apply (75);
- about 70% pass the checks and the category rules, about 50 of them inside the cap;
- 40 of those pay;
- 10 of them buy Pro.

**Year-1 costs:**
- **Screening:** about **€25** (60 checks × €0.40) through the API, plus **€0** for the daily local re-checks (§2).
- **KVKK representative:** **€1–3k** a year (round 5).
- **One-off legal and tax opinions:** **€2–6k** (my estimate).
- **The owner's time:** about 30–45 hours.

**Break-even:**
- **The running costs** (about €2k a year) are covered by about **12 Pro businesses or about 45 verifications** a year.
- **The one-off legal costs** are recovered in year 2 at the mid case.

**Margin per business:**
- **Verification at €49:**
  - Card fee about €1.79 and screening about €0.40, which leaves **about €46.8 in cash**.
  - If the buyer withholds 15%, about €39.5.
  - After pricing 30–45 minutes of the owner's time at €40 an hour, **about €15–25**.
- **Pro Turkey at €190:**
  - Card fee about €6.24, which leaves **about €183.8**.
  - With 15% withheld, **about €155**.

---

## 2. Making screening cost almost nothing

### 2.1 The free official lists (all free to download)

| List | Access | Note |
|---|---|---|
| **EU consolidated financial sanctions list** (the EU Financial Sanctions Files) | Free with an EU Login account; XML, CSV and PDF; each user gets a download link that a script can call ([FSF user manual](https://circabc.europa.eu/d/a/workspace/SpacesStore/9cf02a9e-7604-4178-a21d-d0b6bdcb4114/MA_FSF_EN.pdf)) | More than 5,000 persons and entities, with aliases ([EU Sanctions Helpdesk resources](https://eu-sanctions-compliance-helpdesk.europa.eu/resources_en)) |
| **OFAC**: the SDN list and the consolidated non-SDN list (US) | Free files (the Advanced XML format and the older flat files), archives of changes, email alerts; OFAC's own search tool uses fuzzy name matching ([OFAC Sanctions List Service](https://ofac.treasury.gov/sanctions-list-service)) | US secondary sanctions are a policy choice for us, and Stripe requires it in practice |
| **UN Security Council consolidated list** | Free XML | The 1737 (Iran) list is back since 28 Sep 2025 (`payments-iran.md`) |
| **UK Sanctions List** (FCDO) | Free; **since 28 Jan 2026 it is the only UK list**, because the OFSI Consolidated List was closed ([GOV.UK](https://gov.uk/government/publications/the-uk-sanctions-list), [ICAS](https://www.icas.com/news-insights-events/news/practice/uk-sanctions-list-consolidation)) | Round 6 still says "OFSI"; update it |
| Germany: finanz-sanktionsliste.de | A free search for manual checks | The IHK Frankfurt recommends it for checks by hand ([IHK Frankfurt](https://www.frankfurt-main.ihk.de/international/importkontrolle-in-der-praxis/finanzsanktionen-5551694)) |

### 2.2 Screening tools and what they cost

| Tool | Price | Commercial use |
|---|---|---|
| **OpenSanctions API** | **500 checks €50 (€0.10); 5,000 for €400 (€0.08)**; 2,000 free trial credits; credits valid for 1 year ([OpenSanctions API](https://www.opensanctions.org/api/)) | **Allowed.** It covers the official lists plus PEPs (politically exposed persons) and other sources, with spelling variants across scripts. |
| OpenSanctions data on our own server (yente) | **No public price** ("a quote in the first conversation"); a 2022 announcement said **€595/month** ([OpenSanctions 2022](https://opensanctions.org/articles/2022-10-04-saas-api/)) **[1 source]**; startup discounts on request ([licensing](https://www.opensanctions.org/sponsor)) | Data CC BY-NC: **"Compliance screening is a commercial use even though it generates no revenue"** ([OpenSanctions exemptions](https://www.opensanctions.org/docs/commercial/exemption/)), so self-hosting their data needs a paid licence. The *software* (yente, zavod, and probably nomenklatura) is MIT ([OpenSanctions open source](https://www.opensanctions.org/docs/opensource.md)). |
| dilisense | **100 free checks a month**, then €0.10 each; €150/month for 3,000 or €300/month for 10,000 ([dilisense](https://dilisense.com/en/products/aml-screening-api)) | Sanctions, PEPs and criminal lists. The free tier would cover our volume, but its matching on Persian and Turkish names is untested. |
| sanctions.io | About **$899 for 5,000** checks, prepaid ([APIs.io](https://apis.io/finops/sanctions-io/sanctions-io-finops/)) **[1 source]** | Too expensive for us. |
| Castellum.AI | A free "AML/KYC Check" search on the website (2023); paid plans on request ([Business Wire](https://www.businesswire.com/news/home/20230425005482/en/Castellum.AI-launches-world%E2%80%99s-first-free-AMLKYC-Check)) | For manual second opinions only. |
| **EU Sanctions Helpdesk** | **Free for EU SMEs.** It checks counterparties against EU, UN and member-state lists, **including ownership and control**, and sends a written report in about 10 working days for Iran ([Helpdesk support service](https://eu-sanctions-compliance-helpdesk.europa.eu/support-service_en)) | **Use it for the hard possible matches** and keep the report as evidence. It accepts no liability and does not cover US lists. The older Iran "Sanctions Tool" questionnaire (2020) wasn't found as a current tool. |

### 2.3 Recommended set-up: about €0.40 per business, €0 to re-check

1. **At sign-up, once per business, paid for by the fee:**
   - one OpenSanctions `/match` call for the company and for **every partner and manager** on the trade registry gazette (*Ticaret Sicili Gazetesi*);
   - about 4 names, so about €0.40;
   - the 2,000 trial credits cover about the first 500 businesses' sign-up checks.
2. **Re-checks on our own server:**
   - **daily** download of the EU, OFAC, UN and UK lists (all free), with a diff against yesterday's files;
   - **every new or changed list entry** is matched against our small table of screened names (a few hundred);
   - a weekly full re-run as well.
   - **Matching:** names folded the same way (Persian, Arabic, Turkish and Latin variants such as Mohammad/Muhammed/Mohammed, Hosseini/Hüseyni, Rezaei/Rızai), compared with trigram similarity (PostgreSQL `pg_trgm`) on surnames and full names, plus nationality and birth year when known.
   - **Our role is the reverse of what's hard:** the official lists are matched against a few hundred known names, not the other way round.
   - **Build effort:** about 2–4 days (my estimate). No Elasticsearch, so it fits the server.
   - **Daily beats monthly at the same cost:** an EU listing applies from the day it is published.
3. **Any possible match:**
   - suspend the page and show "under review";
   - check by hand (date of birth, nationality, the registry gazette);
   - if still unclear, ask the EU Sanctions Helpdesk.
   - **If confirmed:** freeze (no refund), report to the Bundesbank (Servicezentrum Finanzsanktionen) and call the lawyer.
4. **Fallback if the build is postponed:** monthly re-checks through the API cost about €5 per business a year, about €250 a year for 50 businesses. That is acceptable too.

### 2.4 Is this good enough for a small company?

- **No EU or German text sets a method or a frequency for non-financial companies.** The duty is not to make funds or economic resources available to listed persons.
  - The IHK Frankfurt says every company must "take suitable steps" before a deal. It names the EU database, finanz-sanktionsliste.de, or software for many contacts, and warns about spelling variants like Mohammed and Muhammad ([IHK Frankfurt](https://www.frankfurt-main.ihk.de/international/importkontrolle-in-der-praxis/finanzsanktionen-5551694)).
- **My reading:** a documented, risk-based process is a reasonable good-faith standard for a sole trader. It would consist of:
  - checks at sign-up through a recognised API;
  - daily checks against the official lists;
  - ownership taken from the registry gazette;
  - hard cases sent to the EU Sanctions Helpdesk;
  - forbidden categories (round 6, §2.1).
  - **The lawyer should confirm this** (round 6, question 10).
- **The gap that remains:** OFAC's 50% rule and the EU's "owned or controlled" test.
  - Names alone don't show who owns a company.
  - The registry gazette shows partners, but not who owns a corporate partner.
  - **Rule:** if any partner is itself a company, ask for its shareholders, or refuse.
- **Records to keep** (in `audit_log` or a separate `screenings` table) for each check:
  - the names as screened;
  - the source and the date or version of the list;
  - the best candidates and their scores;
  - the decision, who made it and when;
  - why a possible match was cleared.
  - **Keep them for the whole relationship plus 5 years** (my suggestion, modelled on AML practice).
  - **Never keep ID copies** (round 6).
  - **Legal basis:** GDPR Art. 6(1)(c)/(f), and under KVKK as well.

---

## 3. Taking money from Turkish businesses safely

### 3.1 Stripe

- **The restricted list** ([updated 22 Sep 2026](https://stripe.com/legal/restricted-businesses)), checked word for word on Stripe's page:
  - *"Persons located in, resident in, or a citizen of, or products or services originating from jurisdictions … that Stripe has determined … to be prohibited … including, Cuba, Iran, North Korea, and Syria, and the Crimea, Donetsk, and Luhansk regions."*
  - The words "owned or controlled" do **not** appear on that page.
- **The Services Agreement** ([SSA, updated 28 Sep 2026](https://stripe.com/legal/ssa)):
  - **§11.6 (trade control):** no access for High-Risk Persons or for people *"ordinarily resident"* in a High-Risk Jurisdiction.
  - **Our own warranty:** that Peydoo is not located in, organised under the laws of, or owned 50% or more by such parties. That part concerns Peydoo, not its customers.
  - **§1.2:** no dealings with a Prohibited or Restricted Business without Stripe's written pre-approval.
  - **§10.1:** immediate suspension if Stripe "reasonably believes" a law was broken.
- **What this means:**
  - **Sole traders (*şahıs işletmesi*) with Iranian citizenship are natural persons who are "a citizen of" Iran.** Dual Turkish–Iranian citizens are too, because Iran rarely lets anyone give up its citizenship. **Don't sell to them through Stripe.**
  - **A Turkish Ltd. Şti. or A.Ş.** is a Turkish legal person, so the literal test isn't met. But its Iranian-citizen partners, its Iranian brand and Persian copy are exactly what Stripe's reviews look for.
    - Example: in 2019 Stripe held an Iranian-American nonprofit's funds, apparently because of the word "Iranian" in its name, and released them after a review ([Salt Lake Tribune](https://sltrib.com/news/politics/2019/11/10/utah-nonprofit-says-it)) **[1 source]**.
  - **No published Stripe guidance on dual nationals** or Iranian owners of foreign companies was found.
- **What EU software companies usually do** (my summary from public cases; no survey found):
  - **What they check:** the customer company and its beneficial owners against the sanctions lists, and the payer's location, IP address and card country.
  - **Most don't block on nationality alone.** Slack blocked users with Iranian links in 2018, was widely criticised, and later reversed it ([Giga Law](https://giga.law/daily-news/2018/12/20/citing-sanctions-slack-deactivates-accounts-for-users-with-ties-to-iran)).
  - **Stripe's own wording, though, is stricter than EU law**, and for us the contract with Stripe is what decides.
- **Action:**
  - **Write to Stripe before the first sale.** Describe exactly: Turkish-registered companies, partners who may hold Iranian citizenship and live in Turkey, screened against the EU, UN, OFAC and UK lists, paying by Turkish card, yearly plans only.
  - **Ask the same question for Iranian-citizen customers in Germany.** The "citizen of" clause reads on Peydoo's core market too.
  - **Keep the written answer.** Without it, use the bank-transfer route only.

### 3.2 Alternatives

| Route | Verdict |
|---|---|
| **Paddle** (a merchant of record, which would handle Turkish VAT and screening itself) | **Doesn't fit.** Its policy forbids "Advertising Services, including but not limited to job boards", any service that lets non-Paddle sellers sell ("digital marketplaces"), and sales with "no real product … advertising, and sponsorship" ([Paddle](https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle)). Turkey is supported; Iran is blocked by location, with no rule on nationals ([Paddle countries](https://www.paddle.com/help/legal/sanctions/which-countries-are-supported-by-paddle)). |
| **Lemon Squeezy** | Iran is blocked by customer country; Turkey is allowed; no rule on nationals ([docs](https://docs.lemonsqueezy.com/help/getting-started/supported-countries)). **It belongs to Stripe** (since 2024; [Finextra](https://finextra.com/pressarticle/101686/stripe-acquires-lemon-squeezy)), so it isn't independent of the Stripe risk. Its policy for advertising products wasn't checked. |
| **FastSpring** | Built for digital products. It blocks sellers and buyers on US sanctions lists and restricts Iran ([FastSpring restricted countries](https://fastspring.com/terms-use/restricted-countries)). It has no explicit ban on advertising, but it would need approval, and its fees are higher. Not needed for B2B-only sales. |
| **iyzico, PayTR** (Turkish payment providers) | They need Turkish documents: a tax plate, the registry gazette, a Turkish bank account ([Ticimax on PayTR](https://www.ticimax.com/blog/paytr-nedir-nasil-basvuru-yapilir)). That means a Turkish company, which brings a permanent establishment, Turkish corporate tax and VAT. **Not for year 1.** |
| **Papara** (a Turkish e-money wallet) | **No.** Since **27 May 2025** it has been run by a state trustee (TMSF) in a money-laundering case linked to illegal betting ([Ekonomi Gazetesi](https://www.ekonomigazetesi.com/finans/paparaya-tmsf-kayyum-atandi-50762)). |
| **Invoice + bank transfer** (EUR by SWIFT; Turkey isn't in SEPA) | **The fallback for yearly plans.** We invoice in EUR, and a company pays from a Turkish bank account in its own name. Both banks screen the payment. Fees are about €5–40 per transfer across both banks (my estimate), too much for €9.99 and acceptable for €190. **Context:** Turkey is tightening on Iran-linked banking. OFAC listed the Istanbul **Golden Global Bank** on 4 Sep 2026 ([Crypto Briefing](https://cryptobriefing.com/treasury-golden-global-bank-iran-sanctions/)), and the BDDK revoked **Bank Mellat Istanbul**'s licence on 18 Sep 2026 ([MEF](https://www.meforum.org/mef-online/erdogans-quiet-squeeze-turkey-just-closed-a-key-iranian-financial-channel)) **[1 source]**. Never accept payment from a third party or a personal account on behalf of the business. |

### 3.3 Tax

**Turkish VAT (KDV, 20%)**
- **Sales to consumers or unregistered buyers (B2C):** a foreign provider of electronic services must register in a special scheme and file VAT return no. 3 every month, **from the first sale** ([Kintsugi](https://trykintsugi.com/sales-tax-guides/middle-east/turkey), [Quaderno](https://www.quaderno.io/tax-registration-filing-guides/turkey)). **Avoid it by selling only to businesses.**
- **Sales to businesses (B2B):**
  - A Turkish buyer of a service from abroad that is used in Turkey calculates the VAT itself "sorumlu sıfatıyla" and pays it on **VAT return no. 2** ([MuhasebeTR](https://www.muhasebetr.com/yazarlarimiz/muratkeloglu/002/)).
  - A 2019 Revenue Administration ruling says advertising that also runs in Turkey falls under this mechanism ([Lexpera özelge](https://www.lexpera.com.tr/mevzuat/ozelgeler/21152195-130-11-2019-2234-e-227088-sayili-ozelge-1)).
  - **Confirmed by these sources. Peydoo does not register.**

**15% withholding (Presidential Decision 476, since 1 Jan 2019)**
- **The rule:** payments to non-residents for "services provided online with an advertising character", or for acting as an intermediary for them, are taxed at 15% at source ([EY](https://taxnews.ey.com/news/2019-0387-turkey-issues-guidance-regarding-withholding-taxes-imposed-on-online-advertising-services), [Alo Maliye](https://www.alomaliye.com/2019/04/10/internet-reklam-vergilendirilmesi/)).
- **Who bears it:**
  - In law, the **Turkish payer**: companies and book-keeping traders who are withholding agents.
  - In money, **Peydoo**, unless the price is grossed up.
- **The treaty:**
  - Commentators agree that advertising income is business profit (Art. 7). Without a permanent establishment in Turkey (a website alone isn't one), Turkey shouldn't tax it, and tax courts have ruled that way ([Erdem & Erdem](https://www.erdem-erdem.av.tr/bilgi-bankasi/dijital-reklam-hizmetlerinde-stopaj-vergisi-sorunu), [KPMG](https://kpmgvergi.com/blog/internet-reklamlarina-yeni-15-stopaj-vergilemesi-nasil-hareket-etmeli/55)).
  - **But for Germany the treaty works by refund:** Turkey withholds under its own law first.
    - The German resident applies **within 4 years** at the payer's tax office.
    - It needs the original German residence certificate and a Turkish translation certified by a consulate (Treaty Art. 27; DTT General Communiqué no. 3, Official Gazette 29417, 15 Jul 2015; [Alo Maliye](https://www.alomaliye.com/2015/07/15/cifte-vergilendirmeyi-onleme-anlasmalari-genel-tebligi-seri-no3/)).
  - **That isn't worth doing for €49.**
- **Does a directory listing or Pro count as advertising?**
  - Featured events and sponsorships: **almost certainly yes**.
  - A paid business profile or Pro: **probably yes** (my reading).
- **Practical rule:**
  - Prices are net of any tax the customer must withhold or self-assess.
  - Accept the 85% from payers that do withhold.
  - Ask for the withholding receipt.
  - The tax advisor decides whether a German credit is possible for tax the treaty doesn't allow (probably not, so the refund route would be the only way back).

**Germany**
- **Where the service is supplied:** in Turkey, for business buyers (§3a(2) UStG), so it is "not taxable in Germany".
- **Proof that the buyer is a business:** the e-Devlet-checked tax plate (*vergi levhası*) and the VKN. That is the same document as the verification, so one check serves both purposes.
- **The small-business limits:** §19(2) UStG defines "Gesamtumsatz" as the sum of **taxable (steuerbare)** supplies ([§19 UStG](https://www.gesetze-im-internet.de/ustg_1980/__19.html)), so Turkish B2B sales **look like they fall outside the €25k/€100k limits** (my reading; the IHK leaflets only confirm the same logic for imports and acquisitions within the EU: [IHK](https://www.ihk.de/hannover/hauptnavigation/recht/steuerrecht/umsatzsteuer/umsatzsteuer-national2/kleinunternehmer-im-ust-5213920)). **For the tax advisor.**
- **The invoice:** it needs wording for "not taxable in Germany / reverse charge" in place of the §19 footer, plus the buyer's VKN.
- **Income tax:** the profit is still taxable in Germany as usual.

**Currency:** price in **EUR**, with the approximate TRY amount shown.
- Turkish inflation would otherwise force repricing several times a year.
- Charging in TRY adds Stripe's 2% currency conversion.
- Turkish rules that restrict foreign-currency contracts are aimed at contracts between Turkish residents. I read EUR pricing by a non-resident as allowed (for the Turkish adviser).

---

## 4. Proposal: Turkey pricing and process

**Who is accepted**
- Registered **companies (Ltd. Şti., A.Ş.)** with a VKN and MERSİS number that **file VAT returns**, in the allowed categories (round 6, §3.2).
- **Sole traders:** listed and verified. They pay **only by bank transfer, or not at all, until Stripe answers in writing** about Iranian citizens.
- **Associations, lawyers and clinics:** free, neutral listings (§1.3).
- **Refused:**
  - every forbidden category (round 6, §2.1);
  - any company with a corporate partner whose owners aren't disclosed;
  - any payment from a third party.

**Prices (EUR, B2B only, yearly)**

| | Price | Founding offer (first 20 businesses that pay) |
|---|---|---|
| Verified business | €49/year (≈2,700 TRY) | €29 in year 1 |
| Pro Turkey (verification included) | €190/year (≈10,600 TRY) | €95 in year 1 |
| Featured event | €9.99 | 2 free per founding organiser |
| Nowruz or Yalda sponsor | €150–300 per season | — |

**Process**
1. **Free application on `/turkey`:**
   - company details, VKN, MERSİS, the registry gazette PDF;
   - partners and managers, with birth year and nationality;
   - a category picker that rejects forbidden categories automatically.
2. **Automated sanctions check before any money:**
   - OpenSanctions `/match` for the company, every partner and every manager (about €0.40);
   - a possible match goes to manual review or the EU Sanctions Helpdesk, and the business sees only "under review".
3. **Payment:**
   - **Stripe Checkout** (EUR, yearly, card) only after Stripe's written answer, and only for companies;
   - **otherwise an EUR invoice paid by SWIFT** from the company's own account.
   - The invoice has the wording for "not taxable in Germany / reverse charge" and the VKN.
   - **Full refund if we reject**, except money that has to be frozen (§1.2).
4. **The owner verifies** (round 6, §3.3):
   - the tax plate barcode checked on e-Devlet;
   - the registry gazette;
   - licences for regulated professions;
   - proof of the shop's location;
   - a video call in which ID is shown, not stored.
   - Then `verify-business.ts` sets the badge, with an expiry date one year ahead.
5. **Ongoing:**
   - daily local checks against the four official lists (€0);
   - a new check on any change of partner or manager;
   - **yearly re-verification at renewal**, paid for by the renewal fee.
6. **On a confirmed match:** suspend the page, freeze the money, report to the Bundesbank and call the lawyer.

**What has to be built** (when Turkey opens; my estimate):
- Turkey prices in `seed/products.ts`, plus the yearly products;
- a `screenings` table, the daily list download and matching job, and an admin queue;
- an invoice and bank-transfer path, where the order is marked paid by an admin and recorded in `audit_log`;
- the invoice wording for Turkey.

**When it can start**
- **Now:** nothing changes; Turkey stays a guide and waitlist (round 6).
- **The four gates before the first sale:**
  1. the sanctions lawyer (round 6 question 10; is a paid page for an Iranian-owned Turkish company a problem as "economic resources"; is this screening method enough);
  2. Stripe's answer in writing;
  3. the tax advisor plus a Turkish adviser (withholding, VAT return no. 2, §19 and §3a);
  4. VERBIS and the KVKK representative.
- **Earliest start:** the **Istanbul starter in mid-2027**, paid from the first day, with the founding prices. That is a year earlier than round 6's "year 2".
- **If Stripe says no:** bank transfer for yearly plans only, which means fewer, larger sales. The low case is then the realistic one.

## Weak evidence and gaps
- No official prices were found for sahibinden stores, Armut credits, Hepsiemlak or Zingat; the figures come from user complaints.
- No affiliate programme was found for any Turkish ticket seller.
- OpenSanctions' current price for self-hosting its data isn't public (the €595/month figure is from 2022).
- No Stripe statement on dual nationals or on Iranian owners of foreign companies was found.
- The papers iyzico requires from a foreign company weren't found.
- The Germany–Turkey refund route comes from a 2015 communiqué; check that it is still current.
- The point that B2B sales to Turkey stay outside the §19 limits is my reading of §19(2), not a statement from an official source.
- The revenue, uptake, fee and build-time numbers are my estimates.
