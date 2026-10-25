# Peydoo: phone verification costs and options (research, 25 Oct 2026)

Scope: SMS, WhatsApp, Telegram Gateway, other methods, Telegram Bot API limits, and a recommendation. Prices are list prices fetched 25 Oct 2026, net of VAT, one SMS segment. For conversions I assumed **€1 ≈ $1.15**. "[1 source]" marks a figure that only one source confirms, or that comes from a third party.

**Two findings from the repo (not from the web):**
- **The +98 refusal only works for SMS.** In `src/modules/users/phone-number.ts`, SMS is limited to the seeded countries, and Iran (IR) is not seeded. But `telegramNumberToE164()` accepts any number, so a Telegram account on +98 (or on an anonymous Fragment **+888** number) is accepted today. The bot needs the same refusal (see §6).
- Many people in the diaspora keep WhatsApp and Telegram on their old **+98** SIM. For them, both free messenger methods will be refused, so SMS to their local SIM is the real fallback. Expect this share to be noticeable.

---

## 1. SMS: price per message

### Cheap EU gateways (price per SMS, EUR)

| Country | GatewayAPI standard ([price list JSON](https://gatewayapi.com/api/prices/list/sms/json)) | seven.io ([country list](https://www.seven.io/en/full-sms-pricelist/)) | Firebase / Identity Platform, USD per SMS sent ([pricing](https://cloud.google.com/identity-platform/pricing)) | Twilio SMS, USD (reference) |
|---|---|---|---|---|
| DE | 0.0722 | 0.075 | 0.10 | [0.112](https://www.twilio.com/en-us/sms/pricing/de) |
| AT | 0.0416 | 0.075 | 0.03 | – |
| NL | 0.0669 | 0.075 | 0.10 | – |
| IT | 0.0401 | 0.075 | 0.05 | – |
| SE | 0.0422 | 0.075 | 0.05 | – |
| FR | 0.0428 | 0.075 | 0.07 | – |
| UK | 0.0378 | 0.075 | 0.04 | [0.056](https://www.twilio.com/en-us/sms/pricing/gb) |
| CA | 0.0201 | 0.075 | 0.01 | – |
| US | 0.0201 (+ rented US number required) | 0.075 | 0.01 | 0.0083 + carrier fees |
| AU | 0.0242 | 0.075 | 0.02 | – |
| TR | 0.0061 (2017 price, doubtful) | 0.075 | 0.01 | [0.0305](https://www.twilio.com/en-us/sms/pricing/tr) |
| IR (refuse) | 0.2736 | 0.306 | 0.19 | – |

Notes on the providers:
- **seven.io** charges a flat **€0.075 per SMS** to all 11 countries, with discounts by quote from 10,000 SMS a month ([prices page](https://www.seven.io/en/prices/)). It was the planned provider, but it is the **most expensive** cheap option everywhere except Germany.
- **GatewayAPI** has no subscription. The US needs a rented virtual number, and countries that require short codes add monthly fees ([pricing](https://gatewayapi.com/pricing/)). The DE, NL, FR, IT and UK prices were updated 15 Oct 2026.
- **Firebase / Identity Platform** bills per SMS **sent**, not per verification. The first 10 SMS a day are free (about 300 a month). It is the cheapest option in North America, Austria, Australia and Turkey. The catch: it is Google's flow (Firebase JS SDK plus reCAPTCHA, Google's SMS text), not our own HMAC code. Its SMS region policy can block +98.
- **Plivo** charges [$0.095](https://www.plivo.com/sms/pricing/de/) to DE. **Sinch** publishes only US and Canada (US $0.0078 plus carrier fees; [pricing](https://sinch.com/pricing/sms/)). **Infobip** and **BulkSMS** show prices only in calculators or by quote, not in a public list.
- **Persian text is Unicode, so 70 characters per segment.** seven.io bills each extra segment ([prices page](https://www.seven.io/en/prices/)). Keep the OTP SMS short, or send it in Latin script.

### Verification APIs (fee per verification plus the channel cost)

| API | Fee | Channel | Example all-in price |
|---|---|---|---|
| **Twilio Verify** | $0.05 per *successful* verification; Fraud Guard included | SMS at Messaging rates (US $0.0083); WhatsApp at Meta's rate | DE ≈ $0.162, US ≈ $0.058 ([pricing](https://www.twilio.com/en-us/verify/pricing)) |
| **Vonage Verify** | ≈ €0.052 per successful verification, plus channel cost [1 source] | SMS, WhatsApp, voice, silent auth | official page refused access (403); figure from [Authgear](https://www.authgear.com/post/best-otp-service-providers/) |
| **Plivo Verify** | $0 (also Fraud Shield $0; failed or fraudulent attempts not charged) | SMS (DE from $0.095), voice, WhatsApp | DE ≈ $0.095 ([pricing](https://www.plivo.com/verify/pricing/)) |
| **Telnyx Verify** | $0.03 per successful verification ("from $0.05" headline) | SMS, voice, flash call, WhatsApp | ([pricing](https://telnyx.com/pricing/verify-api)) |
| **Prelude** | €0.032 per verification (pay as you go), messages "at cost" | DE: SMS €0.0574, WhatsApp €0.0456, Telegram €0.012. UK: SMS €0.0258. US: SMS €0.0039 | DE ≈ €0.089, UK ≈ €0.058, US ≈ €0.036 ([pricing](https://prelude.so/pricing), [DE](https://prelude.so/countries/de), [UK](https://prelude.so/countries/gb), [US](https://prelude.so/countries/us)) |
| **Firebase Phone Auth** | none, only the per-SMS price above | SMS only | DE $0.10, US $0.01 |

### Registration rules that add cost or delay

- **US.** No alphanumeric sender ID. You need either A2P 10DLC (brand fee about $4 one-off, standard brand with vetting about $41.50–48.51, campaign about $10 a month, plus carrier fees; normally an EIN; [1 source, vendor fee lists](https://apeiron.io/docs/messaging/10dlc_industry_fees)) or a **verified toll-free number** (unverified toll-free has been blocked since 31 Jan 2024; [Twilio](https://support.twilio.com/hc/en-us/articles/20212966914075-Toll-Free-Verification-and-Developers-Navigating-the-New-Restrictions)). Twilio says that **Verify replaces your own 10DLC registration** for OTP traffic ([Twilio 10DLC docs](https://jp.twilio.com/docs/sms/a2p-10dlc)). This is the main reason to use a verification API, rather than a raw gateway, for +1 numbers.
- **Canada.** Also no alphanumeric sender ID: long code, toll-free (needs verification) or short code (Sinch lists a CAD 1,500 filing fee, then CAD 350 a month; [Sinch](https://sinch.com/pricing/sms/)).
- **UK.** Alphanumeric sender ID works, but registration is needed, free of charge ([Prelude UK](https://prelude.so/countries/gb)).
- **France.** Since 1 Mar 2026 the sender ID must be Latin characters only, and generic names are refused. Whether registration is mandatory is disputed: LINK Mobility says yes, Telnyx says no. Sending A2P from French mobile numbers is not allowed ([LINK Mobility](https://www.linkmobility.com/news/france-updates-sms-sender-id-requirements-from-march-2026), [Telnyx](https://support.telnyx.com/en/articles/6531603-france-sms-guidelines)).
- **Australia.** The ACMA SMS Sender ID Register is **mandatory from 1 Jul 2026**. Registering needs an ABN, so a foreign sender goes through a provider. Unregistered alphanumeric IDs show as "Unverified" or are blocked, while numeric senders are unaffected ([Nexon](https://nexon.com.au/news/new-sms-sender-id-register-requirements-take-effect-from-1-july-2026/), [HWL Ebsworth](https://hwlebsworth.com.au/identity-crisis-new-acma-rules-for-sms-communications-and-the-sender-id-register/)).
- **Germany** needs no registration ([Prelude DE](https://prelude.so/countries/de)).

### SMS pumping
Bots request codes to premium or colluding numbers, and the operators share the revenue. Twilio's advice is to turn off every country you don't serve (Geo Permissions) and use Fraud Guard, which is free in Verify and blocks suspicious prefixes ([docs](https://www.twilio.com/docs/verify/preventing-toll-fraud/sms-fraud-guard.md)). In **Aug 2026** Twilio switched **Italy** to "monitor for fraud" by default after a pumping wave ([changelog](https://www.twilio.com/en-us/changelog/Verify_Geo_Permission_Update)). Italy is on our list, so cap it.

Plivo and Twilio Verify don't charge the verification fee for failed attempts, but the SMS itself is still paid. A raw gateway has no protection at all, so our own limits are what protect us: the country allowlist, mobile-only numbers, 3 SMS per number per day, and Turnstile.

---

## 2. WhatsApp

### (a) Business-sent authentication template (Cloud API)
Since 1 Jul 2025 Meta charges **per delivered message**, and messages from users are free ([Meta pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)). Current USD authentication rates per message, from Twilio's mirror of Meta's rate card ([CSV](https://www.twilio.com/content/dam/twilio-com/pricing-data/en/WhatsAppPricing-pricing-details.csv)):

| DE | NL | FR | IT | UK | AT | SE | AU | CA | US | TR |
|---|---|---|---|---|---|---|---|---|---|---|
| 0.055 | 0.050 | 0.030 | 0.030 | 0.022 | 0.0171 | 0.0171 | 0.0113 | 0.0034 | 0.0034 | 0.0009 |

- None of the 11 countries has an authentication-international rate. North America got cheaper on 1 Jan 2026 and Turkey on 1 Apr 2026. Volume tiers lower the rate by about 5–15%.
- Rates are cheaper than SMS everywhere, and especially in TR, US, CA and AU. **DE and NL are barely cheaper than SMS.**
- **Requirements:**
  - Meta Business portfolio and Cloud API app, plus a phone number not used in the WhatsApp app (it can receive SMS or a call for registration).
  - Display name review.
  - New portfolios can start 250 business-initiated conversations a day. Business verification (or 2,000 good messages) raises that to 2,000, then 10k, 100k and unlimited ([limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits)).
  - A fixed template, "<code> is your verification code", with an optional security note and expiry. Buttons are **copy code**, **one-tap** (needs an Android app, or autofill suggestions on iOS 26+) or **zero-tap** (Android only) ([auth templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/authentication-templates)). For a website, that means copy code.
  - The user must have opted in.

### (b) User-initiated ("reverse OTP"): wa.me/<our number>?text=<token>
- **Cost.** The user's message is **free**. We don't have to answer in WhatsApp, because the web page shows the result. But since **1 Oct 2026, service replies are free only for the first 1,000 a month per number**; after that they cost the local rate (e.g. DE $0.055) ([Meta pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)). The same date ended free utility messages inside the 24-hour window.
- **Policy.** I found no Meta rule that allows or forbids it explicitly. Meta requires an authentication template only for codes *the business sends* ([best practices](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/authentication-best-practices/)). The user starts the chat, so no business-initiated opt-in is involved. Low risk, but not something Meta has confirmed.
- **Main weakness: WhatsApp usernames (2026).** Business-scoped user IDs have appeared in webhooks since Apr 2026. For a user who turns on a username, `wa_id`/`from` (the phone number) is **left out** unless we interacted with them in the last 30 days or have them in the contact book. A first contact therefore usually arrives **without the number** ([Meta BSUID docs](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids)).
  - The fix is the analogue of Telegram's request_contact: answer with an interactive **`REQUEST_CONTACT_INFO`** button. A tap shares the user's own number, and the contacts webhook carries `origin: contact_request`; a contact shared by hand arrives with `origin: other`. **Accept only `contact_request`**, like our `contact.user_id == from.id` check.
  - That reply is a service message, so it falls under the 1,000-a-month free tier.
- **Spoofing.** The sender can't fake the number. It is the number WhatsApp itself verified, and webhooks are signed (`X-Hub-Signature-256`). But:
  - It is the **WhatsApp account's** number. That can be a VoIP number, a recycled number, or +98.
  - Users whose WhatsApp is on another number verify that number.
  - Desktop users without WhatsApp Desktop can't open wa.me.
  - The link must carry a long random token. A friend could send it from their phone, which is the same risk as the Telegram flow, and `phone_in_use` limits it.
  - It needs a **public webhook** on the web app (the worker has none) and must bypass Access.

### (c) Through providers
- Twilio Verify WhatsApp: **$0.05 + Meta's rate** (DE ≈ $0.105) ([pricing](https://www.twilio.com/en-us/verify/pricing)).
- Prelude: **€0.032 + €0.0456** (DE) ([Prelude DE](https://prelude.so/countries/de)).
- seven.io: +€0.005 per message on top of Meta's fee ([prices page](https://www.seven.io/en/prices/)).
- Twilio Programmable WhatsApp: +$0.005 per message ([pricing](https://www.twilio.com/en-us/whatsapp/pricing)).

Running the Cloud API directly is cheaper than any of these.

---

## 3. Telegram

### (a) Telegram Gateway
- **Price.** **$0.01 per delivered code**. The Mar 2025 "2.0" update made it "20% more cost-effective", and testing on your own number is free ([Gateway](https://core.telegram.org/gateway), [blog](https://telegram.org/blog/star-messages-gateway-2-0-and-more)).
- **Refunds.** A code not delivered within your `ttl` (30–3,600 s) is refunded automatically. Revoked codes aren't refunded ([API](https://core.telegram.org/gateway/api)).
- **Payment.** You buy credits **through Fragment** (Telegram's crypto platform, in practice TON). Purchases are final, credits expire after 3 years, and prices vary by country and can change without notice ([ToS](https://telegram.org/tos/gateway)). That is awkward for a German sole trader's bookkeeping.
- **Requirements.** E.164 numbers; the user must have a Telegram account on that number and have opted in.
- **Presence oracle.** `checkSendAbility` costs nothing when the number can't receive and charges one message when it can. Our own server learns whether the number is on Telegram; Telegram doesn't reveal the number itself.
- **It proves exactly what our free bot already proves** (a Telegram account holds this number). The only gain is a smoother flow: type the number, get the code in Telegram, no bot to start. So it is optional.

### (b) Bot request_contact (current)
- **Free.** Bots message users at no cost ([Bot FAQ](https://core.telegram.org/bots/faq)). The `contact.user_id == from.id` check is the right one.
- **Gaps.**
  - It accepts any country, including **+98** and the anonymous **+888** Fragment numbers.
  - Telegram also allows VoIP numbers.
- **Fix.** Apply the same parse to bot numbers: libphonenumber, a country allowlist, mobile-only, and refuse IR and +888.

---

## 4. Other methods

- **Flash call / missed call.** No public per-call price found (Telnyx: $0.03 + voice; [Telnyx](https://telnyx.com/pricing/verify-api)).
  - Operators lose SMS revenue to it and are moving to block or charge for it ([MEF](https://mobileecosystemforum.com/2023/03/17/lanck-telecom-spotlight-on-flash-calls/), [TechRadar](https://www.techradar.com/news/flash-calling-is-set-to-cost-operators-billions-in-the-coming-years)).
  - Browsers and iOS can't read the call log, so users type the digits themselves.
  - **Not for a website.**
- **Silent network authentication** (Twilio SNA, Vonage Silent Auth). The carrier checks the SIM over mobile data, and the price is a per-country channel fee ([Twilio](https://www.twilio.com/en-us/verify/pricing)). It works only on mobile data and with supporting carriers. It is overkill at our size.
- **Voice OTP.** Billed per minute, usually at or above the SMS price. It is a fallback for landlines only.
- **Email only with risk scoring.** Free, but it doesn't stop multi-accounts. We already have the email code, Turnstile and limits for new accounts.
- **Passkeys.** These are sign-in, not proof of a phone number. Twilio passkeys are still a pilot.
- **What others do.**
  - **Kleinanzeigen:** SMS code (6 digits), required first in risky categories, later reportedly for all accounts; **EU numbers only** ([TECHBOOK](https://www.techbook.de/mobile-lifestyle/ebay-kleinanzeigen-sms-tan), [t3n](https://t3n.de/news/?p=1593950) [1 source]).
  - **Vinted:** email required, phone by SMS (4 digits) as 2-step verification when activity looks unusual ([Vinted help](https://www.vinted.com/help/537)).
  - **Divar:** SMS code to an Iranian mobile at login ([unofficial client](https://pypi.org/project/Divar) [1 source]).

---

## 5. Telegram Bot API limits ([FAQ](https://core.telegram.org/bots/faq), [API](https://core.telegram.org/bots/api), Bot API 10.3, 24 Aug 2026)

- **Per chat:** about 1 message a second; short bursts are tolerated, then 429.
- **Per group:** 20 messages a minute.
- **Overall (bulk):** about **30 messages a second**.
- **Paid broadcasts:**
  - `allow_paid_broadcast` raises the rate to 1,000 a second, at **0.1 Star per message above the free 30 a second**.
  - It needs **≥100,000 Stars on the bot's balance and ≥100,000 monthly active users**, so it is **not available to us**.
- **429 errors:** the answer carries `parameters.retry_after` (seconds). Wait at least that long before retrying; repeated floods get longer bans.
- **getUpdates:**
  - `limit` 1–100 (default 100).
  - `timeout` 0 by default, so set about 30–50 s for long polling.
  - Only one consumer per token (a second one gets 409).
  - It doesn't work while a webhook is set.
- **Webhook:** `max_connections` 1–100, default 40.
- **request_contact:** works in private chats only. There is no documented separate limit on it or on new bots.

**What this means for Peydoo:**
- One verification takes about 2–3 bot messages (the button after `/start`, then confirmation or error). At a safe 25 messages a second, that is about **8–10 verifications a second, ~500 a minute, ~30,000 an hour**. That is far above 20,000 a month, and polling is never the bottleneck (100 updates per call).
- **A weekly events digest must be throttled:** queue it at ≤25 messages a second, at most 1 a second per chat, and honour `retry_after`.
  - 10,000 users take about 7 minutes; 100,000 about 70 minutes.
  - Run it as a low-priority worker queue, so verification replies always go first.
  - Treat 403 "bot was blocked" as an unsubscribe.

---

## 6. Recommendation: a cheapest-first ladder

1. **Telegram bot contact (free, already built).** Add the refusal: IR (+98), +888, non-mobile numbers, and countries outside the allowlist. Show "your Telegram number is Iranian: use SMS with your local number".
2. **WhatsApp user-initiated (free).**
   - The user taps the wa.me link with a token.
   - If the webhook has no `wa_id`, we answer with `REQUEST_CONTACT_INFO` and accept only `origin: contact_request`.
   - Same refusal as step 1; replies come out of the 1,000-a-month free tier.
   - Setup: a Meta portfolio, a dedicated number (a few €/month), a public signed webhook.
3. **SMS to the local SIM (paid).**
   - **GatewayAPI** for Europe (DE €0.072, UK €0.038, the rest ≈ €0.04, NL €0.067).
   - For **+1** use a verification API that removes 10DLC/toll-free work, or Firebase ($0.01): **Twilio Verify** ≈ $0.058 per US verification, **Prelude** ≈ €0.036, or Firebase.
   - Keep Turkey closed until needed. Turkey via WhatsApp costs $0.0009, so WhatsApp covers it.
   - **seven.io (flat €0.075) is the most expensive of the cheap options outside DE**, so drop it as the default.
4. **Optional:**
   - **Telegram Gateway ($0.01)** only if bot conversion turns out to be poor.
   - A **WhatsApp authentication template** as a cheaper channel than SMS in AU, CA, US and TR.

**Estimated monthly cost.**
- Assumptions:
  - Country mix: DE 35%, US 10%, CA 8%, UK 8%, SE 7%, NL 6%, TR 6%, AU 6%, AT 5%, FR 5%, IT 4%.
  - 1.25 SMS sent per SMS verification (resends).
  - Ladder split: 70% Telegram, 15% WhatsApp, 15% SMS.
- Weighted SMS price: GatewayAPI ≈ €0.047, cheapest provider per country ≈ €0.043, seven.io €0.075.

| Verifications a month | All SMS, seven.io | All SMS, GatewayAPI | **Ladder (15% SMS)** | Ladder with the 15% WhatsApp share as templates instead of free reverse |
|---|---|---|---|---|
| 1,000 | €94 | €58 | **≈ €9** | ≈ €13 |
| 5,000 | €469 | €291 | **≈ €44** | ≈ €65 |
| 20,000 | €1,875 | €1,163 | **≈ €175** | ≈ €260 |

Add a dedicated WhatsApp number (about €5–10 a month). If US traffic goes through a verification API, add about $0.05 per US verification on Twilio, or about €0.03 on Prelude. If the free messenger share is only 50% instead of 85%, the ladder costs about 3× more (≈ €29 / €145 / €580 a month).

**Anti-fraud limits, in addition to the existing ones:**
- **Number checks.** One country allowlist, parsed with libphonenumber, for every channel; mobile only; refuse IR and +888, and VoIP where libphonenumber can tell.
- **SMS limits.**
  - Keep SMS at 3 a day per number and add a per-country daily budget (e.g. IT and TR low) with an owner alert at 2× normal.
  - Add a global SMS cap a day (e.g. 3× the 7-day average).
  - Require Turnstile before an SMS.
  - Use a separate low credit balance at the gateway. Prepaid gateways limit the damage.
- **Unchanged rules.** One phone per account (`phone_in_use`) and "one Telegram/WhatsApp identity per account" stay. Store the WhatsApp BSUID like `telegram_user_id`.
