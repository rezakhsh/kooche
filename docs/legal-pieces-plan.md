# Legal pieces: plan, Kleinanzeigen level (Nov 6, 2026)

The owner found the first plan too strict and dropped the Telegram consent ("we never send data to Telegram; Telegram is just their notification"). This version copies what **Kleinanzeigen** itself does (checked on their terms, footer and help pages, Nov 6, 2026), not the strictest court reading. Built on staging only; production on the owner's «release». Mockups: `docs/design-options/mockups/final/legal-promote`, `legal-pro`, `legal-pro-cancel`, `legal-email` (pictures in `/root/peydoo-media/wave2/legal-pieces/mockups-light/`).

## What Kleinanzeigen does

- **Sign-up:** sending the form means accepting the terms (§ 2 Nr. 3). No tick box is mentioned.
- **Paid options:** the price shows in the form and again at the button. Paying is the binding step: "if you stop the payment, the ad isn't published" (help "Gebühren", § 3). No order-summary page, and no separate box for losing the withdrawal right was found.
- **Subscriptions** (PRO for businesses; also private ones such as "KA Pur" and "Plus" packages): cancelled in the account ("Abonnement verwalten", "Meine Anzeigen") or by email (§ 11). **No "Verträge hier kündigen" link** anywhere.
- **Emails:** invoices by email. Nothing found about attaching the terms.
- **Terms changes** (§ 13): notice 30 days ahead (15 for businesses). Small changes count as accepted unless the user objects. Big changes need "ausdrückliche Zustimmung". No screen at sign-in was found.
- **Withdrawal:** a footer link «Vertrag Widerrufen» to a form. Peydoo has its button behind sign-in in «خریدهای من».

## The pieces

1. **Store the accepted terms version.** Nothing new to see. At sign-up we save the version, the time, the IP address and the browser in a new table `terms_acceptances`, and each purchase records the version too. Existing accounts get one row "accepted at sign-up" with their sign-up time. Account deletion removes the rows.
2. **Cancelling Pro** (instead of a footer page): on the billing page, next to «کارت، فاکتورها و تغییر پلن» (Stripe's page), our own red **«لغو اشتراک»** with one confirmation ("Pro works until 21 December, then ends; no more charges; you can switch it back on until then"). It ends at the period's end. An email receipt with the date and time goes to the owner, and Telegram too (rule: always tell the person). Before the end, «روشن کردن دوباره» undoes it. No footer link, as at Kleinanzeigen.
3. **Price at the button.** On the promote page, one line above the button: what, for which listing, price, "once, doesn't renew". The button reads **«پرداخت ۱٫۹۹ €»** and follows the ticked option. On the billing page, one line in each plan: "€24 a month, renews every month, cancel here any time", with the button «پرداخت و شروع اشتراک». The existing withdrawal tick stays. Founding Pro stays «شروع ۶ ماه پروی رایگان». No terms change: paying on Stripe stays the binding step, as at Kleinanzeigen.
4. **The payment email.** The existing «پرداخت انجام شد» email gets:
   - a short box: what was bought, the price, the date and time, the sentence that you asked for an immediate start, and the last day to withdraw;
   - then, in German: the order confirmation, the withdrawal notice and the model form, as text;
   - the terms as a link, with no attachments.

   For businesses (Pro, a business's bump) the line says there is no withdrawal right. The law (§ 312f) asks for this confirmation; it is one block of text in an email we already send.
5. **Telegram consent:** dropped (owner).
6. **"I agree" to worse new terms:** see the question to the owner: build now or when the first such change comes. Small changes keep today's 4-week email.

## Migration

One (0049): `terms_acceptances` with the backfill for existing accounts. Cancelling uses Stripe's own "cancel at period end"; nothing new in our database apart from the audit log.

## For the lawyer (added to `docs/legal-review.md`)

- No § 312k footer page, only cancelling in the account (Pro is business-only; Kleinanzeigen has none either).
- The button reads «پرداخت ۱٫۹۹ €» (Persian, with the price), not «zahlungspflichtig bestellen».
- The terms are sent as a link in the confirmation email, not as text or an attachment.
- No consent for Telegram notices (owner's decision).
