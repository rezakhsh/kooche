# Legal pieces: plan (Nov 6, 2026)

Six things the new terms and privacy pages promise but the site doesn't do yet. Built on staging only; production on the owner's «release». Mockups: `docs/design-options/mockups/final/legal-*` (pictures in `/root/peydoo-media/wave2/legal-pieces/mockups/`, phone and computer, light and dark).

## What others do (and what we take)

- **Order button.** German courts rejected "Weiter zur Zahlung" and "Abonnieren" as order buttons (OLG Düsseldorf 20 UKl 4/23, Meta). The 2026 courts are split on "Bestellen" alone (KG Berlin 1 U 25/25 vs OLG Frankfurt). Stripe can't rename its own button (only "Pay/Bezahlen" or "Subscribe/Abonnieren"). Shops that send buyers to PayPal or Klarna put the summary and «zahlungspflichtig bestellen» on their own page, then send the buyer off only to pay. **We do the same.**
- **Cancel button (§ 312k).** Big sites (ImmoScout24, Netflix) have a footer link on every page. It leads to one page that holds every field and the "Jetzt kündigen" button, needs no sign-in (LG München I 33 O 15098/22; OLG Düsseldorf 20 UKl 3/23: no login step in between), and sends an email receipt with date and time. Nothing else may be on that page, such as "pause instead" offers (BGH I ZR 200/25, July 2026). **We do the same**, even though Pro is for businesses only (Kleinanzeigen has none, but it is the cheap safety net the legal review suggests).
- **Confirmation email.** A link to the website is not a "durable medium" (CJEU C-49/11). German shops either put the full withdrawal notice into the email or attach it, and attach the terms. **We put the withdrawal notice and model form into the email and attach the terms as files.**
- **Telegram.** No EU site found that asks for this. We follow the model wording from e-recht24: a separate yes/no that names the risk, with email as the alternative.
- **New terms.** Kleinanzeigen asks for active consent to important changes. We ask once at the next sign-in. Silence never counts as yes.

## 1. Store which terms each person accepted

- **What people see:** nothing new. The account settings page shows one line: "You accepted the terms of 3 November 2026 on …".
- **Stored:** a new table `terms_acceptances` with the person, the version (its start day), a fingerprint of the exact German and Persian text, when, how (sign-up or a later "I agree"), IP address and browser. The full text of each version is kept once in `legal_texts`, so we can always show what someone agreed to, even years later.
- **Existing accounts** (signed up before today): one row "accepted at sign-up" with their sign-up time. They saw the same notice on the sign-in page. It is marked so we never pretend it is more than that.
- Every purchase also records the terms version in its existing purchase record.

## 2. «لغو قرارداد (Verträge hier kündigen)», the cancel button

- **Where:** in the footer of every page, under «حقوقی», and on the business's billing page.
- **The page** (`/cancel`, no sign-in needed): name, email, which contract (optional; we also find it by email), normal (at the end of the period) or immediate with an important reason, end date ("as soon as possible"), and one red button «همین حالا لغو کن (jetzt kündigen)». Signed in, the fields are filled and the business's plan is chosen.
- **After the click:** a receipt page with the date and time (save or print), and at once an email receipt to the address given **and** to the business owner, by Telegram too (rule: always tell the person). If the email or the signed-in person matches a business with Pro, Stripe is told "end at the end of the period" right away. This can be undone from the billing page until that day, so a stranger's form can't do lasting harm. If we can't match it, or it is an immediate cancellation, it goes to support@ with [Kündigung] for you to handle.
- **Stored:** table `contract_cancellations` (who, what, when, kind, result).

## 3. Order summary and «سفارش با پرداخت (zahlungspflichtig bestellen)»

- **Every paid path:** bump, 3 bumps, featured, featured event (promote page), Pro and Pro Plus (billing page), founding Pro.
- **Right above the button:** what it is, for which listing or business, the total price, how long it runs, whether it renews and how to cancel (plans), the 14-day withdrawal right and when it is lost (bumps and featured). The box changes with the option you tick, without needing JavaScript.
- **The button** says «سفارش با پرداخت (zahlungspflichtig bestellen)». Founding Pro is free and asks for no card, so its button stays «شروع ۶ ماه پروی رایگان».
- **Stripe's page** also shows the German essentials in a line above its own button.
- **Terms 15.2** describes the old flow ("binding on Stripe's page"). I add a new version: "the button on Peydoo is your binding order; the contract starts when the payment succeeds". This does not worsen anything, so it goes out with the usual 4-week email notice when you choose (admin › «خبر تغییر شرایط به همه»).

## 4. Terms and withdrawal notice in the payment confirmation email

- **Bump, 3 bumps, featured, featured event** (private persons): the "payment done" email gets a box with the order (what, price, date and time), the sentence that you asked for an immediate start and know the withdrawal right ends, and the last day to withdraw. Below that, in German (binding): the order confirmation, the full withdrawal notice and the model form. Two attached files: the terms in German and in Persian (plain text, which every phone opens; we have no PDF tool, and adding one would mean a new package).
- **Businesses** (Pro started, a business's bump): the same email with the terms attached and a line saying there is no withdrawal right for businesses.
- **No new migration.**

## 5. Telegram only with a clear "yes"

- **Where people see it:** right after a phone check through Telegram, and in «اعلان‌ها» (notifications). The card says plainly that Telegram is outside the EU (UAE, British Virgin Islands), that the bot's messages are not end-to-end encrypted, and that email works instead. Two buttons: «بله، در تلگرام هم بفرستید» and «نه، فقط ایمیل».
- **Withdraw:** one switch «اعلان در تلگرام» on the notifications page. From that moment nothing goes to Telegram, and email takes over. Writing /stop to the bot does the same.
- **In the code:** every Telegram notice (chat, replies, saved searches, events, payments, business and moderation notices) passes through one check, so nothing can slip past it. The phone check itself (the person writes to the bot) still works without the "yes".
- **Stored:** `users.telegram_consent_at` (empty = no), and each yes and withdrawal in the audit log with the time.
- **People already linked:** Telegram stops until they say yes. They see the card once on their next visit. Email carries everything in between.
- The privacy policy (section 8) gets the consent as the legal basis, in German and Persian (a correction in our favour, no notice needed).

## 6. "I agree" to worse new terms at the next sign-in

- **In the code:** a new terms version can be marked "needs consent". Minor changes keep today's email notice and nothing else.
- **What people see** after such a version starts: at the next sign-in (and on the next signed-in page, for people who stay signed in) a page with the date, the changes in short, links to the full text (Persian and German), «موافقم (Ich stimme zu)», «فعلاً نه», and a link to delete the account. Mockup: `legal-reconsent`.
- **Stored:** the "I agree" goes into `terms_acceptances` (piece 1).
- **No such change exists today.** I build it, test it, and show it on staging with a test version that only staging sees.

## Migrations

One migration (0049): `terms_acceptances`, `legal_texts`, `contract_cancellations`, `users.telegram_consent_at`, and the backfill for existing accounts. Account deletion removes the person's acceptance and consent rows, as it does today with the legal notices.

## For the lawyer (in `docs/legal-review.md`)

- Is the Persian label with «zahlungspflichtig bestellen» next to it good enough for the button?
- Does a business-only Pro also need the § 312k page? (Built anyway.)
- May a page without sign-in cancel automatically when the email matches? (We chose: yes, at period end, undoable.)
- Is a plain-text file of the terms a durable medium, or is a PDF needed?
- How long may we keep acceptance records after an account is deleted? (Today: deleted with it.)
- The § 356a withdrawal button sits behind sign-in («خریدهای من»). Is that enough? (An open question from the review; not one of these six.)
