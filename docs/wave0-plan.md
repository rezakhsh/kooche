# Wave 0 build plan: what must be live before Berlin opens

Oct 26, 2026 · for the owner's approval · no app code changed yet · branch `wave0` (`/root/classifieds-wave0`)

Sources: `docs/progress.md` ("Owner decisions and preferences from the design research"), `docs/design-options.md` rounds 11 → 7, the plan page `docs/design-options/launch-plan.html` (version 6, which holds round 12), the round 12 mockups in `docs/design-options/mockups/final/`, the research where needed, and today's code.

## In short

| # | Item | Days (estimate) |
| --- | --- | --- |
| 1 | Only Berlin open: Austria closed, other German cities on a waitlist | 3–3.5 |
| 2 | Telegram: refuse +98, +888 and numbers outside the allowlist; Telegram login with the phone scope as the main check, the bot as fallback | 3–3.5 |
| 3 | WhatsApp check where the user sends us a code (SMS stays built but off) | 3 |
| 4 | Founding Pro that never charges by itself after 6 months | 2–2.5 |
| 5 | Iran read-only, with the new wording | 1.5–2 |
| 6 | Withdrawal button for consumer purchases (checked: missing, needs building) | 2 |
| 7 | Docs, staging deploy, checks on a phone-size browser | 1 |
| | **Total** | **16–18 working days** |

The plan page said 7–10 days for wave 0. It grew because the city waitlist moved into wave 0 (it was wave 2), Telegram login was added after the 25 Oct test, and the withdrawal button turned out to be missing. Ways to cut it are under "Decisions I need from you".

**Build order** (each step: tests, commit, push to `wave0`, merge to `main` = staging deploy, check on staging):
1. Telegram bot refusal (the known gap, smallest step)
2. Austria closed and Berlin-only posting
3. Iran read-only
4. Telegram login
5. WhatsApp
6. Founding Pro
7. Withdrawal button
8. Waitlist pages and the admin "Countries and cities" page

Production gets nothing until you ask for `peydoo-promote`.

---

## 1. Only Berlin open

**What you get**
- Austria is closed: `/austria` answers 404, nobody can post there, and the home page and city chooser no longer list it.
- In Germany, items, rooms, cars, services and jobs can be posted only in Berlin.
- Business pages and events can be created in every German city from day one (round 12: "businesses and events everywhere from the start").
- Hamburg, Cologne and Bonn, Düsseldorf and Frankfurt get a waitlist page (mockup `city-waitlist`):
  - the business goal and a progress bar ("12 of 30 businesses");
  - "notify me" by email with a confirmation email;
  - the founding-business box and a link to the private vs business page.
- Every other German city shows "opens when Germany opens" and the same email signup.
- Admin › "Countries and cities" (mockup `admin-cities`):
  - each city's status, business count against an editable goal, and people waiting (for information only);
  - an "Open city…" button with a preview and a confirmation;
  - an "Open all of Germany" button.
  - Nothing opens by itself. Opening purges that city's pages from Cloudflare's cache.
- The city chooser (mockup `city-chooser`) shows Berlin as open and the rest with their goals.

**How a business is counted:** a verified, active business whose city is that city. Count only, never a condition other than the goal.

**Files**
- `seed/countries.ts`: Austria out of `ACTIVE`.
- `seed/locations/de.ts`: launch status and goals per city.
- `src/db/schema/listings.ts`: new columns on `locations`.
- New `src/db/schema/launch.ts`: the waitlist table.
- New `src/modules/launch/` (`cities.ts`, `waitlist.ts`).
- `src/modules/listings/listings.ts`: `saveListing()` refuses a non-event listing in a city that isn't open, with a new error `city_not_open` on the place field.
- `src/modules/listings/queries.ts`.
- `src/app/[country]/_browse/resolve.ts` and `browse-page.tsx`: a waitlist city shows the waitlist page instead of an empty list. Its events page keeps working.
- New `src/app/[country]/[place]/waitlist.tsx`.
- New `src/app/waitlist/confirm/` and `src/app/waitlist/off/` (confirm and unsubscribe links).
- New `src/app/admin/cities/`.
- `src/app/page.tsx` (home and city chooser).
- `src/messages/fa.ts`.
- `src/db/retention.ts`: unconfirmed signups deleted after 30 days.

**Database migrations**
- `0016_city_launch.sql`:
  - `locations` gets three columns:
    - `launch_status` (`open` / `waitlist` / `later`);
    - `business_goal` (small integer);
    - `opened_at` (`timestamptz`).
  - Plus `launch_with_id`, so Bonn counts towards Cologne's goal.
  - New table `city_waitlist`:
    - the city;
    - the email (original and normalized);
    - the role ("looking", "private seller" or "business");
    - the SHA-256 hash of the confirm token;
    - `confirmed_at` and `unsubscribed_at`;
    - created time.
  - One signup per email per city. Grants: the app inserts and confirms, the worker deletes.
- The seed sets Berlin `open` and the four key cities `waitlist` with goals; everything else is `later`.

**Tests**
- Austria refused on save.
- A listing in Hamburg refused; an event in Hamburg allowed; a business in Hamburg allowed.
- Berlin allowed; an existing Berlin listing still renews.
- Waitlist:
  - double opt-in;
  - the same email twice;
  - unsubscribe;
  - rate limits per IP and per email;
  - the token works once;
  - unconfirmed rows deleted after 30 days.
- Admin:
  - only staff can open a city;
  - opening writes `audit_log` and purges the cache;
  - the business count counts only verified, active businesses in that city (Bonn counts for Cologne).

**Risks**
- **Berlin's edge** (decided: the Berlin area including Potsdam, within 40 km; see "Decided by the owner", point 2). A test covers Potsdam allowed and a postal code joining Berlin but 60 km away refused.
- **Cached pages.** City pages are cached at Cloudflare. Opening a city must purge them; the worker already does purges.
- The confirmation email is sent straight from the web (like login codes), because the outbox would store the token in plain text.

**You do by hand:** confirm the goals (see "Decisions"). Later, write the "Hamburg is open" email; you send it yourself, as decided.

---

## 2. Telegram

### 2a. Refusal in the bot path (the gap found in round 8)

**What changes**
- `telegramNumberToE164()` is joined by one rule for every channel (bot, Telegram login, WhatsApp): `checkVerifiedNumber()`. It parses the number with libphonenumber and accepts it only when its country is on the allowlist.
- **The allowlist** is the seeded countries (`seed/countries.ts`). Iran isn't seeded. +888 numbers have no country (Telegram's anonymous Fragment numbers), so both are refused, and so are other countries' numbers.
- The bot answers in Persian with the round 12 wording (mockup `iran-phone`). It never says "sanctions"; it says Peydoo has no office in Iran and can't guarantee the deal.
- **Every refusal is logged with the number's country** (not the number), so we have the per-country numbers for the SMS switch-on rule from day one.
- Starting a phone check from an Iranian IP is refused too (see item 5).

**Files**
- `src/modules/users/phone-number.ts`, `phone.ts` and `telegram-bot.ts`.
- `src/messages/fa.ts`.
- New `scripts/phone-country-check.ts`: lists how many verified numbers would now be refused, by country only. None are expected; production is emptied at go-live.

**Migration `0017_phone_channels.sql`**
- `phone_verifications.number_country` (the ISO code, for verified and refused attempts).
- `phone_verification_method` gains `telegram_oidc` and `whatsapp`, on both tables.
- `phone_verifications.whatsapp_user_id`, and `users.whatsapp_user_id` (unique).
- New failure reasons: `country_not_allowed`, `declined`.

**Tests**
- Germany +49 accepted; +98 refused; +888 refused.
- A number from a country that isn't seeded is refused.
- Telegram's number without "+" is handled, and spaces are ignored.
- The refusal row records the country and no number.
- The bot replies with the new text.
- The existing `foreign_contact`, `phone_in_use` and `telegram_in_use` cases still pass.

### 2b. Telegram login (OpenID Connect, phone scope) as the main check

The same flow as the 25 Oct test, inside the app.

**Flow**
1. On `/account/phone` the user taps «تأیید با تلگرام».
2. Our server makes a `state`, a `nonce` and a PKCE verifier. It keeps them in Valkey for 10 minutes, tied to the signed-in user, and sends the browser to `https://oauth.telegram.org/auth` with `scope=openid phone`.
3. Telegram returns to `/account/phone/telegram/callback`. The server:
   - checks the state belongs to this signed-in user;
   - exchanges the code (with the client secret and the PKCE verifier);
   - verifies the RS256 `id_token` against Telegram's JWKS (cached), plus issuer, audience, expiry and nonce;
   - requires `phone_number_verified: true`.
4. The number goes through `checkVerifiedNumber()`, then the same `completeVerification()` as today (`phone_in_use` and the audit log as now).
5. Name, picture and username come back without being asked for. They are thrown away and never stored or logged.
6. If the person refuses consent, they come back to the page with a short message, and the attempt is logged as `declined`.

**On the page** (mockup `verify-phone`):
- one sentence first: «برای جلوگیری از کلاهبرداری، فقط یک بار؛ به کسی نشان داده نمی‌شود»;
- Telegram is the big button and WhatsApp the second;
- the bot link becomes a small fallback ("Telegram login didn't work? Use the bot").

**Files**
- New `src/modules/users/telegram-oidc.ts`.
- New `src/app/account/phone/telegram/start/route.ts` and `callback/route.ts`.
- `src/app/account/phone/page.tsx` and `telegram.tsx`.
- `src/lib/env.ts`: `TELEGRAM_OIDC_CLIENT_ID` and `TELEGRAM_OIDC_CLIENT_SECRET` on the web. Without them, the bot is the only path, as today.
- The CSP's `form-action` gets `https://oauth.telegram.org`.
- `src/messages/fa.ts`.

**Tests** (with a fake Telegram and a test key pair)
- The token is refused for:
  - a bad signature, wrong issuer, wrong audience or an expired token;
  - a wrong nonce;
  - `phone_number_verified` false.
- State:
  - a reused state is refused;
  - a state from another user's session is refused;
  - a state older than 10 minutes is refused.
- Numbers: +98, +888 and an unseeded country refused; `phone_in_use`.
- Consent refused, and the rate limits.
- The extra claims are not stored.

**Risks**
- **`sub` vs the bot's user id.** The 25 Oct test didn't show whether `sub` is the same number as the bot's user id. On day 1, I compare it on your staging account.
  - If they are the same, Telegram login also links `telegram_user_id`, so Telegram notifications keep working once the person starts the bot.
  - If not, it stays a phone check only.
- **The consent screen** ("Peydoo wants your phone number") may put some people off. Our sentence comes first, and the bot and WhatsApp remain.
- **Telegram's login is new.** If Telegram changes it, the bot still works.

**You do by hand (BotFather)**
- **Staging bot (@Peydoo_bot)**, still open from 25 Oct:
  - remove the test redirect `https://staging.peydoo.com/tg-oidc-test`;
  - regenerate the OIDC client secret (it was pasted in chat);
  - add the redirect `https://staging.peydoo.com/account/phone/telegram/callback`.
- **Production bot (@peydoobot):**
  - switch on OpenID Connect;
  - add `https://peydoo.com/account/phone/telegram/callback`.
- **Hand over each client ID and secret** without pasting them in chat:
  - production: `ssh root@2.31.122.66 peydoo-secret auth.env TELEGRAM_OIDC_CLIENT_SECRET` (and `…_CLIENT_ID`);
  - staging has no `peydoo-secret` yet. I add the same small script to staging so you can do the same there.

---

## 3. WhatsApp: the user sends us the code

**Flow** (round 9; mockup `verify-phone`)
1. The user taps «تأیید با واتس‌اپ». We create a code like `PD-K7Q2-9XMD`:
   - 8 characters;
   - valid 10 minutes;
   - single use;
   - tied to the signed-in user.

   We store only its hash.
2. The button opens `https://wa.me/<our number>?text=…` with a ready Persian message, «کد تأیید حساب پیدوی من: PD-K7Q2-9XMD — این کد را کسی به من نداده است». On a computer we show a QR code of the same link (the admin page's QR code is reused).
3. Meta sends the message to our webhook `/api/whatsapp/webhook`. We:
   - check the `X-Hub-Signature-256` signature;
   - skip a message we've already seen (Meta retries for up to 7 days; message IDs are kept 8 days in Valkey);
   - find the code in the text (Persian digits, spaces and dashes tolerated);
   - check the number with `checkVerifiedNumber()` (no +98, no +888, allowlist only, mobile only);
   - verify.
4. **We send no reply**, so it costs nothing. The page sees "verified" (it polls as today) and shows the masked number, with a "this isn't my number" link.
5. **WhatsApp usernames (2026).** If the message arrives without a number, the worker sends one `request_contact_info` message. It is inside the 1,000 free service messages a month per number. We accept the number only from a reply with `origin: contact_request`.
6. **Never sent to:** no message ever goes to a +98 number.

The button shows only after the user has chosen an allowed country, and never to an Iranian IP.

**SMS stays built and off**
- The SMS link disappears from `/account/phone` unless `SMS_COUNTRIES_ON` lists a country.
- The SMS page refuses when it is off.
- The code stays as it is (today it only writes to the log).
- I don't build a GatewayAPI adapter in wave 0. It is half a day whenever the switch-on rule fires.

**Files**
- New `src/modules/users/whatsapp.ts`.
- New `src/app/api/whatsapp/webhook/route.ts`: GET for Meta's verify challenge, POST for messages.
- New `src/app/account/phone/whatsapp/`.
- `src/worker/` (a `whatsapp` job for the contact request, via the outbox).
- `src/lib/env.ts`:
  - `WHATSAPP_NUMBER`;
  - `WHATSAPP_PHONE_NUMBER_ID`;
  - `WHATSAPP_ACCESS_TOKEN`;
  - `WHATSAPP_APP_SECRET`;
  - `WHATSAPP_VERIFY_TOKEN`.

  The button is hidden when they are unset.
- `src/app/account/phone/sms/`.
- `src/messages/fa.ts`.

**Migration:** in `0017_phone_channels.sql` (above), plus the check that a `whatsapp` attempt has a code hash.

**Tests**
- The signature: an unsigned or wrong one is refused.
- The verify challenge.
- Codes:
  - found in messy text and with Persian digits;
  - an expired code refused;
  - a used code refused;
  - a wrong code ignored.
- Numbers: +98, +888 and an unseeded country refused; a landline refused; `phone_in_use`.
- The same message twice is handled once.
- A message without a number queues exactly one contact request.
- `origin: other` is ignored and `contact_request` accepted.
- The rate limits, and no outgoing message to +98.

**Risks**
- **Meta may restrict the number** (low to medium within a year, round 9). Telegram stays the main path, so signups don't stop.
- **Conversion is unknown;** no published numbers exist.
- **Production is behind Cloudflare Access until go-live.** The webhook path needs the same bypass as Stripe's. The Cloudflare token may not cover Access; if it doesn't, it's one click for you.
- **Staging.** It needs its own number, or Meta's free test number. Day 1 shows whether Meta's test number receives messages from your phone; if not, a second cheap number.

**You do by hand at Meta** (all from outside Iran, without an Iranian VPN, and with no Iranian admin, card or document):
1. **Number.** Get a dedicated number used only for this, never for support:
   - a German prepaid SIM or a VoIP or landline number (€0–10 a month);
   - it must receive one SMS or voice call;
   - it must not be on the normal WhatsApp app.
   - Keep it forever; if it lapses, someone else can take it.
2. **Business portfolio.** Meta Business portfolio at business.facebook.com, with two-step login on your Facebook account.
3. **App.** developers.facebook.com → Create app → type "Business" → add the **WhatsApp** product, linked to the portfolio.
4. **Register the number.** WhatsApp Manager → Phone numbers → Add:
   - display name «Peydoo» (Meta reviews it);
   - verify by SMS or voice;
   - set the **two-step PIN**.
5. **System user.** Business settings → Users → System users → add an admin system user. Assign it the app and the WhatsApp account, then generate a **permanent token** with `whatsapp_business_messaging` and `whatsapp_business_management`.
6. **Webhook.** App → WhatsApp → Configuration:
   - callback URL `https://staging.peydoo.com/api/whatsapp/webhook` (production later `https://peydoo.com/api/whatsapp/webhook`);
   - a verify token I give you;
   - subscribe to the `messages` field.
   - Also turn on the `account_update` alerts to your email.
7. **No payment method.** Do **not** add one, ever. That is what keeps the cost at €0: Meta then simply doesn't send anything paid.
8. **Live mode.** Put the app in Live mode. Meta asks for a privacy policy URL (`https://peydoo.com/privacy`), an icon and a category.
9. **Hand over the values** with `peydoo-secret`, never in chat:
   - the phone number ID;
   - the permanent token;
   - the app secret (App settings → Basic);
   - the number itself.

---

## 4. Founding Pro that never charges by itself

**What is wrong today:** founding Pro is the coupon `peydoo-launch-6m` on a normal monthly subscription. Checkout asks for a card, and after 6 months Stripe charges €24 automatically.

**What I build**
- **Stripe's "free trial without a payment method"** instead of the coupon. Checkout runs with:
  - a 6-month trial;
  - `payment_method_collection: if_required`, so no card is asked for;
  - `trial_settings.end_behavior.missing_payment_method: cancel`.

  If the business does nothing, the subscription simply ends on the last day. Their page and 3 free listings stay.
- **Pro still arrives only through Stripe's webhook,** so the CLAUDE.md rule "money and entitlements only through webhooks" is kept. The €0 trial invoice grants the 6 months.
- **Continuing is the business's own choice.** On `/b/{slug}/billing`, a button «ادامهٔ پرو بعد از ۶ ماه» opens Stripe's page to add a payment method. Only then does Stripe charge at the end of the trial. Mockup `founding-business`: "no card, no automatic renewal".
- **Reminders.** We send our own Persian emails 14 days and 3 days before the end: "your free Pro ends on <Gregorian date>; nothing will be charged; to continue…". A worker job sends them through the outbox.
- **Who gets it:** in admin › businesses you press «پیشنهاد بنیان‌گذار» on a business.
  - The places per city equal the city's business goal; Berlin's is 30 unless you say otherwise.
  - A business can use it once.
  - The business owner then sees «۶ ماه پروی رایگان، بدون کارت» on its billing page.
- **The old coupon and `scripts/stripe-launch-codes.ts` are retired.** `stripe-setup.ts` deactivates the coupon, and the script refuses to run.

**Files**
- `src/modules/payments/checkout.ts` (new `startFoundingCheckout()`), `gateway.ts` (trial options), `apply.ts` (the trial invoice, and the subscription ending at trial end), `plans.ts`.
- `src/worker/payments.ts` (reminders), and `customer.subscription.trial_will_end` added to the webhook events.
- `scripts/stripe-setup.ts` and `scripts/stripe-launch-codes.ts`.
- `src/app/b/[slug]/billing/`, `src/app/admin/businesses/`.
- `src/messages/fa.ts`.

**Migration `0018_founding.sql`:** `organizations` gets:
- `founding_offered_at`;
- `founding_offered_by_user_id`;
- `founding_location_id`;
- `founding_started_at`.

Who may write each column is set by grants, as today.

**Tests** (required for payments)
- Checkout:
  - is sent without card collection and with the cancel-at-trial-end setting;
  - only the owner can start it;
  - only with an offer;
  - only once.
- The city's places limit.
- Webhooks:
  - the trial invoice grants exactly the trial period;
  - the trial ending with no card revokes Pro;
  - a card added, then a paid invoice, grants the next period.
- Reminders on the right days, once each.
- The old coupon is no longer offered anywhere.

**On staging** I run it end to end in the Stripe sandbox with a **test clock** (Stripe moves time forward 6 months), with and without a card.

**Risks**
- Stripe's own English emails about trials. I suggest switching them off and using ours (below).
- The €12 vs €24 question (see "Decisions").

**You do by hand (Stripe)**
- In both sandboxes (and later live): Settings → Billing → Subscriptions and emails → turn off Stripe's "trial ending" reminder emails, if you want only our Persian ones.
- I run `stripe-setup.ts` on staging. On production I run it only when you ask.

---

## 5. Iran read-only, with the new wording

**What happens for a request from Iran** (Cloudflare's `CF-IPCountry` = IR, trusted only when the request really came through Cloudflare, as today)
- Browsing, search, listing and event pages, and reporting a listing (DSA) work.
- Refused, with a Persian notice:
  - every other write: login code requests (no new accounts or sessions from Iran), phone checks, posting, events, business setup, chat, favorites, checkout and waitlist signups;
  - each refusal carries a new reason, `region_read_only`.
- **Someone already signed in who travels to Iran:** their requests from Iran are read-only, with a travel notice. Their listings stay live.
- **A banner on every page**, using the round 12 wording without "sanctions":

  > «از ایران می‌توانید آگهی‌ها و رویدادهای ایرانیان خارج از کشور را ببینید. گذاشتن آگهی، پیام و پرداخت از داخل ایران ممکن نیست: پیدو در ایران دفتر و نماینده ندارد و نمی‌تواند امنیت معامله و پرداخت را برای شما تضمین کند. این تصمیم دربارهٔ شما نیست.»

  Plus the "if you are moving abroad" line and a «چرا؟» help page.
- **Wave 0 is stricter than the `iran` mockup.** The mockup shows email sign-up and messaging from Iran, but the plan builds that only in wave 4, after the sanctions lawyer, so wave 0 leaves out that sentence and those buttons.

**Three layers**
1. **The app.** One helper (`isIranRequest`) checked in the permission functions and every write action, with tests.
2. **Cache.** The Cloudflare Cache Rule leaves out Iranian visitors (`ip.src.country ne "IR"`), and the app sends `private, no-store` to them. Then the banner never leaks into the cached pages others see, and Iranian visitors always see it.
3. **Cloudflare WAF**, as a safety net. One custom rule blocks POST requests from IR except:
   - `/report`;
   - `/api/monitoring`;
   - the Stripe and WhatsApp webhooks.

   The Cloudflare token can edit WAF and Cache Rules, so I add both through the API after your approval and record them in `docs/setup.md`.

**Files**
- `src/lib/client-ip.ts` and `src/modules/users/permissions.ts`.
- The write actions under `src/app/` (login, account/phone, new, events/new, business/new, chat, favorites, promote, billing, waitlist).
- `src/proxy.ts` (no-store for IR).
- `src/app/layout.tsx` (the banner).
- New `src/app/help/iran/`.
- `src/messages/fa.ts`.

**Migration:** none. Refusals are counted per day in Valkey; no IP is stored.

**Tests**
- Every write refused for an IR request coming from a Cloudflare address.
- The same header from a non-Cloudflare address is ignored.
- Reporting still works.
- Signed-in travellers are read-only.
- Normal visitors are unaffected.
- IR responses are `no-store`.

**Risks**
- **A VPN hides Iran.** Accepted: the +98 refusal is the main control, and this layer is what regulators expect.
- **An Iranian VPN exit from Germany** makes a normal user read-only for that request. That is rare, and the notice explains it.
- **The lawyer hasn't confirmed** the read-only approach yet (round 5 questions).

**You do by hand:** nothing, unless the Cloudflare API refuses; then two rules to click in.

---

## 6. Withdrawal button for consumer purchases

**What I checked**
- Private people can buy:
  - a bump (€1.99);
  - 3 bumps over 7 days (€4.49);
  - featured for 7 days (€6.99);
  - a featured event (€9.99).
- Today:
  - before paying, they tick that the service starts at once (`waiver`, recorded in `audit_log`);
  - terms 14.4 says to withdraw **by email**.
- Since 19 Jun 2026, § 356a BGB requires an online **withdrawal function** for consumer contracts made online:
  - clearly labelled («Vertrag widerrufen» or equivalent);
  - available for the whole withdrawal period;
  - in two steps: enter the details, then a clear confirm button;
  - followed by an immediate receipt on a durable medium.

  Pure B2B is exempt.
- **What happens if it is missing:** warning letters (Abmahnung) and, by one source, a withdrawal period extended to 12 months and 14 days. **We don't have it, so it needs building.**

**What I build**
1. **The button.** On `/my/orders` and `/my/orders/{id}`, every consumer order younger than 14 days gets the button «انصراف از قرارداد (Vertrag widerrufen)».
2. **The second step** shows:
   - the order;
   - the account name;
   - the email the receipt goes to.

   Then the button «تأیید انصراف (Widerruf bestätigen)».
3. **We record it** (who, when, IP), and the receipt email goes out at once with the content, date and time.
4. **The refund**, worked out by the worker:
   - **a single bump** already carried out: the right ended with it (the waiver), so no refund, and the receipt says why;
   - **3 bumps:** the bumps not yet run are refunded;
   - **featured:** the unused days are refunded pro rata (§ 357a (2) BGB).

   The worker creates the Stripe refund with a `withdrawal` tag. The **webhook** then removes what is left of the order's featured time or bumps. This is a new rule (today a partial refund removes nothing), so entitlements still change only through webhooks.
5. **Pro is sold to businesses only.** Checkout gets a tick «برای کسب‌وکارم می‌خرم», and the terms say so. Then Pro needs no withdrawal button and no § 312k cancel button (the lawyer should confirm).
6. **Texts.** Terms 14.4 and the withdrawal instructions, in German and Persian, are updated to point to the button.

**Files**
- `src/modules/payments/` (new `withdrawals.ts`, plus `apply.ts` and `checkout.ts`).
- `src/worker/payments.ts`.
- `src/app/my/orders/`.
- `src/app/b/[slug]/billing/` (the B2B tick).
- `src/messages/legal-de.ts` and `fa.ts`.

**Migration `0019_withdrawals.sql`:** a new table `order_withdrawals` with:
- the order (unique);
- the user;
- received at;
- the receipt email;
- the refund amount in minor units, and the currency;
- the status (`received` / `refunded` / `no_refund`);
- the provider's refund ID.

Grants: the app inserts; the worker updates.

**Tests** (required for payments)
- The button:
  - only on your own consumer orders;
  - only within 14 days;
  - never on Pro.
- Both steps are required.
- A second press does nothing.
- The receipt email is sent.
- The pro-rata amounts are right for bump-3 and both featured kinds.
- The webhook removes the rest only for a withdrawal refund.
- The refund only ever comes through the webhook.

**Risks**
- **The label language.** The site is Persian; a bilingual label is my proposal, for the lawyer to confirm.
- **A single bump.** Whether the button must still show after it has run is a lawyer question; I show it for 14 days either way.

**You do by hand:** add the button text and terms 14.4 to the lawyer's list. Nothing in Stripe.

---

## 7. Docs, deploy, checks (1 day)

- `docs/setup.md`:
  - the cities and the waitlist;
  - the phone channels and the allowlist;
  - the WhatsApp settings;
  - founding Pro;
  - Iran read-only with the Cloudflare rules;
  - withdrawals;
  - and the launch checklist.
- `docs/progress.md` at the end.
- **The deploy:** `free -m` first, merge to `main` (staging), then check on staging in one headless browser at phone size, with test accounts only and no real users' data in screenshots.

## CLAUDE.md rules that change on approval

1. "Persian-language classifieds marketplace for **Iranians in Europe**" → "for **Iranians in many countries** (Europe, North America, Australia, Turkey later)".
2. "**Time:** `timestamptz` in UTC. **Jalali dates only in the interface.**" → "Dates in the interface are **Gregorian** with Persian month names and digits (`fa-u-ca-gregory`). Jalali only as a second label for cultural dates (Nowruz, Yalda)." The pages themselves switch to Gregorian in wave 1 (the redesign), as planned.
3. New: "**Phone numbers** from any channel (Telegram, WhatsApp, SMS) pass `checkVerifiedNumber()`: allowlisted countries only, never +98 or +888."
4. New: "**Requests from Iran are read-only** (`isIranRequest()`): every write except reports is refused. Never write 'sanctions' in user-facing text."
5. New: "**Cities:** posting non-event listings only in open cities; events and businesses everywhere in an active country."
6. Unchanged but worth knowing: "money and entitlements only through webhooks" still holds with founding Pro as a Stripe trial. **The waitlist reward bumps (wave 2) will need a decision**: either a free Stripe order or a rule change for staff grants.

## Decided by the owner (Oct 26, 2026)

0. **Telegram login (item 2b) switched off after trying it on staging:** too complicated, and Telegram's page says Peydoo wants access to the person's Telegram. The bot stays the main and only Telegram path (with the +98 / +888 / allowlist refusal). The code stays, off, for when Telegram makes it simpler.

1. **Business goals:** Hamburg **20**. The others keep the plan page's numbers: Cologne and Bonn 25, Düsseldorf 20, Frankfurt 20. All of them can be edited in admin.
2. **Berlin area, Potsdam included.**
   - **Why a distance limit:** every postal code joins its nearest seeded city, so some codes that join Berlin are 138 km away in rural Brandenburg.
   - **The rule:** the cities Berlin and Potsdam are open, and a listing must also be within **40 km of Berlin's centre** (Potsdam is 27 km away). Farther away, the seller sees "only the Berlin area for now".
   - **How:** a `launch_radius_km` column on `locations`, in migration 0016, plus Potsdam's `launch_with_id` pointing to Berlin. About +0.25 day.
3. **After 6 months, founding Pro costs €24 a month**, and only if the business says yes. No extra coupon.
4. **Founding places in Berlin: 30.**
5. **The founding badge «بنیان‌گذار» is built in wave 0** (+0.5 day).
   - It lasts one year from the day the founding business creates its business page on Peydoo, then disappears by itself.
   - It shows on the business page and next to its listings.
   - Built as `organizations.founding_badge_until` (in migration 0018), set when the founding offer is used.
6. **Everyone verifies a phone number to post.** There is no email-only limited account.
   - «هیچ‌کدام را ندارم» explains the second-account trick (Telegram "add account", WhatsApp's second account) and offers support by email.
   - Each such case is logged for the SMS switch-on rule.
   - This replaces the plan page's "limited account" for wave 0.
7. **Turkey (+90) is on the phone allowlist.**
8. **No cuts:**
   - the waitlist page is built as in the `city-waitlist` mockup, with email signups;
   - purchases stay on sale, with the withdrawal button.

Total: about 16–18.5 working days (+0.25 for the Berlin area, +0.5 for the badge).
