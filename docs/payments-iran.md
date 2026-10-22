# Payments from Iran: study

Oct 22, 2026 · roadmap step 6, Part A · **Study only. Nothing is built for it.**

> **This is not legal advice.** It summarises public sources so the owner can brief a sanctions lawyer. A lawyer who knows EU, German and US Iran sanctions must confirm any approach **before anything is built**, and again before money from or for people in Iran is ever accepted.

## The question

The owner wants people living in Iran to be able, later, to buy Pro or visibility (bumps, featured) for listings in some countries. Peydoo is run by a German sole trader under the small-business VAT exemption, takes payments through Stripe, and has no presence in Iran.

## Short answer

- **Safe now: nothing that takes money from people in Iran, directly or through anyone else.** Peydoo stays free to use from anywhere (posting is free for private users), and paid products are sold only through Stripe to payers who are outside Iran and buying for themselves.
- **Every route that moves money out of Iran to the owner** (an Iranian gateway, a partner who forwards rial income, crypto from Iranian exchanges) runs into the EU funds-transfer rules, the asset freezes on Iran's main banks, the US secondary sanctions on Iran's financial sector, and the anti-circumvention rule. Each one would also end the Stripe account if Stripe linked it to Peydoo.
- **The one option worth taking to a lawyer:** a gift code bought **openly** outside Iran by someone who pays from their own money, used on a listing whose subject is outside Iran (for example a flat in Berlin), with the buyer and the code holder both screened against the sanctions lists, and run through a **second, separate provider whose terms allow it**, never Stripe. Whether even that is allowed depends on facts a lawyer has to check (see "Option 5").
- The payments code stays provider-neutral (`provider` columns on `product_prices`, `billing_customers`, `orders`, `payments`, `subscriptions`, `webhook_events`), so a second provider can be added later without touching Stripe's path.

## 1. The legal position

### EU: Regulation (EU) No 267/2012, as restored after the snapback

- The E3 (France, Germany, UK) triggered the UN "snapback" in August 2025. The UN measures returned on 28 September 2025, and the Council reimposed the EU measures it had lifted under the JCPOA on 29 September 2025: Council Regulation (EU) 2025/1975 amends Regulation 267/2012, Implementing Regulations 2025/1980 and 2025/1982 restore the asset-freeze listings, and Decision (CFSP) 2025/1972 amends the CFSP decision. ([Council press release](https://www.consilium.europa.eu/en/press/press-releases/2025/09/29/iran-sanctions-snapback-council-reimposes-restrictive-measures/), [EU Sanctions Helpdesk](https://eu-sanctions-compliance-helpdesk.europa.eu/iran-sanctions-snapback-council-reimposes-restrictive-measures_en), [Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2025/10/eu-reintroduces-sanctions-against-iran-following-un-snapback), [Gibson Dunn](https://www.gibsondunn.com/snap-decision-renewed-global-iran-sanctions-and-increased-risks-for-business/))
- **Funds transfers (Articles 30 and 30a).** Transfers between EU banks and Iranian banks are prohibited in principle. Transfers to or from any "Iranian person", which includes any individual in or resident in Iran, are allowed below €10,000 and need a notification or a prior authorisation above that, **counting linked operations together**. ([Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2025/10/eu-reintroduces-sanctions-against-iran-following-un-snapback)) Each sale here is small, but a business that collects many small payments from Iran through one channel is the textbook case of "linked operations", and the bank or provider in the middle has to apply enhanced vigilance anyway.
- **Asset freezes.** The Central Bank of Iran and Iran's major commercial banks are listed again; making funds available to them, directly or indirectly, is prohibited. ([Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2025/10/eu-reintroduces-sanctions-against-iran-following-un-snapback)) Almost every rial payment inside Iran settles through these banks.
- **No general ban on serving people in Iran.** The EU measures are targeted (goods lists, sectors, listed persons, transfers), not a ban on offering an online service to Iranian residents. That is why Peydoo can be **used** from Iran; the problem is **taking money**.
- **Anti-circumvention (Article 41).** It is prohibited to take part, knowingly and intentionally, in activities whose object or effect is to circumvent the measures, including Article 30. ([Regulation 267/2012, art. 41](https://legislation.gov.uk/eur/2012/267/article/41/adopted?view=plain)) Any design whose purpose is to make an Iranian payment look like a non-Iranian one is exactly this.
- Check the current consolidated text on EUR-Lex before relying on article numbers; the regulation has been amended many times since 2012.

### Germany

- **Deutsche Bundesbank, Servicezentrum Finanzsanktionen** handles the financial side of the Iran sanctions in Germany: notifications and authorisations for transfers, and exemptions from freezes. ([Bundesbank: Iran](https://www.bundesbank.de/de/service/finanzsanktionen/sanktionsregimes/-/iran-610216))
- **BAFA** (Federal Office for Economic Affairs and Export Control) handles the goods and export side. An online advertising service is not a listed good, so BAFA is unlikely to be the relevant authority here, but the lawyer should confirm.
- Breaches of EU sanctions regulations are criminal offences under § 18 of the Foreign Trade and Payments Act (Außenwirtschaftsgesetz, AWG), with prison terms; negligent breaches can be administrative offences under § 19 AWG. ([AWG on gesetze-im-internet.de](https://www.gesetze-im-internet.de/awg_2013/))
- Separately, the Foreign Trade and Payments Ordinance (AWV) requires reporting incoming payments from abroad above €12,500; small sales stay below that, but it shows how visible such flows are.

### United States: secondary sanctions

- The US has comprehensive sanctions on Iran for US persons, and **secondary sanctions** that can hit non-US persons with no US link at all. In October 2020, OFAC used Executive Order 13902 to designate Iran's **financial sector**: any person, wherever located, who knowingly engages in a significant transaction with it can be sanctioned. ([Sidley](https://www.sidley.com/zh-hans/insights/newsupdates/2020/10/treasury-sanctions-iranian-financial-sector), [Orrick](https://www.orrick.com/en/Insights/2020/01/US-Targets-Additional-Iranian-Sectors-for-Sanctions-Broadly-Increasing-Exposure-for-Non-US-Companies)) A law-firm update of 31 August 2026 reports further sectors, including **digital assets**, made subject to EO 13902; only one source was found for this, so the lawyer should confirm it. ([Steptoe, weekly sanctions update](https://www.steptoe.com/en/news-publications/international-compliance-blog/weekly-sanctions-update-august-31-2026.html))
- OFAC's carve-outs for non-US persons cover food, agriculture, medicine and medical devices, and financial-sector dealings that a US person could do under General License L. Advertising products for a marketplace are not among them. ([OFAC FAQ 844](https://ofac.treasury.gov/faqs/844))
- A small German business is not a likely OFAC target. The real US exposure is indirect: every card network, PayPal, Stripe, Apple and Google is a US company or depends on US banks, and they cut off any merchant who might draw them into a violation.
- EU law (the Blocking Statute, Regulation 2271/96) formally forbids EU operators to comply with some US Iran sanctions. It does not oblige a provider to serve anyone, and it is not a reason to route Iranian payments through US-linked providers. ([Gibson Dunn](https://www.gibsondunn.com/snap-decision-renewed-global-iran-sanctions-and-increased-risks-for-business/))

## 2. Why Stripe, PayPal and similar providers refuse Iran

- **Stripe** lists, under "High-Risk Jurisdictions and Persons", persons located in, resident in or citizens of jurisdictions it prohibits, naming Iran (with Cuba, North Korea, Syria and the occupied Ukrainian regions), and persons on OFAC's lists. ([Stripe restricted businesses](https://stripe.com/legal/restricted-businesses))
- **PayPal** paid OFAC $7.66 million in March 2015 for 486 apparent sanctions violations (Iran among them) worth $43,934 in total: the payments were tiny, the penalty was not. ([OFAC recent action, 25 March 2015](https://ofac.treasury.gov/recent-actions/20150325_33), [Goodwin](https://www.goodwinlaw.com/publications/2015/04/ofac-announces-settlement-with-paypal-for-apparent)) Since then PayPal, card networks and wallets screen IP addresses, phone numbers, addresses and payer names for Iran.
- **What this means for Peydoo's Stripe account.** Stripe's terms make the merchant responsible for not processing payments for prohibited persons and jurisdictions. If Stripe concludes that Peydoo sells to people in Iran, directly or through codes bought by others for them, the likely outcome is the account closed, funds held for months, and the owner's name on the shared risk databases payment providers use (MATCH for cards), which makes a new account hard to get. **Iran-related sales must never go through the Stripe account, and the Stripe account must never be used to buy something meant for someone in Iran.** This is the main reason to keep any future Iran path on a separate provider and a separate legal footing.

## 3. The options

Each option is judged on: legality (as far as public sources go), risk to the owner, risk to the Stripe account, cost and effort.

### Option 1: an Iranian payment gateway (for example Zarinpal)

How it works: Zarinpal and other Shaparak gateways take rial card payments inside Iran and pay out to a rial account at an Iranian bank.

- **Who can use it:** gateway accounts require an Iranian national ID (کد ملی), an Iranian mobile number and identity checks before the payment gateway is switched on, and pay out only to an Iranian bank account (شبا). ([Zarinpal: membership levels](https://www.zarinpal.com/blog/%D8%B3%D8%B7%D8%AD-%D8%B9%D8%B6%D9%88%DB%8C%D8%AA-%D8%A2%D8%A8%DB%8C), [Zarinpal merchant guide](https://www.zarinpal.com/blog/%D8%B1%D8%A7%D9%87%D9%86%D9%85%D8%A7%DB%8C-%D9%BE%D8%B0%DB%8C%D8%B1%D9%86%D8%AF%DA%AF%D8%A7%D9%86-%D8%B2%D8%B1%DB%8C%D9%86-%D9%BE%D8%A7%D9%84/)) Iranian sites usually also need an eNamad (اینماد) trust certificate. Zarinpal has no recurring payments, so no subscriptions.
- **Legality:** the money ends up in an Iranian bank, often one that is frozen under EU law, and inside the financial sector designated under US EO 13902. Getting it from there to the owner in Germany is an EU funds transfer from an Iranian person (Article 30a), and there is no ordinary banking channel for it. Using someone else's Iranian ID and account to hold the merchant account would be both a breach of the gateway's terms and a textbook circumvention.
- **Risk to the owner:** high (criminal exposure under § 18 AWG if the structure is a circumvention; US secondary sanctions exposure for dealing with Iranian banks).
- **Risk to Stripe:** high if the two are visibly connected (same site, same products).
- **Cost and effort:** an Iranian legal entity or person, eNamad, local support, rial accounting, and no clean way to get the money out.
- **Verdict: not recommended.**

### Option 2: a partner or reseller inside Iran

How it works: an Iranian company sells Peydoo products in Iran for rials and either forwards money to the owner or keeps it.

- **If it forwards money:** the same Article 30a problem as Option 1, plus whatever channel moves the money out (exchange houses, hawala, third-country accounts). Moving it through a third country to hide where it comes from is circumvention.
- **If it keeps all the money** (the owner earns nothing from Iran and gives the partner free codes or access): no money moves to the EU. This may be legal under EU law if the partner, its owners and its banks are not listed and the service is not in a restricted sector, but it earns the owner nothing and still needs screening and a written agreement. US exposure is low for the owner and higher for the partner.
- **Risk to Stripe:** medium; the partner's codes would work on the same site as Stripe products, and Stripe could still see Iranian users of paid features. Keep any such codes entirely outside Stripe.
- **Cost and effort:** finding and vetting a partner, contracts, screening, support in two places.
- **Verdict: forwarding money is not recommended. A no-money partnership is possible only with a lawyer's sign-off, and has little business value.**

### Option 3: crypto or stablecoins

How it works: buyers in Iran pay in USDT or another stablecoin (Iranian exchanges such as Nobitex sell it for rials); the owner receives it in a wallet and converts it to euros at an EU exchange.

- **EU sanctions apply to crypto-assets exactly as to money.** "Funds" and "economic resources" in EU sanctions law include crypto-assets, so Articles 30a, the asset freezes and Article 41 apply unchanged.
- **MiCA and the transfer-of-funds rules:** the owner accepting crypto for their own services is not a crypto-asset service provider, but converting it to euros goes through a MiCA-licensed exchange, which since 30 December 2024 must collect and check who sent each transfer (Regulation (EU) 2023/1113, the "travel rule") and screen for sanctions. ([EBA travel rule guidelines](https://www.eba.europa.eu/activities/single-rulebook/regulatory-activities/anti-money-laundering-and-countering-financing-terrorism/guidelines-information-requirements-relation-transfers-funds-and-certain-crypto-assets-transfers)) Coins traced to Iranian exchanges are routinely frozen by EU exchanges and by stablecoin issuers.
- **US exposure:** if the 2026 EO 13902 digital-assets determination is confirmed, dealing with Iranian exchanges is itself a secondary-sanctions risk.
- **Risk to the owner:** high: frozen funds, account closures at the exchange and at the owner's bank, and the appearance of circumvention (crypto is a known route around Iran's banking isolation).
- **Risk to Stripe:** high if connected.
- **Cost and effort:** low to build, high to keep clean (chain analysis, records, tax treatment of crypto receipts).
- **Verdict: not recommended.**

### Option 4: someone abroad pays the seller's way directly

How it works: a relative in Germany pays for a bump or Pro with their own card and their own account, for a listing that belongs to someone in Iran.

- **If the listing belongs to the person in Iran,** the service is supplied to someone in Iran and paid through Stripe, which Stripe's terms forbid. Done knowingly, it is a way around both the provider's rules and possibly the transfer rules. Peydoo must not offer or suggest it.
- **If the relative buys for their own listing** (they are the seller, the flat is in Germany, the money is theirs), it is an ordinary sale. That is the normal Stripe path today and needs nothing special.
- **Verdict: only the second form is allowed, and it is just the normal product.** The site must not advertise "pay for someone in Iran".

### Option 5: a gift code or voucher bought outside Iran

How it works: someone outside Iran buys a Peydoo credit code with their own money and gives it to someone in Iran, who uses it on a listing.

- **What a lawyer would have to confirm:** that providing an advertising service to a person in Iran is not restricted for the products and listing categories involved; that the code holder and the buyer are screened against the EU and UN lists (and, as a policy choice, OFAC's SDN list); that no Iranian person pays anything, so no Article 30a transfer exists; that the scheme's purpose is not to get around the transfer rules (Article 41); and what records to keep.
- **Stripe:** almost certainly not allowed. A code knowingly sold for use by persons in Iran is a sale for the benefit of a prohibited jurisdiction under Stripe's terms. Codes bought through Stripe must not be marketed or used for Iran.
- **A separate provider:** a European provider whose terms explicitly allow this case after its own compliance review, with separate products, a separate merchant account and full disclosure to that provider of what the codes are for. Few will accept it.
- **Risk to the owner:** medium even with a lawyer's sign-off (the interpretation could be challenged, and banks de-risk anyway).
- **Cost and effort:** a second provider integration (the schema already allows it), a code system (redemption by the worker, entitlements with a new source), screening, records, a lawyer's opinion.
- **Verdict: the only route worth a lawyer's time, and only if the lawyer confirms it and a provider accepts it in writing.**

## 4. Summary table

| Option | Legality (public sources) | Risk to owner | Risk to Stripe account | Cost and effort | Verdict |
| --- | --- | --- | --- | --- | --- |
| 1. Iranian gateway (Zarinpal) | Money sits in (often frozen) Iranian banks; getting it out is an Art. 30a transfer with no clean channel; needs an Iranian ID | High | High | High | No |
| 2a. Partner forwards money | Art. 30a transfer; channels out of Iran look like circumvention (Art. 41) | High | Medium–high | High | No |
| 2b. Partner keeps the money | Possibly legal with screening; no income for the owner | Low–medium | Medium | Medium | Only with a lawyer; little value |
| 3. Crypto / stablecoins | EU sanctions cover crypto; MiCA exchanges screen and freeze; possible US digital-assets sanctions | High | High | Low to build, high to keep clean | No |
| 4. Someone abroad pays for the person in Iran | Breaks provider terms; possibly circumvention | Medium–high | High | Low | No (the normal sale to a payer for their own listing is fine) |
| 5. Gift code bought openly outside Iran, separate provider | Depends on facts a lawyer must check; no Iranian payer | Medium | None if fully separate, high if through Stripe | Medium–high | Only after a lawyer and a provider agree in writing |

## 5. Recommendation

**Now (this step):**
- Sell only through Stripe, only to payers buying for themselves. No product, page, FAQ or support answer mentions paying from Iran or for someone in Iran.
- Keep the site usable from Iran for free features; that needs no payment.
- Do not block Iranian visitors from free features. Do not ask for or store more data about them than about anyone else.
- Keep the payments code provider-neutral: everything Stripe-specific sits behind one gateway interface in `src/modules/payments/`; tables keep their `provider` columns.
- Stripe Radar can block payments from cards issued in sanctioned countries; Stripe does this itself, and nothing on our side tries to work around it.

**Later, if the owner still wants it:**
1. Brief a German sanctions lawyer with this document, the exact products and categories, and the expected volume. Ask specifically about Option 5 and Option 2b, the screening duty, Article 41 and the Bundesbank's view.
2. If the lawyer confirms a route, find a separate EU provider that accepts it in writing after its own review.
3. Only then design it: a second `provider`, worker-applied redemptions, screening against the EU list, records for 10 years, and a clear statement on the site of what is and isn't possible.
4. Review it again whenever the EU, UN or US measures change; the snapback showed they can change within weeks.

## Sources

- Council of the EU, [Iran sanctions snapback: Council reimposes restrictive measures](https://www.consilium.europa.eu/en/press/press-releases/2025/09/29/iran-sanctions-snapback-council-reimposes-restrictive-measures/), 29 Sep 2025
- EU Sanctions Helpdesk, [Iran sanctions snapback](https://eu-sanctions-compliance-helpdesk.europa.eu/iran-sanctions-snapback-council-reimposes-restrictive-measures_en)
- Mayer Brown, [EU reintroduces sanctions against Iran following UN snapback](https://www.mayerbrown.com/en/insights/publications/2025/10/eu-reintroduces-sanctions-against-iran-following-un-snapback), Oct 2025
- Gibson Dunn, [Snap decision: renewed global Iran sanctions](https://www.gibsondunn.com/snap-decision-renewed-global-iran-sanctions-and-increased-risks-for-business/)
- Covington, [Reimposition of UN-mandated sanctions against Iran](https://www.cov.com/en/news-and-insights/insights/2025/10/reimposition-of-un-mandated-sanctions-against-iran-and-additional-eu-and-uk-sanctions)
- Regulation (EU) No 267/2012, [Article 41](https://legislation.gov.uk/eur/2012/267/article/41/adopted?view=plain); current consolidated text on EUR-Lex
- Deutsche Bundesbank, [Finanzsanktionen: Iran](https://www.bundesbank.de/de/service/finanzsanktionen/sanktionsregimes/-/iran-610216)
- [Außenwirtschaftsgesetz (AWG)](https://www.gesetze-im-internet.de/awg_2013/), §§ 18–19
- Sidley, [Treasury sanctions Iranian financial sector](https://www.sidley.com/zh-hans/insights/newsupdates/2020/10/treasury-sanctions-iranian-financial-sector), Oct 2020; Orrick, [US targets additional Iranian sectors](https://www.orrick.com/en/Insights/2020/01/US-Targets-Additional-Iranian-Sectors-for-Sanctions-Broadly-Increasing-Exposure-for-Non-US-Companies)
- Steptoe, [Weekly sanctions update, 31 Aug 2026](https://www.steptoe.com/en/news-publications/international-compliance-blog/weekly-sanctions-update-august-31-2026.html) (single source for the 2026 digital-assets determination; confirm)
- OFAC, [FAQ 844](https://ofac.treasury.gov/faqs/844); [PayPal settlement, 25 Mar 2015](https://ofac.treasury.gov/recent-actions/20150325_33)
- Stripe, [Prohibited and restricted businesses](https://stripe.com/legal/restricted-businesses)
- EBA, [Travel rule guidelines under Regulation (EU) 2023/1113](https://www.eba.europa.eu/activities/single-rulebook/regulatory-activities/anti-money-laundering-and-countering-financing-terrorism/guidelines-information-requirements-relation-transfers-funds-and-certain-crypto-assets-transfers)
- Zarinpal, [membership levels](https://www.zarinpal.com/blog/%D8%B3%D8%B7%D8%AD-%D8%B9%D8%B6%D9%88%DB%8C%D8%AA-%D8%A2%D8%A8%DB%8C) and [merchant guide](https://www.zarinpal.com/blog/%D8%B1%D8%A7%D9%87%D9%86%D9%85%D8%A7%DB%8C-%D9%BE%D8%B0%DB%8C%D8%B1%D9%86%D8%AF%DA%AF%D8%A7%D9%86-%D8%B2%D8%B1%DB%8C%D9%86-%D9%BE%D8%A7%D9%84/)
