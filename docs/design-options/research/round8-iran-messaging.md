# Iran: message-only accounts (research 8)

Oct 25, 2026 · for the owner's decision: *"Iran is read-only, but people there can sign up with email so they can send messages."* This replaces the "no registration" part of `docs/design-options/research/round5-iran.md`. Everything else in round 5 stays: no posting, no payments, +98 refused.

> **Not legal advice.** This summarises public sources to brief a sanctions lawyer. **[1 source]** means the claim was found in one source only. **[code]** means checked in `/root/classifieds` today. **[assessment]** means my reading, with no source that says it directly.

## Short answer

- **The model is defensible on paper.** Under EU law, messages between people are not restricted. The risks are money, listed persons and goods. On the US side, the rule that has replaced GL D-2 (31 CFR 560.540, amended 17 May 2024) names "instant messaging, chat and email" and no longer requires communications to be "personal". OFAC FAQ 1088 lets cloud providers (AWS, Cloudflare) rely on it for their non-Iranian customers' users in Iran without checking those end users. Peydoo is not a US person, so this matters mainly to keep our US providers safe. A lawyer must confirm.
- **The danger point is money, not chat.** Nothing that moves money (Stripe, bumps, Pro, deposits) may run for these accounts. On top of the existing scam checks, the safe zone needs one rule: in any conversation with an Iran account, **IBANs, card numbers, payment requests and links are blocked in both directions**. That one rule blocks the deposit scam and also stops anyone arranging a payment from Iran on our platform.
- **Phone verification stays for everyone abroad.** The Iran account type is a **downgrade**. It is labelled «از ایران» to the other person, limited to chat, kept to low daily limits, and can never post or pay. That makes it useless to scammers abroad, so it can be granted on self-declaration, prompted by signals (IR IP, `Asia/Tehran` time zone). It doesn't have to rely on an IP check, which is easy to fake anyway: Iranian-IP VPNs are sold openly to the diaspora for Iranian banking.
- **Safety means keeping less data.** Delete chat contents 90 days after the last message. Don't ask for real names. Send email notifications without message text. Use short sessions, and no push or PWA. Never answer Iranian authorities. Iran's Oct 2025 espionage law punishes sending images or information "contrary to national security" to foreign media or pages. Press reports describe no penalty for simply using a foreign platform.
- **Keep refusing `.ir` email addresses.** It is no longer a way to detect Iran. The reason now is safety and reliability: chmail.ir's mail servers sit on a Tehran state-gateway network, and the codes we send are the keys to the account. Gmail is the practical choice.

---

## 1. Legal

### 1(a) United States

**Personal communications exemption (50 U.S.C. 1702(b)(1), 31 CFR 560.210(a)).** IEEPA does not let the President regulate "any postal, telegraphic, telephonic, or other personal communication, which does not involve a transfer of anything of value" ([OFAC FAQ 1190](https://ofac.treasury.gov/faqs/1190), [560.210 text](https://www.law.cornell.edu/cfr/text/31/560.210)). A chat message asking about a room is a communication. Two limits:
1. The exemption covers the communication, not obviously the commercial services that carry it. That gap is why OFAC has a separate licence for internet services.
2. "Personal" is read narrowly, and a business negotiation is not clearly "personal". No source was found that defines "transfer of anything of value" for Iran.

Don't rely on 1702(b)(1) alone.

**Informational materials (1702(b)(3), 560.210(c)).** Public listing and event pages fit. This exemption excludes "marketing or business consulting services" provided to Iranians. Peydoo sells advertising only to advertisers abroad, which is one more reason Iran accounts must never post or buy ([560.210](https://www.law.cornell.edu/cfr/text/31/560.210)).

**31 CFR 560.540 (the rule that replaced GL D-2).** On 17 May 2024 OFAC folded GL D-2 into 560.540, which now supersedes it; transactions under D-2 remain authorised ([OFAC FAQs 1110, 337](https://ofac.treasury.gov/faqs/updated/2024-05-16)).
- **What it authorises:** fee-based or no-cost services "incident to the exchange of communications over the internet", including messaging, chat, email and web browsing, plus cloud services in support ([560.540](https://www.law.cornell.edu/cfr/text/31/560.540)). The list is illustrative, not complete ([FAQ 338](https://ofac.treasury.gov/faqs/updated/2024-05-16)).
- **D-2 dropped the "personal" requirement.** Providers "need not assess the 'personal' nature of communications" ([Gibson Dunn](https://www.gibsondunn.com/united-states-expands-sanctions-authorization-of-internet-based-activities-in-wake-of-protests-in-iran/)). That closes the gap left by 1702(b)(1).
- **Exclusions:**
  - the Government of Iran (except free, publicly available services) and blocked persons;
  - commercial-grade connectivity;
  - **web hosting for commercial endeavours located in Iran** ([560.540(b)](https://www.law.cornell.edu/cfr/text/31/560.540)). Iran accounts must therefore never get business pages or listings.

**FAQ 1088 is the key one for our providers.** A cloud provider whose non-Iranian customers serve persons in Iran may rely on 560.540 after ordinary-course due diligence: the customer is not blocked, and its service falls within the communications categories. The provider "need not evaluate" whether Iranian end users' access "is related to communication". The contrast example is payroll software ([OFAC FAQ 1088](https://ofac.treasury.gov/faqs/1088)).

**Does it cover a classifieds chat? [assessment]** The chat feature is "chat", and the sign-in codes and notifications are "email". Both sit squarely in the list. The marketplace around it is the uncertain part, but for Iran accounts it is reduced to reading pages (web browsing). The underlying deal, a tenant in Iran and a landlord in Berlin, involves no US person. The licence would stop fitting if Iran accounts got fee-based features, posting, business pages or payments.

**Our US providers:**

| Provider | Iran account touchpoint | Position |
|---|---|---|
| AWS SES | Sign-in codes and notification emails to the user's mailbox (usually Gmail) | Email is in 560.540(a)(1). AWS §11.6 makes us "solely responsible for compliance related to … the provision of Your Content to End Users" ([AWS Customer Agreement](https://aws.amazon.com/agreement/), updated 14 Aug 2026). No AWS term was found that bars recipients in Iran. In 2019 AWS closed accounts of customers *in* Iran ([Al Jazeera](https://www.aljazeera.com/amp/economy/2019/10/2/locked-out-why-is-amazon-blocking-iranians-from-its-services)); we are a German customer. |
| Cloudflare CDN + Turnstile | Pages and the challenge at sign-up | Cloud services in support of browsing, covered by FAQ 1088 reliance. Its terms bar SDN customers and restricted exports ([terms](https://www.cloudflare.com/terms/)); they say nothing about visitors. **No source found on Turnstile from Iran in particular.** Test with contacts that the challenge loads on Iranian connections. |
| Sentry | Browser errors | Keep dropping IR-origin browser events in `/api/monitoring` (round 5), and also server events tagged with an Iran-account user ID. |
| Stripe | None allowed | Block at the **account** level (not only by IP): Iran accounts can never create a Checkout Session. Stripe bars persons "located in, resident in" Iran ([Stripe](https://stripe.com/legal/restricted-businesses)). |

### 1(b) EU: Reg. 267/2012 (as restored on 29 Sep 2025)

- **No ban on communications or free information services to people in Iran.** The measures cover listed persons (Art. 23, freezes, including "economic resources"), goods lists, sectors, funds transfers (Art. 30 bank-to-bank; Art. 30a, transfers with "Iranian persons" allowed below €10,000, linked operations counted together, notification or authorisation above that) and anti-circumvention (Art. 41, knowing and intentional) ([Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2025/10/eu-reintroduces-sanctions-against-iran-following-un-snapback), [Art. 41](https://legislation.gov.uk/eur/2012/267/article/41/adopted?view=plain)). The full analysis is in `docs/payments-iran.md`.
- **What's new with accounts:** we now hold accounts for "Iranian persons" (Art. 1 counts any natural person *in* or resident in Iran). We cannot screen them against the freeze lists, because we don't collect real names. Whether a free chat account counts as "economic resources" for a listed person is an open lawyer question. My view is that it probably doesn't, since an account can't be used to obtain funds or goods **[assessment]**.
- **Art. 40:** everyone must "supply immediately any information which would facilitate compliance", for example on frozen funds, to the national authority ([Art. 40](https://www.legislation.gov.uk/eur/2012/267/article/40/adopted?view=plain)). In Germany that means the Bundesbank for financial matters. This is a duty to share information if we learn of it, not a duty to monitor.
- **Germany:** § 18 AWG (criminal, intent) and § 19 AWG (administrative, negligence) ([AWG](https://www.gesetze-im-internet.de/awg_2013/)). Separately, hawala without a licence is an offence under the ZAG: the Federal Court of Justice (BGH) has confirmed this several times, and BaFin pursues it ([Bundestag hib 178/2023](https://www.bundestag.de/presse/hib/kurzmeldungen-937706), [Hessenschau, Darmstadt hawala sentence](https://www.hessenschau.de/panorama/illegaler-geld-transfer-zwei-maenner-im-hawala-prozess-in-darmstadt-verurteilt-v1,hawala-prozess-100.html)). Our existing ban on havaleh and exchange offers stays.

### 1(c) When chat leads to a transaction

Example: a person in Iran pays a Berlin landlord a deposit through an Iranian bank, an exchange office, havaleh, or a relative.

- **We are not a party.** No money touches Peydoo, and we are not payer, payee, agent or intermediary. A transfer from an individual in Iran below €10k is not banned outright under Art. 30a. The practical channels are, though: Iranian banks are frozen, and havaleh is unlicensed in Germany. That legal exposure belongs to the payer, the landlord and the money mover.
- **Our duties, as far as public sources show:**
  1. **No general duty to monitor private messages** (DSA Art. 8). Hosting liability starts with specific knowledge (DSA Art. 6), and the notice mechanism (Art. 16) already exists **[code: `/report`, chat report]**.
  2. **Don't build anything that carries the payment.** No deposit button, no escrow, and no payment instructions for or to Iran. Anything designed to get Iranian money past the rules is the Art. 41 case.
  3. **If we learn of a concrete breach,** for example a havaleh offer, a listed person, or goods for Iran: remove it, restrict the account, and consider Art. 40 information to the Bundesbank. Record it in `audit_log`.
  4. **Never suggest a route.** Not "ask a relative to pay", not VPNs, not crypto. Exodus 2025 (staff suggesting VPNs) was treated as egregious ([OFAC](https://ofac.treasury.gov/media/934831/download)).
- **The control that does both jobs:** in a conversation where either side is an Iran account, block messages carrying the `iban` flag (IBAN or a 16-digit Luhn card number), `payment_request` or `link`, **in both directions**, with a short system explanation. Today these are blocked only for accounts younger than 7 days, and only the receiver sees a warning **[code: `risk.ts`, `conversations.ts`]**. This stops the deposit scam and keeps payment arrangements off our platform. It needs no new kind of monitoring, because the detector already runs.
- **Open point:** if the chat counted as an interpersonal communications service, telecom secrecy (§ 3 TDDDG) would apply to scanning it. A chat that is a "minor ancillary feature … intrinsically linked to another service" is excluded ([EECC Art. 2(5)](https://eur-lex.europa.eu/eli/dir/2018/1972/2024-10-18/eng/pdf); [Bundesnetzagentur NI-ICS classification](https://bundesnetzagentur.de/EN/Areas/Digitalisation/Onlinekommunikationsdienste/NIICS/start.html)). Marketplace chat usually counts as ancillary **[assessment]**. This question exists already, with or without Iran; the new rule doesn't change it.

---

## 2. Product rules for message-only accounts

### 2.1 Who gets the account type (`users.region_tier = 'iran_message_only'`)

| Situation at sign-up | Result |
|---|---|
| Email code verified, and the user answers «در ایران زندگی می‌کنم» to the residence question | Iran account |
| IR IP (`CF-IPCountry = IR`) or `Asia/Tehran` time zone | Show the residence question first. "Iran" → Iran account. "Abroad" → normal account, but phone verification is refused while on an IR IP (round 5). The notice may say: «اگر بیرون از ایران هستید و با آی‌پی ایران وصل شده‌اید، آن را خاموش کنید» (it helps detection; it is not advice on evading anything) |
| No Iran signal, answers "abroad" | Normal account. **Phone still required** to chat or post. Nothing changes |
| An existing normal account later shows the strong Iran pattern (round 5 §1.5) | Moved to the Iran account type by a person, with a DSA Art. 17 statement of reasons and appeal. Listings paused |

**Why self-declaration is safe enough:** an IP check is not a strong gate, because Iranian-IP VPNs are sold to the diaspora for Iranian internet banking, at around 250k toman a month ([Rokna](https://www.rokna.net/%D8%A8%D8%AE%D8%B4-%D8%A8%D8%A7%D8%B2%D8%A7%D8%B1%DA%AF%D8%A7%D9%86%DB%8C-171/999672-%DA%86%DA%AF%D9%88%D9%86%D9%87-%D8%AF%D8%B1-%D8%AE%D8%A7%D8%B1%D8%AC-%D8%A7%D8%B2-%DA%A9%D8%B4%D9%88%D8%B1-%D8%A8%D9%87-%D8%AE%D8%AF%D9%85%D8%A7%D8%AA-%D8%A8%D8%A7%D9%86%DA%A9%DB%8C-%D8%B3%D8%A7%DB%8C%D8%AA-%D9%87%D8%A7%DB%8C-%D8%AF%D8%A7%D8%AE%D9%84-%D8%AF%D8%B3%D8%AA%D8%B1%D8%B3%DB%8C-%D8%AF%D8%A7%D8%B4%D8%AA%D9%87-%D8%A8%D8%A7%D8%B4%DB%8C%D9%85), advertorials). A scammer abroad can therefore get an IR IP cheaply. The protection is that the Iran account type gives a scammer nothing:
- it is labelled;
- it can't post;
- it can't send links, payment details or contact details in an opening message;
- it has low limits;
- recipients can switch off messages from Iran accounts.

A diaspora user who picks it to skip phone verification only makes things worse for themselves.

**Leaving the Iran account type (the emigration path).** The user needs all of:
- a new residence statement;
- a non-IR IP and a time zone other than `Asia/Tehran` on that day;
- phone verification with a number from one of the 36 seeded countries;
- at least 14 days since the account was created, so people can't hop between types.

Log the change. A person in Iran with a virtual number and a VPN can still lie their way through; that gap was already there (round 5 §1.4).

### 2.2 What the account can do

| Feature | Iran account | Note |
|---|---|---|
| Browse, search, report | Yes | As in round 5 |
| Start and answer chats | **Yes, within limits (2.3)** | The point of the decision |
| Categories it can message | **At launch: housing, jobs, services, courses, events, business pages. Not goods** | The owner's examples are all in these. Goods for someone in Iran mean shipping to Iran (banned) or "fake buyer, my courier will collect" scams [assessment] |
| Favorites | Yes | Data stays with us; harmless |
| Saved-search alerts, waitlist | Not at launch | Fewer emails into Iran; revisit |
| Phone reveal | **No** | Reveal stays for verified viewers, which protects sellers from harvesting and unwanted calls. A seller can give their number in chat after replying |
| Post a listing, event or business page | No | Plus 560.540(b) "commercial endeavours located in Iran" |
| Pro, bumps, Checkout | No, blocked at account level | Stripe |
| Business invites (membership) | No | |
| Attachments in chat (if added later) | No | Safety (images under the 2025 law) and spam |

### 2.3 Limits

Existing limits for comparison: new accounts may start 5 conversations an hour and 15 a day, everyone 20 messages a minute and 300 an hour; links and IBANs are blocked for accounts younger than 7 days **[code: `limits.ts`, `risk.ts`]**.

| Limit | Iran account |
|---|---|
| New conversations | 3 a day for the first 7 days, then 10 a day, at most 30 a week |
| Messages before the other side replies | **2 per conversation** (works as a message request) |
| Messages a day | 60 |
| `link`, `iban` (incl. card numbers), `payment_request` | **Blocked both ways** in Iran conversations, always |
| `phone_number`, `off_platform_contact` | Blocked until the other side has replied, then allowed with the existing warning |
| Same text in ≥ 3 conversations within 24 h | Held for review |
| Turnstile | At sign-up and on the first new conversation each day |
| Email | One account per mailbox, normalised (Gmail dots and `+tags`); disposable domains refused; `.ir` refused (§4) |
| Per IP | Soft only, e.g. 20 sign-ups a day per IP, then review. Iran uses carrier-grade NAT, so many users share one IP |
| Auto-pause | 2 reports from different users, or 3 blocks within 7 days → sending paused, sent to review with a DSA Art. 17 statement of reasons |

### 2.4 What the recipient sees and can do

- **The label «از ایران»** next to the name, with a tooltip: «این حساب از ایران ساخته شده و فقط می‌تواند پیام بفرستد. شمارهٔ تلفنش تأیید نشده است.» Tell the Iran user at sign-up that this label is shown. That is data about them, so it must be transparent; the basis is fraud prevention and an informed counterpart, Art. 6(1)(f) GDPR (lawyer to confirm).
- **A system message at the start of every Iran conversation, shown to both sides:**
  > یادآوری پیدو: پیش از دیدن خانه یا اتاق و امضای قرارداد هیچ پولی نفرستید و نخواهید، نه بیعانه، نه ودیعه، نه اجارهٔ ماه اول. در این گفت‌وگو شمارهٔ کارت، شبا و لینک فرستاده نمی‌شود. حواله، صرافی و کارت‌به‌کارت در پیدو مجاز نیست. اگر کسی پیش‌پرداخت خواست، گزارش دهید.
- **The deposit scam has a known shape:** a landlord who is "abroad", no viewing, keys by post, and a deposit before viewing. A Kaution is due only when the tenancy starts ([zdfheute](https://www.zdfheute.de/ratgeber/immobilien-anzeigen-betrug-wohnungssuche-100.html), [R+V](https://www.ruv.de/newsroom/infocenter/wohnungsnot-betrug), [Berliner Mieterverein](https://www.berliner-mieterverein.de/?p=75794)). Someone in Iran can't view a flat, which makes them the ideal victim. The warning matters most for them.
- **Recipient tools:** block and report (existing), plus a new setting «پیام از حساب‌های ایران را نپذیر». Default: accept. It is offered on the first Iran message. Diaspora users have real reasons to want it: Iran-linked pressure on exiles in Germany is documented ([New Arab/BfV](https://www.newarab.com/news/iran-stepping-harassment-nationals-germany-authorities); [Iran International](https://www.iranintl.com/en/202512108632) **[1 source]**).

### 2.5 Travel rule for normal accounts (changes round 5 §1.5 rule 1)

When a verified user is in Iran (IR IP), each request is **message-only**, not read-only. They can reply in their existing conversations and start new ones within the Iran account limits. Posting, payment and phone reveal stay off. This keeps the two account types consistent.

---

## 3. Safety for users in Iran

**What Iranian law says (factual):**
- **The Oct 2025 espionage law** ("Intensifying Punishment for Espionage and Cooperation with the Zionist Regime and Hostile States"):
  - sending videos, images or information "contrary to national security" to foreign networks, media or social-media pages: 2–5 years;
  - false or fear-inducing content: 10–15 years;
  - the US and Israel are defined as hostile states;
  - the intelligence ministry must publish lists of hostile networks, media and online accounts;
  - Starlink is criminalised.

  Iran International "does not describe a separate penalty for simply using foreign platforms" ([Iran International, 9 Oct 2025](https://www.iranintl.com/en/202510099140), [AsiaNews](https://www.asianews.it/news-en/Death-penalty-for-illegal-use-of-the-internet:-Tehran's-espionage-law-64137.html)). Its status: signed with immediate effect per IranWire; "poised to implement" per Iran International **[sources differ]**.
- **Unlicensed VPN use** is prohibited (Feb 2024 resolution). Whether that is a crime is disputed (round 5).
- **Access in 2026:** the general public was cut off from the global internet for most of the year. Access has partly returned since late May, but it is tiered and whitelisted, and "some Google services work, while others don't" ([Al Jazeera, 31 May 2026](https://aljazeera.com/news/2026/5/31/iran-reinstates-some-internet-access-but-restrictions-remain-for-most), [Kentik](https://www.kentik.com/blog/irans-internet-blackout-peering-into-the-worlds-worst-internet-shutdown/)). Telegram is among the blocked services, so the Telegram phone check is out of reach for them in any case.

**Assessment.** Asking a Berlin landlord or a translator a practical question is far from "sending information contrary to national security". The risk rises with:
- political or LGBTQ event organisers as the other party;
- sending photos or documents;
- a phone that is inspected (the browser session, Gmail, saved passwords).

Peydoo would be on a hostile list only if it were classed as media, which it is not, but filtering is likely (round 5).

**Data minimisation (Iran accounts):**
1. **Chat contents deleted 90 days after the last message** in any conversation with an Iran account. This matches the existing 90-day rule for deleted accounts **[code: `retention.ts`]**. Messages linked to a report or a moderation decision follow the existing 2-year hold. Both sides see «این گفت‌وگو ۹۰ روز پس از آخرین پیام پاک می‌شود».
2. **"Delete my messages" at any time,** with the text replaced by «حذف شد». When an Iran account is deleted, its message bodies go **at once**, except reported ones.
3. **No real name.** The display name stays free (2–50 characters) **[code]**, with a nickname suggested. No avatar upload.
4. **Email notifications carry no message text.** Neutral subjects: «کد ورود شما», «پیام تازه دارید». At most one per conversation every 6 hours, and they can be turned off.
5. **Sessions:** 14 days of inactivity, a prominent «خروج از همه دستگاه‌ها», no PWA install prompt, no web push.
6. **IP data:** keep the full IP for 7 days for abuse handling, then only the country and the day.
7. **Requests from Iranian authorities are not answered** (GDPR Art. 48). Data is stored in the EU.

**Persian safety note (sign-up, one screen):**
> **پیش از ثبت‌نام بدانید**
> - با این حساب فقط می‌توانید به آگهی‌دهندگان پیام بدهید؛ گذاشتن آگهی و پرداخت ممکن نیست.
> - به طرف گفت‌وگو نشان داده می‌شود که حساب شما «از ایران» است.
> - نام واقعی لازم نیست. عکس، مدرک یا اطلاعات شخصی خود و دیگران را نفرستید.
> - پیام‌ها ۹۰ روز پس از آخرین پیام از سرورهای پیدو پاک می‌شوند و هر وقت بخواهید می‌توانید زودتر پاکشان کنید.
> - اگر دیگران به گوشی یا ایمیل شما دسترسی دارند، بعد از هر بار استفاده از حساب خارج شوید.
> - پیدو به درخواست نهادهای ایرانی دربارهٔ کاربرانش پاسخ نمی‌دهد.

(Never mention VPNs or virtual numbers in any copy or support answer.)

**Updated banner for IR visitors (replaces round 5 §4):**
> از ایران به پیدو سر زده‌اید. دیدن آگهی‌ها آزاد است و می‌توانید با ایمیل ثبت‌نام کنید و به آگهی‌دهندگان پیام بدهید. گذاشتن آگهی و پرداخت از داخل ایران ممکن نیست. [بیشتر بدانید]

---

## 4. Email deliverability

- **SES to Gmail, Yahoo or Outlook:** delivery happens in the provider's own (US) servers and doesn't depend on where the reader is. Whether the reader can open it depends on Iran's network. No 2026 source confirms Gmail's status. "Some Google services work" (Al Jazeera, May 2026). During shutdowns, nothing arrives in practice, and the site is unreachable too.
- **New Gmail accounts from Iran have got harder.** Since Sep 2026, Google reportedly refuses or fails phone verification for +98 numbers at sign-up. Existing accounts are not reported as affected ([Siasat, 27 Sep 2026](https://www.siasat.com/google-restricts-new-account-creation-for-iranian-users-3549175/) **[1 source]**). Most people already have Gmail, so this mainly hits new users.
- **chmail.ir and other `.ir` domains:**
  - chmail.ir has been the "national email" since 2012. Registration asked for the national ID, address and phone. Banks and operators were ordered to use national email ([Citizen Lab](https://citizenlab.ca/?p=12537), [CHRI](https://iranhumanrights.org/2014/11/internet-report-national-email/), [Gulf News](https://gulfnews.com/world/mena/iran-curbs-foreign-sourced-email-providers-1.1021933)).
  - Its MX hosts (`mtame1/2.chmail.ir`, 80.191.56.141) are in AS12880, "Information Technology Company", Tehran **[checked today with DNS and RIPE RDAP]**. That is Iran's state-owned international gateway operator **[assessment: ownership not sourced here]**.
  - SES can technically send there; no AWS rule against it was found. Delivery into Iran is unreliable during shutdowns and filtering **[assessment]**.
- **Recommendation: keep refusing `.ir`.** It no longer serves to detect Iran. The reasons now:
  - **Safety:** a sign-in code is the key to the account, and a state-linked mailbox operator can read it.
  - **Sanctions hygiene:** it avoids the "Government of Iran" exclusion question under 560.540(b)(1).
  - **Reliability.**

  The copy reads: «لطفاً یک ایمیل بین‌المللی مثل جیمیل وارد کنید؛ ایمیل‌های ‎.ir‎ را نمی‌پذیریم.» An attempt with a `.ir` address is an Iran signal, so show the residence question.

---

## 5. Updated rule table (signal → action)

| Signal | Action | Reversible | Logged |
|---|---|---|---|
| IR IP, signed out | Site readable, banner (new copy); **sign-up allowed**; waitlist and checkout refused; report allowed | Per request | Counted |
| IR IP or `Asia/Tehran` at sign-up | **Residence question.** "Iran" → Iran account; "abroad" → normal account, phone step refused while on IR IP | User can answer again from abroad | Yes |
| Self-declared Iran residence (no other signal) | Iran account | Via the emigration path (2.1) | Yes |
| Iran account, any IP | Chat within limits, favorites; no posting, no checkout (account-level), no phone reveal, no business, no goods categories | Emigration path only | Yes |
| Iran conversation contains `link`, `iban`/card, `payment_request` | Blocked both ways, with an explanation | n/a | Count per account |
| Iran account, `phone_number` or `off_platform_contact` before a reply | Blocked; allowed after a reply, with a warning | n/a | No |
| Iran account: 2 reports or 3 blocks within 7 days, or the same text to ≥ 3 people | Sending paused, review, DSA Art. 17 | Yes | Yes |
| Normal verified account, IR IP | That request **message-only** (was read-only); travel notice | Automatic | `audit_log` per day |
| Phone +98, number outside the 36 seeded countries, or +888 | Refuse verification (unchanged) | No | Yes |
| Email `.ir` | Refuse that address, ask for another, show the residence question | Yes | Yes |
| Tor (`T1`) at sign-up | Refuse or review (unchanged) | n/a | Yes |
| VPN IP alone | Nothing (unchanged) | — | No |
| VPN IP + `Asia/Tehran` on a normal account | Phone step held for review (unchanged) | Yes | Yes |
| Strong pattern (≥ 21 of 30 days IR, no non-IR request) on a normal account | **Moved to the Iran account type**, listings paused, Art. 17 statement, appeal | Emigration path | Yes |
| Havaleh, exchange, card-to-card, Iran-bound goods, listed person | Moderation; close the account; consider Art. 40 information to the Bundesbank | Per moderation | Yes |
| Iran conversation 90 days after its last message | Bodies deleted (unless reported) | No | Count |
| IR-origin Sentry events, or events tagged with an Iran account | Dropped or scrubbed | — | Counted |

## 6. Questions for the sanctions lawyer (changed or new)

1. **(Was Q1)** Is it permitted under Reg. 267/2012 (as amended by 2025/1975), Reg. 359/2011 and the AWV to let persons in Iran hold **free, unscreened, chat-only accounts** and message sellers and businesses abroad? Is such an account "economic resources" (Art. 1, 23) if a listed person uses one, and do we need name screening that we can't do without collecting names?
2. **(Was Q2)** Do 560.540(a)(1) and FAQ 1088 cover AWS SES (sign-in codes and notifications to Gmail users in Iran) and Cloudflare CDN and Turnstile for Iran accounts? Does the 560.540(b)(3) exclusion ("commercial endeavours located in Iran") stay clear as long as Iran accounts can't post or create business pages? Should we tell AWS and Cloudflare in writing?
3. **(New)** When a chat leads to a deal paid from Iran (a deposit or a translator's fee) outside our platform, do we have any duty beyond: no payment features, blocking payment details in Iran conversations, acting on knowledge, and Art. 40 information? Does our knowledge that "some users in Iran will pay landlords abroad" create Art. 41 or § 19 AWG exposure?
4. **(Was Q4)** For users visiting Iran, is message-only (instead of read-only) acceptable?
5. **(New)** Does scanning and blocking IBANs, cards and links in chats raise TDDDG § 3 issues, or is our chat a "minor ancillary feature" (EECC Art. 2(5))?
6. **(New)** GDPR: is showing «از ایران» to the other party lawful under Art. 6(1)(f) with notice at sign-up? Is the 90-day deletion compatible with DSA record-keeping (Art. 17, 20) and our 2-year moderation hold?
7. **(Was Q3)** With self-declaration as the main way into the Iran account type, and IR IP and time zone used as prompts rather than gates, does the control set still show due care? Which records, for how long?
8. **(Was Q8)** Is refusing `.ir` email addresses, and limiting Iran accounts by category (no goods), acceptable under the AGG and the DSA (Art. 14 terms, Art. 17 statements)?
9. **(Was Q7)** Stripe: given the account-level checkout block, what should we tell Stripe about accounts in Iran that never pay?

Questions Q5 (list screening, now merged into Q1) and Q6 (DSA notices from Iran) from round 5 stand as they were.

## Sources

- OFAC: [FAQ 1190](https://ofac.treasury.gov/faqs/1190) (1702(b)(1)), [FAQ 1088](https://ofac.treasury.gov/faqs/1088), [FAQs updated 16 May 2024 (1110, 337, 338)](https://ofac.treasury.gov/faqs/updated/2024-05-16), [Exodus settlement](https://ofac.treasury.gov/media/934831/download)
- 31 CFR [560.210](https://www.law.cornell.edu/cfr/text/31/560.210), [560.540](https://www.law.cornell.edu/cfr/text/31/560.540); GL D-2 in the [Federal Register, 87 FR 62003](https://regulations.justia.com/regulations/fedreg/2022/10/13/2022-22233.html); [Gibson Dunn on GL D-2](https://www.gibsondunn.com/united-states-expands-sanctions-authorization-of-internet-based-activities-in-wake-of-protests-in-iran/); [Baker McKenzie](https://sanctionsnews.bakermckenzie.com/ofac-issues-updated-iran-general-license-related-to-certain-services-software-and-hardware-for-communications-over-the-internet-and-new-related-faqs/)
- [AWS Customer Agreement](https://aws.amazon.com/agreement/) §11.6; [Al Jazeera 2019 on AWS and Iran](https://www.aljazeera.com/amp/economy/2019/10/2/locked-out-why-is-amazon-blocking-iranians-from-its-services); [Cloudflare terms](https://www.cloudflare.com/terms/); [Cloudflare blog](https://blog.cloudflare.com/the-challenges-of-sanctioning-the-internet); [Stripe restricted businesses](https://stripe.com/legal/restricted-businesses)
- EU: [Mayer Brown on the snapback](https://www.mayerbrown.com/en/insights/publications/2025/10/eu-reintroduces-sanctions-against-iran-following-un-snapback); Reg. 267/2012 [Art. 40](https://www.legislation.gov.uk/eur/2012/267/article/40/adopted?view=plain), [Art. 41](https://legislation.gov.uk/eur/2012/267/article/41/adopted?view=plain); [EECC 2018/1972](https://eur-lex.europa.eu/eli/dir/2018/1972/2024-10-18/eng/pdf); [Bundesnetzagentur NI-ICS](https://bundesnetzagentur.de/EN/Areas/Digitalisation/Onlinekommunikationsdienste/NIICS/start.html)
- Germany: [AWG](https://www.gesetze-im-internet.de/awg_2013/); [Bundestag hib 178/2023 on hawala](https://www.bundestag.de/presse/hib/kurzmeldungen-937706); [Hessenschau hawala case](https://www.hessenschau.de/panorama/illegaler-geld-transfer-zwei-maenner-im-hawala-prozess-in-darmstadt-verurteilt-v1,hawala-prozess-100.html)
- Rental scams: [zdfheute](https://www.zdfheute.de/ratgeber/immobilien-anzeigen-betrug-wohnungssuche-100.html), [R+V](https://www.ruv.de/newsroom/infocenter/wohnungsnot-betrug), [Berliner Mieterverein](https://www.berliner-mieterverein.de/?p=75794), [koeln.de / Polizei Köln](https://www.koeln.de/?p=190044)
- Iran: [Iran International on the espionage law](https://www.iranintl.com/en/202510099140); [AsiaNews](https://www.asianews.it/news-en/Death-penalty-for-illegal-use-of-the-internet:-Tehran's-espionage-law-64137.html); [Al Jazeera, 31 May 2026](https://aljazeera.com/news/2026/5/31/iran-reinstates-some-internet-access-but-restrictions-remain-for-most); [Kentik](https://www.kentik.com/blog/irans-internet-blackout-peering-into-the-worlds-worst-internet-shutdown/); [Siasat on Google accounts](https://www.siasat.com/google-restricts-new-account-creation-for-iranian-users-3549175/); [Rokna on Iranian-IP VPNs](https://www.rokna.net/%D8%A8%D8%AE%D8%B4-%D8%A8%D8%A7%D8%B2%D8%A7%D8%B1%DA%AF%D8%A7%D9%86%DB%8C-171/999672-%DA%86%DA%AF%D9%88%D9%86%D9%87-%D8%AF%D8%B1-%D8%AE%D8%A7%D8%B1%D8%AC-%D8%A7%D8%B2-%DA%A9%D8%B4%D9%88%D8%B1-%D8%A8%D9%87-%D8%AE%D8%AF%D9%85%D8%A7%D8%AA-%D8%A8%D8%A7%D9%86%DA%A9%DB%8C-%D8%B3%D8%A7%DB%8C%D8%AA-%D9%87%D8%A7%DB%8C-%D8%AF%D8%A7%D8%AE%D9%84-%D8%AF%D8%B3%D8%AA%D8%B1%D8%B3%DB%8C-%D8%AF%D8%A7%D8%B4%D8%AA%D9%87-%D8%A8%D8%A7%D8%B4%DB%8C%D9%85); [Citizen Lab on national email](https://citizenlab.ca/?p=12537); [CHRI on national email](https://iranhumanrights.org/2014/11/internet-report-national-email/); [Gulf News 2012](https://gulfnews.com/world/mena/iran-curbs-foreign-sourced-email-providers-1.1021933); [New Arab on BfV](https://www.newarab.com/news/iran-stepping-harassment-nationals-germany-authorities); [Iran International on Die Welt](https://www.iranintl.com/en/202512108632)
