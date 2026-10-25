# Iran: read-only, no registration (research 5)

Oct 25, 2026 · for the owner's decision: *"Iran read-only with no registration. All Iranian numbers blocked. Even with a VPN they cannot sign up or add a listing."*

> **Not legal advice.** This summarises public sources to brief a sanctions lawyer. Claims marked **[1 source]** were found in one source only. **[code]** means checked in this repository.

## Short answer

- **The decision can be built, but only partly enforced.** The IP check (Cloudflare `CF-IPCountry = IR`) catches visitors without a VPN. The **+98 refusal is the control that actually holds**, because Telegram's shared contact is the account's real number, and a VPN doesn't change that. **Nothing stops someone in Iran with a foreign or virtual number and a VPN.** The goal is good-faith compliance (use every signal we can get cheaply, act on it, keep records), not making it impossible.
- **Keep reporting open to Iranian visitors.** DSA Art. 16 requires a notice mechanism for "any individual or entity". The report form already works without signing in **[code]**.
- **Legally, a free read-only site reachable from Iran looks low-risk** for a German operator. EU Iran sanctions work by lists, sectors and transfers, not by banning service to Iranians. On the US side, Cloudflare serving web pages to Iranian browsers is the kind of "web browsing" GL D-2 authorises for US persons. A lawyer must confirm both.
- **Safety:** hiding things only from IR IP addresses protects almost no one, because Iranian authorities can browse from anywhere. Put the protections on the site itself: sensitive event details only for signed-in, verified users, no faces of other people without consent, nicknames rather than full names, and no tracking.

---

## 1. Technical: making it real

### 1.1 Read-only for IR visitors (CF-IPCountry = IR)

`CF-IPCountry` is sent on every Cloudflare plan. Trust it only when the request came through Cloudflare, by the same rule `clientIp()` already uses **[code]**. The origin lock makes that safe.

| Action | IR visitor | Why |
|---|---|---|
| Browse, search, listing and event pages, maps, "add to calendar" (.ics) | **Allowed** | Read-only information |
| Sign-in / sign-up (`/login`, email code) | **Blocked**: no code is sent. `/login` shows the notice (§4) | "No registration". No SES mail to new IR addresses |
| Phone verification (`/account/phone`, SMS, Telegram start link) | **Blocked** | Also covered by the +98 rule |
| Post a listing, event or business (`/new`, `/events/new`, `/business/new`) | **Blocked** (they need a session anyway) | Core of the decision |
| Chat send, phone reveal | **Blocked** | Both already need a verified phone **[code]**. Add the IP check |
| Favorites, saved searches and alerts | **Blocked** (account-based) | No accounts |
| Waitlist "خبرم کن" (email + city) | **Blocked** | Collecting emails from Iran is account-like, and it's the start of a mailing relationship |
| Pro, bumps, Stripe Checkout, customer portal | **Blocked** before a Checkout Session is created | Stripe forbids persons located in Iran ([Stripe](https://stripe.com/legal/restricted-businesses)) |
| Business invites (`/business/invite/[token]`) | **Blocked** | It creates a membership |
| **Report a listing, event or user** (`/report`) | **Allowed** (signed out: name, email, Turnstile, as today **[code]**) | DSA Art. 16(1): "mechanisms … to allow **any individual or entity** to notify" ([DSA Art. 16](https://www.eu-digital-services-act.com/Digital_Services_Act_Article_16.html)). There's no territorial limit. Art. 16(2)(c) asks for name and email, and the decision has to be sent back to the reporter, which is one-off email, not an account |
| Contact page / Impressum email | Allowed | Legal notice duty. The email link is passive |
| Sentry browser reports | **Drop IR events in the tunnel** (`/api/monitoring`) | Cheap hygiene. Sentry already sees only our server's IP **[code]**, but its terms forbid use "in violation of any U.S. export embargo" ([Sentry terms §19.11](https://sentry.io/terms/)) |

**How to build it (three layers, cheapest first):**
1. **App, the real enforcement.** One `isIranRequest(headers)` helper. `canPostListing`, `canSendMessage`, `canFavorite` and the login, phone, checkout, waitlist and invite actions all refuse with a new reason, `region_read_only`. The rule is "every write except `/report`", checked server-side. The UI is only a convenience on top. Tests are required, since this is a permissions change (CLAUDE.md).
2. **Cache.** Logged-out browse pages are cached at the edge and must be identical for everyone **[code]** (`docs/setup.md`, "Caching"). An IR banner on them would leak to all visitors, or the IR visitor would get the normal copy. Options: (a) add `and ip.src.country ne "IR"` to the Cache Rule, and have the proxy send `private, no-store` for IR requests (check that Cache Rules accept that field on Free); or (b) leave the cache alone and show the banner from a tiny uncached `GET /api/region`. `/login` and every form are already uncached, so the notice can be rendered on the server there.
3. **Cloudflare WAF, belt and braces.** One custom rule on Free (5 allowed): `ip.src.country eq "IR" and http.request.method eq "POST" and not starts_with(http.request.uri.path, "/report") and not starts_with(http.request.uri.path, "/api/monitoring")` → Block. Next.js server actions are POSTs, so this stops writes even if the app has a bug. On Free the block page is Cloudflare's default, because a custom response body needs Pro ([Cloudflare docs](https://developers.cloudflare.com/waf/custom-rules/create-dashboard/)). That's acceptable, since the app shows the Persian notice before anyone can submit. The Stripe webhook and Telegram long polling are not affected.

**Caveat on the old plan.** Round 4 proposed a static **451** page for Iran. The new decision replaces it with a full read-only site (HTTP 200 plus a banner). Update `docs/design-options.md` and the strategy line "geoblock Iran".

### 1.2 Blocking +98 numbers

- **SMS:** already refused. `IR` is not among the 36 seeded countries, so `SMS_COUNTRIES` excludes it **[code]**.
- **Telegram:** the bot accepts any number today **[code]** (`docs/setup.md`). Add a check after `contact.user_id === from.id`: normalise `contact.phone_number` (Telegram may send it without `+`), and if the country is `IR` (`+98`), fail the row with a new reason `country_not_allowed`, write `audit_log`, and answer in Persian (§4). **Also refuse non-geographic and anonymous numbers.** Telegram sells SIM-less **+888** numbers on Fragment ([TechCrunch](https://techcrunch.com/2022/12/07/telegram-is-auctioning-phone-numbers-to-let-users-sign-up-to-the-service-without-any-sim)). The simplest rule: accept only numbers whose country is one of the 36 seeded countries. That is the same rule as SMS, and it also covers the other sanctioned codes.
- **Why it holds:** Telegram's `request_contact` returns the phone number the Telegram account is registered with. A VPN changes the IP address, not the number.
- **Existing data:** at release, find users whose verified number starts with +98, remove the verification, and email them a notice. Write a statement of reasons, because DSA Art. 17 applies to account restrictions that rest on the terms.
- **Side effect on the diaspora (assumption, no source found):** many Iranians abroad keep Telegram on the +98 number they registered in Iran, and keep the Iranian SIM for banking codes. They would be refused on Telegram and must verify by SMS with their local number. **SMS is not live yet** (`SMS_PROVIDER=log`, no provider bought) **[code]**. So the +98 block and a live SMS provider (seven.io) must ship together, or diaspora users with +98 Telegram accounts cannot post at all.

### 1.3 Virtual numbers and other signals

**Virtual numbers are a normal product in Iran.** Mainstream Iranian tech media publish guides to buying foreign virtual numbers for Telegram and WhatsApp, and resellers sell them for rials ([Digiato](https://digiato.com/article/2023/02/26/virtual-number), [Jame Jam](https://jamejamonline.ir/fa/news/1543729/شماره-مجازی-رایگان-واقعیت-دارد-راه‌های-امن-خرید-شماره-مجازی), [Mehr](https://www.mehrnews.com/news/5442949/بهترین-راه-ساخت-شماره-مجازی-در-سال-۱۴۰۱), [Zoomit ad](https://www.zoomit.ir/pr/411134-number4)). **No figures on how common this is were found.** A Telegram account opened with a US or UK virtual number passes the +98 check.

| Signal | Available? | Cost | Use |
|---|---|---|---|
| IP country at sign-in, phone start and publish (`CF-IPCountry`) | Yes, all plans | Free | Hard block for IR |
| `T1` (Tor) country code | Yes | Free | Don't block browsing. Refuse sign-in from Tor, or send it to review |
| Browser time zone `Asia/Tehran` (`Intl…resolvedOptions().timeZone`, a hidden field on the login and phone forms) | Yes, client-side | Free | **A VPN doesn't change it.** Strong cheap signal, though a careful user can spoof it. Store only a boolean |
| Email domain `.ir` (e.g. chmail.ir, Iran's "national email") | Yes | Free | Refuse at sign-in. Few people use one, but it costs nothing |
| `Accept-Language: fa-IR`, Telegram `language_code = fa` | Yes | Free | **Useless.** The diaspora sends the same values |
| Cloudflare VPN/anonymizer lists (`cf.anonymizer`, `cf.vpn`, `cf.open_proxies`) | **Enterprise only** ([Managed Lists](https://developers.cloudflare.com/waf/tools/lists/managed-lists)) | n/a | Not available to us |
| Cloudflare Bot Management fields (`cf.bot_management.*`) | **Enterprise only** ([docs](https://developers.cloudflare.com/ruleset-engine/rules-language/fields/reference/cf.bot_management.verified_bot/)) | n/a | Not available. They don't flag VPNs anyway |
| IPinfo privacy detection (VPN, proxy, Tor, relay, hosting) | API | Lite is free but country only. **Core $26/month** (150k requests) includes VPN/proxy detection. Max $163/month adds residential proxies ([IPinfo pricing](https://ipinfo.io/pricing)) | Check only at sign-in and phone verification, never on page views |
| proxycheck.io | API | Free 1,000 queries a day, same features as paid; from about $4/month ([pricing](https://proxycheck.io/pricing/)) | The same use, and enough for launch volumes. Check the DPA and location first |
| MaxMind Anonymous IP database | Download | Price on request ([MaxMind](https://www.maxmind.com/en/geoip-anonymous-ip-database)) | Later, if needed |
| Iranian IBAN (`IR` + 24 digits) or Shetab card numbers in listing or chat text | Yes, regex | Free | A moderation flag (it also catches havaleh). Iranian cards can't be used on Stripe at all |
| Listing location | Yes | Free | Already limited to the open countries |
| Self-declaration at sign-up ("I don't live in Iran", country of residence) and in the terms | Yes | Free | Good-faith record. A user who lies breaks the terms, and the account can be closed for it |

**VPN or hosting IP on its own is not a reason to block.** Many people in Germany use VPNs, and Iranian VPN exits are often in German or Dutch data centres. Use it only together with another Iran signal (see the rule table).

### 1.4 What can't be prevented, and what good faith looks like

**Say it plainly in the docs:** a person in Iran with a foreign or virtual number, a VPN, a non-Iranian time zone setting and a Gmail address looks exactly like a diaspora user. No method for a site of our size stops them.

**What regulators expect, from the US cases (they concern US persons and money, which is not our situation, but they set the standard of care):**
- **Use the IP data you already have, across the whole lifecycle, not only at onboarding.**
  - Kraken (2022, $362k): checked location only at onboarding and had no automated IP blocking ([OFAC release](https://ofac.treasury.gov/media/929541/download), [Orrick](https://infobytes.orrick.com/2022-12-02/ofac-settles-virtual-currency-exchange-resolve-ip-address-screening-deficiencies/)).
  - Poloniex (2023, $7.6M): monitored IPs from 2015 but blocked them only from 2017 ([OFAC release](https://ofac.treasury.gov/media/931701/download)).
  - Interactive Brokers (July 2025, $11.8M): an IP-geoblocking "technical bug", and customers who claimed non-sanctioned residence were shown by IP to be in Iran ([OFAC release](https://ofac.treasury.gov/media/934501/download), [Willkie](https://complianceconcourse.willkie.com/articles/u-s-broker-dealer-reaches-11-8-million-settlement-with-ofac-for-apparent-violations-of-u-s-sanctions/)).
  - ShapeShift (Sept 2025, $750k): "knew or should have known" from IP data ([DLA Piper](https://www.dlapiper.com/insights/publications/2026/02/ofac-sanctions-enforcement-in-fintech-and-crypto)) **[1 source]**.
- **Never tell users to use a VPN.** Exodus (Dec 2025, $3.1M): staff advised users in Iran to hide their location with VPNs, and OFAC treated those cases as egregious ([GRC Report](https://www.grcreport.com/post/ofac-fines-crypto-wallet-provider-exodus-3-1-million-over-iran-sanctions-violations), [OFAC release](https://ofac.treasury.gov/media/934831/download)). **Support answers and the notice must never mention VPNs as a way in.**
- OFAC's 2021 virtual-currency guidance says firms "should be able to use geolocation tools to identify and prevent IP addresses that originate in sanctioned jurisdictions from accessing" their services, and suggests analytics to catch VPN misattribution ([White & Case](https://www.whitecase.com/insight-alert/ofac-sanctions-compliance-guidance-virtual-currency-industry), [Davis Polk](https://www.davispolk.com/insights/client-update/ofac-publishes-sanctions-compliance-guidance-virtual-currency-industry)).
- **EU:** no EU guidance on IP geolocation for Iran was found. German criminal liability (§ 18 AWG) needs intent; negligence is an administrative offence (§ 19). A documented control set should count as due care, but a lawyer must confirm.
- **So the reasonable standard for Peydoo:**
  - IP block on every write.
  - +98 and non-seeded-number refusal.
  - Time zone and `.ir` email checks.
  - A residence statement in the terms and at sign-up.
  - VPN checks at sign-in only (proxycheck free tier).
  - Re-checks on later logins (§1.5).
  - An audit log of every refusal and restriction.
  - Never advising evasion.
  - A yearly review.

### 1.5 Accounts that later show Iran signals

A real case: diaspora users visit family in Iran, for example at Nowruz. EU law counts "any natural person **in**, or resident in, Iran" as an Iranian person ([Reg. 267/2012 Art. 1](https://www.legislation.gov.uk/eur/2012/267/article/1/adopted?view=plain)), and Stripe's terms also say "located in". The proposed rules:

1. **Any request from IR while signed in → that request is read-only.** Existing listings stay live. Posting, chat replies, favorites and checkout are refused, with the travel notice (§4). This needs no account change and is undone automatically.
2. **IR sign-in attempts:** no new sessions from IR. Existing sessions keep working read-only.
3. **Pattern, record in the audit log and send to review:** IR requests on **≥ 7 distinct days in 30 days**, or IR plus `Asia/Tehran`, or a VPN IP plus `Asia/Tehran`. Admin queue item "possible residence in Iran".
4. **Strong pattern → restrict, with a person in the loop:**
   - The trigger: IR on ≥ 21 of the last 30 days and no non-IR request in that time, or the user says they live in Iran.
   - The action: pause the listings, refuse posting and messaging (`user_sanctions`), and send a DSA Art. 17 statement of reasons with Art. 20 appeal.
   - Lifted when: the user signs in from abroad and confirms residence.
5. **Hard evidence → close the account:** a +98 number found later, an Iranian IBAN with havaleh, or Iran-bound goods. Use the existing moderation flow.
6. **Data:** keep only the country and the day per session (`sessions.ip_address` is already stored **[code]**), not new trackers. Name the purpose in the privacy policy (sanctions compliance, Art. 6(1)(c)/(f) GDPR). A person reviews every account restriction (Art. 22 GDPR).

---

## 2. Legal (questions for the lawyer, from public sources)

### 2.1 EU / Germany: Regulation 267/2012 after the snapback

- The EU measures came back on 29 Sep 2025 (Reg. 2025/1975, Impl. Regs. 2025/1980 and 2025/1982) ([Council](https://www.consilium.europa.eu/en/press/press-releases/2025/09/29/iran-sanctions-snapback-council-reimposes-restrictive-measures/), [Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2025/10/eu-reintroduces-sanctions-against-iran-following-un-snapback)). They are targeted: listed persons (asset freezes), goods and technology lists, sectors (oil, gas, petrochemicals, nuclear, finance), funds transfers (Art. 30/30a) and anti-circumvention (Art. 41). **There is no general ban on giving a free information service to people in Iran.** That is consistent with `docs/payments-iran.md`.
- **Where a read-only site could still touch the rules:**
  - **Listed persons.** A read-only page gives nobody "funds" or "economic resources" (defined as "assets … which may be used to obtain funds, goods or services"; [Art. 1](https://www.legislation.gov.uk/eur/2012/267/article/1/adopted?view=plain)). An account or a Pro entitlement might be, which is one more reason for "no accounts from Iran".
  - **Content.** Listings that offer listed goods for export to Iran, or Iran-bound parcel carrying, could be a breach under § 18 AWG. The existing ban terms cover this; the IR read-only mode does not.
- **Germany:** § 18 AWG (criminal, intent) and § 19 AWG (administrative, negligence) ([AWG](https://www.gesetze-im-internet.de/awg_2013/)); the Bundesbank handles the financial side ([Bundesbank](https://www.bundesbank.de/de/service/finanzsanktionen/sanktionsregimes/-/iran-610216)).
- **Assessment:** a free, no-account, read-only service reachable from Iran is **probably allowed**. The lawyer should confirm it, including Reg. 359/2011 (human rights) and the AWV.

### 2.2 US: GL D-2 and our US providers

- **GL D-2** (23 Sep 2022) authorises "the exportation or reexportation … from the United States or **by a U.S. person**, wherever located, to Iran of fee-based or no-cost services incident to the exchange of communications over the Internet, such as … **web browsing** … as well as cloud-based services in support of the foregoing" ([GL D-2 text](https://ofac.treasury.gov/media/928096/download)).
- **What it doesn't authorise:**
  - Services to the Government of Iran (except publicly available no-cost services) or to blocked persons.
  - Commercial-grade connectivity.
  - "Web-hosting services that are for websites of commercial endeavors **located in Iran**". Peydoo is not located in Iran, so this exclusion shouldn't apply. Confirm it.
- **Does it cover a non-US company?** GL D-2 is mainly a licence for **US persons and US exports**. A German company with no US person involved doesn't need it for its own conduct, because the primary US sanctions don't reach it. FAQ 341 extends parts of it to non-US persons re-exporting US-origin software and hardware ([Mondaq summary](https://www.mondaq.com/it-and-internet/1273766/ofac-releases-new-iran-internet-guidance)). **What GL D-2 does matter for is our US providers** (Cloudflare, AWS, Sentry, Stripe): they are US persons, and our setup must not make them break US law (IEEPA "causing" liability). Serving read-only web pages through Cloudflare is the core GL D-2 case. Also look at 31 CFR 560.210(c) (informational materials) and 560.508 (telecommunications).
- **Cloudflare:**
  - It openly works under GL D-2 for ordinary Iranians. Its Dec 2022 post welcomed GL D-2 for letting infrastructure companies serve people in Iran ([Cloudflare blog](https://blog.cloudflare.com/the-challenges-of-sanctioning-the-internet)), and it measures Iranian traffic on Radar. Its CEO said sanctions stop it from putting equipment *in* Iran ([CNN via KVIA](https://kvia.com/news/business-technology/cnn-technology/2023/01/19/cloudflare-says-white-house-asked-tech-firm-to-bypass-iran-censorship-but-us-sanctions-got-in-the-way/)).
  - **The terms (§7.1, updated 12 Sep 2025)** forbid SDN customers and "export or re-export [of] any information or technology to any country … to which such export … is restricted". They also make the customer "responsible for determining whether use of the Service will satisfy [its] compliance obligations" ([Cloudflare terms](https://www.cloudflare.com/terms/)).
  - **No clause bars visitors from Iran.** Verified: Cloudflare serves Iranian eyeballs (as far as its own blog shows), but **no written statement was found that says GL D-2 covers Cloudflare customers' sites**. That's question 4 for the lawyer, or a ticket to Cloudflare.
- **AWS (SES only):** §11.6 says "you are solely responsible for compliance related to … the provision of Your Content to End Users" ([AWS Customer Agreement](https://aws.amazon.com/agreement/), updated 14 Aug 2026). With no sign-up and `.ir` refused, SES sends nothing to new Iranian users. The only mail to someone in Iran would be the decision on a DSA report, which is email and squarely GL D-2.
- **Sentry:** §19.11, customer "not … located in … a country that is subject to a U.S. government embargo" and won't use the service "in violation of any U.S. export embargo" ([Sentry terms](https://sentry.io/terms/)). Our tunnel forwards scrubbed events from our own server **[code]**. Dropping IR-origin browser events removes the question.
- **Stripe:** it prohibits "persons located in, resident in, or a citizen of" Iran ([Stripe](https://stripe.com/legal/restricted-businesses)).
  - **Serving free pages isn't a Stripe transaction.** With checkout blocked for IR IPs and flagged accounts, no IR payer and nothing marketed "for Iran", the account risk should be low.
  - **What remains is Stripe's automated website review.** A Persian site that visibly targets Iran would raise questions. Keep the site visibly about life *abroad*, keep "Iran" out of descriptors and products (already planned), and have a one-paragraph answer ready: "read-only in Iran, no accounts, no payments, IP- and phone-based controls".
  - "Citizen of" read literally would cover diaspora buyers with Iranian citizenship. Stripe applies it through its own screening, not ours; ask the lawyer or Stripe.

## 3. Safety for people in Iran and posters abroad

**Context:**
- **Espionage law (Oct 2025).** Iran's law on espionage and cooperation with "hostile states" covers sending images or video to "hostile" foreign media or pages: reported as up to 5 years ([Adnkronos/IRNA](https://english.adnkronos.com/2025/10/01/iran-harsher-sentences-for-espionage-for-us-or-israel/)) or 2–5 years ([AsiaNews](https://www.asianews.it/news-en/Death-penalty-for-illegal-use-of-the-internet:-Tehran's-espionage-law-64137.html)). It has prison terms for unlicensed satellite internet, and death for espionage for Israel or the US. It is reported as signed and in force **[1 source]**.
- **VPN ban.** A Feb 2024 Supreme Council of Cyberspace resolution prohibits unlicensed VPN use. Sources disagree on whether it is criminal ([RFE/RL](https://rferl.org/a/iran-vpn-banned-internet-restrictions/32832544.html), [Filterwatch](https://filter.watch/english/tag/cyber-sovereignty/)).
- **Travel.** The Auswärtiges Amt warns against travel and reports arbitrary detention and exit bans for dual nationals, including German residents ([AA](https://www.auswaertiges-amt.de/de/reiseundsicherheit/iransicherheit-202396)).
- **Pressure in Germany.** Iranian agents use relatives' phones in Iran to put pressure on exiles in Germany ([Iran International on Die Welt](https://www.iranintl.com/en/202512108632) **[1 source]**). The BfV reports more Iran-linked cases ([New Arab](https://www.newarab.com/news/iran-stepping-harassment-nationals-germany-authorities)).

**Risk to viewers in Iran:** low from viewing alone. No source found that viewing a foreign classifieds site is a crime. The realistic risks are using a VPN (prohibited, enforcement unclear) and what is found on a seized phone. We can help a little:
- no tracking or third-party scripts;
- no cookies for IR visitors beyond what's needed;
- no PWA install prompt or push for IR;
- nothing they could be asked to "send" (no forms except report).

**Risk to posters abroad (higher, and not about IR IPs):**
- **The exposure.** Party, LGBTQ or political events, or photos of women without hijab, linked to a real name, are exactly what is used against people when they travel or against relatives in Iran.
- **Why IP-hiding won't fix it.** Hiding these only for IR IPs protects nobody, because the authorities browse from abroad and through VPNs. It would also break the cache (§1.1).
- **Mitigations for everyone:**
  1. **"Sensitive event" option** (and on by default for some categories, e.g. LGBTQ, political, parties):
     - the exact address, the organiser's personal name and photos with people are visible only to signed-in users with a verified phone (by policy, never Iran);
     - the public page shows the title, the date, the city and the organisation's name.
  2. **Posting guidance and a check:** "Don't upload photos showing other people's faces without their consent", with consent ticked at upload for event photos. Optional face blurring later.
  3. **Names:** keep display names free (2–50 characters **[code]**) and suggest a first name or nickname. Never show surnames or phone numbers publicly (a phone reveal needs a verified viewer **[code]**).
  4. **Metadata:** imgproxy runs with `IMGPROXY_STRIP_METADATA` **[code]**. Make sure originals are never served, so no GPS EXIF leaks.
  5. **Requests from Iranian authorities:** don't answer (GDPR Art. 48). Write this into the internal process.

**Is peydoo reachable from Iran, and the paradox:**
- **Will it be filtered?**
  - Iran filters Persian-language content more than English ([OpenNet](https://opennet.net/bulletins/004/)), and has at times blocked Cloudflare-fronted sites widely ([Iran International](https://old.iranintl.com/en/iran/iran-international-exclusive-new-wave-internet-censorship-iran) **[1 source]**).
  - 2026 had two near-total shutdowns, partly lifted on 26 May ([CTV/AP](https://www.ctvnews.ca/world/mideast-conflict/article/iranians-are-back-online-after-a-monthslong-shutdown-but-still-face-heavy-restrictions/)), and a tiered "white SIM / Internet Pro" system ([policyreview](https://policyreview.info/articles/news/how-war-restructured-irans-internet/2094)).
  - A diaspora site with party events and unveiled photos is **likely to be filtered once noticed (my assessment, no source)**. Test it after launch with OONI Probe measurements or contacts.
- **VPN use:** 81% of users ([Parliament Research Center via Iran International](https://iranintl.com/en/202502243980)). But an official poll says only 10% keep the VPN always on and 53% switch it on for specific tasks ([Iran International](https://www.iranintl.com/en/202510290150)).
- **What this means:**
  - **If peydoo is not filtered,** many Iranian visitors arrive without a VPN, and the IR read-only mode works for them.
  - **If it is filtered,** almost all arrive through a VPN with a foreign IP. The IP mode doesn't trigger, and they see the normal site and the sign-in.
  - Either way, **the +98 phone gate is the main real control**, with time zone and VPN checks at sign-in as the second line. The IP mode is still worth building: it is what regulators expect (§1.4), it is cheap, and it catches unfiltered or "VPN-off" visits. The design must not assume IR visitors see the banner.

## 4. What the Iranian visitor sees (Persian copy)

**Banner (top of every page for IR, one line, dismissible):**
> از ایران به پیدو سر زده‌اید. دیدن آگهی‌ها و رویدادها آزاد است، اما ثبت‌نام، گذاشتن آگهی و پیام دادن از داخل ایران ممکن نیست. [چرا؟]

**Notice page (`/login` and every blocked action for IR):**
> **پیدو در ایران فقط برای دیدن است**
>
> پیدو بازاری برای ایرانی‌هایی است که بیرون از ایران زندگی می‌کنند. آگهی‌ها و رویدادهای آن همه در کشورهای دیگرند.
>
> به خاطر قوانین تحریم اروپا و شرایط شرکت‌هایی که پیدو با آن‌ها کار می‌کند، نمی‌توانیم برای کسانی که در ایران هستند حساب بسازیم یا شماره‌های ایرانی (‎+98‎) را تأیید کنیم. این تصمیم دربارهٔ شما نیست؛ کاری است که قانون از ما می‌خواهد.
>
> **از ایران می‌توانید:** آگهی‌ها و رویدادها را ببینید و جست‌وجو کنید، و اگر محتوای غیرقانونی یا خطرناکی دیدید، [گزارش دهید].
>
> **اگر مهاجرت می‌کنید:** وقتی در کشور تازه ساکن شدید، با ایمیل و شمارهٔ موبایل همان کشور ثبت‌نام کنید. شماره‌های ایرانی پذیرفته نمی‌شوند، حتی بیرون از ایران.
>
> حسابی که از داخل ایران ساخته شود، خلاف قوانین پیدوست و بسته می‌شود.

(The last line deters without mentioning VPNs or virtual numbers. Never name them as a route; see Exodus in §1.4.)

**Telegram bot, +98 or non-seeded number:**
> این شماره قابل تأیید نیست. پیدو فقط شماره‌های موبایلِ کشورهایی را تأیید می‌کند که در آن‌ها فعال است و شماره‌های ایرانی (‎+98‎) را نمی‌پذیرد. اگر بیرون از ایران زندگی می‌کنید، در پیدو «تأیید با پیامک» را انتخاب کنید و شمارهٔ کشور محل زندگی‌تان را وارد کنید.

**A signed-in user seen in Iran (travel):**
> به نظر می‌رسد الان در ایران هستید. تا وقتی آن‌جا هستید، حسابتان فقط برای دیدن است: آگهی‌هایتان سر جایش می‌ماند، اما گذاشتن آگهی، پیام دادن و خرید ممکن نیست. وقتی از ایران خارج شدید، همه‌چیز مثل قبل کار می‌کند.

## Rule table (signal → action)

| Signal | Action | Reversible | Logged |
|---|---|---|---|
| IR IP, signed out | Read-only site, banner; login, waitlist and checkout refused; report allowed | Per request | Refusals counted (no IP stored) |
| IR IP, signed in | That request read-only; travel notice; listings stay live | Automatic | `audit_log` per day |
| IR IP at sign-in | No code sent; notice | n/a | Yes |
| Phone +98 (Telegram or SMS) | Refuse verification (`country_not_allowed`) | No | Yes |
| Number outside the 36 seeded countries, or +888/non-geographic | Refuse verification | No | Yes |
| Email ending `.ir` | Refuse sign-in | No | Yes |
| Tor (`T1`) at sign-in | Refuse sign-in (or review) | n/a | Yes |
| Browser time zone `Asia/Tehran` at sign-in or phone start | Refuse that step; ask the user to check device settings | Yes | Yes |
| VPN/hosting IP (proxycheck/IPinfo) alone | Nothing | — | No |
| VPN IP + `Asia/Tehran`, or VPN IP + another Iran signal | Hold the phone verification for review | Yes | Yes |
| IR on ≥ 7 days in 30 | Admin review queue | — | Yes |
| IR on ≥ 21 of 30 days and no non-IR request, or self-declared Iran residence | Restrict posting and messaging, pause listings, DSA Art. 17 statement of reasons, appeal | Yes, on confirmed residence abroad | Yes |
| Iranian IBAN/Shetab card in text, havaleh, Iran-bound goods | Moderation: remove, possibly close the account | Per moderation | Yes |
| Existing verified +98 numbers at release | Remove the verification, notice with statement of reasons | Re-verify with a local number | Yes |
| Any IR-origin Sentry browser event | Dropped in the tunnel | — | Counted |

## Questions for a sanctions lawyer

1. Is a free, no-account, read-only Persian marketplace reachable from Iran (HTTP 200, full listings) permitted under Reg. 267/2012 as amended by 2025/1975, Reg. 359/2011 and the AWV? Does the answer change for event pages and business (Pro) pages?
2. Do GL D-2 (a)(1) "web browsing … cloud-based services", 31 CFR 560.210(c) and 560.508 cover our US providers (Cloudflare CDN and Turnstile, AWS SES for one-off DSA replies, Sentry) when Iranian visitors read our pages? Should we get written confirmation from Cloudflare?
3. Is our control set enough to show due care under § 19 AWG and against "causing" liability under IEEPA, given that VPNs and virtual numbers defeat it? The set: IR-IP write block, +98 and non-seeded-number refusal, time zone, `.ir` and VPN checks at sign-in, a residence statement, re-checks on later logins, audit log. Which records, and for how long?
4. Users temporarily in Iran (visiting family) are "Iranian persons" under Art. 1. Is per-request read-only enough, or must existing listings and incoming chat notifications also stop while they are there?
5. Must we screen account holders against the EU, UN and OFAC lists, given that a free account or a Pro entitlement may be "economic resources"? If so, by what method for a sole trader?
6. Does the DSA Art. 16 duty to accept notices from "any individual" conflict with anything when the notifier is in Iran? Is replying by email (SES) to them fine?
7. Stripe: do "persons … citizen of" Iran in Stripe's policy reach diaspora buyers with Iranian citizenship? Does a read-only Iranian audience put the account at risk? What should we tell Stripe up front?
8. Account restrictions based on Iranian signals: is an automated refusal at sign-in acceptable under GDPR Art. 22 and the AGG? What must the DSA Art. 17 statement of reasons say?
