# Peydoo: WhatsApp "user sends us the code", dropping SMS, Telegram bot limits (research, 25 Oct 2026)

Follows on from `research8-phone.md`. No code was changed.

Markers:
- **[1 source]**: only one source confirms it, or it comes from a third party.
- **[assessment]**: my own reasoning, not a published fact.

## Summary

1. **Reverse WhatsApp OTP costs nothing at all if we never reply.**
   - Inbound messages are free.
   - Opening the 24-hour customer service window is free.
   - The Cloud API has no monthly fee.
2. **The prior note's 1 Oct 2026 claim is correct.** Each business number gets 1,000 free service messages a month. Above that, a service message costs the market's utility rate, for example DE $0.055 or TR $0.0009.
   - If we never add a payment method, Meta simply stops delivering service messages above the free tier. So the cost is capped at €0.
3. **Usernames are the real catch.**
   - When a user has a WhatsApp username and has never talked to our number, their first message arrives without the phone number.
   - We then have to reply with a `REQUEST_CONTACT_INFO` button. That reply is a service message, so it falls in the free 1,000.
   - Usernames are only reservable so far (since 29 Jun 2026). I found no source confirming the full launch. So today the share of such users is close to zero, but it will grow.
4. **New finding: Telegram now has an official OpenID Connect "Log In With Telegram".** Its `phone` scope returns a signed, verified `phone_number`. That is a free alternative to the bot chat, with no message needed.
5. **Meta blocks Iran itself.** Users in Iran "are not eligible to receive messages sent via the WhatsApp Business Platform". Third parties say +98 numbers are blocked. We still need our own +98 refusal.
6. **Telegram limits are per bot, not per owner account.**
   - The ToS says "By default, TPA [the bot] are able to broadcast up to 30 messages per second".
   - One account can own 20 bots, or 40 with Premium (official config defaults).
   - Using extra production bots to get around limits is risky under ToS §5.2(f). It also doesn't work, because a bot can only message people who started *that* bot.
   - A separate staging bot is good practice, and with `getUpdates` it is required anyway.
7. **No data exists on diaspora Iranians without a messenger on a local number.** My estimate is 5–15% of verifications, higher in Turkey and among recent migrants [assessment].
   - Recommendation: launch with Telegram and WhatsApp only, plus a limited email-only account.
   - Keep the SMS adapter built but switched off.
   - Switch it on when a clear, measured trigger is hit (§2.5). Even then the cost is about €10–30 a month.

---

## 1. WhatsApp "user sends us the code" (reverse OTP)

### 1.1 Cost of inbound messages and of the service window

Source: [Meta pricing (developer docs)](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing), fetched 25 Oct 2026.

| Question | Answer |
|---|---|
| Are inbound user messages free? | **Yes.** "Meta does **not** charge for messages from users to businesses." |
| Any cost if we never reply? | **None.** Meta charges only per *delivered* message that the business sends. Nothing is billed for receiving, for webhooks or for an open window. |
| Is a customer service window opened? | **Yes.** "a 24-hour timer called a *customer service window* starts" when the user messages us. Inside it we may send free-form (non-template) messages. |
| Does an unused window cost anything? | **No.** The page lists no fee for opening or keeping a window. Cost arises only from messages we send inside it. |
| What changed on 1 Jul 2025? | Pricing moved from per-conversation to **per delivered message**, and conversation-based pricing "is deprecated". Utility templates sent inside an open window became free. |
| What changed on 1 Oct 2026? | "Meta resumed charging, on a per-message basis, for messages that were previously free." <br>• **Service messages** (non-template replies, including interactive ones): "Each business phone number has one free tier of 1,000 delivered service messages per month." Billing starts at the 1,001st, and unused messages don't roll over. <br>• **Utility templates inside the window** are charged again: the pricing type changed "from `free_customer_service` to `regular` as of October 1, 2026". The 1,000 free tier covers service messages only. |
| What if we have no payment method? | Meta "deliver[s] service messages within the free tier but [does] not deliver them after the free tier has been used". **This is a hard €0 cost cap.** |

**The prior note is correct** on the 1,000-a-month free tier per number since 1 Oct 2026, and on utility messages in the window no longer being free. Two clarifications:
- The free tier is **per business phone number**, not per account or portfolio.
- Meta's marketing page [whatsappbusiness.com/products/platform-pricing](https://whatsappbusiness.com/products/platform-pricing/) still says "we do not charge for service messages". That text is out of date; the developer docs are authoritative. One blog ([ChatMaxima](https://chatmaxima.com/blog/whatsapp-service-message-pricing-october-2026/)) even claims there is no free allowance at all. Meta's own page contradicts it.

**Rate for a service message above the free tier.** The "Service" column in Twilio's mirror of Meta's rate card equals the utility rate in every one of our markets ([CSV](https://www.twilio.com/content/dam/twilio-com/pricing-data/en/WhatsAppPricing-pricing-details.csv)) [1 source]. Meta's page only says "per published rates".

| DE | NL | FR | IT | UK | AT / SE (Rest of W. Europe) | AU | CA / US | TR |
|---|---|---|---|---|---|---|---|---|
| $0.055 | $0.050 | $0.030 | $0.030 | $0.022 | $0.0171 | $0.0113 | $0.0034 | $0.0009 |

Iran does not appear in the rate card at all (see §1.7).

**Webhook billing fields.** Within the free tier the pricing webhook shows `category: service`, `type: free_customer_service`, `billable: false`. After the free tier it shows `type: regular`, `billable: true`. Log these fields to watch the tier.

### 1.2 Fixed costs and setup

| Item | Fact | Source |
|---|---|---|
| Cloud API itself | Meta-hosted. There is no hosting or monthly fee; charges are only per delivered message. | [pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing), [about the platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform) |
| Phone number | It must be "owned by you", have a country and area code (no short codes), and be able to receive a **voice call or SMS** once for the code (`code_method` SMS or VOICE). Landline, toll-free and VoIP numbers are allowed; for them SMS is "Not Recommended" and voice is standard. Call forwarding and IVR must be off for the call. Pager numbers are not supported. | [phone numbers](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers) |
| Number in the consumer app | A registered number "cannot be used with WhatsApp Messenger". A number already on WhatsApp must be deleted there first. "Coexistence" with the WhatsApp Business **app** exists, but such numbers get a fixed 20 messages a second [1 source, [vendor blog](https://blog.campaignhq.co/whatsapp-coexistence-pros-cons-20-mps-scaling/)]. | as above |
| Numbers per portfolio | 2 for a new portfolio; 20 after business verification or after reaching a 2,000 messaging limit. | as above |
| Display name | Required when registering. It shows in chat threads and the chat list only once **display name verification** has approved it. It is re-checked on every change. No fee is mentioned. | [display names](https://developers.facebook.com/documentation/business-messaging/whatsapp/display-names) |
| Business verification | **Not needed for our use.** Messaging limits count only business-initiated messages "outside of a customer service window", so replies to users who wrote first are not limited. New portfolios start at 250 for business-initiated messages. Verification is free but needs company documents; I assume a Gewerbe registration is enough [assessment]. | [messaging limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits) |
| Webhook | A public HTTPS endpoint signed with `X-Hub-Signature-256`. Meta retries failed webhooks "for up to 7 days, with exponential backoff". | [throughput](https://developers.facebook.com/documentation/business-messaging/whatsapp/throughput) |

**Realistic fixed cost: the number only** [assessment].
- A German prepaid SIM or a cheap VoIP or landline number costs about €0–10 a month.
- Keep it forever and set the two-step PIN. If the number lapses, someone else could re-register it.
- Everything else is free.

### 1.3 Usernames and business-scoped user IDs (BSUIDs)

Source: [Meta BSUID docs](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids).

**Timeline**
- BSUIDs "began appearing in webhooks in early April 2026".
- Business username reservation opened 29 Jun 2026.
- Sending messages to a BSUID has been possible since July 2026.
- Users: on 29 Jun 2026 WhatsApp opened username **reservation** "to use later this year when we launch this feature", rolling out gradually country by country ([Meta newsroom](https://about.fb.com/news/2026/06/its-time-to-reserve-your-whatsapp-username/), [BleepingComputer](https://bleepingcomputer.com/news/security/whatsapp-rolls-out-usernames-to-help-users-hide-their-phone-number)).
- I found **no source after early July 2026 that confirms the full user launch**. Treat it as imminent.

**When does an inbound message arrive without the phone number?**
- Once a user turns on a username, "their phone number will not be included in webhooks, unless you have interacted with the user before". The webhook then carries the BSUID (`user_id` / `from_user_id`), and `wa_id` / `from` is left out.
- The number **is** included if any of these is true, checked **per business phone number**:
  1. We messaged or called that number in the last 30 days.
  2. We received a message or call from it in the last 30 days.
  3. The user is in our **contact book**. This is a Meta-hosted store that fills itself from our interactions after its launch. It can be switched off, which deletes it.
- Meta doesn't say outright whether the very first inbound message counts as "received a message". The wording ("unless you have interacted with the user before") means a **first contact from a username user arrives without the number** [assessment, consistent with the prior note].
- Users **without** a username, "the default state for most users at launch", arrive with the BSUID **and** the phone number.

**Getting the number for free**
- Reply with an interactive message: `type: "interactive"`, `interactive.type: "request_contact_info"`, `action.name: "request_contact_info"`. It can also be a template button `REQUEST_CONTACT_INFO`.
- When the user taps it, "their WhatsApp phone number will be shared in the message thread" and a contacts webhook fires:
  - `origin: "contact_request"` means the user tapped our button. No vCard comes with it.
  - `origin: "other"` means the user shared some contact card by hand. A vCard comes with it.
- **Accept only `contact_request`**. That is our equivalent of Telegram's `contact.user_id == from.id` check.
- **Cost of that reply:** Meta's BSUID page doesn't state its category. A non-template message is by definition a **service** message ("Any non-template message not powered by the Meta Business Agent Platform"). So it is **free within the 1,000 a month per number**, and after that it costs the local rate above, or is not delivered if we have no payment method [assessment based on Meta's definition].

**How common will usernames be?**
- Meta gives no forecast. Usernames are "optional for users and businesses", and at launch most users have none.
- I expect a low single-digit share in the first months, growing over 2027. Privacy-minded diaspora users may adopt faster [assessment].

**Can we require the number?** No. There is no flag to force it. The user decides by tapping the button. If they refuse, we show "not verified" on the website.

**Other BSUID facts that matter to us**
- A BSUID is "unique to each business portfolio-user pair".
- It is "regenerated if a user changes their phone number", with a system webhook.
- Store it as the WhatsApp identity, like `telegram_user_id`, and treat a regenerated BSUID as a new identity that needs re-verification.

**Rough cost check** [assessment]
- Example: 3,000 WhatsApp verifications a month, with 20% username users. That means about 600 `request_contact_info` replies, which is free.
- We would pay only above 1,000 replies a month on one number. A second number has its own free tier, but using numbers just to multiply free tiers is not clean.

### 1.4 Policy: may we use inbound messages for verification?

Source: [WhatsApp Business Messaging Policy](https://whatsappbusiness.com/policy/), last updated 23 Sep 2026.

**What the policy covers**
- **Opt-in** is needed for *business-initiated* contact. We may contact people who "have given you their mobile phone number or username". A user writing to us first is the opt-in for replies inside the 24-hour window.
- **Free-form replies** are allowed inside the window. Outside it, only approved templates.
- **Automation** is allowed, but we "must also have available prompt, clear, and direct escalation paths", such as a human, email or web support. Put a support link in the reply text and on the page.

**Nothing in the policy, or in the [authentication best practices](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/authentication-best-practices/), forbids or mentions user-sent codes.** The authentication-template rules cover only codes *the business sends*.

**Commerce policy**
- It prohibits "commerce experiences" on WhatsApp for adult products, **dating services**, firearms, MLM, payday loans and regulated verticals.
- That governs selling *inside WhatsApp*, not our website. But if Peydoo ever has a "personals" or "dating" category, keep the WhatsApp number strictly for verification and support [assessment].

**Overall risk: low, but Meta has not explicitly endorsed it** [assessment].

**Who does this already?**
- **Whatsiplus "Login with Whatsiplus (Reverse OTP)"** (WordPress plugin): the user sends a generated code to the site's number. The authors say a user-initiated chat lowers the risk of WhatsApp blocking the business number ([plugin page](https://fair.pm/packages/plugins/login-with-whatsiplus-reverse-otp/)) [1 source].
- **OTPless** used a user-initiated flow in 2022–23: a prefilled WhatsApp message, then a magic-link reply ([OTPless blog](https://blogs.otpless.com/?p=575)) [1 source, vendor].
  - Its current WhatsApp Auth page describes only the **business-sent** template with on-device auto-read ("zero-tap", Android). It reports P50 ~2 s, P90 ~7 s and 99%+ delivery "where WhatsApp is installed" ([OTPless](https://otpless.com/products/whatsapp-auth)) [1 source, vendor].
  - The shift suggests that, for mobile *apps*, the business-sent zero-tap flow converts better. For a *website*, zero-tap and one-tap don't apply, so the reverse flow is not at a disadvantage [assessment].
- "Zero-tap" and "one-tap" are Meta authentication-template buttons for Android apps. They don't help a website, and they need the phone number, not a BSUID.
- I found **no published conversion data** for reverse WhatsApp OTP.

### 1.5 Throughput and limits

| Limit | Value | Source |
|---|---|---|
| Messages a second per business number | **80** by default (auto-upgrade to 1,000). "inclusive of inbound and outbound messages" | [throughput](https://developers.facebook.com/documentation/business-messaging/whatsapp/throughput) |
| Inbound-only cap | none documented | as above |
| Webhook latency target for our server | median < 250 ms, < 1% over 1 s | as above |
| Webhook retries | up to 7 days, exponential backoff, so de-duplicate by message id | as above |
| Messages to one user (pair rate limit, error 131056) | exists; about 1 message per 6 s [1 source, [WATI](https://www.wati.io/en/blog/whatsapp-api-errors-solutions/)] | as above |
| Messaging limit (250 / 2,000 / …) | only business-initiated messages outside the window, so it doesn't apply to us | [messaging limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits) |

80 messages a second is thousands of times our need [assessment]. Answer the webhook with 200 at once and process from a queue.

### 1.6 Spoofing risks and mitigations

**What the sender cannot fake** [assessment]
- The `from` / `wa_id` number. WhatsApp verified it when the account was registered.
- The webhook itself, because it is signed. Verify `X-Hub-Signature-256` with the app secret and reject unsigned requests.

| Risk | Mitigation |
|---|---|
| Guessing another person's pending code | Use about 40 bits: 8 Crockford base32 characters, e.g. `PD-K7Q2-9XMD`. Expire after 10 minutes, use once, bind to the browser session. Each guess costs the attacker a WhatsApp message and runs into the pair limit. |
| **Reverse-OTP phishing**: a scammer tells a victim "send this code to confirm your parcel", and the victim's number lands on the scammer's Peydoo account | Prefill an explicit Persian text: "I am verifying *my own* Peydoo account; nobody gave me this code". Show the masked number on the website for the session owner to confirm. Allow one number per account (`phone_in_use`). Offer a support-led "this is my number" reclaim flow. This risk exists equally in the Telegram bot flow [assessment]. |
| A friend's or relative's phone sends the code | Accepted risk, the same as with Telegram. `phone_in_use` limits it to one account per number. |
| VoIP or virtual numbers on WhatsApp | WhatsApp itself registers any number that can receive its SMS or call [assessment]. Run libphonenumber `getType()` and refuse fixed lines. For +1 numbers (FIXED_LINE_OR_MOBILE), optionally use [Twilio Lookup Line Type Intelligence, $0.008 a request](https://www.twilio.com/en-us/user-authentication-identity/pricing/lookup) as a later step. |
| Contact card of a third party | Accept only `origin: contact_request`, never `other`. |
| Number change or recycled number | A new BSUID is generated on number change, so ask for re-verification. |
| +98 | See §1.7. Refuse in our code too. |
| Desktop users without WhatsApp Desktop | Also show a **QR code** of the wa.me link so they can scan it with their phone. |
| Persian digits or odd formatting in the message | Run `normalizePersian()`, upper-case, ignore spaces and dashes, and search for the code anywhere in the text. |

### 1.7 Iran and the WhatsApp Business Platform

[Meta support docs](https://developers.facebook.com/documentation/business-messaging/whatsapp/support):
- Businesses in Cuba, Iran, North Korea, Syria and three sanctioned regions of Ukraine can't use the platform.
- Users in those places "are not eligible to receive messages sent via the WhatsApp Business Platform".
- Third parties list the blocked codes as +53, **+98**, +850, +963 and +7978 ([Deskpro](https://support.deskpro.com/en-US/guides/admin-guide/channels/whatsapp/whatsapp-country-restrictions)) [1 source].

What this means for us:
- A +98 user could not receive our `request_contact_info` reply.
- Whether their inbound message reaches our webhook at all is unclear [assessment].
- **Keep our own refusal** of IR in the WhatsApp path, exactly as in the bot.
- Turkey has been unrestricted since 15 May 2024.

### 1.8 Proposed flow [assessment]

1. The website creates a code (10 min, single use) and shows a button `https://wa.me/49XXXXXXXX?text=<url-encoded Persian sentence + code>`, plus a QR code.
2. The webhook (signature checked, de-duplicated by message id) finds the code in the text.
   - **With `wa_id`:** parse it with the same rules as SMS (libphonenumber, allowlist, mobile, no IR, no +888). Mark the account verified, store the BSUID, and **send no reply**, so it costs €0. The page polls or uses SSE and shows "verified".
   - **Without `wa_id`:** send one `request_contact_info` message (a service message in the free tier). On a contacts webhook with `origin: contact_request` from the same BSUID, apply the same parse and verify.
3. Don't add a payment method to the Meta account until it is needed. This keeps the cost at €0 by construction.

---

## 2. Can we drop SMS completely?

### 2.1 What data exists

**No survey measures messenger use among Iranians abroad.** What exists:

| Population | WhatsApp | Telegram | Source |
|---|---|---|---|
| Inside Iran, "often" use, 2023 (n = 38,445) | 46% | 43% | [GAMAAN 2023](https://results.gamaan.org/en/survey/iran-media-survey-1402) |
| Inside Iran, users 18+, 2021 | 64.1% | 36.3% | [ISPA via Atlantic Council](https://www.atlanticcouncil.org/in-depth-research-reports/report/iranians-on-socialmedia/) |
| Iranian students, daily use, 2024 | 66.7% | 89.5% | [ISPA via Iran International](https://iranintl.com/en/202410135352) [1 source] |
| Germany, internet users 16+, monthly | 85.1% | – | [DataReportal via OMR](https://omr.com/de/daily/social-media-nutzung-in-deutschland/) [1 source] |
| UK / Turkey, 16+, monthly | 81% / 90.4% | – | [DataReportal Q1 2025 via Exploding Topics](https://explodingtopics.com/blog/messaging-apps-stats) [1 source] |
| Australia / Canada / US, 16+, monthly | 49.1% / 45.3% / 30.1% | – | as above |
| US adults, 2025 | 32% | – | [Pew 2025](https://www.pewresearch.org/internet/2025/11/20/americans-social-media-use-2025) |

**No source covers how many diaspora Iranians keep WhatsApp or Telegram on a +98 SIM.**

### 2.2 Estimate of who has neither messenger on a local number [assessment]

- **Almost every diaspora Iranian has at least one of the two**, because both are the default channels to family in Iran. In 2024 Iran's own students used Telegram (89.5%) and WhatsApp (66.7%) daily, and the diaspora talks to them.
- **The real gap is the +98 number.** People keep the Iranian SIM because Iranian banking and government services send codes to it. Moving WhatsApp or Telegram to a local number loses nothing technically, but people don't bother.
- The share is likely highest among:
  - recent migrants (Turkey; students and skilled workers in Germany, the Netherlands, Sweden, Italy);
  - people who keep one phone with two SIMs.
- It is lowest among long-settled communities in the US, Canada and the UK, where WhatsApp is on the local number or people barely use messengers.
- A North American group of older users has **neither**: WhatsApp is at 30–45% in the general US and Canadian population. But Iranian-Americans contact family abroad, so it is far higher among them.
- **Rough estimate: 5–15% of people who try to verify will fail both messengers.** Maybe up to 20–25% in Turkey, and 3–8% in the US, Canada and the UK.
- Most of these users **can fix it in two minutes without SMS from us** (§2.3, row 1). So the share actually lost is maybe 2–6% [assessment].

### 2.3 Non-SMS fallbacks

| Fallback | Cost to us | Works for | Comment |
|---|---|---|---|
| **Add a second Telegram account on the local number** (Telegram supports "several different accounts at once" in one app; [FAQ](https://telegram.org/faq)), or "Change Number" (chats are kept) | €0 (Telegram sends its own SMS) | anyone with a local SIM | **Best fallback.** Explain it on the refusal screen with a 3-step Persian guide. Telegram refuses landlines ("We currently don't support landline numbers"). |
| **Add a second WhatsApp account** (same app, needs a second SIM or eSIM; [WhatsApp blog](https://blog.whatsapp.com/multiple-accounts-coming-to-whatsapp)), or WhatsApp "Change number" | €0 | dual-SIM phones | Android is solid; iOS reports conflict. |
| **Telegram Login (OIDC) with `phone` scope** (§3.4) | €0 | Telegram users | Same number requirement as the bot, so it doesn't help +98-only users. It is a smoother UX, though. |
| **Telegram Gateway** | $0.01 per code | only numbers already on Telegram | Proves nothing new over the bot (research8 §3a). |
| **Limited email-only account**: browse, save, contact sellers through Peydoo chat with low limits (e.g. 3 new chats a day); **one listing held for manual review**; no events posting | staff time | everyone | Keeps the user, but gives a scammer little. Pair it with Turnstile, email code and device limits (already built). |
| **Card check** (a €0 or €0.01 authorisation via Stripe, like Nextdoor's $0.01 billing-address check: [older third-party](https://www.digitalunite.com/technology-guides/social-networking-blogs/how-join-local-social-network-nextdoor)) | about Stripe card-processing fee [assessment] | card holders | Proves a payment instrument, not a phone. A decent anti-multi-account signal. Stripe fees for card checks need confirming. |
| **ID document + selfie** (Stripe Identity **€1.25 per successful verification**, [Stripe](https://stripe.com/identity); Veriff: reported prices conflict, [CostBench](https://costbench.com/software/kyc-aml/veriff/), [PricingSaaS](https://pricingsaas.com/companies/veriff)) | €1.25+ | ID from 100+ countries | 20–30× the price of an SMS. Only as a "trusted seller" badge, not as phone replacement. GDPR: ID data is sensitive [assessment]. |
| **German eID / eAT** (residence permits have the online ID function) via an eID provider | by quote [assessment] | residents of Germany | Strong, but only for Germany, and people find it awkward. Later, for a "verified" badge. |
| **Video selfie with staff** | about 3–5 minutes of staff time each | everyone | Doesn't scale. Only for appeals. |
| **Vouching by a verified business or community partner** | staff time | niche | Possible for event organisers or shops, not for the mass of users. |
| **Voice OTP** | about the SMS price or more | landlines | Still a telecom cost. Not worth adding before SMS. |

### 2.4 What big marketplaces do

- **Vinted:** email is required for everyone. A phone code (SMS) is used only as 2-step verification "when activity looks unusual" ([Vinted help](https://www.vinted.co.uk/help/537)). This is the closest model to "avoid SMS by default".
- **Craigslist:** a phone code by **voice or text**, only in some categories, US/CA/AU/UK numbers only, **no VoIP**, one number per account, codes at most every 5 minutes ([Craigslist help](https://www.craigslist.org/about/help/posting/verify/phone)) [1 source].
- **Kleinanzeigen** (EU numbers) and **Leboncoin** (French and border-country numbers) **require SMS** ([The Local](https://www.thelocal.fr/20231012/leboncoin-everything-you-need-to-know-about-frances-biggest-sales-website)) [1 source].
- **Facebook Marketplace** relies on Facebook account age and history, and asks for ID only for payouts. Reports are inconsistent and third-party only.
- **Nextdoor** (older sources): postcard, phone call, credit-card billing address, or an invitation from a verified neighbour.

**Pattern** [assessment]: platforms that avoid SMS replace it with **account reputation plus step-up checks when risk shows up**, not with another universal proof.

### 2.5 Recommendation and trigger

**Launch: Telegram (bot, later OIDC) + WhatsApp reverse OTP + limited email-only account.**
- The refusal screen (+98, +888, no messenger) explains how to add a local-number account in Telegram or WhatsApp.
- It also offers "continue with a limited account".
- **Keep the SMS adapter coded and tested, but switched off.**

**Measure from day one** (one event per attempt, with country and reason):
- `verify_started`, `verify_ok_telegram`, `verify_ok_whatsapp`
- `refused_ir`, `refused_888`, `refused_country`, `refused_landline`
- `whatsapp_no_number_declined` (user didn't tap request_contact)
- `chose_limited_account`, `abandoned` (no completion within 24 h)

**Switch SMS on when any of these is true, over a rolling 4 weeks:**
1. Accounts that could not verify by any messenger make up **≥ 5%** of distinct accounts that started verification, or more than **50 accounts a month**. This counts `refused_ir`, `refused_landline` and "no messenger" that didn't recover through the second-account guide within 7 days.
2. Or a country where this rate is **≥ 10%**, typically TR or DE. Switch on for that country only.
3. Or support complaints about verification exceed about 5 a week.
4. Or once usernames launch, the share declining `request_contact_info` passes 5%.

**When it is switched on, offer SMS only behind the refusal screen**, not as a first choice. Use Turnstile, 3 SMS per number a day, country budgets and a prepaid gateway balance.
- Example: 5% of 5,000 verifications is 250 users, times 1.25 SMS at about €0.05, so **about €15 a month**.
- At 20,000 verifications it is **about €60 a month**.
- The owner's "avoid SMS" goal is met in substance either way [assessment].

---

## 3. Telegram bot limits: per bot or per account?

### 3.1 Rate limits are per bot (per token)

- **[Bot FAQ](https://core.telegram.org/bots/faq)** (written about "your bot"):
  - "In a single chat, avoid sending more than one message per second."
  - "In a group, bots are not be able to send more than 20 messages per minute."
  - "For bulk notifications, bots are not able to broadcast more than about 30 messages per second".
  - Ordinary bot messages are free: "bots are able to message their users at no cost".
- **[Bot Developer Terms §6.2.5](https://telegram.org/tos/bot-developers):** "By default, TPA are able to broadcast up to 30 messages per second". TPA, the third-party application, is the bot. Paid broadcasts (up to 1,000 a second, 0.1 Star per message above 30 a second) need ≥ 100,000 Stars **on the bot's balance** and ≥ 100,000 monthly active users, so they are per bot too.
- **No official text links the limits to the owner account.** The limits are per bot token, and the per-chat 1 a second is per bot-and-chat pair [assessment, strongly implied by the wording above]. `getUpdates` also allows one consumer per token (research8 §5).

### 3.2 How many bots one account can own

[Telegram client config](https://core.telegram.org/api/config):
- `bots_create_limit_default` = **20**: "Maximum number of bots that can be owned by non-Premium users".
- `bots_create_limit_premium` = **40**.

[bots.createBot](https://core.telegram.org/method/bots.createBot) returns `BOT_CREATE_LIMIT_EXCEEDED` and suggests that Premium raises the limit. These are fallback defaults that the server can change.

### 3.3 Multiple production bots to spread load?

- **ToS §5.2(f):** "Your TPA must not attempt to circumvent or otherwise undermine Telegram rate limits and moderation". It also must not operate by proxy with other users' Bot API credentials.
- No clause is about owning several bots as such. But **splitting one broadcast over several bots to beat 30 a second fits "circumvent"** [assessment].
- It also **doesn't work technically.** A bot can message only users who started *that* bot. So bot B can't take over sending for bot A's users.
- Splitting users by product purpose is fine, e.g. a verification bot and a separate events-digest bot that users subscribe to on their own [assessment].
- At our scale it is unnecessary. One bot handles about 8–10 verifications a second (research8 §5), and a 100,000-user digest takes about 70 minutes at 25 a second.
- **Risk to keep in mind:** a ban can hit the owner's Telegram account and its other bots (§10). If the owner account is lost, "all TPAs it created may be terminated" (§6.3). So:
  - Own the bots from a dedicated business Telegram account with 2FA.
  - Add a second admin.
  - Don't mix it with personal use.

### 3.4 Staging and production bots: good practice?

**Yes.**
- The [bot features page](https://core.telegram.org/bots/features) suggests testing "without interfering with its users" by running another instance on a separate bot from @BotFather.
- Separate bots are **required** anyway, because one token allows only one `getUpdates` consumer (409 otherwise).
- File IDs are per bot.
- Telegram also has a separate test environment, but flood limits there "are not raised … and may at times be stricter".
- Set a different name and avatar ("Peydoo TEST"), and keep the tokens in separate secrets.

### 3.5 Does request_contact need any message from us beyond the button?

- **At least one message is needed.** The `request_contact` button lives in a `ReplyKeyboardMarkup`, which can only be shown as the `reply_markup` of a message we send. `KeyboardButton.request_contact`: "If True, the user's phone number will be sent as a contact when the button is pressed. Available in private chats only." ([Bot API](https://core.telegram.org/bots/api), version 10.3, 24 Aug 2026)
- So the minimum is the deep link → `/start <token>` → **one prompt message with the button**.
- The confirmation message after the contact arrives is optional, because the website can show "verified". It is still useful to send a short reply with `remove_keyboard`, which needs a message too. The current code sends exactly these 2 messages.
- All bot messages are free.

### 3.6 New option: "Log In With Telegram" (OpenID Connect) with a verified phone

[core.telegram.org/bots/telegram-login](https://core.telegram.org/bots/telegram-login):

**How it works**
- Standard OIDC Authorization Code Flow with PKCE, issuer `oauth.telegram.org`.
- The client ID and secret come from @BotFather → Login Widget → Allowed URLs.
- Scopes:
  - `openid`: required.
  - `profile`.
  - **`phone`**: "the user's verified phone number", which "Requires user consent". It comes as the claim `phone_number` (digits without "+", e.g. `"971577777777"`), with `phone_number_verified: true` in the example.
  - `telegram:bot_access`: lets our bot message the user after login, useful for our chat notices.
- ID tokens are signed RS256 by default. Keys are at `https://oauth.telegram.org/.well-known/jwks.json`.
- Choosing EdDSA or ES256K blocks the `profile` and `phone` scopes.
- It is "a free and open platform", with no fees and no rate limits stated.
- A popup flow; a `Cross-Origin-Opener-Policy: same-origin` header breaks it.
- **No launch date found.**

**What it means for Peydoo** [assessment]
- It does the same job as the bot: proves the Telegram account's number.
- The user never leaves for a chat and we send no message.
- Validate the token server-side, then apply the same parse and refusal (IR, +888, allowlist, mobile).
- Store `sub` / `id` as the Telegram identity.
- **Worth a prototype as the first-choice Telegram path**, keeping the bot as fallback. Check first whether it needs the Telegram app installed on desktop.

---

## Corrections and confirmations to research8-phone.md

| research8 claim | Status |
|---|---|
| Inbound WhatsApp messages free; per-message pricing since 1 Jul 2025 | **Confirmed.** |
| Since 1 Oct 2026, service replies free only for the first 1,000 a month per number, then local rate (DE $0.055) | **Confirmed.** Precisely: 1,000 *delivered service messages* per *business phone number* per month, no rollover. The service rate equals the utility rate [1 source, Twilio mirror]. **New:** without a payment method, messages above the tier are not delivered rather than billed, so cost can be capped at €0. |
| Same date ended free utility messages inside the window | **Confirmed** (`free_customer_service` → `regular`). |
| Usernames: first contact usually arrives without the number; use REQUEST_CONTACT_INFO; accept only `origin: contact_request` | **Confirmed.** Added: the 30-day and contact-book rules are evaluated *per business phone number*; BSUID is regenerated on number change; user usernames are reservation-only so far (not confirmed live). |
| Number requirement "not used in the WhatsApp app, can receive SMS or a call" | **Confirmed.** Landline, VoIP and toll-free are allowed, with voice verification recommended. New portfolios can register 2 numbers. |
| New portfolios 250 business-initiated a day | **Confirmed.** Doesn't apply to replies inside the window, so business verification is optional for reverse OTP. |
| Policy: no Meta rule for or against | **Confirmed** against the 23 Sep 2026 policy. Added: escalation-path requirement and the commerce-policy note. |
| Telegram limits 1/s per chat, 30/s bulk, paid broadcasts need 100k Stars + 100k MAU | **Confirmed.** Added: they are **per bot**, per ToS §6.2.5. |
| (not in research8) Meta blocks Iran on the Business Platform | **New.** |
| (not in research8) Telegram OIDC login with verified `phone` scope | **New.** |
| (not in research8) BotFather limit | **New:** 20 bots, or 40 with Premium. |

---

## 8. Iran and WhatsApp business number bans

Question: does Meta block or ban a business number because people in Iran, or with +98 numbers, write to it?

**Short answer.**
- I found **no rule saying a business abroad must not *receive* messages from Iran**.
- I found **no report of a number banned for that reason**.
- Meta says it filters these users out itself. The documented sanctions rules target the **business** being in, or acting for, a restricted country.
- Enforcement is automated and opaque, so a residual risk remains [assessment].

### 8.1 What the official texts say

| Document | What it says on sanctions or Iran | Consequence it names |
|---|---|---|
| **Cloud API support docs, "Country restrictions"** ([link](https://developers.facebook.com/documentation/business-messaging/whatsapp/support)) | "Businesses in Cuba, Iran, North Korea, Syria, and three sanctioned regions in Ukraine (Crimea, Donetsk, Luhansk) are not eligible to use the WhatsApp Business Platform." <br>"WhatsApp Messenger (WhatsApp) and WhatsApp Business app users in Cuba, Iran, … are not eligible to receive messages sent via the WhatsApp Business Platform." <br>Under "Message not delivered": "The customer is in a restricted or sanctioned country", and "we will not disclose the underlying cause". | **None for the business.** The message just isn't delivered. Nothing about warnings or quality rating. |
| **WhatsApp Business Messaging Policy** (23 Sep 2026, [link](https://whatsappbusiness.com/policy/)), which now also holds the Commerce Policy (whatsapp.com/legal/commerce-policy redirects there) | No mention of sanctions, embargoes or Iran. Regulated goods are allowed only "in limited countries". | General: "We may limit or remove your access …", "we may prohibit you and your organization from all future use". |
| **WhatsApp Business Platform terms** (effective 23 Sep 2026, [link](https://www.whatsapp.com/legal/WhatsApp-Terms-for-WhatsApp-Business-Platform)) | No sanctions clause. §4: the company must comply with all applicable law. | §9: may "suspend, or terminate" if the company "creates harm, risk, or possible legal exposure for us". |
| **Meta Terms for WhatsApp Business Platform** (23 Sep 2026, [link](https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform)) | No sanctions clause. §4.3: the platform "may not be available in all locations". | §5.3: Meta may "immediately suspend or terminate" access if needed to "comply with applicable laws". |
| **Meta Commercial Terms** (6 Mar 2024, [link](https://www.facebook.com/legal/commercial_terms); these apply to Meta business tools) | You may not use Meta products "if you are located in a country that is subject to embargo under the laws of the United States", or if you are on the SDN list. | Access not allowed. |
| **WhatsApp Business *app* terms** (23 Sep 2026, [link](https://www.whatsapp.com/legal/WhatsApp-Terms-for-WhatsApp-Business-App)), §15 Legal Compliance | The company must follow "all applicable U.S. and non-U.S. export control and trade sanctions laws". It may not use the app if located in, or owned or controlled from, "a restricted country". It may not use it "for the benefit or on behalf of a restricted country". It may not disguise its location by "IP proxying or other methods". | §6: may "limit, throttle, suspend, or terminate Company's account". |
| **Cloud API error codes** ([link](https://developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes)) | `130497`: "The WhatsApp Business Account is restricted from messaging to users in certain countries" (tied to business category). `131026`: "Unable to deliver message". **No error code specific to sanctioned countries.** | – |
| **Policy enforcement** ([link](https://developers.facebook.com/documentation/business-messaging/whatsapp/policy-enforcement)) | Escalating blocks are for repeat violations such as "spam, template misclassifications, or high-risk policy categories": 1–3 days on templates → 5/7/30 days on all messages → account lock → permanent disable. Appeals take 24–48 h. The `account_update` webhook reports violations. **Sanctions or Iranian users are not listed as a trigger.** | as stated |

**Reading** [assessment]:
- Every sanctions rule is about **who the business is and where it operates**: located in, owned or controlled from, or acting "on behalf of" a restricted country, or hiding its location by proxy.
- On the user side, Meta's documented answer is **non-delivery, not punishment of the business**.
- A German business serving Iranians *abroad*, who use non-Iranian numbers, is not acting "on behalf of" Iran.

### 8.2 Does Meta deliver inbound messages from +98 users to the Cloud API?

- **Probably not.** Twilio, an official Meta partner, says WhatsApp blocks numbers from Crimea, Cuba, **Iran (+98)**, North Korea and Syria from communicating with WhatsApp business numbers, and that end users with such numbers are excluded too.
  - Search snippets of Twilio's [WhatsApp countries article](https://support.twilio.com/hc/en-us/articles/360051177134-What-countries-can-I-reach-with-the-Twilio-API-for-WhatsApp) also say the restriction follows the **number, not the location**. The page itself returned 403 to me, so this is [1 source, not read in full].
- For Twilio's own traffic: WhatsApp and RCS to "recipients whose numbers begin with `+98`" are blocked, also `+53`, `+963`, `+7978`, `+850`. Twilio stopped all traffic to Iran on **15 Mar 2025** ([21408](https://www.twilio.com/docs/api/errors/21408), [63058](https://www.twilio.com/docs/api/errors/63058)).
- Meta's own page speaks only of users "in" these countries **receiving** messages. It doesn't say how location is decided, or whether inbound is filtered. So: **expect that a +98 user's message either never arrives (one grey tick on their side) or arrives and our replies fail silently** [assessment].
- **Users physically in Iran with a foreign number** (e.g. a diaspora member visiting) may also be filtered, if Meta uses location. This is undocumented [assessment].

**Can we ignore or reject them without penalty?** Yes, as far as the docs go.
- Quality is based on "user feedback signals such as blocks, reports, mutes, archives" on messages *we send* ([send messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages)). Not replying generates none of these.
- No rule requires a reply. The policy asks only for an escalation path, so put a support link on the website.
- Optionally we can **block** the sender via the [block users API](https://developers.facebook.com/documentation/business-messaging/whatsapp/block-users): only users who wrote in the last 24 h, up to 64,000 blocked.
- **Never send to +98.** It fails anyway (`131026` or silent non-delivery), and a pattern of sending to sanctioned numbers is the one behaviour that could look like serving a restricted country [assessment].

### 8.3 Reports of bans, 2022–2026

- **I found no report** on Reddit, Stack Overflow, Meta's developer community, news, or Persian blogs (Zoomit, Digikala Mag, Shahrsakhtafzar) of a **business abroad** being banned because users from Iran or with +98 numbers wrote to it.
  - Vendor ban guides (respond.io, Fyno, YCloud and others) list spam, user blocks and reports, missing opt-in, unofficial bulk tools and prohibited categories as causes.
  - One vendor blog says that "operating from or sending messages to" Iran and similar countries is prohibited ([Fyno](https://www.fyno.io/blog/why-is-my-whatsapp-business-number-banned-a-complete-guide-cm3wtf4m4007ijdc77805mylu/)) [1 source, vendor].
- **Businesses *in* Iran:** Persian sources say the Business **API** is officially unavailable in Iran and used only through risky intermediaries ([sadima.ir](https://sadima.ir/features-whatsapp-business/)) [1 source]. Yet Iranian shops use the WhatsApp Business **app** widely ([Digikala Mag](https://www.digikala.com/mag/whatsapp-business-guide/)).
- I could not search Telegram channels.
- **The owner's earlier incident.** Without the error text it can't be pinned down. The most likely causes are, in order [assessment]:
  1. it was the **Business app**, with user reports or blocks, bulk sending, or many new chats;
  2. the number or Meta account was used from an **Iranian IP or through a VPN or proxy**, which the app terms (§15) explicitly forbid;
  3. the account looked Iran-operated: +98 numbers on the account, Iranian admin logins, or payment or verification documents tied to Iran.
  
  Receiving messages from +98 users alone is not a documented trigger. If the owner still has the ban notice or the error code (`368`, `131031`, `130497`), it would settle this.

### 8.4 Mitigation for Peydoo's reverse-OTP plan

| Measure | Value | Comment |
|---|---|---|
| **Separate number used only for verification**, ideally in its **own WhatsApp Business Account**. Support runs elsewhere (email or web, or a second number) | High | A restriction on one number or account then hits only WhatsApp verification. Meta can act at business or organisation level ("prohibit you and your organization"), so this limits but doesn't remove the shared risk [assessment]. |
| **Send nothing to +98**, and no replies at all except `request_contact_info` to username users | High | Keeps quality signals near zero. The platform blocks +98 delivery anyway. |
| **Refuse +98 in our code**, and optionally block the BSUID or number via the API | High | Already planned (§1.8). |
| **Show the WhatsApp button only when the account's chosen country is on the allowlist.** Hide it for IR IPs and the `Asia/Tehran` time zone | Medium | Mainly UX, because such users would fail anyway. Show Telegram instead. Don't treat the time zone as hard proof, since diaspora users sometimes keep it [assessment]. |
| **Operate Meta Business Manager and the number only from outside Iran, never through VPN exits in Iran**, with no Iranian admins, payment methods or documents | High | This is the one documented sanctions trigger (location and "IP proxying"). |
| **Subscribe to `account_update`** and check the Health Status API. Alert the owner on any violation | Medium | Early warning; appeal within 24–48 h. |
| **Telegram stays the primary channel. SMS adapter dormant**, switchable per country | High | A WhatsApp ban then costs some conversion, not the sign-up flow. |
| Clear prefilled text and website copy ("for people living outside Iran") | Low–medium | Makes it plain the service is not for Iran. |

### 8.5 Honest risk assessment [assessment]

- **Chance that inbound +98 messages get our Cloud API number banned: low.**
  - Meta documents non-delivery, not penalties, for sanctioned users.
  - Partners say +98 is filtered at the platform level.
  - Ignoring messages leaves no quality signals.
  - No case report exists.
- **Chance of *some* WhatsApp restriction over a year: low to medium.**
  - Meta's enforcement is automated and opaque.
  - Peydoo is Persian-language and Iran-adjacent.
  - A small share of users may report the verification number as spam.
- **Impact if it happens: moderate and limited**, provided WhatsApp is a secondary channel on its own number, Telegram is primary, and SMS can be switched on within a day.
- **Conclusion:** go ahead with reverse OTP as planned, with the dedicated number, nothing sent to +98, and admins operating only from outside Iran.
