# Legal pieces (Nov 6, 2026)

Six items in the brief: things the new terms and privacy pages promise but the code doesn't do yet (`docs/progress.md`, "Legal part 2"). Three plans were drawn up the same day:

1. **Strict** (first draft): an order-summary box with «zahlungspflichtig bestellen», a § 312k cancel page in every footer, terms attached to emails, consent before Telegram notices, and a «موافقم» screen. The owner: "too much; we never send data to Telegram; see what Kleinanzeigen does".
2. **Kleinanzeigen level:** Kleinanzeigen's own terms, footer and help pages were checked (no "Verträge hier kündigen" link, price again at the button, paying is the binding step, deemed consent for small terms changes, a footer "Vertrag Widerrufen" form). The owner: "we have this big website for many countries, so make it very simple or don't change it; I don't want customers in the US, England and other countries to have difficulties".
3. **Built (very simple):** nothing new to do or tick for anyone.
   - The accepted terms version is recorded at sign-up and with every purchase (audit log, with a fingerprint of the text).
   - The pay button shows the price of the ticked option («پرداخت ۱٫۹۹ €»).
   - The «پرداخت انجام شد» email carries the last day to withdraw, and below it in German the order confirmation with the statutory withdrawal notice and model form.

Not built, by the owner's decision: the Telegram consent, the cancel page, the summary box, and the «موافقم» screen (built later, with the first worsening change). How it works: `docs/setup.md`, "Legal pages" › "Legal pieces". For the lawyer: `docs/legal-review.md`, section G.

Mockups: `docs/design-options/mockups/final/legal-promote` (the button) and `legal-email` (the email). Pictures of all three rounds are in `/root/peydoo-media/wave2/legal-pieces/` (`mockups/` = strict, `mockups-light/` = Kleinanzeigen level).
