# What Peydoo can learn from Kleinanzeigen: contact strategy and legal pages

Research for the owner, 2 November 2026. Written for planning only. Nothing in the repository was changed.

**This is not legal advice.** Points marked **[uncertain]** were not fully verified, or need the lawyer's view. **[verified]** means I saw it myself in the live page, in its source code or in an archived copy. **[inferred]** means I concluded it from indirect evidence.

How I got around the blocks: `hilfe.kleinanzeigen.de` returns 403 to normal fetches, so I read **Wayback Machine copies** of the help centre (the raw HTML and the page scripts, not only the visible text). Kleinanzeigen's terms, privacy policy, rules page, Impressum and IP form were readable directly. I read willhaben and markt.de from their live pages, plus one archived willhaben form.

Peydoo files I compared against: `src/modules/users/contact.ts`, `src/modules/users/contact-topics.ts`, `src/app/contact/actions.ts`, `src/app/contact/page.tsx`, `src/messages/fa.ts` (`contactForm`, `pages.contact`, `pages.help`), `src/messages/legal-de.ts` (`terms`, `privacy`), `docs/legal-review.md`, `docs/setup.md`, `seed/categories.ts`, `src/modules/moderation/decide.ts`.

---

## Short answer

1. **Kleinanzeigen does not run an open contact form.** Its help centre only offers "Anfrage einreichen" at the **end of a help article**. The "Anfrage einreichen" link in the site header is commented out. Each article opens a form with the topic already filled in. Since some time between February 2025 and September 2026, the form page sends visitors who are not signed in to the sign-in page. There is one deliberate exception: a form for reporting illegal content, which people **without an account** may use. All of this is **[verified]** from archived page source.
2. Kleinanzeigen can lock its form behind a login because it has other channels that are open to everyone: the Impressum lists an **email address and a fax number**, plus a separate address for authorities. The legal minimum is one email address that a human actually reads and answers, plus one second fast channel that anyone can use. A contact form counts as that second channel (CJEU C-298/07). The safe reading is that this second channel must work **without an account**, at least for some topics.
3. **Recommendation for Peydoo:** build a help-first topic picker. Topics that create most of the mail (listings, chat, payments, business pages, appeals) require sign-in. Guests may use the form only for: "I can't sign in", reporting illegal content, authorities and legal matters, privacy requests, and "other". For guests, add a hidden honeypot field, a minimum time before sending and a global hourly cap. Replace the guest receipt with an **email confirmation link that releases the message**. This is what Zendesk, the help-desk software Kleinanzeigen and willhaben use, has done by default since March 2026. Add a separate address for authorities, and put a topic tag in the subject line so mail can be sorted. Details are in section 1.5.
4. **Legal pages:** Peydoo's new texts are already as strong as Kleinanzeigen's on liability and indemnity, and safer in several places. Kleinanzeigen has about **15 protective rules that Peydoo lacks**. The most valuable ones:
   - a clause that lets the contract move to a future GmbH or UG (§ 309 Nr. 10 BGB makes this possible);
   - a ban on scraping and on harvesting other users' data;
   - "one account per person, and no new account after a ban";
   - a ban on deleting a listing and posting it again (this gives a free bump);
   - holding back suspicious listings before they go live;
   - deleting inactive accounts after notice;
   - rules for pets and tickets (Peydoo has both categories but no rules for them);
   - the § 327r BGB rule for changing paid digital products.

   The full list is in section 2.1. Kleinanzeigen also does several things Peydoo should **not** copy (section 2.4).

---

## 1. Contact strategy

### 1.1 Kleinanzeigen's Impressum: which channels it lists

From https://www.kleinanzeigen.de/impressum.html **[verified]**:

| Channel | What it says |
|---|---|
| `impressum@kleinanzeigen.de` | The general email address. In the terms it is also the address for ending the contract (§ 11 Nr. 1) and for withdrawal (Widerrufsbelehrung), so it is clearly read. |
| Fax `+49 30 13881317` | A second channel that does not need the internet or an account. It is also printed on the IP-infringement form and in the withdrawal notice. |
| `behoerdenanfragen@kleinanzeigen.de` | DSA Art. 11 contact point for authorities (German and English). It says user enquiries sent there are not handled, or only with delay. |
| Reporting | Users report through "Anzeige melden"; the Impressum links the help article. |
| IP infringement | A PDF form (https://kleinanzeigen.de/public-ep-frontend-web/pdf/2026_kleinanzeigen_rechtsverletzung.pdf), sent **by email to impressum@ or by fax**. The rights holder signs a sworn declaration ("an Eides Statt"), lists listing numbers with reason codes, and agrees that their name and a contact address can be passed to the seller. **[verified]** (PDF text) |
| Questions | The help centre. The Impressum says every help page ends with "Anfrage einreichen", and calls this the fastest way. |
| Others | A withdrawal form (its own ticket form), a page for reporting security vulnerabilities, privacy settings, mediators for business users, and the P2B complaint report. |

There is no phone number. A help article explains why: a free platform cannot offer a free hotline, most questions are answered in the help pages, and many issues are between buyer and seller (https://web.archive.org/web/20260829042413/https://hilfe.kleinanzeigen.de/hc/de/articles/17426476500508-Kontakt-zu-Kleinanzeigen-Deine-Fragen-unsere-Antworten) **[verified]**.

### 1.2 Kleinanzeigen's help-centre flow

The help centre runs on **Zendesk**. You can tell from the `/hc/de/...` paths, the `ticket_form_id` parameters and the Zendesk script names.

| Question | Answer | Evidence |
|---|---|---|
| Does the form require login? | **Yes, since 2025/26.** The form page has a script: if the URL does not contain `sso_ref=1`, it sends the browser to `/hc/signin?return_to=…`, which is the Kleinanzeigen account login. The February 2025 copy of the same page has no such script, so the login rule was added between Feb 2025 and Sep 2026. | Archived form, 17 Sep 2026: https://web.archive.org/web/20260917202156/https://hilfe.kleinanzeigen.de/hc/de/requests/new ; 13 Feb 2025: https://web.archive.org/web/20250213053407/https://hilfe.kleinanzeigen.de/hc/de/requests/new **[verified]** |
| Exception for people without an account? | **Yes, for reporting illegal content.** Form `19600813765148` ("Unzulässige Inhalte melden") has its own code for anonymous submission. The help article says: "Nur für Nutzer ohne Kleinanzeigen-Konto: Das Kontaktformular". In the app, guests reach it through the login screen's "Hilfe" link. How a guest gets past the sign-in redirect on the web is not visible in the copy. | Article: https://web.archive.org/web/20260316211713/https://hilfe.kleinanzeigen.de/hc/de/articles/17088366607388-Unzul%C3%A4ssige-Anzeige-melden **[verified]**; the exact guest path **[uncertain]** |
| Does it make you pick a topic first? | **Yes.** The first field is "Wobei benötigst du Hilfe?" and it is required. Options (Sep 2026): Kaufen mit Sicher bezahlen, Verkaufen mit Sicher bezahlen, Nutzerkonto, Sicherheit, Anzeigen, Unzulässige Inhalte melden, Melden von verdächtigen Links, Vertrag widerrufen. Above that is "Was für ein Kunde bist du? Privat / PRO". PRO customers are told to sign in to their account to reach their own team, with an answer within 24 hours. | Archived form (Sep 2026) **[verified]** |
| Help articles before you can write? | **Yes.** The header link "Anfrage einreichen" is commented out in the page code. The help article "Kontakt zu Kleinanzeigen" says: search first, and if nothing helps, scroll to the end of the article and click "Anfrage einreichen". | Archived article (Aug 2026) **[verified]** |
| Is it per topic? | **Yes.** The page script maps **159 help articles** to form links with the topic and two sub-levels already filled in. For example, "Ich kann mich nicht einloggen!" opens `ticket_form_id=17084842529436&…=l2_ko_dein_konto&…=l3_ko_dein_konto_einloggen_probleme`. There is also a list (`articlesNoContact`) that hides the button on chosen articles. | Archived article source **[verified]** |
| Captcha? | Zendesk always shows a CAPTCHA check (Cloudflare bot detection) to **signed-out** users who send a request, and it cannot be switched off. Signed-in users are not checked. | https://support.zendesk.com/hc/en-us/articles/4408839088794-About-CAPTCHA-and-CAPTCHA-FAQs **[verified for Zendesk; that Kleinanzeigen sees it: inferred]** |
| Email check for guests? | Since 10 March 2026 (default for everyone from 7 May 2026), Zendesk **holds every guest request** and emails the sender a one-time link. Only a click creates the ticket. The stated reason is the growth in spam attacks. Customers can opt out. Without the click, no ticket and no auto-reply is created. | https://support.zendesk.com/hc/en-us/articles/10360295453082-Announcing-verification-for-anonymous-help-center-requests **[verified]**; whether Kleinanzeigen opted out **[uncertain]** |
| Receipt? | For **reports**, the terms promise a receipt when the sender gave an email address (§ 7 Nr. 2, as the DSA requires). For ordinary requests, Zendesk sends a "request received" email by default once the ticket exists. | Terms **[verified]**; general receipt **[inferred]** |
| Other details | The report form requires a tick: "Bitte bestätige, dass deine Angaben richtig und vollständig sind." Signed-in reporters can tick "anonymous". The page promises an answer "in der Regel innerhalb weniger Werktage". | Archived form and article **[verified]** |

### 1.3 Two comparable marketplaces

**willhaben.at** (Austria) **[verified]**:
- The Impressum (https://www.willhaben.at/iad/impressum) names the **contact form** as the DSA contact point for users (Art. 12) **and** for authorities (Art. 11). Only general questions about the company go to `impressum@willhaben.at`. It also publishes its average monthly active users (Art. 24 (2) DSA).
- The form (Zendesk, archived 19 Oct 2026: https://web.archive.org/web/20261019172441/https://hilfe.willhaben.at/hc/de/requests/new) is **one form** with a required "Bereich" picker: PayLivery, Marktplatz, Immobilien, Auto & Motor, Tiere & Tierschutz, Datenschutz, Anordnungen/Anfragen von Behörden, Widerrufsrecht. Extra fields appear by topic, for example a willhaben code, the amount and the booking date. There is an anonymous email field and no forced sign-in, so **guests can write**. They get Zendesk's guest CAPTCHA **[inferred]**.

**markt.de** (Germany) **[verified]**:
- The Impressum (https://www.markt.de/impressum.htm):
  - The DSA contact point for users is the contact form.
  - Illegal content is reported through "Anzeige melden" or "Melden".
  - Authorities write to `behoerdenanfragen@markt.de`, which says user enquiries are not handled there. Authorities must give their legal basis and the facts, following the "Hinweise auf der Kontaktseite".
  - `impressum@markt.de` is for "other enquiries", with the same "user enquiries not handled" note.
  - There are also a youth-protection officer address and a data protection officer.
  - It links a prices page under § 4 DL-InfoV and the PAngV.
- The contact page (https://www.markt.de/service.htm) starts with "**Wie können wir Dir helfen? Sag uns mit ein paar Worten, was los ist. Meistens haben wir die Antwort schon parat.**" A keyword box filters about 70 quick-help cards, each tagged with search words such as "login geht nicht" or "code kommt nicht". The send button comes at the end. The page loads Google reCAPTCHA and allows file uploads. The page and form texts are served to a signed-out visitor, so guests can probably write **[inferred]**.

**Pattern across all three:** help before the form, a required topic, topic-specific fields, a captcha for guests, a separate address for authorities, and no phone. Kleinanzeigen goes furthest: sign-in is required, but guests can still report content and there is a fax for everyone else.

### 1.4 The legal minimum (Germany)

- **§ 5 Abs. 1 Nr. 2 DDG** requires details that allow fast electronic contact and direct communication, "einschließlich der Adresse der elektronischen Post". The email address is therefore mandatory in all cases.
- **CJEU C-298/07** (16 Oct 2008, text: https://lexetius.com/2008,2648; EUR-Lex CELEX 62007CJ0298) **[verified]**:
  - Besides email there must be a second fast, direct and effective channel. It **need not be a phone number** (operative part, Rn. 40).
  - An **online enquiry form** with answers by email can be that channel (Rn. 35). In the case the company answered within 30–60 minutes, but that was the fact pattern, not a rule.
  - "Direct" only means that no third party sits in between (Rn. 29). "Effective" means adequate information within a time that meets the user's legitimate expectations (Rn. 30).
  - If someone has **no access to the internet** and asks for it, the provider must offer a non-electronic way, such as a phone number (Rn. 36, 39).
- **LG München I, 25 Feb 2025, 33 O 3721/24** (as summarised by IT-Recht Kanzlei: https://www.it-recht-kanzlei.de/lg-muenchen-e-mail-adresse-impressum-direkte-kontaktmoeglichkeit.html):
  - An Impressum email that only sends **auto-replies pointing elsewhere** (to a contact form) breaks § 5 DDG and is misleading (§ 5a UWG).
  - The email must allow unrestricted contact, without length limits or set categories.
  - So `support@peydoo.com` must stay **open and read by a person**. A form may have topics; the email may not. **[verified from secondary source; full judgment not read]**
- **Can the form require login?** No court decision found. Commentary says the second channel should work without a cumbersome registration (https://www.juraforum.de/lexikon/impressum-telefonnummer-pflicht). Visitors and authorities without an account are also "users" under the DDG. **Safe minimum:** the form, as the Impressum's second channel, must have **at least one path that guests can use for any matter** (an "other" topic is enough). If Peydoo wanted *every* topic behind a login, it would need another open channel, as Kleinanzeigen has with its fax. **[uncertain: no case law; lawyer]**
- **Can the form be limited to some topics?** Yes, as long as one topic is open to everything ("other") and the email stays unrestricted **[inferred from the cases above]**.
- **DSA Art. 12:** users must be able to choose a contact method that is not only automated (no bot-only support). **DSA Art. 16:** "any individual or entity" must be able to report illegal content, so **reporting must work for guests**. Peydoo's report button already works without login (terms 8.1). Kleinanzeigen needed a special guest form for this. **Art. 16 (4):** a receipt must be sent to a reporter who gave an email address.
- **legal-review.md row B3 "Contact channels"** says: email only is not enough; add a contact form (also usable for DSA and GPSR) or a phone number; priority **must**. The form is now built. This section answers the follow-up question of how far it can be tightened.

### 1.5 Recommended design for Peydoo

Today (`src/app/contact/actions.ts`) the form is open to everyone for all five topics. It sends every message straight to `support@`, and every sender gets a receipt. That is the most generous version. The design below cuts mail volume and bot spam while staying inside the legal minimum.

**A. Help first, then topic, then form.** (Kleinanzeigen and markt.de both do this.)
- `/contact` starts with "Worum geht es?" as 7 large topic buttons, not the form.
- Choosing a topic shows **2–4 matching answers** taken from `pages.help` (they already exist: "کد ورود نرسید", "آگهی‌ام برداشته شد. چرا؟", "چرا نمی‌توانم لینک بفرستم؟" and others), opened inline.
- Under them: «جوابم را پیدا نکردم» ("I didn't find my answer"). Only this opens the form, with the topic fixed.
- Add a «به ما بنویسید» link with the topic preset at the end of the relevant help groups on `/help`, the way Kleinanzeigen puts a link at the end of each article.
- Keep the email address visible on `/contact` and in the Impressum (legally required). Do **not** add an auto-reply that only points to the form (LG München I).

**B. Topics, who may use them, and how each is handled**

| Topic (fa label idea) | Who | Before the form | Extra fields | Delivery | Receipt | Subject tag |
|---|---|---|---|---|---|---|
| 1. Can't sign in («وارد نمی‌شوم / کد نمی‌رسد») | **Guests** (by definition) | Code-not-arriving help, spam folder, Telegram | "Email of your account" | Immediately (a confirmation link may not arrive either) | **None**; on-screen message only | `[Login]` |
| 2. Listings, chat, business page, payments and invoices, Pro | **Signed in only** | Matching help answers | Listing link (optional), account attached automatically | Immediately | Optional (goes to the verified account address, so harmless) | `[Anzeige]`, `[Zahlung]`, `[Pro]` |
| 3. Objection to a decision | **Signed in only** | Points to the in-app «اعتراض» button (terms 7.4); form only if that fails | Decision link | Immediately | Optional | `[Widerspruch]` |
| 4. Report illegal content or rights infringement | **Guests allowed** (DSA Art. 16) | "Use the «گزارش» button on the page; it works without an account" | **Peydoo URL required**; reason; name and email (optional only for child-abuse content, Art. 16 (2) (c)); **required tick "my information is correct and complete"** (Kleinanzeigen does this) | Immediately (no extra hurdle for DSA notices) | **Yes**, required by Art. 16 (4); text without the sender's words | `[Meldung]` |
| 5. Authorities, lawyers, press | **Guests** | Note: "Authorities can also write directly to `behoerden@…`" | Authority or firm, case number, legal basis | Immediately | No | `[Behörde]` |
| 6. Privacy | **Guests allowed**; signed-in users first see the self-service pages "download my data" and "delete my account" | The self-service links | — | Guests: after the email link; signed in: immediately | No | `[Datenschutz]` |
| 7. Other | **Guests** (keeps the Impressum's second channel open to everyone) | Search box over help questions | — | Guests: **after the email link**; signed in: immediately | No | `[Sonstiges]` |

Why the sign-in-only topics are where the volume is: listing, chat and payment questions come from people who have accounts. A login attaches the account, which saves a reply asking "which account?". It also removes bots completely, because publishing already needs a verified phone. Banned accounts can still sign in. In the code, sanctions only block posting and messaging (`src/modules/moderation/sanctions.ts`), so the appeal route stays open **[inferred from code]**.

**C. Anti-spam for guests** (the signed-in path needs none of this)
1. **Turnstile**: keep it. Peydoo already has it, Zendesk uses the same kind of Cloudflare check, and markt.de uses reCAPTCHA.
2. **Honeypot**: a text field hidden with CSS (not `type=hidden`), `tabindex=-1`, `autocomplete=off`. If it is filled, show the normal "sent" screen but send nothing, so bots learn nothing. Kleinanzeigen: not visible **[uncertain]**.
3. **Minimum time**: the server signs the time the form was rendered (an HMAC with an existing secret) into a hidden field. If the form comes back in under about 3 seconds or after more than 2 hours, treat it like the honeypot. Kleinanzeigen: not visible **[uncertain]**.
4. **Content rules for guests**: at most 2 links. Refuse a message that is only a link. On topic 4 the URL must be on `peydoo.com`.
5. **Global circuit breaker**: if more than N guest messages arrive per hour across all IPs (for example 30), the guest form shows "Please write by email to …" until the hour ends, and the owner gets one alert with counts only (n8n). This is lawful because the email is still there.
6. Keep the limits that exist today: 5 an hour per IP and 5 a day per email. Lower the per-email limit for guests to 3 a day.

**D. Confirmation link instead of a receipt (guests, topics 6–7)**
- The guest's message is held for up to 24 hours (Valkey). The guest gets **one** email: "Click to send your message to Peydoo". The email contains a link only, never the guest's text.
- Only the click sends the message to `support@`. Bots never click, and a forged address only ever receives one link.
- This is exactly what Zendesk switched on for all customers in 2026 because of spam waves (source above). It replaces the current guest receipt, so the total number of outgoing emails stays the same while inbound spam drops to near zero.
- Not for topic 1 (the email may be the problem) or topic 4 (DSA notices should not get an extra step; the receipt is required anyway).

**E. Separate addresses and routing**
- **`support@peydoo.com`** stays the Impressum address, read and answered by the owner.
- Add **`behoerden@peydoo.com`** as a Zoho alias, or a separate folder, for DSA Art. 11 authorities and court orders. Show it in the Impressum and on `/contact`, with the line "Nutzeranfragen bitte über das Kontaktformular; hier werden sie nur verzögert bearbeitet". Kleinanzeigen and markt.de do this **[verified]**. **Never** put such a line on `support@` itself (LG München I).
- If you add it, also update **terms 8.2** (today it says the 1.1 email is the contact point for authorities and users), `pages.contact` (the "مقام‌های دولتی" section) and the Impressum.
- **Subject tags** as in the table, plus `[Gast]` or `[Konto]`, and **`[Pro]`** for accounts with an active subscription. Zoho filters can then sort mail into folders, and Pro mail can be answered first. Kleinanzeigen gives PRO customers a separate team with a 24-hour answer, reached only after sign-in **[verified]**.

**F. Expectations and the non-electronic route**
- Under the form: "Antwort in der Regel innerhalb von 2 Werktagen" (Kleinanzeigen says "within a few working days" **[verified]**).
- One line for people without internet access (CJEU Rn. 39): "Ohne Internetzugang? Schreiben Sie per Post an die Anschrift im Impressum; auf Wunsch rufen wir zurück." Whether post alone is enough is **[uncertain]**; offering a callback on request covers it.
- A short FAQ item "چرا شماره تلفن پشتیبانی نداریم؟" ("Why there is no support phone"), like Kleinanzeigen's article.

**G. Privacy text after the change.** Update privacy 3.7 to cover: the held guest message (up to 24 hours, then deleted), the confirmation email, and that the honeypot and timing checks store nothing.

**Which parts Kleinanzeigen itself does** (summary): help first (yes), the form only reachable from articles (yes), required topic (yes), topic filled in per article (yes), login required (yes), guest exception for illegal-content reports (yes), "correct and complete" tick (yes), anonymous option for signed-in reporters (yes), captcha for guests (Zendesk default, yes **[inferred]**), email confirmation for guests (Zendesk default since 2026, **[uncertain]** whether kept), separate authorities address (yes), IP notices on a structured form (yes), faster path for PRO customers (yes), no phone plus an article explaining why (yes), fax (yes). Honeypot and minimum time: not visible.

---

## 2. Learning from Kleinanzeigen's legal pages

Sources:
- Nutzungsbedingungen: https://themen.kleinanzeigen.de/nutzungsbedingungen/ (in force since 17 Feb 2024; previous version at `/nutzungsbedingungen_alt/`).
- Grundsätze (rules, made part of the terms): https://themen.kleinanzeigen.de/policy/
- Datenschutzerklärung: https://themen.kleinanzeigen.de/datenschutzerklaerung/ (in force since 21 Oct 2026).
- Sicherheitshinweise: https://themen.kleinanzeigen.de/sicherheitshinweise/

All read **[verified]**. Kleinanzeigen numbers its terms "§ x Nr. y". Below, "K § 5 Nr. 1" means Kleinanzeigen's terms, § 5, point 1.

**Where Peydoo is already as good or better:** liability (Peydoo 10.1 matches K § 9 and adds data loss and B2B limitation), indemnity (9.2 is as strong as K § 10), the hearing before a permanent ban (7.6; K has nothing similar for consumers), the purpose-limited licence (9.1, versus K's broad § 1 Nr. 7), the changes clause (12, safer than K § 13), ranking (14.7), contract formation (15) and the two binding languages.

**A practical point first:** most of the additions below make users' position worse. Under Peydoo's own clause 12 (3)–(4) they then need **consent at the next sign-in**, which is not built yet (`docs/setup.md`, "Promises the texts make"). The cheapest route: put all chosen additions into **one new version before public launch**, while there are few real accounts. Use the existing version system (`src/modules/legal/versions.ts`) and the four-week notice.

### 2.1 Protective rules Kleinanzeigen has and Peydoo lacks

All German wording below is my own suggestion, not Kleinanzeigen's text.

| # | Rule and what it does | Kleinanzeigen | Lawful for Peydoo? | Priority |
|---|---|---|---|---|
| 1 | **Contract transfer to a company.** Lets the owner move all user contracts to the future UG or GmbH (legal-review C3) without asking every user. | K § 14 | **Yes, if done right.** § 309 Nr. 10 BGB voids a clause that lets the operator swap itself for a third party, *unless* the third party is named or the user may end the contract. So: give notice and a right to end. Without a clause, each user must agree (§ 415 BGB). Lawyer to confirm. | **high** |
| 2 | **Ban on scraping, data harvesting, getting around blocks, overloading the site, malware, spam** | K § 5 Nr. 1 | Yes (§ 307 BGB: a clear legitimate interest). It binds only account holders. Against outside scrapers you rely on the database right (§ 87b UrhG) and a **machine-readable** text-and-data-mining reservation (§ 44b (3) UrhG, for example in `robots.txt`). Whether a reservation only in the terms is enough is **[uncertain]**. | **high** |
| 3 | **Other users' data:** use it only for the deal, and you are responsible for it yourself | K § 5 Nr. 1; K privacy sec. 11 | Yes. Private sellers often fall under the GDPR "household" exemption, so write "soweit das Datenschutzrecht für Sie gilt". | **high** |
| 4 | **One account per person, and no new account after a permanent ban** | K § 2 Nr. 5, § 6 Nr. 3 | Yes, if the ban followed 7.6 (BGH III ZR 179/20). Peydoo already keeps a fingerprint of banned phone numbers for 2 years (privacy 7, 9); the clause gives that a contractual basis. A review after 2 years keeps it proportionate. | **high** |
| 5 | **Deleting and posting again counts as a duplicate; no keyword stuffing; no ads that only advertise other websites or channels** | K Grundsätze "Grundsätzliches" | Yes. It is especially important because Peydoo sorts by recency and **sells bumps**: deleting and reposting is a free bump that undercuts 14.7 and the bump revenue. | **high** |
| 6 | **Hold back publication on suspicion; exclude products often used for fraud** | K § 6 Nr. 1–2 | Yes (DSA Art. 14 requires it to be stated in advance). Today **7.1 promises "werden sofort veröffentlicht"**, so Peydoo may not hold anything back. Paid features should start at publication. | **high** |
| 7 | **Warning as the mildest measure** | K § 6 Nr. 1 | Yes. The code already issues warnings (`SanctionKind 'warning'` in `src/modules/moderation/decide.ts`), but **7.2 does not list them**. Adding it makes the text match the code (Art. 14 DSA). | **high** (one line) |
| 8 | **Pets rules** (Peydoo has dogs, cats, birds and small animals in `seed/categories.ts`) | K Grundsätze "Haustiere" | Yes, as Peydoo's own rules. The legal minimums (puppy age, permits under § 11 TierSchG, protected species) are **[uncertain, lawyer check]**. The new EU dogs-and-cats regulation may add rules for online ads **[uncertain on status]**. | **medium** |
| 9 | **Tickets rules** (Peydoo has a "بلیت کنسرت و رویداد" category) | K Grundsätze "Unzulässige Artikel" | Yes. | **medium** |
| 10 | **Deleting inactive accounts after notice** | K § 11 Nr. 4 (12 months, 30 days' notice) | Yes, and it supports GDPR storage limitation (Art. 5 (1) (e)). Leave out accounts with running paid services. I suggest **24 months**, not 12: cities open slowly, so people sign up long before they use Peydoo. | **medium** |
| 11 | **Changes to paid digital products** (§ 327r BGB) | K § 13 Nr. 2 | **Yes, and needed.** Peydoo 2.1 lets Peydoo change or stop features. For a consumer's running paid product (7-day featured listing, featured event) a change is only allowed if the contract says so and the § 327r conditions are met. | **medium** |
| 12 | **Purchased services stay with the account; no resale** | K § 3 Nr. 7 | Yes (§ 399 BGB; clear interest). Covers bumps and Pro features, including staff seats. | **medium** |
| 13 | **Deleting your account ends running paid services without a refund** (withdrawal right unaffected) | K § 11 Nr. 1 | Probably yes. It mirrors the statutory result when the customer makes performance impossible (§ 326 (2) BGB). **[uncertain against consumers; lawyer]**. Also check what the code does with an active subscription when an account is deleted. | **low–medium** |
| 14 | **Passing a rights holder's name to the seller** (for IP and personal-rights notices) | K § 7 Nr. 2; consent box on the IP form | Yes, with notice in the form (Art. 6 (1) (a) or (f) GDPR). Today **privacy 7 promises never to pass on the reporter's name**, so add a narrow exception for "own rights" notices. | **low–medium** |
| 15 | **No right to an account** (but no refusal on grounds the AGG forbids) | K § 2 Nr. 3 | Yes. AGG §§ 19–20 limit refusals for mass transactions **[uncertain on scope]**. | **low** |
| 16 | **Making features depend on named conditions** (phone, account age, business check, country of number) | K § 2 Nr. 6 (open-ended list) | Only with a **closed list of criteria**. An open "we may make anything conditional" risks § 308 Nr. 4 and § 307 (1) 2 BGB. Peydoo already applies these conditions in practice; the clause just states them together. **[uncertain]** | **low** |
| 17 | **Costs of a failed direct debit** (B2B subscriptions only) | K § 8 | Against businesses yes. Against consumers only with proof of a lower loss allowed (§ 309 Nr. 5). SEPA in Peydoo is subscriptions only, which are B2B. | **low** |

**Suggested German wording** (own words; section numbers fit Peydoo's terms):

1. **New section 17 "Übertragung des Vertrags"**
   > Wir dürfen diesen Vertrag mit allen Rechten und Pflichten auf eine Gesellschaft übertragen, die Peydoo künftig betreibt (zum Beispiel eine von uns gegründete GmbH oder UG). Wir kündigen die Übertragung mindestens vier Wochen vorher per E-Mail an und nennen dabei die Gesellschaft. Sind Sie nicht einverstanden, können Sie den Vertrag bis zum Tag der Übertragung ohne Frist beenden; für bezahlte, noch nicht erbrachte Leistungen erhalten Sie dann den anteiligen Betrag zurück.

   Privacy policy: name the new controller in the same notice.

2. **New 6.4 "Unzulässige Nutzung"**
   > Nicht erlaubt ist, (a) Inhalte von Peydoo mit automatisierten Mitteln wie Bots, Scrapern oder Crawlern abzurufen oder zu sammeln, außer wir haben es in Textform erlaubt; Suchmaschinen dürfen Peydoo im Rahmen unserer robots.txt erfassen; (b) Kontaktangaben oder andere Daten von Nutzern zu sammeln; (c) Sperren, Zugangsbeschränkungen oder Grenzen nach diesen Bedingungen (zum Beispiel Ziffern 7, 7.5 und 14.1) zu umgehen; (d) Peydoo übermäßig zu belasten, in seinen Betrieb einzugreifen oder Schadsoftware zu übertragen; (e) Werbung, Kettenbriefe oder Massennachrichten zu versenden.

3. **New 6.5 "Daten anderer Nutzer"**
   > Daten, die Sie über Peydoo von anderen Nutzern erhalten (zum Beispiel Namen, Telefonnummern und Nachrichten), dürfen Sie nur für den Kontakt zu dem jeweiligen Angebot verwenden. Soweit das Datenschutzrecht für Sie gilt, sind Sie für diese Daten selbst verantwortlich; das gilt insbesondere für Geschäftskonten.

4. **3.1, second sentence:**
   > Jede Person darf nur ein Konto haben; Unternehmensseiten verwaltet sie über dieses Konto.

   **New 7.7 "Nach einer dauerhaften Sperre":**
   > Wer nach Ziffer 7.6 dauerhaft gesperrt wurde oder wem wir nach Ziffer 11.2 aus wichtigem Grund gekündigt haben, darf kein neues Konto anlegen und kein Konto einer anderen Person nutzen. Nach zwei Jahren können Sie uns bitten, die Sperre zu überprüfen.

5. **4.2, add:**
   > Als Wiederholung gilt auch, eine Anzeige zu löschen und dasselbe Angebot neu einzustellen, damit es wieder oben in den Listen steht; dafür gibt es das Hochschieben (Ziffer 14.2). Titel und Beschreibung dürfen keine Suchbegriffe, Marken oder Orte enthalten, die mit dem Angebot nichts zu tun haben. Anzeigen, die vor allem für andere Websites, Kanäle oder Gruppen werben, sind nicht erlaubt.

6. **7.1, replace the first sentence:**
   > Anzeigen und Veranstaltungen erscheinen in der Regel sofort. Gibt es Anhaltspunkte für einen Verstoß oder Missbrauch, zum Beispiel bei sehr neuen Konten oder in Kategorien, in denen oft betrogen wird, können wir die Veröffentlichung zurückhalten, bis ein Mensch sie geprüft hat; das geschieht an Werktagen in der Regel innerhalb von 24 Stunden. Eine gebuchte Hervorhebung beginnt erst mit der Veröffentlichung. Waren, die typischerweise für Betrug angeboten werden, können wir ganz ausschließen; sie stehen in Ziffer 5.

7. **7.2, first list item:**
   > eine Verwarnung aussprechen,

8. **New 5.12 "Tiere"** **[legal details to be checked]**
   > Tiere dürfen nur ihre Halter anbieten. Nicht erlaubt sind: Tiere geschützter Arten ohne die vorgeschriebenen Nachweise, Hunde- und Katzenwelpen unter dem gesetzlichen Mindestalter, der Versand lebender Tiere und gewerbsmäßiger Handel ohne behördliche Erlaubnis. Angaben zu Alter, Herkunft, Gesundheit, Impfungen und Kennzeichnung müssen stimmen.

9. **New 5.13 "Eintrittskarten"**
   > Eintrittskarten dürfen Sie nur anbieten, wenn Sie sie besitzen und der Veranstalter die Weitergabe erlaubt; personalisierte Karten, die nicht übertragen werden dürfen, sind ausgeschlossen.

10. **New 11.3 "Inaktive Konten"**
    > Haben Sie sich 24 Monate lang nicht angemeldet und laufen keine bezahlten Leistungen, können wir Ihr Konto löschen. Wir kündigen das mindestens 30 Tage vorher per E-Mail an; melden Sie sich in dieser Zeit an, bleibt Ihr Konto bestehen.

    Privacy 9 retention: add the same rule.

11. **2.3 or 14.6, add:**
    > Ändern wir eine laufende bezahlte Leistung aus einem sachlichen Grund (zum Beispiel Sicherheit, rechtliche Vorgaben, technische Weiterentwicklung), entstehen Ihnen dadurch keine Kosten. Beeinträchtigt die Änderung die Leistung mehr als nur unerheblich, informieren wir Sie vorher per E-Mail; Sie können den Vertrag dann innerhalb von 30 Tagen beenden und erhalten den nicht genutzten Teil zurück (§ 327r BGB).

12. **New 14.9**
    > Gebuchte Leistungen gelten nur für Ihr eigenes Konto oder das Unternehmen, für das sie gebucht wurden. Sie dürfen sie nicht an andere weitergeben oder verkaufen.

13. **11.1, add** **[lawyer]**:
    > Löschen Sie Ihr Konto, enden laufende bezahlte Leistungen; eine Erstattung erfolgt dann nicht. Ihr Widerrufsrecht (Ziffer 14.4) bleibt unberührt. Ein Abonnement kündigen Sie vorher im Kundenportal von Stripe.

14. **Privacy 7, "Meldungen", add:**
    > Melden Sie die Verletzung eigener Rechte (zum Beispiel Urheber-, Marken- oder Persönlichkeitsrechte), können wir Ihren Namen und eine von Ihnen genannte Kontaktadresse an die betroffene Person weitergeben, damit sie sich äußern kann; darauf weisen wir im Meldeformular hin.

15. **3.1, add:**
    > Ein Anspruch auf ein Konto besteht nicht; wir lehnen aber niemanden aus einem Grund ab, den das Allgemeine Gleichbehandlungsgesetz verbietet.

16. **7.5, add** (closed list):
    > Einzelne Funktionen hängen von einer bestätigten Telefonnummer, dem Alter des Kontos, dem Land der Telefonnummer oder einer Prüfung des Unternehmens ab; die Einzelheiten stehen in diesen Bedingungen und in der Hilfe.

17. **14.3, add** (businesses only):
    > Schlägt eine Lastschrift aus einem Grund fehl, den Sie zu vertreten haben, ersetzen Sie uns die Bankgebühren dafür.

All of these must also go into the Persian text in `fa.ts` (`pages.terms`, `pages.privacy`), because both versions are binding (13.2). `tests/legal.test.ts` keeps the numbering in step. New sections that moderation can cite also need ids for `policyGround()` (`src/modules/moderation/terms.ts`).

### 2.2 Structure and presentation ideas

1. **A rules annex inside the versioned terms, plus a plain help page.**
   - Kleinanzeigen keeps its detailed rules on a separate page ("Grundsätze") that the terms pull in by reference.
   - For Peydoo it is safer to put category rules (pets, tickets, vehicles, rentals, jobs, licensed services) in an **annex that is part of the versioned terms**. A separate, unversioned web page would change the contract without notice (§ 305 (2) BGB; Peydoo's own clause 12).
   - Then add a Persian help page «چه چیزهایی مجاز است؟» ("What is allowed?") that explains the rules simply and links to the section ids.
2. **A public prices page** (`/prices`) in EUR: each product, what it does, how long it runs, price, and that the § 19 UStG small-business rule applies (no VAT shown).
   - markt.de links its prices page from the Impressum under § 4 DL-InfoV and the PAngV **[verified]**.
   - Kleinanzeigen explains its featured options in a help article linked from terms § 1.
   - Peydoo's 14.2 lists the products but not the prices. Link the page from 14.2, the footer and the Impressum. Whether DL-InfoV applies to platform services is **[uncertain]**; the page is cheap either way.
3. **Safety page additions** (Kleinanzeigen's "Sicherheitshinweise"):
   - a three-word rule like their "Stop – Question – Protect" (in Persian);
   - the **official sender addresses and handles**: "Peydoo only writes from @peydoo.com and the bot @peydoobot; we never ask for your login code or bank details";
   - examples of fake messages;
   - what to do after a fraud: police report first, then report in Peydoo. markt.de has a "Betrogen worden – was jetzt?" card.
4. **A "Contact Peydoo" help item** like Kleinanzeigen's: help first, how long answers take, why there is no phone.
5. **A page for rights holders**, with a structured notice (Peydoo URLs, which right, proof, declaration of good faith, consent to pass on name and contact). Kleinanzeigen uses a PDF form sent by email or fax. A web form under topic 4 would be easier.
6. **Notes for authorities** next to the authorities address. markt.de asks for the legal basis, facts and requester details (§ 24 TDDDG, then still called TTDSG). Asking for these up front saves a round of emails.
7. **Archive of earlier terms.** Kleinanzeigen publishes its previous version at `/nutzungsbedingungen_alt/` **[verified link]**. Peydoo sends old versions only on request (15.3). legal-review B1 suggested an archive link; the version data already exists.
8. **Monthly active users.** willhaben shows its average monthly users in the Impressum (Art. 24 (2) DSA) **[verified]**. legal-review B3 marks the duty for micro platforms as uncertain; showing "weniger als 45 Mio." costs nothing.

### 2.3 Privacy policy: what is missing given Peydoo's real processing

Peydoo's privacy policy is already detailed and matches `docs/setup.md` well: Hetzner, Cloudflare (including Turnstile and country lookup), R2, SES, Zoho, Stripe, Sentry, n8n, Telegram and OpenStreetMap are all named. Gaps found by comparing with Kleinanzeigen's policy:

| Gap | Kleinanzeigen | Suggested addition (own words) |
|---|---|---|
| Users who receive other users' data are responsible for it themselves | Privacy sec. 11 **[verified]** | "Erhalten Sie über Peydoo Daten anderer Nutzer, etwa in Nachrichten oder durch eine angezeigte Telefonnummer, sind Sie für deren weitere Verwendung selbst verantwortlich, soweit das Datenschutzrecht für Sie gilt. Verwenden Sie sie nur für den Kontakt zu dem jeweiligen Angebot." |
| Manifestly unfounded or excessive requests; identity check | Sec. 8 (fee or refusal) **[verified]** | "Anträge beantworten wir unentgeltlich. Bei offenkundig unbegründeten oder, etwa wegen häufiger Wiederholung, exzessiven Anträgen können wir ein angemessenes Entgelt verlangen oder den Antrag ablehnen (Art. 12 Abs. 5 DSGVO). Haben wir begründete Zweifel an Ihrer Identität, können wir weitere Angaben verlangen (Art. 12 Abs. 6 DSGVO); Anfragen zu einem Konto beantworten wir an dessen E-Mail-Adresse oder nach der Anmeldung." This protects a one-person operator from waves of access requests and fits the contact design. |
| Minors | Sec. 11 "Privatsphäre von Kindern" **[verified]** | "Peydoo richtet sich nicht an Personen unter 18 Jahren (Nutzungsbedingungen Ziffer 3.1)." |
| Inactive-account deletion | Terms § 11 Nr. 4 | Add to section 9 if rule 10 above is adopted. |
| Contact form after the redesign | — | Section 3.7: guest messages held up to 24 hours until confirmed, the confirmation email, honeypot and timing checks store nothing, topic tags. |
| Passing a rights holder's name to the seller | Terms § 7 Nr. 2; IP form | See 2.1 item 14. |
| Push notifications (planned PWA push, memory "Apps: PWA first") | Sec. 5.1 lists push | When push is built: the browser asks for permission (consent, § 25 (1) TDDDG), name the push services (Google, Mozilla, Apple; US transfer), and how to switch it off. Already flagged in legal-review B2. |
| Checks against public registers (if Peydoo looks up Handelsregister data for the "verified business" badge) | Sec. 4.4 "public sources" | Terms 14.1 mentions "Registerangaben". If staff look up registers, add "aus öffentlichen Registern (z. B. Handelsregister)" to privacy 5.1. **[check what staff actually do]** |
| Login persistence on shared devices | Sec. 11 | Optional: "Melden Sie sich auf fremden Geräten nach der Nutzung ab; die Anmeldung bleibt sonst 30 Tage bestehen." |

Small inconsistency found: in `docs/setup.md` ("Legal pages", "Terms and privacy rewritten") the text still says "the Gmail inbox stated openly". The privacy policy now correctly names **Zoho Mail**. The doc line is out of date.

**Not to copy from their privacy policy** (it does not match Peydoo's processing): personalised advertising and segments, credit agencies and Schufa, data sharing within the Adevinta group, call recording, AI assistants, TV-campaign measurement, keeping data of blocked accounts for 3 years. Peydoo keeps only a keyed fingerprint for 2 years, which is leaner and better.

### 2.4 What Peydoo should NOT copy

| Kleinanzeigen does | Why not for Peydoo |
|---|---|
| **"No objection means consent"** for non-material changes to the terms (K § 13) | Void against consumers beyond trivial changes (BGH XI ZR 26/20; legal-review C2). Peydoo's clause 12 is the safer model. |
| **Severability clause with a duty to negotiate a replacement** (K § 15) | Void or pointless; § 306 BGB already applies (legal-review C2). |
| **Broad promotion licence**: ads used on third-party platforms, in TV and print, translated, with third parties given access (K § 1 Nr. 7) | Too broad for § 307 BGB and the purpose-transfer rule (§ 31 (5) UrhG). Republishing users' content as Peydoo's own also risks the DSA hosting privilege (legal-review B1-9.1, C3). Keep 9.1. |
| **Court in Potsdam for merchants**, extra court for consumers | Peydoo's owner is not a merchant. 13.4 is already the correct version. |
| **Terms only in German** | Peydoo's users read Persian; both versions are binding (13.2). |
| **DSA out-of-court dispute bodies, trusted-flagger priority, P2B complaint system and mediators, transparency reports** (K § 7, § 15; gewerbliche_beschwerden page) | Micro and small companies are exempt (DSA Art. 19 for Art. 20–28; Art. 15 (2); P2B Art. 11 (5), 12 (7)). Promising them in the terms would turn them into contractual duties. |
| **30 days' notice before any block of a business account** (K § 6 Nr. 1) | P2B Art. 4 asks for reasons at the time of a restriction, and 30 days only for ending the whole service (Peydoo 11.2 already does this). A 30-day wait before every block would slow fraud response. |
| **Absolute "no refund when a listing is deleted for a breach"** (Grundsätze) | Risky against consumers (§ 309 Nr. 5; legal-review B1-14.6). |
| **Two accounts per person** (one private, one business) | Peydoo's business pages hang off one personal account; one account per person is simpler and stricter. |
| **"User enquiries are not handled" on the Impressum email** (markt.de says this about `impressum@`) | After LG München I (2025) this is risky for the § 5 DDG address. Use it only on an extra authorities address. |
| **Login for every contact topic** | Only safe together with another open channel. Kleinanzeigen has a fax; Peydoo would need a guest path anyway (section 1.4). |
| **Data-hungry processing** (credit checks, ad segments, group sharing) | Not done; Peydoo's "no tracking" promise is a selling point. |

---

## 3. Suggested order of work

1. **Contact form** (section 1.5): topic picker with help answers, sign-in for the high-volume topics, honeypot and minimum time, confirmation link for guests on topics 6–7, `behoerden@` alias, subject tags. Update terms 8.2, the Impressum, `pages.contact` and privacy 3.7 together.
2. **One new terms version before public launch** with items 1–7 of section 2.1 (high priority), plus 8–12 if the owner agrees. Add the privacy additions from section 2.3. Ask the lawyer about items 1, 8, 13 and 16 when the next review happens (add them to legal-review E1).
3. **Pages:** prices, rights holders, rules help page, safety additions, terms archive.

## Sources

Kleinanzeigen (read 2 Nov 2026):
- Impressum: https://www.kleinanzeigen.de/impressum.html
- Terms: https://themen.kleinanzeigen.de/nutzungsbedingungen/
- Rules (Grundsätze): https://themen.kleinanzeigen.de/policy/
- Privacy policy: https://themen.kleinanzeigen.de/datenschutzerklaerung/
- Safety page: https://themen.kleinanzeigen.de/sicherheitshinweise/
- IP-infringement form: https://kleinanzeigen.de/public-ep-frontend-web/pdf/2026_kleinanzeigen_rechtsverletzung.pdf

Kleinanzeigen help centre (Wayback Machine copies):
- Form, Sep 2026: https://web.archive.org/web/20260917202156/https://hilfe.kleinanzeigen.de/hc/de/requests/new
- Form, Feb 2025: https://web.archive.org/web/20250213053407/https://hilfe.kleinanzeigen.de/hc/de/requests/new
- Contact article: https://web.archive.org/web/20260829042413/https://hilfe.kleinanzeigen.de/hc/de/articles/17426476500508-Kontakt-zu-Kleinanzeigen-Deine-Fragen-unsere-Antworten
- Reporting article: https://web.archive.org/web/20260316211713/https://hilfe.kleinanzeigen.de/hc/de/articles/17088366607388-Unzul%C3%A4ssige-Anzeige-melden

Zendesk:
- https://support.zendesk.com/hc/en-us/articles/4408839088794-About-CAPTCHA-and-CAPTCHA-FAQs
- https://support.zendesk.com/hc/en-us/articles/10360295453082-Announcing-verification-for-anonymous-help-center-requests

willhaben:
- https://www.willhaben.at/iad/impressum
- https://web.archive.org/web/20261019172441/https://hilfe.willhaben.at/hc/de/requests/new

markt.de:
- https://www.markt.de/impressum.htm
- https://www.markt.de/service.htm

Law and commentary:
- CJEU C-298/07: https://lexetius.com/2008,2648 (EUR-Lex CELEX 62007CJ0298)
- LG München I 33 O 3721/24 (summary): https://www.it-recht-kanzlei.de/lg-muenchen-e-mail-adresse-impressum-direkte-kontaktmoeglichkeit.html
- Commentary on § 5 DDG contact channels: https://www.juraforum.de/lexikon/impressum-telefonnummer-pflicht
- Statutes (not re-fetched for this study; cited from the text of the law): BGB §§ 305–310, 326, 327r, 399, 415 (https://www.gesetze-im-internet.de/bgb/); UrhG §§ 44b, 87b (https://www.gesetze-im-internet.de/urhg/); DSA Regulation (EU) 2022/2065 (https://eur-lex.europa.eu/eli/reg/2022/2065/oj); P2B Regulation (EU) 2019/1150.

Peydoo's own research and code:
- `docs/legal-review.md` (rows B1, B2, B3; sections C2, C3)
- `docs/setup.md` ("Legal pages", "Bot protection")
- The code files listed at the top.
