# Research 8: country legal requirements, "soft but inside a safe zone", and solo moderation

Peydoo · 2026-10-25 · web research plus repo docs; no code changes. Builds on `docs/design-options.md` "Final plan (round 7)", `research/round6-expansion.md` §3–5, `round6-turkey-uae.md` §2.3, `round7-turkey-money.md`, `round7-fast-resilient.md` §3–4, `docs/progress.md` (what is already built) and `docs/architecture.md` (DSA notes). Figures from those files are not re-sourced here.

> **This is not legal or tax advice.** It sorts what the law text requires from what earlier rounds added out of caution, and estimates how likely enforcement is. **[1 source]** marks a fact found in only one source. "My reading" or "estimate" marks my own inference. The German lawyer, the tax advisor and (for Turkey) a Turkish adviser should check the "required" lists before the dates they apply.

**The owner's two instructions:**
1. "Be a bit softer about country legal requirements: soft, but inside a safe zone."
2. "I don't need a moderation mini-job; I can moderate myself."

---

## 0. The short version

- **Most of what the law requires is already built** for Germany: Impressum, DSA notice and action (Art. 16), statements of reasons (Art. 17), contact points, terms and privacy drafts, and the report and appeal buttons (`docs/progress.md`). Most of the other countries need **paragraphs in the existing documents**, not new systems.
- **The EU establishment does most of the work.** Under the e-Commerce Directive's country-of-origin principle, a German provider follows **German** rules for information duties and online conduct in every EU country. Consumer contract law is the exception, and it is largely harmonised. Austria, the Netherlands and Sweden need essentially nothing extra. Italy and France only add language duties, and only for **paid offers to consumers**.
- **Being a micro enterprise removes most of the DSA.** Fewer than 10 people and turnover of €2M or less means Art. 15 and 20–32 don't apply: no transparency report, no internal complaint system, no out-of-court dispute body, no trusted flaggers, no ad repository, no trader KYC (Art. 15(2), 19, 29).
- **Outside the EU, the cheap rule is "B2B only" for anything paid.** That avoids UK VAT from the first £, Turkish VAT from the first lira, Quebec's French rules and most consumer-subscription laws.
- **What softens (estimate):**
  - Legal one-time spending drops from about €6–14k (country lawyer reviews in rounds 5–7) to about **€1.5–4k**: the German lawyer review stays, plus small, targeted consults (§9).
  - Moderators (about €1.5–2.4k a month from January in round 7) drop to **€0** while the owner moderates.
- **What can't soften:** the red lines in §8 (sanctions, illegal-content notices and official orders, Impressum, GDPR basics, scams). Two items are cheap but also required by the text: the **UK GDPR representative**, and **KVKK registration with a representative before the first Turkish payment**.
- **Solo moderation works up to about 200 new listings a day** (about 11–16 h a week), with AI pre-screening, night holds for risky categories and an emergency rule. Around **300 or more a day** (about 20–32 h a week at 500) it stops fitting next to everything else the owner does (§7).

---

## 1. EU and Germany baseline (applies in every EU country through the German establishment)

### 1.1 DSA: which articles apply to a micro or small online platform

Peydoo stores user content (a hosting service) and shows it to the public (an online platform). It is a **micro enterprise** under Recommendation 2003/361 (fewer than 10 staff, ≤€2M turnover) ([architecture.md sources: springlex Art. 19/29](https://www.springlex.eu/en/packages/dsa/dsa-regulation/article-19/)).

| DSA article | What it requires | Applies to Peydoo? |
|---|---|---|
| 11, 12 | Points of contact for authorities and for users | **Yes**, already on `/contact` |
| 13 | A legal representative in the EU | No: established in Germany |
| 14 | Terms that describe moderation policies, "including algorithmic decision-making and human review" | **Yes.** Add one paragraph on AI pre-screening (§7) |
| 15 | Yearly transparency report | **No**: Art. 15(2) exempts micro and small enterprises |
| 16 | Notice and action. Notices processed "in a timely, diligent, non-arbitrary and objective manner", and the notifier told if automated means were used ([Art. 16 text](https://www.eu-digital-services-act.com/Digital_Services_Act_Article_16.html)) | **Yes**, built |
| 17 | A statement of reasons for every restriction, including hiding and demotion, and saying when it was automated | **Yes**, built. Auto-hides (§7) also need a statement |
| 18 | Report suspected crimes that threaten life or safety to the police | **Yes.** In Germany, the BKA's central reporting office. Part of the emergency rule (§7) |
| 19 | "This Section, with the exception of Article 24(3) thereof, shall not apply to providers of online platforms that qualify as micro or small enterprises" ([Art. 19 text](https://www.eu-digital-services-act.com/Digital_Services_Act_Article_19.html)) | Exempts Art. 20–28 |
| 20 | Internal complaint-handling system (appeals) | **No, not required.** The appeal button is already built; **keep it**, because it costs nothing now and it is the fairest way to fix mistakes |
| 21 | Out-of-court dispute settlement | No |
| 22 | Trusted flaggers (formal status) | No. Prioritising reports from known good reporters is still allowed |
| 23 | Measures against misuse | No; the terms can still suspend abusers |
| 24(2), 24(5) | Publish average monthly active users; send statements to the EU transparency database ([Art. 24 text](https://www.eu-digital-services-act.com/Digital_Services_Act_Article_24.html)) | **No** (Section 3). Only **24(3)** applies: give the user figure to the regulator *on request* |
| 25–28 | Dark patterns, ad transparency, recommender transparency, protection of minors | No as DSA duties. The UWG and consumer law still forbid misleading design |
| 29–32 | Marketplace duties: trader traceability (KYBC), compliance by design, informing buyers | **No**: Art. 29 exempts micro and small enterprises |

Two details:
- The exemption lasts until **12 months after** Peydoo stops being small (already noted in `docs/progress.md`).
- **"Expeditious" is the only speed rule.** The hosting liability exemption (Art. 6) needs action "expeditiously" on actual knowledge. The DSA sets no hours, and Germany's old NetzDG 24-hour rule is gone.

### 1.2 Impressum (§ 5 DDG)

- **Required, already built.**
- The fine is up to **€50,000** (§ 33 DDG), but fines are "in practice almost never pursued" ([IHK München](https://www.ihk-muenchen.de/ratgeber/recht/internetrecht/impressum/), [IT-Recht Kanzlei](https://www.it-recht-kanzlei.de/eroeffnen-onlineshop-impressum.html)).
- **The real risk is the Abmahnung**, but it is lower than it was. Since 2020, **competitors can't charge their costs** for violations of e-commerce information duties (Impressum, withdrawal notice, price display). The same goes for GDPR violations by firms with fewer than 250 employees. Associations and chambers still can (§ 13(4) UWG) ([gesetze-im-internet](https://www.gesetze-im-internet.de/uwg_2004/__13.html), [IT-Recht Kanzlei](https://www.it-recht-kanzlei.de/gesetz-gegen-abmahnmissbrauch-in-kraft.html)).
- The Impressum also covers Turkey's Law 5651 Art. 3 identity duty (§6).

### 1.3 GDPR: the real minimum

Required:
- **Privacy notice** (Art. 13).
- **Record of processing** (Art. 30). The under-250 exemption doesn't apply because the processing isn't occasional. A one-page spreadsheet is enough.
- **Data processing agreements** with AWS, Cloudflare and any AI moderation vendor. Choose a vendor setting that doesn't train on our data.
- A **transfer basis for US vendors** (Data Privacy Framework or standard contractual clauses, as the vendors offer).
- A **72-hour breach routine**, and answers to access and deletion requests within a month.
- **No cookie banner** while only essential cookies are used (§ 25 TDDDG; round 3).

Not needed:
- A **DPO**: § 38 BDSG starts at 20 people who regularly process personal data.
- An **EU representative**: Peydoo is established in the EU.

Soft (do later):
- A short **DPIA** for sanctions screening and AI moderation. It is good practice and arguably not mandatory at this scale (my reading). A few hours of the owner's time.

**GDPR Art. 22 line:** AI may **hold or hide** a listing. **Only a person bans an account**, because a ban is the kind of decision that could have a "similarly significant" effect.

### 1.4 P2B Regulation (EU 2019/1150): businesses that reach consumers through Peydoo

**Applies**, because verified businesses offer services to consumers. The core terms duties have no size exemption:
- plain-language terms;
- **15 days' notice** of changes;
- the reasons for suspending a business;
- **30 days' notice** before terminating a business, except for illegal content or repeated breaches;
- the **main ranking parameters**, including any effect of paid features (Pro, featured);
- any differentiated treatment;
- what data businesses get.

Small enterprises are **exempt from the internal complaint system (Art. 11) and from naming mediators (Art. 12)** ([gesetze.legal Art. 11](https://gesetze.legal/eu/vo_eu_2019_1150/11), [Legalmondo](https://www.legalmondo.com/?p=16079)). **Cost: one section in the terms.**

### 1.5 Consumer law, only if something is sold to consumers (bumps, featured, Pro for private users)

Required for any B2C sale:
- the price and a §19 note;
- a **"zahlungspflichtig bestellen"** button (§ 312j BGB);
- withdrawal information, plus the waiver for a digital service that starts at once;
- the **withdrawal button**, mandatory since **19 Jun 2026** for every online consumer contract with a withdrawal right, regardless of size (§ 356a BGB, from Directive 2023/2673) ([IHK Braunschweig](https://www.ihk.de/braunschweig/beratung-und-service/rechtsthemen/wirtschaftsrecht-von-a-bis-z/internet-und-recht2/widerrufs-button-verpflichtend-seit-juni-2026-7103310), [IHK Bonn checklist](https://www.ihk-bonn.de/fileadmin/dokumente/Downloads/Recht_und_Steuern/Internetrecht/Checkliste_Widerrufsbutton.pdf)). **New since round 3: check the build;**
- the **cancellation button** (§ 312k BGB) for consumer subscriptions;
- marketplace information: whether the other party is a trader (§ 312l BGB), and the ranking parameters (§ 5b UWG). The business badge already does the first.

Not required:
- **Dispute-resolution statement (VSBG § 36):** not needed with **10 or fewer employees** unless we volunteer. Once a real consumer dispute exists, § 37 still requires naming the competent body in text form ([IT-Recht Kanzlei](https://www.it-recht-kanzlei.de/informationspflicht-streitentstehung-verbraucher.html)).
- **The EU ODR link must be removed.** The platform closed on 20 Jul 2025 ([onlinemarktplatz.de](https://onlinemarktplatz.de/257950/os-plattform-ist-abgeschaltet/)).

**Softest safe option:** sell paid features only to businesses in year 1, everywhere. Then this whole block shrinks to the P2B section. This only works if founding Pro and bumps for private users wait.

### 1.6 EU items that look scary but can be skipped or wait

| Item | Why it can wait | Trigger to revisit |
|---|---|---|
| European Accessibility Act | Microenterprises that provide services are exempt ([summary](https://www.xictron.com/en/blog/accessibility-act-exemptions-microenterprises-2026/); German BFSG reads it narrowly) | 10 staff or €2M turnover |
| DAC7 / PStTG platform tax reporting | The EU definition excludes software that only lets users "list or advertise", and Peydoo neither processes nor knows payments between users (my reading of Directive 2021/514 Annex V; a vendor blog agrees that pure ad portals "can fall out" [1 source] ([Beancount](https://beancount.io/de/blog/2026/07/13/dac7-us-online-sellers-eu-customers-reporting-guide))) | Any in-app payment between users. **Ask the tax advisor once** |
| GPSR Art. 22 (online marketplaces) | It is aimed at platforms where consumers buy from **traders**. P2P listings are mostly outside it ([Osborne Clarke](https://www.osborneclarke.com/insights/navigating-eus-new-gpsr-obligations-are-introduced-online-marketplaces)) | When **businesses can list goods** (shops, car dealers): register in **Safety Gate** (free, under an hour) and name a product-safety contact |
| OSS VAT | Below the €10k EU-wide B2C threshold, German rules (and §19) apply | B2C sales in other EU countries reach €10k |
| Jugendschutzbeauftragter | Only for services with youth-harmful content | Never, as long as there are no adult categories |

### 1.7 Austria, Netherlands, Italy, Sweden, France: anything country-specific?

| Country | Real extra minimum | Realistic enforcement risk |
|---|---|---|
| **Austria** | None. German texts work; the country of origin covers information duties | Very low |
| **Netherlands** | None for a free service. For B2C paid offers, EU consumer law, which the German texts already meet | Very low (ACM goes after systemic consumer harm) |
| **Sweden** | None. The Language Act binds the public sector, not private sites | Very low |
| **Italy** | Codice del Consumo Art. 9: "all information for consumers must be given **at least in Italian**" ([Brocardi](https://brocardi.it/codice-del-consumo/parte-ii/titolo-ii/capo-ii/art9.html)). This bites only on **paid offers to consumers** in Italy. No AGCM case against a foreign site over language was found | Low. Soft fix: no B2C sales in Italy, or one Italian page with prices and key terms (≈€150–300 translation, estimate) |
| **France** | **Loi Toubon:** offers of goods or services in France should be in French; a translation may sit beside the French. The 1996 circular extends it to documents from abroad; the penalty is a 4th-class fine (≤€750 per offence, ≤€3,750 for a company) ([Wikipedia](https://en.wikipedia.org/wiki/Toubon_Law), [Assemblée nationale question](https://questions.assemblee-nationale.fr/dyn/13/questions/QANR5L13QE82797.pdf)). A parliamentary question noted that websites designed **entirely in a foreign language** are a grey zone, and enforcement against foreign sites is rare (no case found). Whether purely **B2B** offers are covered wasn't resolved | Low for a free Persian service and for B2B Pro. Low to medium only if B2C paid offers target France |
| France: **consumer mediator** (L.612-1) | It binds traders according to their EU place of establishment ([CMAP](https://cmap.fr/wp-content/uploads/Documents/EL-Les-litiges-transfrontaliers-dans-le-cadre-de-la-mediation-de-la-consommation.pdf)). A German trader falls under the VSBG, which exempts ≤10 employees (§1.5). **So round 5's "French mediator" is probably not required** (my reading; ask the lawyer) | Very low |
| France: CNIL cookies | No non-essential cookies means nothing to enforce | None today |

**Soft-but-safe EU rule:** keep **one set of German and Persian texts for the whole EU**. Sell paid features to **businesses only in France and Italy** until a French or Italian price-and-terms page exists. That replaces round 5's "French texts and mediator before Paris" (≈€1.5–3k) with **€0**, and the CLAUDE.md "Persian only" conflict disappears for now.

---

## 2. United Kingdom

**Is Peydoo in scope of the Online Safety Act (OSA)?**
- **Yes, once the UK is a target market** (a UK country page, UK cities). It is a user-to-user service with "links with the UK" (round 6 §4).
- There is **no small-service exemption**, only fewer measures.
- Ofcom's "Small but Risky" taskforce has engaged 14 services since July 2025 ([Reed Smith tracker](https://www.reedsmith.com/topics/uk-online-safety-act-2023/)). The fines on 4chan and a suicide forum are in round 5.

**What a small, low-risk user-to-user service actually needs:**
1. **An illegal content risk assessment**, written once and kept on file. Ofcom's 4 steps; fraud is the relevant harm for us. Review it yearly or before a big change.
2. **A children's access assessment.**
   - Stage 1: without highly effective age assurance, children *can* access the service.
   - Stage 2, the "child user condition": is there a *significant* number of child users, or is the service likely to attract them? It must rest on **evidence about actual users**, and "significant" can be a small number ([Osborne Clarke](https://www.osborneclarke.com/insights/uk-online-safety-act-ofcom-publishes-guidance-age-assurance-and-childrens-access), [Wiggin](https://www.wiggin.co.uk/?p=24082)).
   - Peydoo is adult-oriented: 18+ terms, an 18+ statement at sign-up, no youth categories, and job offers only from businesses. It can reasonably record "condition not met" with that evidence. In that case **no children's risk assessment** is needed; re-check yearly (my reading).
3. **The measures for all services** in Ofcom's codes:
   - a **named accountable person** (the owner);
   - a **content moderation function that can swiftly take down** illegal content (ICU C1/C2);
   - an easy **reporting and complaints** route;
   - **clear terms** that explain these;
   - removing accounts of proscribed organisations ([Ofcom codes overview](https://ofcom.org.uk/online-safety/illegal-and-harmful-content/codes-of-practice), [SCL](https://www.scl.org/ofcom-publishes-final-version-of-illegal-harms-guidance-under-online-safety-act/), [HSF](https://www.hsfkramer.com/notes/tmt/2024-posts/ONLINE-SAFETY-ACT--OFCOM-PUBLISHES-ILLEGAL-HARMS-CODES-OF-PRACTICE-)).
   - The **DSA build covers almost all of this**; add a UK paragraph to the terms.
4. **The crisis response protocol** (in force **2 Nov 2026**) and the 2026 intimate-image hash-matching measure target in-scope or larger, higher-risk services, according to commentary ([Bratby](https://bratby.law/ofcom-crisis-response-protocol/), [Digital Policy Alert](https://digitalpolicyalert.org/event/44558-office-of-communications-amendments-to-illegal-content-codes-of-practice-and-protection-of-children-code-of-practice-to-establish-crisis-response-protocol-enter-into-force)). Check the risk ratings when writing the assessment. A one-page internal crisis note costs nothing and is safe to have either way.
5. **Fees:** none. They start at £250M qualifying worldwide revenue, with an exemption below £10M UK revenue ([Ofcom](https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/online-safety-fees-and-penalties)).

**UK GDPR Art. 27 representative:**
- **Required by the text**: the "occasional processing" exemption doesn't fit a site that targets UK users every day ([UK GDPR Art. 27](https://www.legislation.gov.uk/eur/2016/679/article/27/data.htm?view=plain); the commentary agrees).
- Cost about £100–600 a year (estimate). ICO enforcement against small non-UK firms without one is rare (none found).
- **Soft-but-safe:** appoint one when the UK Starter opens (February). It is cheap enough that skipping isn't worth the argument.
- **ICO data protection fee:** whether non-UK controllers must pay is unclear. Commentary splits and the ICO withheld its internal guidance ([Osborne Clarke](https://www.osborneclarke.com/insights/update-to-uk-information-commissioners-office-fees-for-data-controllers-when-and-what-to-pay), [ICO FOI log](https://cy.ico.org.uk/about-the-ico/our-information/disclosure-log/2025/05/ic-389257-h7r0/)). Tier 1 is small (about £52; verify). Ask the representative.

**VAT:** B2B digital services are reverse-charged by the customer. **B2C means UK VAT from the first £** (round 6). **So sell only to UK businesses.** DMCC subscription rules (Jan 2027) then mostly don't apply.

| UK | Required on day one (cost) | Soft (when) | Can skip | Realistic risk if skipped |
|---|---|---|---|---|
| Online safety | Illegal-content risk assessment + children's access assessment, written and filed; named accountable person; UK paragraph in the terms; swift takedown (already built). **£0, about 1–2 days of the owner's time** using Ofcom's online tool | UK lawyer review (£1–3k) only when London rooms open (P2P), or if Ofcom writes. Yearly review | Children's risk assessment (if the condition is recorded as not met); Category 1/2 duties; fees | **Medium if the assessments are missing**: they are the first thing Ofcom asks for, and record-keeping enforcement is active. Low once they exist |
| Privacy | UK paragraph in the privacy notice; **Art. 27 representative ≈£100–600 a year** | ICO fee check (≈£52 if due) | DPO | Low (no cases found), but it's cheap, so do it |
| Tax | Pro and featured **to businesses only**, with evidence of business status | Register for VAT only if B2C becomes worth it | UK VAT registration | **High if B2C sales happen** (VAT from the first £) |
| Consumer | Nothing extra for B2B | DMCC subscription rules if B2C | — | Low |

---

## 3. United States

| Topic | Real position | Day-one action |
|---|---|---|
| **Section 230** | Protects against liability for users' content. It doesn't cover federal crime or IP | Free; keep "users post, we host" in the terms |
| **DMCA agent** | Only needed for the copyright safe harbour. **$6**, renewed every 3 years (round 6) | **Do it** (it's cheap): a takedown form and a repeat-infringer line in the terms |
| **CCPA/CPRA and other state privacy laws** | Thresholds (≈$26.6M revenue or 100k consumers) not met; Texas exempts SBA small businesses unless sensitive data is sold (round 6) | Skip |
| **CalOPPA (California)** | No threshold: any commercial site collecting personal data from Californians must post a privacy policy with set contents, including how it responds to "Do Not Track" (my knowledge; not re-sourced) | **Add 2 sentences** to the privacy notice |
| **Sales tax** | Economic nexus mostly $100k a state, $500k in CA, TX and NY (round 6) | Skip; track revenue by state |
| **INFORM Consumers Act** | Only sales **with payment processed by the marketplace** count toward "high-volume seller" ([FTC](https://www.ftc.gov/INFORMAct), [Pearl Cohen](https://www.pearlcohen.com/the-inform-consumers-act-a-guide-to-compliance-for-online-marketplaces/)); Peydoo processes no payments between users | Skip |
| **ADA website accessibility** | Suits are real (3,117 federal in 2025), but courts need personal jurisdiction. Simply being reachable from a state is usually not enough; deliberately targeting the state is ([Klein Moynihan](https://kleinmoynihan.com/website-ada-lawsuits-and-personal-jurisdiction/), [Seyfarth via adatitleiii](https://www.adatitleiii.com/tag/personal-jurisdiction/)). Plaintiff firms mostly scan English US e-commerce (my inference) | **Soft:** a basic pass (labels, contrast, keyboard, alt text; partly built) plus an **accessibility statement** with a contact. A **full WCAG 2.2 AA audit only when LA business Pro pages grow** (e.g. more than 50 US Pro accounts). Risk low |
| **OFAC** | US users are US persons, and Stripe, AWS and Cloudflare are US companies. GL D-2 covers communication, not trade (round 6) | **Red line** (§8): no Iran-sourced goods or services in US listings, no payments tied to Iran |
| **FTC** | No fake or bought reviews (Consumer Review Rule); label paid placement; CAN-SPAM needs a physical address in marketing email (the Impressum address works) | Already in the rules |
| **COPPA** | Only if aimed at under-13s or knowingly collecting their data | 18+ terms |
| **US counsel** | Round 6 budgeted $1.5–4k | **Soft:** one 1-hour sanctions consult ($300–600, estimate) before US Pro sales, mainly on Iranian-origin goods |

**Truly needed on day one in the US:**
1. US paragraphs in the terms (the OFAC goods rule, DMCA) and in the privacy notice (CalOPPA, DNT).
2. The DMCA agent ($6).
3. Business-only Pro.
4. An accessibility statement.

**About $6 and a few hours.**

---

## 4. Canada

| Canada | Required on day one (cost) | Soft (when) | Can skip | Realistic risk if skipped |
|---|---|---|---|---|
| CASL | Express consent for commercial email (double opt-in exists), sender identity, unsubscribe within 10 business days, **keep proof of consent**. €0 | — | Transactional emails are exempt | **Medium**: penalties up to C$10M and private complaints. Already met |
| PIPEDA | No size threshold. A Canada paragraph (accountable person = the owner, transfers abroad); **keep a record of every breach** and report "real risk of significant harm" breaches to the OPC. €0 | Lawyer review (C$1–2.5k) only at Toronto Open | — | Low |
| Quebec (Law 96, Law 25) | **Don't target Quebec:** no Montreal page, no French marketing, no Pro to Quebec addresses | French version if Montreal ever opens | — | Medium if Quebec were targeted; none if not |
| Online harms | **Bill C-34 "Safe Social Media Act"**, tabled 10 Jun 2026, at first reading; it **excludes services whose primary purpose is selling, listing or advertising goods or services**, and thresholds come later by regulation ([DLA Piper](https://www.dlapiper.com/en/insights/publications/2026/06/an-overview-of-canadas-safe-social-media-act), [Canada.ca](https://www.canada.ca/en/canadian-heritage/news/2026/06/government-of-canada-introduces-legislation-to-make-social-media-services-and-ai-chatbots-safer-for-children.html)) | Watch it; keep community posts secondary to listings | Everything for now | None today |
| GST/HST | — | Simplified registration above **C$30k a year to consumers** | Registration | None below the threshold |

---

## 5. Australia

| Australia | Required on day one (cost) | Soft (when) | Can skip | Realistic risk if skipped |
|---|---|---|---|---|
| Online Safety Act: removal notices | Act on eSafety removal notices **within 24 hours** (round 6). Route eSafety mail to the P0 alert (§7). €0 | — | — | **High if a notice is ignored**; otherwise none |
| Phase 1 industry standards (class 1A/1B: CSAM, terror) | A **short written self-assessment** of category and tier, kept on file:<br>• listings are a designated internet service (DIS);<br>• the chat is probably a relevant electronic service (RES), which must meet the RES Standard regardless of other categories ([Allens](https://www.allens.com.au/insights-news/insights/2025/02/new-industry-standards-for-online-safety-what-service-providers-need-to-know/)).<br>Pre-assessed categories need no own risk assessment; services outside them must assess or default to Tier 1 ([eSafety fact sheet](https://esafety.gov.au/sites/default/files/2024-06/Fact-sheet-registration-DIS-Standard.pdf)).<br>Terms banning class 1A/1B material, a report button, complaint handling: all built. **2–3 h** | Repeat if chat features change (e.g. images in chat) | — | Low (eSafety goes after high-risk services first), but the self-assessment is cheap proof |
| Phase 2 codes (age-restricted material) | Nothing, as long as there are no adult categories | — | — | None |
| Social media minimum age (16+) | Probably **not covered**: the law targets services whose sole or significant purpose is social interaction, and a classifieds site isn't one (my reading) ([infrastructure.gov.au](https://infrastructure.gov.au/media-communications/internet/online-safety/social-media-minimum-age)) | Re-check if community posts grow into a feed | — | Low |
| Privacy Act | **Probably exempt**: small businesses with ≤A$3M turnover from all sources ([OAIC](https://oaic.gov.au/agencies-and-organisations/faqs-for-agencies-orgs/businesses/small-business)). I found nothing that excludes foreign small businesses (my reading). Use the GDPR notice anyway | Re-check if the exemption is repealed (planned, no bill yet [1 source]) | Opt-in register | Low |
| Spam Act | Consent and unsubscribe; double opt-in already meets it | — | — | Low |
| GST | — | A$75k a year | Registration | None below the threshold |

---

## 6. Turkey

**What the law says:**
- **KVKK registration and representative:**
  - Foreign controllers that collect or process data from Turkey must register in **VERBIS** and appoint a **Turkish representative** (a Turkish legal entity or citizen, appointed by a notarised and apostilled decision).
  - The employee and asset thresholds **don't help foreigners**: "no threshold due to turnover or the number of employees" ([Cottgroup](https://cottgroup.com/tr/administrative-fine-amounts-in-kvkk-for-2024/item/verbis-registration-obligation-and-conditions-for-the-data-controllers-resident-abroad), [Gün + Partners](https://gun.av.tr/insights/updates/data-controllers-register-verbis), [IAPP](https://iapp.org/news/a/turkish-dpa-extends-data-controllers-registry-deadline)).
- **Territorial scope:** KVKK has **no express clause** of its own. The Board's practice is to apply it to anyone processing data of people in Turkey, and "low volume is no defence" ([Pandectes](https://pandectes.io/blog/understanding-turkeys-personal-data-protection-law-kvkk), [Prighter](https://prighter.com/resources/kvkk-article)).
- **The 2024 amendments** (Law 7499, in force 1 Jun 2024) changed transfers abroad: standard contracts must be notified to the Board within 5 working days. They did **not** create a size exemption.
- **Fines for a VERBIS breach in 2026:** TRY 341,809–17,092,242, about €6.1k–307k at €1 = 55.67 TRY [1 source].
- **Enforcement against small foreign sites with no Turkish presence: no case found.** Board decisions are published anonymised, and the known foreign cases (Meta and others) involve large Turkish user bases.
- **Law 5651:**
  - Art. 3: identity information on the site. The Impressum covers it.
  - Content and hosting providers must remove illegal content once notified.
  - **Art. 8/A orders must be carried out within 4 hours** of notice ([translation of Law 5651](https://mbkaya.com/?p=501)). Notices can reach foreign providers by email.
  - The social-network duties (representative, 48 h) start at 1M daily users (round 5), which isn't us.
- **VAT:** B2B is reverse-charged by the buyer on return no. 2, with no registration. B2C means registration from the first sale. **Never sell to consumers in Turkey** (round 7).
- **15% withholding** on online advertising services: price net, accept 85%, ask for the receipt (round 7).

**Soft-but-safe Turkey minimum:**

| Turkey stage | Required (cost) | Soft | Can skip | Realistic risk if skipped |
|---|---|---|---|---|
| **Guide + Nowruz events page** (no Turkish accounts, no payments) | Identity info (Impressum); P0 alert on mail from BTK or courts; **"hide in Turkey" per listing and per path** (`/turkey/...`) so a 4-hour order can be met from a phone. €0 | — | VERBIS and representative (hardly any personal data from Turkey) | Low |
| **Free verified businesses and organisers in Istanbul** (accounts, IDs seen during verification, chats) | Turkish privacy notice (*aydınlatma metni*) and minimal data (keep only VKN/MERSİS and the contact person; don't store ID images) | **VERBIS and representative**: here the law already applies by its text, but enforcement is unlikely while it is free and small | — | **Low to medium**: a single complaint could start a Board case, and no foreign small-site precedent was found |
| **Paid B2B from June 2027** | **VERBIS + representative (€1–3k a year) before the first Turkish payment**; standard contracts notified if the lawyer says transfers apply; reverse-charge invoice wording with the VKN; the 15% withholding rule; sanctions screening before any money | A Turkish adviser consult (≈€300–800, estimate) covering VAT, withholding, KVKK, and whether IYS (commercial-message registry) or ETBİS (e-commerce registry) applies | B2C anything | **Medium**: paying Turkish companies make Peydoo visible (invoices, withholding returns), and Board fines start at about €6k |

**My honest view:** KVKK is the one place where "soft" leaves a real gap once money flows. The safe zone is:
- **free and small: soft is fine;**
- **paid: register first.**

At €1.8–7.4k gross in year 1, the representative fee is a real share of revenue. That cost belongs in the go/no-go for paid Istanbul, not after it.

---

## 7. Moderation by the owner alone

### 7.1 What the law demands on speed

| Regime | Speed rule | Fixed hours? |
|---|---|---|
| EU DSA | Act "expeditiously" on actual knowledge (Art. 6); notices handled "in a timely, diligent, non-arbitrary and objective manner" (Art. 16(6)) | **No** |
| Germany | NetzDG's 24 h rule is gone (replaced by the DSA) | No |
| UK OSA | "Swiftly take down" once aware; Ofcom's codes set no clock | **No** |
| Australia | **eSafety removal notices: 24 hours** | Only for official notices |
| Turkey | **Law 5651 Art. 8/A orders: 4 hours** | Only for official orders |
| US | Section 230 doesn't depend on speed. DMCA: "expeditiously" | No |

**So no law forces 24/7 staffing.** What has to be fast is the response to **official orders** (24 h AU, 4 h TR) and to **danger to life** (DSA Art. 18). An alert system handles both, not a shift plan.

### 7.2 The solo setup (soft but safe)

1. **Post-moderation by default, with AI pre-screening on every post:**
   - **Rules first:** banned terms (havaleh, exchange, shipping to Iran, weapons, drugs), IBANs, crypto addresses, phone numbers in text, external links, price outliers, duplicate photos (built).
   - **[OpenAI omni-moderation](https://openai.com/index/upgrading-the-moderation-api-with-our-new-multimodal-moderation-model/):** free, text and images, better in non-English languages ([Analytics Vidhya, 2026](https://www.analyticsvidhya.com/blog/2026/05/openai-omni-moderation/)). **Persian quality is unverified**, and its categories (sexual, violence, hate, self-harm, illicit) **don't cover scams**. Use it as a first gate only.
   - **An LLM policy check** for scams and Iran-rule violations in Persian, as already planned in `docs/progress.md` item 11 (Anthropic). Claude Haiku 5.5 costs $0.10 / $0.50 per million input/output tokens. At 500 listings a day (≈1.5k input and 150 output tokens each) that is about **$3–4 a month** (estimate).
   - **Cloudflare's CSAM Scanning Tool:** free for Cloudflare customers, for uploaded images.
2. **Trust tiers decide what goes live at once:**
   - **Publish now:** verified businesses and organisers after 3 clean posts; "wanted" posts; items from accounts older than 30 days with no strikes.
   - **Hold for the owner:** a new account's first post; **rooms and flats with deposits, job offers, cars**; cross-zone posts (round 6); anything the AI flags; anything with links or payment words.
3. **Night mode** (automatic when the owner is offline): during the gap (e.g. 23:00–07:30 Berlin), every high-risk category is held. Low-risk posts still flow. Show «در حال بررسی، معمولاً کمتر از ۱۲ ساعت».
4. **Sweeps:** 07:30, 13:00, 18:00 and 23:00 Berlin. In winter these are LA 22:30 / 04:00 / 09:00 / 14:00, Toronto 01:30 / 07:00 / 12:00 / 17:00, Sydney 17:30 / 23:00 / 04:00 / 09:00. The longest wait for a held post is **about 8.5 h**, inside the 12 h promise.
5. **User reports:**
   - P2P listings are **auto-hidden after 3 reports from different verified accounts**.
   - An auto-hide is a restriction, so it needs an Art. 17 statement marked "automated", plus an appeal. The system already writes statements.
   - Reports from accounts with a good report history go to the top. These are "community reporters", **not** DSA trusted flaggers, which don't apply to us anyway.
6. **Emergency rule (P0):**
   - **What counts:** a threat to life or safety, child safety, doxxing, and **any official order** (eSafety, BTK or a court, police, Ofcom, a DSA Art. 9/10 order).
   - **Alert:** the Telegram bot rings through Do Not Disturb.
   - **The owner's promise:** act within 1 hour while awake, first thing on waking otherwise. The **4-hour Turkish orders** are met by the one-tap "hide in Turkey".
   - **Danger to life:** report to the police (DSA Art. 18).
   - **One-tap switches:** "pause posting in category × city" (round 7) and "hide in country".
7. **Absence (illness, holidays):**
   - **Safe mode:** every P2P post is held, only verified businesses and organisers publish, and the auto-hide rule stays on.
   - A **deputy** may only switch safe mode on or off and press pause. They don't decide on content.
   - The terms say decisions are made by Peydoo staff, which is true.
8. **The rule for AI:** AI may **hold, hide or flag**. **Only the owner removes for good, restricts or bans** (GDPR Art. 22, DSA consistency).
   - Sample 20 AI decisions a week.
   - Describe the AI use in the terms (DSA Art. 14) and in statements (Art. 16(6), 17).

### 7.3 Hours a week for one person (estimate)

Assumptions (mine):
- AI auto-publishes 75% of posts at 50 a day, 80% at 200 and 85% at 500, as the trust tiers fill.
- About 1 minute per held post.
- Reports at 1.5% of new posts a week, about 8 minutes each including the statement.
- Deep scam cases about 20 minutes each.
- 15 minutes per business verification.
- Not included: support email, seeding and sales.

| New listings a day | Held for review a week | Reports a week | Scam cases | Verifications | AI sample + appeals | **Total h a week** | Per day |
|---|---|---|---|---|---|---|---|
| **50** | ≈90 → 1.5 h | ≈5 → 0.7 h | 2 → 0.7 h | 5 → 1.3 h | 0.8 h | **≈4–6 h** | ≈40–50 min |
| **200** | ≈280 → 4.7 h | ≈21 → 2.8 h | 6 → 2 h | 10 → 2.5 h | 1.5 h | **≈11–16 h** | ≈2 h |
| **500** | ≈525 → 8.8 h | ≈52 → 7 h | 15 → 5 h | 15 → 3.8 h | 2.5 h | **≈22–32 h** | ≈3.5–4.5 h |

- **Without AI pre-screening,** 50 a day alone is about 6 h a week just reading posts. The AI tier is what makes solo moderation possible.
- **Where it stops fitting:**
  - **Up to about 200 a day, solo works** (about 2 h a day in four sweeps).
  - **From about 300 a day, sustained,** it starts crowding out seeding and sales.
  - Then either tighten the rules (more holds turned into rejections, a longer trust period) or add paid help.
  - **Suggested trigger instead of a hire now:** moderation over **15 h a week for 4 weeks**, or held-post p95 over 12 h for 2 weeks.
  - This replaces round 7's "moderator hours covered" capacity check.
- **What this changes in the plan:**
  - No Minijob, Toronto or Vancouver contractor, so the AB5, foreign-contractor tax and GDPR-transfer questions about moderators disappear.
  - LA rentals and cars (September) open with **night-mode holds** instead of an Americas moderator. Rooms and cars posted during LA's afternoon wait until Berlin morning. That is acceptable, but tell posters.

---

## 8. The safe zone: red lines we never cross

1. **Sanctions:**
   - no money to or from Iran;
   - no havaleh, exchange or transfers;
   - no trade or freight to Iran, and no Iran-sourced goods or services in US listings;
   - sanctions screening before any payment or verification;
   - Iran stays read-only;
   - ask Stripe in writing before paid founding Pro.
2. **Official orders and illegal-content notices are always answered:**
   - DSA notices processed and answered with a statement;
   - eSafety notices within 24 h;
   - Turkish 8/A orders within 4 h (by hiding in Turkey);
   - police and court orders without delay;
   - threats to life reported (Art. 18).
3. **Impressum and contact points** reachable within two taps everywhere, always current.
4. **GDPR basics:**
   - privacy notice, record of processing, processor agreements;
   - 72 h breach routine;
   - no non-essential cookies without consent;
   - no selling of data, ever;
   - AI never bans on its own.
5. **Scams:**
   - deposit and rental scams, fake jobs and visa or residence fixers are held before publishing, never published first;
   - the "landlord abroad" pattern is blocked (round 6).
6. **Paid offers outside the EU go to businesses only** (UK, Turkey, and Canada/US/Australia at first). Nothing paid is sold to consumers anywhere without the consumer-law block (§1.5).
7. **No adult, gambling, weapons, drugs or crypto categories.** Without them, the children and age-restriction regimes stay small (UK, AU, CA).
8. **Never target Quebec or the UAE.** Turkey only in the modes above.
9. **Written records exist before the country opens:** the UK assessments, the AU self-assessment, and KVKK before Turkish money. These documents are the cheapest protection there is.

---

## 9. What softens versus rounds 5–7, and the cost

| Item | Earlier plan | Soft but safe | Saving (estimate) |
|---|---|---|---|
| Moderators | Minijob + Toronto from January, Vancouver from June (≈€1.5–2.4k a month) | Owner + AI; trigger in §7.3 | ≈€15–25k in year 1 |
| UK | Lawyer review £1–3k before Starter | Self-written assessments; lawyer only at London Open; **keep the Art. 27 representative** | ≈£1–3k |
| US | US counsel $1.5–4k; WCAG 2.2 AA audit before Starter | DMCA $6; 1-hour sanctions consult; basic accessibility pass + statement; audit later | ≈$1.5–4k |
| Canada, Australia | Lawyer reviews C$/A$1–2.5k each | Paragraphs + self-assessment; lawyer at Toronto Open | ≈€1.3–3.4k |
| France | French texts + mediator ≈€1.5–3k before Paris | B2B-only paid offers in France; no mediator (VSBG) | ≈€1.5–3k |
| Italy | "Check Italian language rules" | B2B-only, or one Italian price page (≈€150–300) | small |
| Turkey | VERBIS + representative before the events page | Before the **first Turkish payment** (or earlier if free accounts grow) | timing only |
| **Keeps its cost** | German lawyer review of terms and privacy (≈€1–2.5k); EU trademark; Turkish adviser before paid Istanbul | — | — |

**Legal and compliance one-time spending in year 1 comes to about €1.5–4k** (estimate): the German review, the UK representative, the DMCA agent, a US sanctions consult and a Turkish consult. Add €1–3k a year for the KVKK representative once Turkey is paid.

## 10. Open questions for the lawyer and tax advisor (short list)

1. The withdrawal button (§ 356a BGB): does the current checkout for bumps or founding Pro need it? Or do we keep year 1 B2B-only?
2. France: does the VSBG cover a German micro trader instead of a French mediator? Does Loi Toubon reach B2B Pro offers in Persian?
3. DAC7: confirm that listing-only classifieds are outside the definition.
4. UK: Art. 27 representative provider, and whether the ICO fee applies.
5. Turkey: when exactly KVKK applies (free accounts or only paid), the transfer basis, and IYS and ETBİS.
6. US: resale of Iranian-origin goods already lawfully in the US (carried over from round 6).

## Weak evidence

- Ofcom's own pages and PDFs returned 403 to my tools. The list of measures for all services comes from law-firm summaries (SCL, HSF) and Ofcom's codes overview, not the code text.
- The children's access "not met" conclusion is my reading of the guidance, not tested against an Ofcom decision.
- The KVKK 2026 fine range comes from one source. No enforcement case against a small foreign site was found, which is not proof there are none.
- Australia: I didn't get the exact DIS or RES category Peydoo falls into. The self-assessment has to settle it.
- DAC7, GPSR and EAA conclusions are my reading of the definitions plus vendor or law-firm commentary.
- The moderation hours are estimates from assumed rates, not measured on Peydoo.
- The Haiku price is from Anthropic's model table as of 6 Oct 2026; the per-listing token counts are guesses.
