# Iran: what can be partially activated? (research 10)

25 Oct 2026 · for the owner's question: *"What can we activate for Iran? I want Iran to be active partially. How about events in Iran? Is this a good idea?"*

This builds on round 5 (`research5-iran.md`: read-only, +98 refused, Exodus, filtering, wording rules) and round 8 (`research8-iran-messaging.md`: email-only message accounts, 31 CFR 560.540, FAQ 1088, payment block in Iran chats). Nothing here repeats those analyses unless something has changed.

> **Not legal advice.** This summarises public sources to brief a sanctions lawyer. **[1 source]** means the fact was found in one source only. **[assessment]** means my own reasoning, with no source that says it directly. No code was changed.

## Short answer

- **Events in Iran: no.** This covers Iranian organisers and diaspora organisers running events inside Iran, free or ticketed. Each of the three legal systems gives its own reason, and the practical case is weak too:
  - **US providers:** a listing for an organiser in Iran is a promotional service whose benefit is received in Iran ([31 CFR 560.410](https://www.law.cornell.edu/cfr/text/31/560.410)). The internet rule we rely on excludes "web-hosting services that are for websites of **commercial entities located in Iran**" ([560.540(b)(3)](https://www.law.cornell.edu/cfr/text/31/560.540)). Stripe bars "products or services originating from" Iran, "directly or indirectly" ([Stripe](https://stripe.com/legal/restricted-businesses)).
  - **Iran:** public events need an Ershad permit. Companies are banned from advertising on unauthorised foreign platforms ([Supreme Council of Cyberspace, Feb 2024, Art. 2](https://www.entekhab.ir/fa/news/765705/)). The state now treats "cultural … cooperation" with listed foreign outlets as a crime ([Radio Zamaneh](https://en.radiozamaneh.com/38237/)).
  - **Practical:** the country has been at war since 28 Feb 2026. Iranian platforms (Evand, Tiwall, Iticket, Iranconcert) already sell tickets in rials. Peydoo can't take any payment.
- **The US tightened sharply in Aug–Oct 2026 ("Operation Economic Outcast").** OFAC suspended its general licences for conferences, performances and exhibitions (560.554), educational exchanges (GL G) and personal remittances (560.550). It now presumes denial for specific licences. **560.540, the communications rule that our message-only model rests on, is untouched** in the eCFR as of 1 Oct 2026. It is now the thing we depend on most, so Peydoo needs a switch that can fall back to read-only quickly.
- **What is worth activating, best first:**
  1. **Peydoo's own guides:** «کارهای ایران از خارج» (consulate, documents, translation) and newcomer city guides. **Yes, now.**
  2. **Jobs abroad that are open to applicants still in Iran** (relocation, visa sponsorship). Iran accounts can already message them. **Yes, now** (a filter, no new rights).
  3. **"Wanted" posts by people about to emigrate** (a room, a job or a course in an open country). **Yes, later**, with pre-moderation, limited visibility and the lawyer's OK.
  4. **Free online events run from abroad that people in Iran can join.** **Yes, later**, badge only, non-political, free only.
  5. **Saved-search email alerts** for the city a user is moving to. **Yes, later.**
  6. **User Q&A on emigration.** **Later**, after the above.
- **What should stay off:**
  - the Nowruz travel guide in its "come visit" form (the Auswärtiges Amt currently **asks Germans to leave Iran**);
  - remote jobs where the work is done from Iran, as a category;
  - free listings inside Iran;
  - Iranian teachers or freelancers selling to the diaspora;
  - events in Iran.
- **Proposed mode «ایران: نیمه‌فعال»:** the round 8 message-only account, plus guides, a relocation-jobs filter, and in phase 2 wanted posts, alerts and an online-event badge. Nothing is ever *located in* Iran, nothing is *sold from* Iran, and no money moves. An admin switch moves between `read_only`, `message_only` and `partial`.

---

## 0. What has changed since round 8

| Change | Date | What it means for Peydoo | Source |
|---|---|---|---|
| **US–Israel war on Iran**, ongoing. Ceasefire from 8 Apr; it collapsed on 8 Jul; hostilities resumed in Sep | from 28 Feb 2026 | Travel, events and payments into Iran are all disrupted. The security state is at its most suspicious | [Wikipedia: 2026 Iran war](https://en.wikipedia.org/wiki/2026_Iran_war) (a summary, tagged as needing an update) |
| **EU lists the IRGC as a terrorist organisation**: funds and economic resources frozen, nothing may be made available to it | political agreement 29 Jan, adopted 19 Feb 2026 | Many Iranian cultural and media organisers have IRGC links. One example is Owj, an IRGC-affiliated arts and media organisation ([Wikipedia](https://en.wikipedia.org/wiki/Owj_Arts_and_Media_Organization)). Peydoo can't screen organisers in Iran | [Eunews](https://www.eunews.it/en/2026/02/19/iran-revolutionary-guards-officially-added-to-eu-terrorist-list), [Estonian MFA](https://vm.ee/en/news/eu-lists-islamic-revolutionary-guard-corps-terrorist-organisation) |
| **OFAC suspends 560.544, 560.550, 560.554 and GLs F and G** (education, remittances, conferences and performances, sports, academic exchanges) | effective 24 Aug 2026 | Even the US authorisation for Iranian residents taking part in **public performances and exhibitions** abroad is gone. The direction is clear | [91 FR 54957](https://www.govinfo.gov/content/pkg/FR-2026-08-26/html/2026-17426.htm) |
| **OFAC suspends 560.522, .528, .529 and GL J-1** (aviation, bunkering) | 8 Sep 2026 | Not relevant to us, except as a trend | [91 FR 57511](https://www.govinfo.gov/content/pkg/FR-2026-09-10/html/2026-18461.htm) |
| **Licensing policy: presumption of denial** for Iran-related specific licences | 10 Sep 2026 | A specific licence is not a realistic route for anything outside the general licences | [Squire Patton Boggs](https://www.squirepattonboggs.com/insights/publications/ofac-s-new-policy-for-iran-related-licenses/), [Global Trade Alert](https://globaltradealert.org/state-act/100464-united-states-of-america-introduction-of-a-presumed-denial-licensing-policy-for-iran-related-transactions) |
| **E.O. 13902 extended to the technology sector** (and to aviation, digital assets, gold, shipping, automotive and rail). Anyone, anywhere, "operating in" the sector can be designated | 24 Aug and 1 Oct 2026 | One more reason not to host Iranian tech freelancers or software sellers (option b). The sector is "broad and not currently defined" | [Paul Weiss](https://www.paulweiss.com/insights/client-memos/treasury-launches-operation-economic-outcast-expanding-the-reach-of-us-iran-sanctions), [OFAC Iran page](https://ofac.treasury.gov/sanctions-programs-and-country-information/iran-sanctions) |
| **560.540 unchanged.** The 30 Sep amendment touched 560.210 and 560.211 only | checked in the eCFR as of 1 Oct 2026 | Our base still stands. OFAC's FAQ confirms 560.540 supersedes GL D-2 | [eCFR 560.540](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-V/part-560/subpart-E/section-560.540), [91 FR 61759](https://www.govinfo.gov/content/pkg/FR-2026-09-30/html/2026-19978.htm), [FAQ 1110](https://ofac.treasury.gov/faqs/1110) |
| **Wording correction:** 560.540(b)(3) says "**commercial entities** located in Iran". The old GL D-1 said "commercial endeavors". Round 8 used the old word | 2024 text | The test is whether the website belongs to a business located in Iran. No OFAC FAQ on marketplaces was found **[assessment]** | [560.540](https://www.law.cornell.edu/cfr/text/31/560.540), [GL D-1](https://www.dwt.com/files/Uploads/Documents/OFAC%20Iran%20General%20License%20D-1%202-7-14.pdf) |
| **Internet:** blackout from 8 Jan 2026 (protests), then war-time shutdown. A tiered "Internet Pro" scheme for businesses, capped at about 10 foreign platforms. Partly restored late May. VPNs "no longer effective or affordable" | Jan–Jun 2026 | Few ordinary users can reach Peydoo at all. Reach in 2026 is small | [RFE/RL](https://www.rferl.org/a/iran-internet-shutdown-censorship/33654841.html), [The National](https://www.thenationalnews.com/future/technology/2026/04/28/iran-internet-pro-update-blackout/), [Al Jazeera](https://www.aljazeera.com/news/2026/5/31/iran-reinstates-some-internet-access-but-restrictions-remain-for-most), [ACLED, 5 Jun 2026](https://acleddata.com/expert-comment/has-iran-really-restored-internet-access) |
| **Crackdown:** more than 6,000 arrests since 28 Feb. Online activity framed as "espionage", which carries the death penalty. Sending images to Persian-language media abroad is treated as "collaborating with the enemy". VPN use is threatened with prosecution | to May 2026 | The risk to users in Iran is higher than in round 8 | [Amnesty, 28 May 2026](https://www.amnesty.org/en/latest/news/2026/05/iran-mass-arbitrary-arrests-and-political-executions-mark-intensifying-repression/) |
| At least 67 people executed on political charges since the attacks began | to Oct 2026 | Same | [Amnesty urgent action via DP Abolition](https://dpabolition.substack.com/p/urgent-action-iran-risk-of-imminent) **[1 source for the figure]** |
| **"Hostile" list under the Oct 2025 espionage law:** 44 outlets, 61 media figures, 310 online pages and accounts (including websites). "Political, cultural, media, or propaganda-related cooperation" with them may be prosecuted. It will be updated "when deemed necessary" | 12 Jul 2026 | Peydoo is not on it. A diaspora site that visibly hosts Iran-facing political content could be added, and then any "cultural cooperation" with it becomes risky | [Radio Zamaneh](https://en.radiozamaneh.com/38237/), [Article 18](https://articleeighteen.com/?p=24568) |
| **A bill to ban giving information to foreigners** without the intelligence ministry's approval | Aug 2026, not yet law | Would widen the risk for anyone in Iran chatting with people abroad | [Neos Kosmos](https://neoskosmos.com/en/2026/08/17/news/world/iran-advances-bill-to-curb-hostile-media-interactions/) **[1 source]** |
| **Auswärtiges Amt: travel warning plus a request to leave.** Concrete risk of arbitrary arrest for Germans, worst for dual nationals. More exit bans. "Sharing, commenting or liking" posts, even from Germany, can count as espionage | as of 25 Oct 2026 | A "come visit for Nowruz" guide is off the table for now | [Auswärtiges Amt](https://www.auswaertiges-amt.de/de/reiseundsicherheit/iransicherheit-202396) |
| **Hijab enforcement:** cafés, restaurants, shops and sports clubs shut in more than 15 cities over customers' or staff hijab | Aug 2026 | Any venue shown on a foreign site with unveiled women risks closure | [Iran International](https://www.iranintl.com/en/202608207335) **[1 source]** |

---

## 1. Events in Iran on Peydoo

There are two cases. **(A)** An organiser in Iran (a band, a gallery, a tour company, a class) lists an event in Iran. **(B)** A diaspora organiser abroad lists an event they run inside Iran, such as a Nowruz tour for second-generation visitors, a cultural night in Tehran, or a meetup during the holidays.

### 1.1 EU law (Reg. 267/2012 as restored on 29 Sep 2025)

What came back ([Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2025/10/eu-reintroduces-sanctions-against-iran-following-un-snapback)):

| Restored | Content | Relevance to events |
|---|---|---|
| Listed persons | Asset freezes on more than 50 people and about 200 entities (Annexes VIII, IX). "Economic resources" are frozen too | A free listing is a service, not obviously "funds". Whether a promotional page that sells tickets counts as "economic resources" made available to a listed or IRGC-linked organiser is open **[assessment]**. Peydoo can't screen organisers in Iran: no real names, and no Persian-script screening tool |
| IRGC terror listing (separate regime, Feb 2026) | Freeze, and no funds or economic resources may be made available | Many state-cultural bodies have IRGC links (Owj, above). The risk is low per listing but impossible to control **[assessment]** |
| Funds transfers | No limit below €10,000. €10k–40k needs advance notification. Prior authorisation from €40k for "other purposes"; tighter rules for Iranian banks ("Iran-related institutions") | Ticket money would flow inside Iran in rials, not through us. A diaspora organiser (case B) paying Iranian venues and suppliers sends money into Iran through Iranian banks or havaleh. That is their legal problem, but Peydoo would be advertising it |
| Sectoral bans | Oil, gas, petrochemicals, metals, certain software, shipping, insurance, bonds | Not relevant to events |
| General ban on services | **None** | Free event information is not banned as such |

**EU conclusion [assessment]:** a free listing of a cultural event in Iran is probably not banned by Reg. 267/2012. The EU side is not the blocker. Two caveats: we can't exclude a listed or IRGC-linked organiser, and § 19 AWG punishes negligence.

### 1.2 US law and our US providers

**Who is exposed.** Peydoo is not a US person. Our providers are: Cloudflare (CDN, Turnstile), AWS (SES), Stripe and Sentry. They must not end up providing services "where the benefit of such services is otherwise received in Iran" ([560.410(a)](https://www.law.cornell.edu/cfr/text/31/560.410)). A page that promotes a Tehran gallery's exhibition benefits the gallery in Iran.

**Is it covered by 560.540?** That rule authorises services "incident to the exchange of communications over the internet", such as chat, social networking, browsing and e-learning platforms. It **excludes** "web-hosting services that are for websites of commercial entities located in Iran" ([560.540(b)(3)](https://www.law.cornell.edu/cfr/text/31/560.540)).

| Case | Covered? [assessment] |
|---|---|
| (A) Ticketed event by an Iranian organiser | **No.** It is promotional hosting for a commercial entity located in Iran. The informational-materials exemption also excludes "marketing and business consulting services" ([560.210(c)(2)](https://www.law.cornell.edu/cfr/text/31/560.210)) |
| (A) Free event by an Iranian organiser (a museum, a free class) | **Unclear.** Many organisers are still businesses or state bodies. Services for the Government of Iran are excluded, apart from free public services to it |
| (B) Diaspora organiser, event inside Iran | **Unclear to doubtful.** The organiser is abroad, but the event is a commercial activity in Iran (venues, guides, transport bought there). If a US-person organiser imports or deals in Iranian-origin services, that is a violation for them ([560.206](https://www.law.cornell.edu/cfr/text/31/560.206)). The travel exemption ([560.210(d)](https://www.law.cornell.edu/cfr/text/31/560.210)) covers "transactions ordinarily incident to travel", including "arrangement or facilitation of such travel". That may help a tour, but not an event business |

**Provider terms:**

| Provider | Term | Effect on Iran events |
|---|---|---|
| **Cloudflare** | [Self-Serve Subscription Agreement](https://www.cloudflare.com/terms/) (12 Sep 2025), §7.1: "You will not use the Service to export or re-export any information or technology to any … individual, or entity to which such export … is restricted". Also "you are responsible for determining whether use of the Service will satisfy your individual compliance obligations" | The burden sits on us. Before its IPO, Cloudflare self-disclosed possible sanctions violations because its service was "used by, or for the benefit of" SDN-listed parties ([giga.law](https://giga.law/daily-news/2019/9/11/cloudflare-says-it-may-have-violated-us-economic-trade-sanctions)), so it is sensitive here. **No separate public sanctions policy page was found** |
| **AWS** | [Customer Agreement](https://aws.amazon.com/agreement/) §11.6 (updated 14 Aug 2026): each party complies with OFAC sanctions, and "you are solely responsible for compliance related to … the provision of Your Content to End Users". §2.5: we are responsible for End Users' use | SES would mail event confirmations and alerts to Iranian organisers. That is outside "communications" if it serves an Iranian business **[assessment]** |
| **Stripe** | Bars "use of Stripe's services for any dealings, engagement, or sale of goods or services either directly or indirectly" involving "persons located in, resident in, or a citizen of, **or products or services originating from**" Iran ([Stripe](https://stripe.com/legal/restricted-businesses)) | Even with no payment from Iran, a diaspora organiser paying for a bump or Pro to promote an event in Iran is Stripe used "indirectly" for services originating from Iran. And an "Iran events" section is exactly what Stripe's website review flags |
| **Sentry** | §19.11, no use "in violation of any U.S. export embargo" ([Sentry](https://sentry.io/terms/)) | Minor; round 5 already drops IR-origin events |

**US conclusion:** events located in Iran fall outside the one rule that protects our providers, and in the case of a bump or Pro purchase they break Stripe's terms directly. Since Aug 2026 OFAC has removed even the cultural-exchange licences (560.554, GL G) and presumes denial for new licences. This is not the moment to test a grey area.

### 1.3 Iranian law and safety

| Topic | Position | Source |
|---|---|---|
| **Permits** | Public performances need a Ministry of Culture and Islamic Guidance (Ershad) licence. Police and other bodies stop licensed concerts anyway | [CHRI](https://iranhumanrights.org/2019/01/musician-ali-ghamsari-banned-from-performing-in-iran-after-refusing-to-remove-female-singer/), [Wikipedia](https://en.wikipedia.org/wiki/Iranian_women_and_Persian_music) |
| **Women and music** | No statute bans women singing, but solo female singing before mixed audiences has been barred in practice since 1979. Concerts are cancelled over female performers | [CHRI 2018](https://iranhumanrights.org/2018/01/iranian-female-vocalist-we-never-get-a-chance-to-practice-our-art-in-a-professional-setting/), [Iran International](https://www.iranintl.com/en/202403055851) |
| **Mixed private parties, alcohol, hijab** | Hijab law suspended, but Penal Code Art. 638 still applies, and venues have been shut in more than 15 cities in Aug 2026. Private mixed parties are raided (well known; not re-sourced here) | [Aos Fatos](https://www.aosfatos.org/noticias/nao-e-verdade-que-autoridades-iranianas-suspenderam-o-uso-obrigatorio-do-hijab/), [Iran International](https://www.iranintl.com/en/202608207335) |
| **Promotion on foreign platforms** | "هرگونه تبلیغ اشخاص حقوقی در بستر سکو‌های خارجی غیرمجاز ممنوع است" (any advertising by legal persons on unauthorised foreign platforms is banned). Enforced by Ershad, the police and the judiciary. The same resolution bans unlicensed VPN use | [Supreme Council of Cyberspace via Entekhab, 20 Feb 2024](https://www.entekhab.ir/fa/news/765705/) |
| **Espionage law (Oct 2025) and the hostile list (Jul 2026)** | "Cultural … cooperation" with listed pages may be prosecuted. Sending images to foreign outlets is treated as collaborating with the enemy | [Radio Zamaneh](https://en.radiozamaneh.com/38237/), [Amnesty](https://www.amnesty.org/en/latest/news/2026/05/iran-mass-arbitrary-arrests-and-political-executions-mark-intensifying-repression/) |
| **Event in Iran during the war** | Live music only "slowly resuming" after the April ceasefire. Example: 300 people at a concert at the Tehran Museum of Contemporary Art on 21 May | [1News/AP](https://www.1news.co.nz/2026/05/23/live-music-returns-to-tehran-amidst-fragile-ceasefire/) |

**Who gets hurt [assessment]:**
- **Organisers in Iran become identifiable.** A Peydoo event page links a venue, a date, a name and often photos to a foreign Persian-language site. Next to it sit diaspora events with unveiled women, LGBTQ nights and political talks. That is the evidence pattern the 2026 crackdown uses.
- **Attendees.** An event page with "going" counts or comments creates a list of people. Peydoo has no RSVP list today, but any future one would be dangerous for events inside Iran.
- **Peydoo itself.** An "events in Iran" section makes Peydoo look Iran-facing. That raises the odds of filtering and of being placed on the hostile list. Being listed would then endanger every message-only user in Iran, because "cooperation" with a listed page is the offence.
- **Diaspora organisers in case (B).** These are often dual nationals. The AA warns of arbitrary arrest and exit bans. A diaspora event business inside Iran is exactly the kind of foreign link that gets questioned at the airport.

### 1.4 Practical

- **Reach:** in 2026, ordinary users were mostly offline or on a whitelist. VPNs are expensive (about 500,000 toman per GB versus 40,000 for Internet Pro, [The National](https://www.thenationalnews.com/future/technology/2026/04/28/iran-internet-pro-update-blackout/) **[1 source for the prices]**). Peydoo will not be on anyone's whitelist.
- **Existing platforms do this already**, in rials, with Shetab cards and permits:
  - [Evand](https://evand.com/): events, webinars, conferences, registration and ticketing (checked live today);
  - [Iticket](https://iticket.ir/): cinema and theatre (checked live today);
  - Tiwall and Iranconcert (both answered with redirects today; not inspected);
  - Tiwall was named as an official ticket seller for the Fajr music festival ([Hamshahri](https://www.hamshahrionline.ir/news/643213/)).

  An Iranian organiser gains nothing from Peydoo: no payment, no local audience, filtering, and legal risk.
- **Payment:** impossible. Iran accounts can't pay, Stripe bars Iran, and we block payment details in Iran chats (round 8).
- **Moderation:** every Iran event would need a permit check we can't do, an IRGC-link check we can't do, and a safety review of the photos. That is too much for one owner.

### 1.5 Diaspora demand

- **No survey or data was found** showing that diaspora members want a listing of events in Iran.
- **Flows before the war:** about 5 million Iranians abroad, and "850,000" travelling to Iran "regularly since 1398" (the period counted is unclear) ([Aftab, quoting deputy FM Bikdeli, Mar 2024](https://aftabnews.ir/fa/news/897960/)) **[1 source]**.
- **Qualitative work** on second-generation "homecoming" trips exists, but it is small ([Erasmus thesis, 14 interviews](https://thesis.eur.nl/pub/56211/)).
- **In 2026:** Nowruz 1405 (March 2026) fell in the first weeks of the war. Imam Khomeini airport had no international flights until 25 April. European airlines still avoided Iranian airspace in April ([GNA](https://gna.org.gh/2026/04/international-flights-resume-in-tehran-for-first-time-since-war/), [Bluewin](https://www.bluewin.ch/en/news/international/first-foreign-flights-take-off-from-tehran-again-3205131.html)). The AA asks Germans to leave.
- **[assessment]** Visitors with family in Iran find events through relatives and Iranian apps. What they cannot easily find is help *before* they travel, and that sits outside Iran (option d').

### 1.6 Verdict on events in Iran

**Not a good idea, in any form that lists events located in Iran.** Not for Iranian organisers, not for diaspora organisers, not free and not ticketed. The reasons, strongest first:

1. **US providers:** it falls outside 560.540, the benefit is received in Iran, and Stripe bars it "directly or indirectly". That is a direct threat to the Stripe account, which pays for Peydoo.
2. **Safety:** it identifies organisers and venues during a war-time crackdown, and raises the odds of Peydoo being listed as hostile. That would endanger all Iran users.
3. **Iran's rules:** companies may not advertise on foreign platforms, and events need Ershad permits.
4. **No demand and no product:** there are local platforms, Peydoo can't take payment, and few people can reach it.
5. **Mission:** Peydoo is for Iranians abroad.

**What to offer instead, in the "events" spirit:**
- **Online events run from abroad** that people in Iran can join for free (option f, phase 2).
- **Nowruz, Yalda and Chaharshanbe Suri events abroad**, which are already in scope and are the real diaspora demand.
- **The «کارهای ایران از خارج» guide** for people preparing a trip or paperwork (option d').

**Product rule:** the event form accepts locations only in the open countries, or "online". An Iranian address, an Iranian city name or a +98 phone number in the text leads to a refusal with the copy in §3.5. This stays the same for diaspora organisers.

**Revisit only if all of these hold [assessment]:**
- the war has ended and the AA has lifted its request to leave;
- 560.540 is still in force and OFAC has eased;
- the lawyer has confirmed;
- and even then, only free, permitted, public cultural events (a museum exhibition), shown as plain information with no organiser contact and no photos of people.

That is low value. Expect to keep saying no.

---

## 2. Other partial activations, ranked

**Ranking (value to Peydoo's mission ÷ risk), best first:**

| # | Option | Recommendation |
|---|---|---|
| 1 | **(d′) Peydoo-written guides: «کارهای ایران از خارج» + (g1) city guides for newcomers** | **Yes, now** |
| 2 | **(c′) Jobs abroad open to applicants from Iran** (relocation and visa sponsorship), replacing (c) | **Yes, now** (a filter on existing rights) |
| 3 | **(a) "Wanted" posts by people about to emigrate** | **Yes, later**, with conditions (phase 2) |
| 4 | **(f) Free online events from abroad, joinable from Iran** | **Yes, later**, with conditions (phase 2) |
| 5 | **(h, new) Saved-search email alerts for the destination city** | **Yes, later** (phase 2) |
| 6 | **(g2) User Q&A about emigration** | **Later** (phase 3), only if 3 and 4 run cleanly |
| 7 | (d) Nowruz guide in its "come and visit" form | **No, for now.** Only a safety box linking to the AA |
| 8 | (c) Remote jobs where the work is done from Iran | **No**, as a category or tag |
| 9 | (e) Free non-commercial listings inside Iran | **No** |
| 10 | (b) Teachers and freelancers in Iran selling to the diaspora | **No** |
| — | Events in Iran | **No** (§1) |

### (d′) and (g1) Peydoo-written guides: «کارهای ایران از خارج» and newcomer city guides

The owner's (d) idea, re-centred on what people need *outside* Iran: passport and ID renewal at the Iranian consulates, sworn translation of Iranian documents, legalisation and recognition for use in Germany (Anerkennung), military-service and exit-ban risks for dual nationals, and newcomer guides (Anmeldung, bank account, health insurance, renting without scams). Each guide links to diaspora businesses abroad that are already listed (translators, lawyers, movers).

| Aspect | Position |
|---|---|
| EU | Peydoo's own information. No issue |
| US providers | Informational material and browsing, the core of 560.540 and 560.210(c). The businesses linked are abroad |
| Iran | Neutral, practical content. **Never** political, never about how to get round filtering. Mention "avoid political events and photographing government buildings", quoting the AA |
| Safety for users | It reduces risk: it warns dual nationals of the AA's points (exit bans, likes on social media, devices) |
| Scam risk | Low. Rather, it fights scams (fake "guaranteed visa" agents, rental deposits) |
| Moderation | None. Writing and updating takes the owner a few hours per guide; review yearly or when the AA changes |
| Mission fit | Strong. It serves both the diaspora and future emigrants |
| **Recommendation** | **Yes, now.** Rule: list only businesses operating **outside** Iran. **Ban** listings that offer services *inside* Iran: property management, inheritance handling, gifts or parcels to Iran, SIM cards, money transfer. These are dealings in Iran and often a cover for havaleh |

### (c′) Jobs abroad open to applicants still in Iran (relocation and visa sponsorship)

Instead of remote work done from Iran (c), let employers in the open countries mark a job «امکان مهاجرت / حمایت از ویزا» (relocation / visa sponsorship). Iran accounts can already message job ads (round 8). This only adds a filter.

| Aspect | Position |
|---|---|
| EU | Hiring someone to move to Germany is ordinary. No payment goes to Iran |
| US providers | The customer is an employer abroad and the work is done abroad. Chat with the applicant is "communications" **[assessment]** |
| Stripe | A paid job ad by a German employer is fine. **Don't** let the ad say "for people in Iran". Use a neutral "open to international applicants / visa sponsorship" **[assessment]** |
| Iran | Applying for a job abroad is not a crime **[assessment; no source found that says otherwise]**. Avoid employers in the US or Israel (the espionage law's "hostile states"): the applicant's risk, our warning |
| Safety | Low to medium. Applicants send CVs with real names. Chat has no attachments, so the CV goes by email after a reply; warn about this |
| Scam risk | **Medium to high.** Fake jobs with "visa fees", "agency fees" or "training fees". The existing payment block in Iran chats helps. Add the rule "an employer never asks for money" to the system message, and require phone-verified business accounts for the relocation flag |
| Moderation | Low: one flag per job, reviewed at posting |
| Mission fit | Good. Future diaspora, and diaspora businesses that need staff |
| **Recommendation** | **Yes, now** (small). Only business or verified accounts may set the flag |

### (a) "Wanted" posts by people in Iran who are about to emigrate

Examples: «دنبال اتاق در برلین از سپتامبر», «دنبال کار در هامبورگ», «کلاس زبان آلمانی در مونیخ». The post is about a city in an open country, not about Iran.

| Aspect | Position |
|---|---|
| EU | Personal, non-commercial. No funds. No issue **[assessment]** |
| US providers | An individual's post is closest to "social networking" or "blogging" in 560.540(a)(1). The list is illustrative ([FAQ 338](https://ofac.treasury.gov/faqs/updated/2024-05-16)). It is not "web-hosting for commercial entities located in Iran". Upwork told the SEC that "a posting by an individual is simply information" ([Upwork SEC letter](https://investors.upwork.com/node/8666/html)). **Lawyer to confirm.** This is the first time Iran accounts would *post* |
| Stripe | Not involved. Wanted posts are free, can't be bumped, and give no Pro |
| Iran | Low for practical posts. Emigration is legal. **Risk rises if people write their reasons** (asylum, religion, LGBTQ), so the form forbids it |
| Safety | Medium. A public post plus a nickname is fine. A post with a real name, phone and photo is not. The form has no fields for them, and the text is scanned for phones, emails and links |
| Scam risk | **High.** The ideal deposit-scam victim is someone who can't view the flat. Mitigations below |
| Moderation | **Pre-moderation** of every post. Estimate 5–20 posts a week at first, 1–2 minutes each **[assessment]** |
| Mission fit | Strong. These are tomorrow's users in Berlin or Toronto |
| **Recommendation** | **Yes, later (phase 2).** Conditions: lawyer OK; message-only accounts live and stable for about 8 weeks; the rules below |

**Rules for wanted posts:**
- One active post per Iran account.
- Categories: room or flat, job search, language course or school, «کمک در روزهای اول» (arrival help: practical questions, no services sold).
- City must be in an open country. Move date within 12 months.
- **The post auto-expires after 30 days** and can be renewed once.
- **Visible only to signed-in, phone-verified users abroad.** No search-engine indexing, no public page. This keeps out casual scrapers and gives the poster some privacy.
- **Only phone-verified accounts older than 14 days can reply.** The round 8 Iran-chat rules apply: no links, IBANs, cards or payment requests in either direction; at most 2 messages before a reply.
- **A system banner on every reply thread:** «پیش از دیدن خانه (حضوری یا تماس تصویری با صاحبخانهٔ واقعی) و امضای قرارداد، هیچ پولی نفرستید. ودیعه (Kaution) معمولاً پس از امضای قرارداد پرداخت می‌شود.» ([Berliner Mieterverein](https://www.berliner-mieterverein.de/magazin/online/mm0918/neue-betrugsmasche-wohnungszusage-bei-sofortiger-kautionszahlung-091809b.htm), [LMU warning](https://cms-cdn.lmu.de/media/lmu/downloads/international/studium/beware-of-fraud_house-hunting-d-e.pdf))
- **Replier pattern checks:**
  - the same reply text to 3 or more wanted posts → hold;
  - a replier reported twice → pause;
  - any replier mentioning "landlord abroad", "keys by post" or "Airbnb/agent deposit" → flag.

### (f) Free online events run from abroad that people in Iran can join

Examples: a poetry night from Berlin, a German-for-newcomers webinar, a Q&A on Anerkennung. Peydoo's online layer already exists. The new part is a badge «از ایران هم رایگان قابل شرکت» and letting Iran accounts see the join link.

| Aspect | Position |
|---|---|
| EU | Free, no money. No issue |
| US providers | Video conferencing and e-learning platforms are in 560.540(a)(1). **But** GL G (educational services) and 560.554 (conferences) are suspended. A **US-person** organiser (an Iranian-American in Germany) teaching people in Iran may now lack cover. 560.540 authorises the *platform*, not obviously the teaching **[assessment]**. Live content is not "fully created", so the informational-materials exemption doesn't clearly help ([560.210(c)(2)](https://www.law.cornell.edu/cfr/text/31/560.210)). Peydoo itself only lists |
| Stripe | Only for free events. A paid online event can't carry the badge, and Iran accounts can't buy tickets |
| Iran | **Content decides.** A poetry night or a language class is low risk. A talk with anyone on the hostile list (BBC Persian or Iran International presenters, opposition figures) is "cultural cooperation" and can be prosecuted ([Radio Zamaneh](https://en.radiozamaneh.com/38237/)). So: **no badge for political, religious-mission or LGBTQ events**. Those stay in scope for the diaspora, just not marketed to Iran |
| Safety | Attendees may show their name and face to the other participants. The organiser must agree to "no attendee list, no recording of participants, camera optional" |
| Practical | Zoom blocks Iran by IP ([Columbia IT](https://it.cuimc.columbia.edu/news/duo-and-zoom-blocked-ofac-countries)). Google Meet's status in 2026 is unknown. YouTube is filtered. Real reach is small **[assessment]** |
| Scam risk | Low (free) |
| Moderation | Low. The organiser ticks a box, and the owner checks the topic once |
| Mission fit | Good. It strengthens diaspora organisers and the future-emigrant funnel |
| **Recommendation** | **Yes, later (phase 2).** Conditions: free only; organiser abroad; non-political topic; organiser confirms the safety rules; the badge text says the platform may not open from Iran (never suggest how) |

### (h, new) Saved-search email alerts for the destination city

Round 8 left alerts off at launch to send fewer emails into Iran.

- **Legal:** email is the core of 560.540, the same as sign-in codes.
- **Safety:** neutral subject lines («آگهی تازه در جست‌وجوی شما»), no listing text in the email, at most one a day.
- **Scam risk:** none added.
- **Recommendation: yes, later (phase 2)**, alongside wanted posts.

### (g2) User Q&A about emigration

Iran accounts would ask questions such as "How do I find a WG in Leipzig?" and diaspora users answer.

- **Legal:** the same as wanted posts (social networking).
- **Safety:** public questions can reveal circumstances, so use nicknames and pre-moderate.
- **Scam risk:** high from fake consultants ("guaranteed visa", "apply"). Ban self-promotion in answers. Answers only from accounts abroad.
- **Moderation:** the heaviest of all options, because content is open-ended.
- **Recommendation: later (phase 3),** and only if the owner has time.

### (d) The «سفر به ایران / برای مسافران نوروز» guide in its "visit" form

- **Legal:** fine (information).
- **Safety:** the AA warns against travel and asks Germans to leave. Dual nationals face arbitrary arrest and exit bans. Even likes on social media can be treated as espionage ([AA](https://www.auswaertiges-amt.de/de/reiseundsicherheit/iransicherheit-202396)). A Peydoo guide that makes travel look normal during a war would be irresponsible, and bad for trust **[assessment]**.
- **Recommendation:**
  - **No, for now.** Put a short «پیش از سفر به ایران» box inside the «کارهای ایران از خارج» guide: link to the AA, the dual-national risks, and "clean your phone and accounts of anything you would not want read".
  - Reconsider the full Nowruz guide when the AA drops the request to leave.
  - Never list services operating inside Iran (see d′).

### (c) Remote jobs at diaspora businesses for people working from Iran

| Aspect | Position |
|---|---|
| EU | Not banned. Salary transfers below €10k are unrestricted from non-Iranian banks, but in practice they need Iranian banks (restricted) or havaleh (unlicensed in Germany, ZAG) |
| US | A **US-person** employer (common in the diaspora) "dealing in" services of Iranian origin breaks 560.206. OFAC fined a US individual $1.43M in Sep 2026 for consulting for an Iranian software company and related dealings ([OFAC, 10 Sep 2026](https://ofac.treasury.gov/recent-actions/20260910)) |
| Stripe | A paid ad for "work from Iran" is Stripe used for "services originating from" Iran |
| Iran | Work for US or Israeli companies is dangerous under the espionage law. Media, translation of news or data work is dangerous too |
| Scam risk | High: task scams, "pay for equipment or training" |
| Mission fit | Weak. It is about the diaspora employing Iran, not about life abroad |
| **Recommendation** | **No dedicated category or "for Iran" tag.** Iran accounts may still message ordinary job ads (round 8), and employers decide. Use (c′) instead |

### (e) Free non-commercial listings inside Iran (giveaways, lost and found)

- **Legal:** personal posts are probably "social networking" (560.540).
- **Practical:** in Iran these happen on Divar, Sheypoor and neighbourhood groups. Peydoo is filtered, hard to reach, and has no audience in Iran.
- **Safety and scam risk:** meeting strangers in Iran, organised from a foreign site. "Free" bait is a common scam.
- **Moderation:** a second market in another country, in another legal system.
- **Mission:** off-mission. It turns Peydoo into an Iran-facing site, which feeds the hostile-list risk.
- **Recommendation: no.**

### (b) Online classes and services by teachers and freelancers in Iran, sold to the diaspora

| Aspect | Position |
|---|---|
| EU | Buying services from an individual in Iran is not banned as such. Payment below €10k is unrestricted on paper, but really runs through havaleh, cards held by relatives, or crypto. A platform built around that invites Art. 41 (circumvention) and ZAG questions |
| US providers | The teacher in Iran is a commercial actor located in Iran. Their listing is hosting for them (560.540(b)(3)), with the benefit received in Iran (560.410). The E.O. 13902 **technology sector** determination (24 Aug 2026) makes Iranian tech freelancers a designation risk for anyone, anywhere |
| Stripe | "Products or services originating from" Iran, directly or indirectly: **prohibited** |
| Diaspora buyers | US persons among them (US citizens or green-card holders in Germany) would breach 560.201/206 by buying Iranian services |
| Iran | Companies are banned from advertising on foreign platforms. Individuals are a grey area. Receiving foreign currency invites questions |
| Precedent | italki stopped serving Iran in 2022 and had blocked payouts to Iranian tutors since 2018 ([NIAC](https://niacouncil.org/niac-calls-on-italki-to-restore-services-to-iranian-nationals/)). Upwork excludes Iran ([Upwork SEC letter](https://investors.upwork.com/node/8666/html)) |
| Scam risk | Prepayment for lessons that never happen, with no recourse |
| **Recommendation** | **No.** This is the clearest "no" after events |

---

## 3. Proposed mode «ایران: نیمه‌فعال» (Iran: partial)

### 3.1 Principles

1. **Nothing located in Iran.** No listing, event or business page has an Iranian location, and no listing offers services inside Iran.
2. **Nothing sold from Iran.** No Iranian seller, teacher, freelancer or organiser.
3. **No money, ever.** No Stripe, bumps, Pro or deposits for Iran accounts. Payment details are blocked in every Iran conversation (round 8).
4. **Everything points abroad.** Every Iran feature helps someone deal with life *outside* Iran: reading, asking, moving.
5. **Keep less data, and keep Peydoo non-political towards Iran.** No Iran-facing political or religious-mission marketing. This lowers the hostile-list risk.
6. **One switch.** An admin setting `iran_mode = read_only | message_only | partial`, with every Iran feature behind it. Today's model is `message_only`.

### 3.2 What each person can do

| Feature | Visitor from Iran (signed out) | Iran account, phase 1 (now) | Iran account, phase 2 (after the lawyer and about 8 stable weeks) | Never |
|---|---|---|---|---|
| Read listings, events, business pages, guides | Yes | Yes | Yes | |
| Report (DSA Art. 16) | Yes | Yes | Yes | |
| Email sign-up (no phone, +98 refused, `.ir` refused) | Yes | — | — | |
| Message advertisers abroad (round 8 limits, «از ایران» label, no goods categories) | — | Yes | Yes | |
| Favorites | — | Yes | Yes | |
| «کارهای ایران از خارج» and city guides | Yes | Yes | Yes | |
| Jobs filter «امکان مهاجرت / حمایت از ویزا» | Yes | Yes (message) | Yes | |
| Saved-search email alerts (destination city) | — | No | **Yes** | |
| "Wanted" post (housing, job, course, arrival help; 1 active; 30 days; pre-moderated) | — | No | **Yes** | |
| See join links of online events with the «از ایران هم رایگان قابل شرکت» badge | Title only | Title only | **Yes** | |
| Q&A questions | — | No | No (phase 3, maybe) | |
| Post a listing, sell, offer a service or class | — | | | **Never** |
| Post an event, or any event located in Iran (for anyone) | — | | | **Never** |
| Business page, business invite | — | | | **Never** |
| Pay, bump, Pro, Checkout | — | | | **Never** |
| Phone reveal, attachments | — | | | **Never** (round 8) |

**For everyone, including diaspora accounts:**
- the event location must be in an open country or "online";
- listings offering services inside Iran (property, inheritance, parcels, SIM cards, money transfer) are banned;
- jobs may not be targeted "for people in Iran".

### 3.3 Kill-switch triggers (back to `message_only` or `read_only`)

| Trigger | Action |
|---|---|
| OFAC suspends or narrows 560.540 or FAQ 1088 | `read_only` at once. Ask the lawyer about wind-down. Email the Iran accounts a neutral notice |
| The EU adds restrictions on services or communications | Lawyer review. `message_only` meanwhile |
| Peydoo appears on Iran's "hostile" list | Turn off new Iran sign-ups. Show existing Iran accounts a neutral safety notice offering account deletion. Keep reading open **[assessment]** |
| A query from Stripe or Cloudflare about Iran | `message_only`. Answer with the one-paragraph summary (round 5) |
| Wanted-post scam reports above about 2 a month, or the owner overloaded | Pause wanted posts |

**Watch, monthly:** OFAC recent actions, the AA page, and OONI measurements for peydoo.com.

### 3.4 Moderation load for one owner [assessment]

- **Phase 1:** about 1 hour a week. Iran chats are mostly self-policing through the blocks. Guides need about 1 day each to write.
- **Phase 2:** another 1–2 hours a week: wanted-post pre-moderation (5–20 a week), badge checks for online events, pattern holds.
- **Phase 3 (Q&A):** open-ended. Only with help.

### 3.5 Wording rules and Persian copy

**Rules (unchanged from rounds 5 and 8, plus new ones):**
- Never mention VPNs, filtering workarounds, virtual numbers, relatives who could pay, crypto or "how to reach" anything. Exodus (Dec 2025, $3.1M) was egregious exactly because staff suggested VPNs ([OFAC](https://ofac.treasury.gov/media/934831/download)).
- The reason for any limit is always: **«به خاطر قوانین تحریم و شرایط شرکت‌هایی که پیدو با آن‌ها کار می‌کند»**. Optionally add «و برای امنیت شما».
- Never name the US, Israel, the Iranian government, the war or politics in Iran-facing copy. Neutral, practical tone.
- Never say a platform "works from Iran". Say «ممکن است از ایران در دسترس نباشد».

**Banner for IR visitors (phase 1; replaces round 8):**
> از ایران به پیدو سر زده‌اید. دیدن آگهی‌ها و راهنماها آزاد است و می‌توانید با ایمیل ثبت‌نام کنید و به آگهی‌دهندگانِ بیرون از ایران پیام بدهید. [بیشتر بدانید]

**Phase 2 banner:**
> از ایران به پیدو سر زده‌اید. می‌توانید آگهی‌ها را ببینید، به آگهی‌دهندگان پیام بدهید و اگر در حال مهاجرت هستید، بنویسید دنبال چه هستید (خانه، کار، کلاس). [بیشتر بدانید]

**«بیشتر بدانید» page:**
> **پیدو از ایران چه کارهایی می‌کند؟**
>
> پیدو بازاری برای ایرانی‌هایی است که بیرون از ایران زندگی می‌کنند یا به‌زودی مهاجرت می‌کنند.
>
> **از ایران می‌توانید:** آگهی‌ها و رویدادها را ببینید، راهنماهای «کارهای ایران از خارج» و «شروع زندگی در شهر تازه» را بخوانید، با ایمیل ثبت‌نام کنید و به آگهی‌دهندگانِ بیرون از ایران پیام بدهید.
>
> **از ایران نمی‌توانید:** آگهی فروش یا خدمات بگذارید، رویداد ثبت کنید، صفحهٔ کسب‌وکار بسازید یا پرداخت کنید. این محدودیت‌ها به خاطر قوانین تحریم و شرایط شرکت‌هایی است که پیدو با آن‌ها کار می‌کند. این تصمیم دربارهٔ شما نیست.
>
> **امنیت:** نام واقعی لازم نیست. عکس، مدرک یا اطلاعات شخصی نفرستید. پیدو به درخواست نهادهای ایرانی دربارهٔ کاربرانش پاسخ نمی‌دهد.

**Event form, location in Iran (for anyone):**
> رویدادهای داخل ایران را نمی‌توانیم منتشر کنیم. پیدو فقط رویدادهای کشورهایی را که در آن‌ها فعال است و رویدادهای آنلاین را نشان می‌دهد. این محدودیت به خاطر قوانین تحریم و شرایط شرکت‌هایی است که پیدو با آن‌ها کار می‌کند، و برای امنیت برگزارکنندگان و شرکت‌کنندگان.

**Listing offers a service inside Iran (moderation notice):**
> آگهی خدماتی که در داخل ایران انجام می‌شود (مثل امور ملک، ارث، ارسال بسته یا هدیه به ایران، سیم‌کارت یا انتقال پول) در پیدو مجاز نیست. دلیلش قوانین تحریم و شرایط شرکت‌هایی است که پیدو با آن‌ها کار می‌کند.

**Wanted-post form (phase 2):**
> **دنبال چه هستید؟** این آگهی فقط برای پیدا کردن خانه، کار یا کلاس در شهری است که به آن مهاجرت می‌کنید.
> - نام کامل، شمارهٔ تلفن، ایمیل، عکس و دلیل مهاجرتتان را ننویسید.
> - این آگهی فقط به کاربران تأییدشدهٔ پیدو نشان داده می‌شود و پس از ۳۰ روز خودبه‌خود حذف می‌شود.
> - پیش از دیدن خانه و امضای قرارداد هیچ پولی نفرستید. پیدو از طرف هیچ‌کس پولی دریافت یا جابه‌جا نمی‌کند.

**Online event badge (phase 2), shown to Iran accounts with the link:**
> این رویداد رایگان است و برگزارکننده گفته از ایران هم می‌شود در آن شرکت کرد. سرویس جلسهٔ آنلاین ممکن است از ایران در دسترس نباشد. با نام کوچک یا نام مستعار وارد شوید؛ روشن کردن دوربین لازم نیست.

**Relocation-jobs filter (help text):**
> شغل‌هایی در کشورهای فعال پیدو که کارفرما گفته از متقاضیانِ خارج از کشور هم می‌پذیرد یا برای ویزا کمک می‌کند. کارفرمای واقعی هرگز برای استخدام، ویزا یا آموزش از شما پول نمی‌خواهد.

**«پیش از سفر به ایران» box in the guide:**
> وزارت خارجهٔ آلمان سفر به ایران را توصیه نمی‌کند. اگر تابعیت دوگانه دارید، خطر بازداشت و ممنوع‌الخروجی برایتان بیشتر است. پیش از هر تصمیم، [هشدار سفر وزارت خارجهٔ آلمان] را بخوانید.

(This names the AA's advice as a fact and links to it. It doesn't name the war or the government.)

---

## 4. New questions for the sanctions lawyer

1. **Events in Iran.** Would listing an event located in Iran, free or ticketed, by (a) an organiser in Iran or (b) a diaspora organiser abroad, breach any of the following?
   - Reg. 267/2012 (economic resources to listed persons), the IRGC terror listing, or § 18/19 AWG, given that we can't screen organisers in Iran.
   - US rules for our providers: "benefit … received in Iran" (560.410), outside 560.540(b)(3) "commercial entities located in Iran".

   Does a plain-text listing with no ticketing change the answer? (We plan to refuse all of these. We need to know whether the refusal is required or prudent.)
2. **Wanted posts.** Is a free, non-commercial post by an individual in Iran ("looking for a room in Berlin from September") within 560.540(a)(1) (social networking or blogging) for Cloudflare and AWS? Is it clearly outside (b)(3)? Any EU concern? What would change if the post had the poster's real name?
3. **Operation Economic Outcast.**
   - If OFAC stays or narrows 560.540, what wind-down applies to message-only accounts?
   - Does the suspension of GL G and 560.554 affect our providers when an Iranian resident reads pages about online courses or attends a free online class listed on Peydoo?
   - Does it affect US-person organisers who teach people in Iran?
4. **Relocation jobs.** May a German employer pay us via Stripe for a job ad flagged "visa sponsorship", knowing applicants may be in Iran? Is that "dealings … indirectly" with "persons located in" Iran under Stripe's terms?
5. **Services inside Iran.** Are we required, or only well advised, to ban diaspora listings for services carried out in Iran (property management, inheritance, gifts and parcels, SIM cards)? Does the ban hold up under the DSA (Art. 14, 17) and the AGG?
6. **Iran's hostile list.** If Peydoo were listed, would we have a duty, or a lawful basis under GDPR, to warn or switch off Iran accounts? Can a safety notice to them be sent under Art. 6(1)(d) (vital interests) or (f)?
7. **The IRGC terror listing and individuals.** Conscripts serve in the IRGC ([ASL19](https://asl19.org/en/blog/2026-02-09-irgc-terror-designation-implications-for-mandatory-servicemen)). Does a free message-only account held by an IRGC member count as making "economic resources" available to the listed organisation? Must we act if a user tells us they serve?
8. **Diaspora events abroad featuring performers living in Iran** (e.g. a concert in Berlin by a singer from Tehran). Does listing such an event raise "benefit received in Iran" for our US providers, now that 560.554 is suspended? May the organiser buy a bump for it via Stripe?
9. **Records and switch.** Is a documented `iran_mode` switch with a monthly review, plus these triggers, a sufficient due-care record under § 19 AWG?

Round 5 questions 1–8 and round 8 questions 1–9 still stand. Round 8 Q2 should now quote "commercial entities" rather than "commercial endeavours".

---

## Sources

**US law**
- 31 CFR [560.540](https://www.law.cornell.edu/cfr/text/31/560.540), [560.410](https://www.law.cornell.edu/cfr/text/31/560.410), [560.210](https://www.law.cornell.edu/cfr/text/31/560.210), [560.206](https://www.law.cornell.edu/cfr/text/31/560.206) (texts as of 1 Oct 2026 from the eCFR); [eCFR part 560](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-V/part-560)
- Federal Register:
  - [91 FR 54957 (24/26 Aug 2026)](https://www.govinfo.gov/content/pkg/FR-2026-08-26/html/2026-17426.htm)
  - [91 FR 57511 (8/10 Sep 2026)](https://www.govinfo.gov/content/pkg/FR-2026-09-10/html/2026-18461.htm)
  - [91 FR 61759 (30 Sep 2026)](https://www.govinfo.gov/content/pkg/FR-2026-09-30/html/2026-19978.htm)
- OFAC:
  - [Iran sanctions page](https://ofac.treasury.gov/sanctions-programs-and-country-information/iran-sanctions)
  - [FAQ 1110](https://ofac.treasury.gov/faqs/1110), [FAQs of 16 May 2024](https://ofac.treasury.gov/faqs/updated/2024-05-16)
  - [Recent actions, 10 Sep 2026](https://ofac.treasury.gov/recent-actions/20260910)
  - [Exodus settlement](https://ofac.treasury.gov/media/934831/download)
  - [GL D-1 text](https://www.dwt.com/files/Uploads/Documents/OFAC%20Iran%20General%20License%20D-1%202-7-14.pdf)
- Commentary:
  - [Paul Weiss on Operation Economic Outcast](https://www.paulweiss.com/insights/client-memos/treasury-launches-operation-economic-outcast-expanding-the-reach-of-us-iran-sanctions)
  - [Baker McKenzie](https://sanctionsnews.bakermckenzie.com/us-department-of-the-treasury-strengthens-iran-sanctions-as-part-of-operation-economic-outcast/)
  - [Squire Patton Boggs on the licensing policy](https://www.squirepattonboggs.com/insights/publications/ofac-s-new-policy-for-iran-related-licenses/)
  - [Global Trade Alert](https://globaltradealert.org/state-act/100464-united-states-of-america-introduction-of-a-presumed-denial-licensing-policy-for-iran-related-transactions)
  - [Sanctions Law Center](https://sanctionslawcenter.com/en/sanctions-programs/iran/)

**Provider terms**
- [Cloudflare Self-Serve Subscription Agreement](https://www.cloudflare.com/terms/)
- [Cloudflare blog on sanctions](https://blog.cloudflare.com/the-challenges-of-sanctioning-the-internet)
- [giga.law on Cloudflare's 2019 disclosure](https://giga.law/daily-news/2019/9/11/cloudflare-says-it-may-have-violated-us-economic-trade-sanctions)
- [AWS Customer Agreement](https://aws.amazon.com/agreement/)
- [Stripe restricted businesses](https://stripe.com/legal/restricted-businesses)
- [Sentry terms](https://sentry.io/terms/)

**EU**
- [Mayer Brown on the snapback](https://www.mayerbrown.com/en/insights/publications/2025/10/eu-reintroduces-sanctions-against-iran-following-un-snapback)
- IRGC listing: [Eunews](https://www.eunews.it/en/2026/02/19/iran-revolutionary-guards-officially-added-to-eu-terrorist-list), [Estonian MFA](https://vm.ee/en/news/eu-lists-islamic-revolutionary-guard-corps-terrorist-organisation), [ASL19](https://asl19.org/en/blog/2026-02-09-irgc-terror-designation-implications-for-mandatory-servicemen)

**Iran**
- [Supreme Council of Cyberspace resolution via Entekhab](https://www.entekhab.ir/fa/news/765705/)
- Hostile list: [Radio Zamaneh](https://en.radiozamaneh.com/38237/), [Article 18](https://articleeighteen.com/?p=24568)
- Information bill: [Neos Kosmos](https://neoskosmos.com/en/2026/08/17/news/world/iran-advances-bill-to-curb-hostile-media-interactions/)
- Crackdown: [Amnesty, May 2026](https://www.amnesty.org/en/latest/news/2026/05/iran-mass-arbitrary-arrests-and-political-executions-mark-intensifying-repression/), [Amnesty urgent action](https://dpabolition.substack.com/p/urgent-action-iran-risk-of-imminent)
- Hijab: [Iran International](https://www.iranintl.com/en/202608207335), [Aos Fatos](https://www.aosfatos.org/noticias/nao-e-verdade-que-autoridades-iranianas-suspenderam-o-uso-obrigatorio-do-hijab/)
- Music and permits: [CHRI 2019](https://iranhumanrights.org/2019/01/musician-ali-ghamsari-banned-from-performing-in-iran-after-refusing-to-remove-female-singer/), [CHRI 2018](https://iranhumanrights.org/2018/01/iranian-female-vocalist-we-never-get-a-chance-to-practice-our-art-in-a-professional-setting/), [Wikipedia](https://en.wikipedia.org/wiki/Iranian_women_and_Persian_music), [Iran International 2024](https://www.iranintl.com/en/202403055851), [1News/AP](https://www.1news.co.nz/2026/05/23/live-music-returns-to-tehran-amidst-fragile-ceasefire/)
- Owj: [Wikipedia](https://en.wikipedia.org/wiki/Owj_Arts_and_Media_Organization)
- Internet: [RFE/RL](https://www.rferl.org/a/iran-internet-shutdown-censorship/33654841.html), [ACLED](https://acleddata.com/expert-comment/has-iran-really-restored-internet-access), [Al Jazeera](https://www.aljazeera.com/news/2026/5/31/iran-reinstates-some-internet-access-but-restrictions-remain-for-most), [The National](https://www.thenationalnews.com/future/technology/2026/04/28/iran-internet-pro-update-blackout/)
- War: [Wikipedia: 2026 Iran war](https://en.wikipedia.org/wiki/2026_Iran_war)
- Flights: [GNA](https://gna.org.gh/2026/04/international-flights-resume-in-tehran-for-first-time-since-war/), [Bluewin](https://www.bluewin.ch/en/news/international/first-foreign-flights-take-off-from-tehran-again-3205131.html)
- Platforms: [Evand](https://evand.com/), [Iticket](https://iticket.ir/), [Hamshahri on Fajr ticketing](https://www.hamshahrionline.ir/news/643213/)
- Diaspora numbers: [Aftab / Bikdeli](https://aftabnews.ir/fa/news/897960/), [Erasmus thesis](https://thesis.eur.nl/pub/56211/)

**Germany**
- [Auswärtiges Amt travel and safety advice for Iran](https://www.auswaertiges-amt.de/de/reiseundsicherheit/iransicherheit-202396)
- Rental scams: [Berliner Mieterverein](https://www.berliner-mieterverein.de/magazin/online/mm0918/neue-betrugsmasche-wohnungszusage-bei-sofortiger-kautionszahlung-091809b.htm), [LMU warning](https://cms-cdn.lmu.de/media/lmu/downloads/international/studium/beware-of-fraud_house-hunting-d-e.pdf)

**Platforms and precedents**
- [Upwork SEC letter](https://investors.upwork.com/node/8666/html)
- [NIAC on italki](https://niacouncil.org/niac-calls-on-italki-to-restore-services-to-iranian-nationals/)
- [Columbia IT on Zoom blocking OFAC countries](https://it.cuimc.columbia.edu/news/duo-and-zoom-blocked-ofac-countries)
