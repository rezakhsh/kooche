# Posting form field audit (Nov 5, 2026)

The owner asked for every category's posting form to be checked field by field: is each field relevant, worded right, and right for each country? This is a report only. **No code was changed.** Each change below waits for the owner's approval.

How it was checked:
- every field read from the code (`seed/categories.ts` and the posting form);
- every German form opened on staging (113 of 119 subcategories; the 6 for verified businesses only redirect a private account, as designed), on phone and computer;
- one test ad published in every subcategory and event type, to see the cards and listing pages (list at the end);
- what the big local sites and the law ask in each country, compared.

**Other countries, seen in the browser (owner's OK, Nov 5).** On staging only Germany is open, so a test account from another country first got Germany's form. The UK, US, Sweden and Australia were therefore opened for posting ("prestart") for about a minute (17:48–17:49 UTC) and then put back on waitlist. No emails were sent and nothing was published. In those four countries, 26 forms each were compared with Germany's:
- **The only difference is the currency:** £ (UK), $ (US), kr (Sweden), A$ (Australia).
- **Everything else is word for word Germany's,** in every form.
  - Rent: «اجارهٔ سرد ماهانه», «Nebenkosten», «Kaution», the «Kaltmiete» hint.
  - Housing: Einbauküche, Keller, Altbau, WBS «فقط آلمان», Energieausweis, m².
  - Cars: «TÜV/HU یا Pickerl», km, PS.
  - Jobs: «سطح زبان آلمانی», Minijob, «Brutto».
  - Sizes: EU sizes, «سایز آلمانی».
- **The other six countries:** the code works the same way for all of them, so they would look the same.

Pictures:
- Germany: `/root/peydoo-media/wave2/field-audit/staging/germany/` (step 3 of each checked form, phone and computer; the short-let card and listing page).
- UK, US, Sweden, Australia: `…/staging/uk/`, `…/us/`, `…/sweden/`, `…/australia/` (15 forms each, phone and computer). For example, `staging/uk/apartments-rent-uk-phone.png` shows a UK landlord being asked for the cold rent in £, Nebenkosten, Kaution and WBS.

---

## 1. Summary: the most important changes, in order

1. **Short-term rent says "cold monthly rent", whatever the unit (the owner's example).**
   - **Problem.** The price label is «اجارهٔ سرد ماهانه», even when the seller picks «شبانه» (nightly). On the card it is worse. Our test ad shows «۸۰ € سرد، ماهانه», then «شبانه» on the next line.
     - Picture: `short-term-rent-card-germany-phone.png`.
   - **Fix.** The price label follows the chosen unit: «اجاره هر شب / هر هفته / هر ماه».
     - Put the unit right next to the price, not after the area.
     - The card shows «۸۰ € هر شب».
     - The amount is all-in: no cold/warm, as on Airbnb and Wunderflats.
2. **"Rooms" means something else to Iranians.**
   - **Problem.** The form asks «تعداد اتاق» with a German hint: «مثل آگهی‌های آلمانی: نیم‌اتاق هم حساب می‌شود (۲٫۵)», meaning "like German ads: half rooms count too (2.5)".
     - Germans count every room, living room included. Iranians count bedrooms: «دو خوابه» means two bedrooms (Divar works the same way).
     - So a German "3 Zimmer" is an Iranian "2 خوابه", and Persian sellers will mix them up.
   - **Fix.**
     - Ask «تعداد اتاق خواب» (bedrooms) in every country, as UK, US, Canadian and Australian sites do.
     - Add «تعداد اتاق به حساب محلی» (the local total-room count) only where ads use it: Zimmer in DE/AT, kamers in NL, pièces in FR, locali in IT, rum in SE.
     - Add bathrooms in UK/US/CA/AU.
3. **German rent terms are shown in every country.**
   - **Problem.** Cold rent, Nebenkosten and Kaution appear everywhere, as do the warm-rent sum, the WBS question, the Energieausweis class (A+–H) and the card's «سرد، ماهانه».
   - **Fix.** Make the rent block country-specific:
     - **DE:** Kaltmiete + Nebenkosten = Warmmiete (as today).
     - **AT:** Hauptmietzins + Betriebskosten (+10% VAT) = Bruttomiete. Austrian ads lead with the gross figure.
     - **NL:** kale huur + servicekosten.
     - **FR:** loyer hors charges + charges = charges comprises. French law requires these in every rental ad, private ones too since July 2022 (loi 3DS). In rent-control cities the ad must also show the reference rent.
     - **IT:** canone + spese condominiali.
     - **SE:** one rent (heating usually included).
     - **UK, US, CA:** one monthly rent + "bills or utilities included: yes / some / no".
     - **AU:** rent per **week**.
     - Show WBS in Germany only.
4. **Energy data: we ask only for the class.** *(Corrected Nov 5, 2026 after the owner's question; see section 20, "Corrections".)*
   - **The law, checked.** §87 GModG (the GEG's new name since July 29, 2026) applies only when **both** are true:
     - a valid certificate already exists when the ad goes up;
     - the ad is in a "commercial medium".
     Haus & Grund reads the second as: free private ads are not covered. Agents and businesses are.
   - **When it applies,** the ad must show:
     - the certificate type;
     - the kWh value;
     - the main energy source;
     - the year built;
     - the class.
     From Jan 1, 2027 also the issue date, and the primary-energy value for new certificates. The fine is up to €10,000.
   - **A private landlord without a certificate** may advertise without any energy data. That is the owner's experience.
   - **Kleinanzeigen:** the same set as optional fields. Vonovia fills them; private landlords leave them empty.
   - **Other countries:**
     - AT: HWB, EEB and the class, since July 2026.
     - SE, UK, FR, IT, NL: each its own label and scale.
   - **Fix.** Optional energy fields per country, like Kleinanzeigen. Never required.
5. **«Anmeldung» answers the owner's question.** It exists in some other countries under other names, and not in others. Full answer in section 2.
   - **Fix.** Use the local word where it exists. Hide it where it doesn't (UK, FR, US, CA, AU).
   - **The chip on the photo too.** Cards put a white «Anmeldung» label over the room's photo; the word is fixed in the code (`src/components/listing-card.tsx`), in every country. It should show the country's own word (Meldezettel, inschrijving, folkbokföring, residenza) and not appear at all in countries without registration. The same goes for its tooltip and the filter.
   - Also ask it for monthly temporary lets (Zwischenmiete), where it matters most. Today it's only on WG rooms, though a code comment says short lets should ask it too.
6. **Room in a shared flat: "entire place" is offered, and "bills included?" is missing.**
   - **Problem.** «کل واحد» (entire place) doesn't belong in a WG-room category. The questions every room site asks are missing.
   - **Fix.** Add:
     - "bills included in the rent?";
     - minimum stay;
     - private bathroom;
     - couples OK.
   - UK and AU let a room rent be per week.
7. **Jobs are German-only in several places.**
   - **Problem.**
     - «سطح زبان آلمانی» (German level) is asked in every country.
     - The contract types Minijob, Werkstudent and Ausbildung are German.
     - The salary hint says «ناخالص (Brutto)».
   - **Fix.**
     - Ask for the language level of the country's own language.
     - Use each country's contract types.
     - Allow a salary range (from–to):
       - Austria requires the minimum pay in every job ad.
       - Many US states require a range, and the EU pay-transparency rules are coming.
8. **Vehicles: units and inspection are German or Austrian.**
   - **Problem.** «TÜV/HU یا Pickerl» is used everywhere, with km and PS, Euro emission classes, and Scheckheft.
   - **Fix.**
     - Inspection by country: MOT (UK), APK (NL), contrôle technique (FR), revisione (IT), besiktning (SE). Leave it out in US, CA and AU, where it depends on the state or province.
     - Miles in the UK and US.
     - hp in the UK, US, CA and AU (EU sites show kW and PS).
     - A neutral «دفترچه سرویس کامل».
9. **Sizes are EU-only.**
   - **Problem.** Clothing labels read «XS (34)…», shoes are «سایز (اروپایی)», and kids' sizes go by height with «سایز آلمانی».
   - **Fix.**
     - UK, US and AU need their own numbers.
     - Kids' sizes there go by age (e.g. 5–6 years).
10. **Live animals and services offer "can be sent by post".**
    - **Problem.** «ارسال پستی ممکن است» shows on:
      - dogs, cats, birds, small animals and fish;
      - pet care (a service);
      - boats.
    - Posting live animals is not allowed by post companies (and in Germany by animal-transport law), and "we ship the puppy" is a classic scam.
    - **Fix.** Remove the shipping toggle from all of them.
11. **Smaller wording fixes.**
    - **Area hint.** The same hint shows on every property form, flats included: "for a room in a shared flat, the room's size; for land, the plot's size". Show only the hint that fits the category.
    - **Lessons and services use German exam and legal terms.** Goethe/telc/TestDaF/ÖSD, «آبیتور یا ماتورا», «beglaubigt», Entrümpelung and Endreinigung: use each country's terms.
    - **Language lists lack Dutch, Italian, Swedish and Spanish.** These are the lists for books, translation and language courses.
    - **"Exchange" as a price kind is odd for services and pets.** Remove it from:
      - services and lessons;
      - dogs and cats;
      - rideshare.

---

## 2. The owner's direct questions

### "What does cold rent mean on a short-term rent?"

It shouldn't be there. The code calls every rent category "cold" except WG rooms. Short-term rent was never added to the "plain rent" list, so it got the long-term flat's label: «اجارهٔ سرد ماهانه» in the form and «سرد، ماهانه» on cards, even for a nightly price.

The owner is right:
- Cold rent plus Nebenkosten only makes sense for a normal long-term flat.
- A short stay has one all-in price for each night, week or month. That's how Airbnb, Wunderflats, HousingAnywhere and WG-Gesucht's Zwischenmiete show it.
- On Divar the field is «اجارهٔ روزانه» (daily rent).

### "Do other countries have Anmeldung?"

| Country | Is there a duty to register your address? | Local name | What the field should say |
| --- | --- | --- | --- |
| Germany | Yes, within 2 weeks; the landlord signs a form | Anmeldung (Wohnungsgeberbestätigung) | «امکان ثبت آدرس (Anmeldung)», as today |
| Austria | Yes, within 3 days; the landlord signs | Meldezettel | «امکان ثبت آدرس (Meldezettel)» |
| Netherlands | Yes, at the city (BRP). Rooms often can't be registered, so room sites ask "inschrijving mogelijk" | Inschrijving BRP | «امکان ثبت آدرس (inschrijving)» |
| Sweden | Yes (folkbokföring at Skatteverket). Matters for sublets | Folkbokföring | «امکان ثبت آدرس (folkbokföring)» |
| Italy | Yes, to get residence | Residenza | «امکان ثبت اقامت (residenza)» |
| Turkey | Yes (adres kaydı), but housing is closed in Turkey | – | not needed |
| UK, France, US, Canada, Australia | No such duty | – | hide the field (and the photo chip) |

Optional for France: what tenants ask there is whether the flat qualifies for **CAF housing benefit (APL)**. That could be a France-only yes/no later.

---

## 3. Housing (املاک)

### Fields every housing form shares

| Field | Problem | Change |
| --- | --- | --- |
| متراژ (area, m², required) | One hint for all: "for a room in a shared flat… for land…" | One hint per category. UK, US and CA sites use sq ft. Let sellers there enter sq ft and show both units |
| Rent label on the card | «سرد، ماهانه» on flats and houses in every country, and on short lets | "cold" only in DE (and "netto" in AT if wanted); per-week in AU; "per night/week/month" on short lets |

### Short-term and temporary rent (اجاره موقت و کوتاه‌مدت)

**Today:**
- price, labelled «اجارهٔ سرد ماهانه»;
- deposit (Kaution);
- area;
- price unit (nightly, weekly, monthly), required and placed after the area;
- type of place (private room, shared room, entire place);
- rooms, with the German hint;
- furnished;
- available from and to.

**Problems:**
- The price label (see the summary, item 1).
- The unit sits far from the price.
- "Furnished" is asked although a short let is always furnished.
- Missing fields:
  - how many guests (Divar's «ظرفیت»);
  - minimum stay;
  - an optional cleaning fee;
  - "Anmeldung possible" for monthly lets;
  - the city's **registration number** for whole-flat holiday lets. Berlin, Amsterdam, Paris, Italy (CIN code) and New York require it in every ad, and Vienna will from 2027. An EU regulation has applied since May 2026, and our terms 5.11 already forbid short lets without it.

**Change:**
1. The unit choice comes first, then «اجاره هر شب/هفته/ماه», all-in. Card: «۸۰ € هر شب».
2. Add guests, minimum stay, an optional cleaning fee, and a registration number:
   - an optional field everywhere;
   - required for nightly whole-flat lets in the cities above.
3. Ask "Anmeldung possible" (local word, see section 2) when the unit is monthly.
4. Drop "furnished", or keep it only for monthly.
5. Bedrooms instead of German rooms.

### Room in a shared flat (اتاق و خانه اشتراکی، WG)

**Today:**
- monthly rent («اجارهٔ ماهانه», correct);
- deposit;
- area;
- type of place (private, shared, **entire place**);
- number of flatmates;
- flatmate preference;
- available from and to;
- furnished;
- Anmeldung.

**Problems:**
- "Entire place" doesn't fit a room category.
- The Anmeldung label and its hint (Bürgeramt, Wohnungsgeberbestätigung) are German in every country.
- Missing fields:
  - bills included in the rent (SpareRoom, Flatmates.com.au);
  - minimum stay;
  - private bathroom;
  - couples OK.

**Change:**
- Room type: private room or shared room only.
- Add bills included (yes / partly / no), minimum stay, private bathroom and couples OK.
- Anmeldung by country (section 2).
- UK and AU: rent per week or per month (both sites let the poster choose).

### Flat and house to rent (اجاره آپارتمان، اجاره خانه)

**Today:**
- cold rent;
- Nebenkosten (required), with the hint that the price is the Kaltmiete;
- heating included in Nebenkosten;
- deposit;
- available from;
- rooms (required);
- floor;
- flat or house type (German types: Etagenwohnung, Doppelhaushälfte…);
- furnished, balcony, lift;
- features (Einbauküche, Keller, Altbau, Neubau…);
- pets allowed;
- WBS («فقط آلمان», "Germany only");
- year built;
- energy class.

**Problems:**
- The whole price block is German (summary, item 3).
- WBS shows in every country, with "Germany only" in its label.
- Energy fields are incomplete for German law, and on the wrong scale elsewhere.
- "Rooms" means total rooms, which Persian sellers read as bedrooms.
- The type lists are German.

**Change:**
- Price block by country (summary, item 3), with the deposit's local name and legal cap as a hint:

| Country | Deposit name | Legal cap |
| --- | --- | --- |
| DE | Kaution | 3 cold rents |
| NL | waarborgsom | 2 months |
| UK | deposit | 5 weeks |
| FR | dépôt de garantie | 1 month unfurnished, 2 furnished |
| AU | bond | about 4 weeks; varies by state |
| Ontario | last month's rent | 1 month; no damage deposit |

- Bedrooms (plus local rooms where used, plus bathrooms in UK/US/CA/AU).
- WBS in Germany only.
- Energy fields by country.
- Type lists: keep the German words in brackets only in DE and AT.
- UK: add the council-tax band. Trading Standards' "material information" guidance (2022) expects it in every rental ad; it is guidance, not law. Rightmove shows it.

### Buying a flat or house (فروش آپارتمان، فروش خانه)

**Today:**
- rooms, floor, type, year built;
- furnished, balcony, lift;
- features;
- energy class;
- Hausgeld (flats);
- plot size (houses);
- rented out;
- provisionsfrei.

**Problems:** Hausgeld and provisionsfrei are German. Each country lists other costs and terms:
- **UK:** tenure (freehold or leasehold), service charge, ground rent, council-tax band.
- **FR:** charges de copropriété, taxe foncière.
- **US/CA:** HOA fees, property tax.
- **AT:** Betriebskosten.

**Change:**
- A "monthly owner costs" field with the local name.
- A buyer's-commission field only where agents charge buyers.
- Bedrooms, energy and area unit as for renting.

### Land and gardens, commercial rent and sale, parking

- **Land:** fine. Kleingarten is German, but allotments exist in the UK and NL too. Keep it, with a neutral label.
- **Commercial rent:**
  - It reuses the flat's Nebenkosten field and the "price is the Kaltmiete" hint. Fine in DE, wrong elsewhere.
  - Commercial rents usually come **plus VAT**. Add "price with or without VAT".
- **Parking:** fine. A rented space should show "per month" next to its price.

---

## 4. Vehicles (وسایل نقلیه)

Turkey: cars, motorbikes, campers and commercial vehicles are closed (EİDS). Bicycles, boats and parts remain, and their fields fit Turkey.

### Cars (خودرو)

**Today:**
- make and model (required);
- trim;
- year (required);
- mileage in km (required);
- fuel and gearbox (required);
- body type;
- power in PS;
- accident status (required);
- inspection «TÜV/HU یا Pickerl» until;
- colour;
- previous owners;
- service book («Scheckheft»);
- doors;
- Euro emission class;
- extras.

The set matches mobile.de and AutoScout24 well.

**Problems by country:**

| | DE | AT | NL | UK | FR | IT | SE | US | CA | AU |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inspection name | HU/TÜV | Pickerl (§57a) | APK | MOT | contrôle technique | revisione | besiktning | varies by state, leave out | safety certificate (Ontario), leave out | roadworthy; rego expiry |
| Distance | km | km | km | **miles** | km | km | km (Swedes often say mil = 10 km) | **miles** | km | km |
| Power | PS (kW) | PS (kW) | pk (kW) | **bhp** | ch (kW) | CV (kW) | hk (kW) | **hp** | **hp** | **kW** |

Other points:
- Euro emission class only in Europe. (In the UK, ULEZ follows from it; AutoTrader has no separate field.)
- "Scheckheft" becomes a neutral «دفترچه سرویس کامل».
- Australia: add "rego expiry" (registration expiry date). It's a standard field there, like the remaining third-party insurance on Divar.

**Change:**
- Inspection label and units by country.
- The mileage field stores km and shows miles in the UK and US.
- Optional later: steering side (left or right) for imports in the UK and AU.

### Motorbikes, campers, commercial vehicles

- **Motorbikes:** licence classes AM/A1/A2/A are EU and UK. In the US, CA and AU, hide the field (licences work differently).
- **All three:** inspection and units as for cars.
- **Campers:** the German words (Wohnwagen, Wohnmobil) are fine as brackets in DE and AT only.

### Bicycles, boats, car parts, tyres, motorbike parts

- Fine.
- Boats offer "can be sent by post". Remove it (nobody posts a boat).
- Tyres: sizes are universal. Summer/winter/all-season is fine everywhere; in AU and the southern US, winter tyres are rare but harmless.

---

## 5. Digital goods (کالای دیجیتال)

- **Overall.** The fields fit everywhere: condition, brand, exact model, storage, RAM, battery health, warranty, receipt, CPU, screen size, platform, and so on.
- **Turkey only.** Add "IMEI registered: yes/no" on phones.
  - Unregistered phones can't be used there.
  - Our Turkey rules already send «بدون رجیستری» ads to review.
  - A clear field is friendlier than a word filter.
- **Brand lists.** Fine. The "other" option covers local brands.

## 6. Home and kitchen (خانه و آشپزخانه)

- **Overall.** Fine.
- **Carpets.** A strong form: type, where it was woven, material, size in cm. Keep it. Optionally show inches in the US.
- **Other forms.** Appliances, furniture and «آشپزخانه کامل (Einbauküche)» for selling a kitchen are fine. The German word in brackets is helpful in DE and AT only.
- **Missing.**
  - An energy label for appliances: optional, low priority.
  - The size of a garden or food item: not needed.

## 7. Clothes and beauty (پوشاک و آرایشی)

- **Women's and men's clothing.** Letter sizes with EU numbers: «XS (34)» for women, «M (48–50)» for men.
  - The UK, US and AU use other numbers: UK women 8 ≈ EU 36, US women 4 ≈ EU 36.
  - **Change:** keep the letters and show the local number in brackets per country.
- **Shoes.** «سایز (اروپایی)» only. **Change:** add UK sizes in the UK and US sizes in the US/CA (an EU/UK/US switch, as Vinted has).
- **Jewellery.** Gold karats 18/21/22/24 are right for Iranian buyers. Keep them.
  - Turkey holds gold ads for review (its rules); nothing to change in the form.

## 8. Children and babies (کودک و نوزاد)

- **Kids' clothes.** Size in cm by height, with the hint «سایز آلمانی».
  - That's right for the EU.
  - In the UK, US, CA and AU sizes go by age (e.g. "5–6 years").
  - **Change:** height in cm in Europe, age in UK/US/CA/AU, and a neutral hint.
- **Car seats.** «گروه ۱/۲/۳» (groups 1, 2, 3) is the old EU rule (R44). New seats use height in cm (R129 / i-Size).
  - **Change:** add "i-Size (by height)" as an option.
  - Outside Europe, seats use other standards, but the groups are still understood.

## 9. Animals (حیوانات)

- **Fields.** Breed, age in months, sex, vaccinated, microchip, neutered and pedigree are fine.
- **Problems.**
  - "Can be sent by post" shows on dogs, cats, birds, small animals and fish, and on pet care (a service). **Remove it.**
  - "Exchange" as a price kind on dogs and cats: remove it.
- **Turkey.** Cats and dogs are free adoption only, which works.
- **Optional.** An "EU pet passport" yes/no for dogs and cats in the EU.

## 10. Leisure (سرگرمی و فراغت)

- **Books.** The language list (Persian, German, English, French, Arabic, Turkish, other) is missing Dutch, Italian, Swedish and Spanish. Add them. Or show Persian, English, the country's own language, and other.
- **Concert and event tickets.** Fine. "Can be sent by post" is right for paper tickets.
- **Instruments.** The Iranian instruments are a good touch. Keep them.

## 11. Services (خدمات)

- **Price unit.** One list for all services: per hour, per job, per day, per m². "Per m²" fits cleaning, painting and tiling, but not hairdressing, translation or IT.
  - **Change:** a unit list per subcategory.
- **German terms in labels.** «تخلیه و دورریزی (Entrümpelung)», «نظافت تحویل خانه (Endreinigung)», «ترجمه رسمی (beglaubigt)».
  - **Change:** Persian first, with the local word in brackets per country.
  - Certified translation is called:
    - UK: certified
    - FR: traducteur assermenté
    - IT: traduzione giurata
    - NL: beëdigd
    - SE: auktoriserad
    - AT: allgemein beeidet
- **"Exchange" price kind.** Shows on moving, repairs, cleaning, beauty, catering, photography, childcare and elder care. Remove it.
- **Car services.** «آماده‌سازی معاینه فنی» (getting a car ready for inspection) is fine; "inspection" becomes the local name.
- **Turkey.** Visa and residence help are refused there by word rules. The forms themselves need nothing.

## 12. Lessons and courses (آموزش و کلاس)

- **Language courses.**
  - The language list has the same gap as books.
  - "Exam preparation (Goethe, telc, TestDaF, ÖSD)" fits DE and AT only. Per country:
    - UK, AU, CA, US: IELTS, Cambridge, TOEFL
    - FR: DELF, DALF, TCF
    - NL: NT2 / inburgering
    - IT: CELI, CILS
    - SE: SFI, Swedex
  - **Change:** the exam names in the label follow the country, or say just «آمادگی آزمون زبان».
- **Tutoring.**
  - The subject «آلمانی (درسی)» (German as a school subject) becomes "the country's language".
  - The level «آبیتور یا ماتورا» becomes the country's final school exam: A-levels (UK), baccalauréat (FR), maturità (IT), eindexamen (NL), high school (US/CA), HSC/VCE (AU).
- **Other lessons.** Fine, apart from "exchange" as a price kind.

## 13. Jobs (استخدام و کاریابی)

**Today (all job subcategories):**
- contract type (full-time, part-time, Minijob, Werkstudent, Ausbildung, internship, freelance);
- work place (on site, hybrid, remote);
- **German level**;
- salary, with the hint «ناخالص (Brutto)»;
- pay period;
- experience in years;
- Persian-speaking job;
- visa help;
- driving licence;
- start date.

**Problems and changes:**
- **Language.** «سطح زبان آلمانی» becomes the level of the country's language (German, Dutch, French, Italian, Swedish, English). In Austria it stays German.
- **Contract types by country:**
  - **DE:** as today (Minijob up to €603 a month in 2026).
  - **AT:** geringfügig, Lehre.
  - **NL:** bijbaan, stage, nul-urencontract.
  - **UK:** zero-hours, apprenticeship.
  - **FR:** CDI, CDD, alternance, intérim.
  - **IT:** indeterminato, determinato, apprendistato.
  - **SE:** tillsvidare, visstid.
  - **AU:** casual.
  - **US/CA:** hourly, salaried, contract.
- **Subcategory names.** «آوسبیلدونگ (Ausbildung)» and «مینی‌جاب و پاره‌وقت» are German. Rename them per country (apprenticeship, part-time).
- **Salary.**
  - Allow from–to and keep it optional, except where law requires it:
    - **Austria:** every job ad must state the minimum pay (GlBG §9(2)).
    - **US states:** CA, CO, NY, WA and others require a pay range.
    - **Ontario:** pay required since Jan 2026 for employers with 25+ staff.
    - **EU:** the pay-transparency directive is coming (not yet law in DE or NL).
  - The hint «ناخالص» stays, with the local word in brackets: Brutto, gross, brut, lordo.
- **Gender-neutral ads.** DE and AT require them ((m/w/d)). A hint under the title would help employers.
- **Turkey.** Jobs from verified businesses only, with open contact. Already enforced; the form needs only the language change.

## 14. Community (اجتماعی)

- **Rideshare.**
  - "Exchange" and "negotiable" don't fit.
  - In Germany a ride may only share costs (no profit).
  - **Change:** one price, «سهم هزینهٔ هر نفر» (cost per seat).
  - Add departure time and one-way or return.
- **Neighbour help, lost and found.** Fine.

## 15. Events (رویدادها)

- **Overall.** The event form is separate and fits every country. It asks for:
  - the event type;
  - dates and times in local time;
  - repeats;
  - in person or online;
  - venue and address;
  - ticket price "from";
  - ticket link, organiser, language, age limit, status.
- **Event languages.** The choices are Persian, German, English and other. Use the country's language instead of German outside DE and AT.

## 16. Equipment and industry (تجهیزات و صنعتی)

- **Overall.** Fine (condition only).
- **Shipping.** "Can be sent by post" on machinery and building materials is fine: it means freight.

---

## 17. What changes by country: one table

| Field | DE | AT | NL | UK | FR | IT | SE | US | CA | AU | TR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Long-term rent | Kalt + NK = warm | Hauptmietzins + BK (+VAT) | kale huur + service | rent pcm + bills? | HC + charges = CC | canone + spese | rent (heating incl.) | rent/month + utilities? | rent/month + utilities? | rent **per week** | closed |
| Deposit name | Kaution | Kaution | waarborgsom | deposit | dépôt de garantie | cauzione | deposition | security deposit | deposit (ON: last month) | bond | closed |
| Address registration | Anmeldung | Meldezettel | inschrijving | – | – | residenza | folkbokföring | – | – | – | closed |
| Social-housing permit | WBS | – | – | – | – | – | – | – | – | – | closed |
| Energy in ads (if a certificate exists; optional on Peydoo) | type + kWh + source + year + class | HWB + EEB + class | label | EPC | DPE + GES | APE class | energiklass | – | – | – | closed |
| Rooms | Zimmer | Zimmer | kamers | bedrooms | pièces | locali | rum | bedrooms | bedrooms | bedrooms | closed |
| Area | m² | m² | m² | sq ft + m² | m² | m² | m² | sq ft | sq ft | m² | closed |
| Short-let registration no. | Berlin and others | Vienna from 2027 | Amsterdam | (London 90 nights) | Paris and others | CIN everywhere | – | NYC | some cities | some states | closed |
| Car inspection | HU/TÜV | Pickerl | APK | MOT | CT | revisione | besiktning | – | – | rego/roadworthy | closed |
| Mileage | km | km | km | miles | km | km | km | miles | km | km | closed |
| Job language field | German | German | Dutch | English | French | Italian | Swedish | English | English/French | English | Turkish |
| Contract types | Minijob, Werkstudent, Ausbildung | geringfügig, Lehre | bijbaan, stage | zero-hours, apprenticeship | CDI, CDD, alternance | determinato… | visstid… | hourly/salaried | hourly/salaried | casual | – |
| Salary in ad | optional | **required (minimum)** | optional | optional | optional | optional | optional | **range required in many states** | **required in Ontario (25+ staff)** | optional | optional |
| Clothes/shoe sizes | EU | EU | EU | UK | EU | EU | EU | US | US | AU/UK | EU |
| Kids' sizes | cm | cm | cm | age | cm | cm | cm | age | age | age | cm |
| Currency | € | € | € | £ | € | € | kr | $ | $ | $ | ₺ |

---

## 18. Suggested order of work (for approval)

1. **Short-term rent price and card** (summary, item 1). Small and visible, and it fixes the owner's example.
2. **Bedrooms instead of German rooms** in housing. Also remove the German hints: rooms, area, WBS, Anmeldung.
3. **Shipping off for animals, pet care and boats; "exchange" off for services, lessons, animals and rideshare.** Small.
4. **Room in a shared flat:** drop "entire place"; add bills included, minimum stay, private bathroom, couples OK.
5. **Country awareness in the form.** A field can be shown, renamed or given options per country. This one building block enables items 6–9.
6. Rent block, deposit, energy and Anmeldung per country, ready before each country opens (Austria first).
7. Jobs: language level, contract types, salary range, Austria's required salary.
8. Vehicles: inspection names, miles, hp.
9. Sizes, exam names, language lists, service units.

Items 1–4 are useful in Germany today. Items 5–9 must be ready before Austria and the other countries open.

---

## 19. Items 1–4 (approved by the owner on Nov 5, 2026; built, see `docs/progress.md`)

All new fields are optional, so posting stays quick. Where the owner had a choice, the plan picks what the big sites do (listed after each item).

**What it touches today.** Production has 1 live listing (a shared room): no rooms value, not "entire place", no shipping, no exchange. So no existing listing needs converting. Staging's test ads keep their values.

### 1. Short-term rent: one all-in price per night, week or month

The step-3 form, in this order:
1. **«اجاره برای»** (rent per): شب / هفته / ماه (night / week / month). Required, and first.
2. **The price.** Its label follows that choice: «اجاره هر شب», «اجاره هر هفته», «اجاره هر ماه». Hint: «همهٔ هزینه‌ها داخل این مبلغ است» (all costs included). No "cold", no Nebenkosten.
3. **Deposit**, as today.
4. **New: «هزینهٔ نظافت»** (cleaning fee, one-time).
5. **New: «حداکثر تعداد مهمان»** (guests). Divar's «ظرفیت», Airbnb's guests.
6. **New: «حداقل مدت اقامت»** (minimum stay): بدون حداقل، ۲ شب، ۳ شب، ۱ هفته، ۱ ماه، ۳ ماه، ۶ ماه.
7. **Area, type of place, bedrooms** (item 2), **available from and to**, as today.
8. **New here: «Anmeldung ممکن»** (registration possible), with the hint "matters for monthly lets". It's the WG field; the per-country words come with item 6.
9. **New: «شمارهٔ ثبت»** (short-let registration number). Hint: in Berlin and many cities it's required for whole flats let by the night and must be in the ad. Optional for now; required per city once forms know the country (item 5).
10. **Removed: «مبله»** (furnished). A short let is always furnished: Airbnb and Wunderflats don't ask.

What buyers see:
- **Card:** «۸۰ € هر شب» (no more «سرد، ماهانه»).
- **Listing page:** the same next to the price.
- **Filters:** the price is just «اجاره». A new night / week / month choice lets nightly and monthly prices be compared separately.

### 2. Bedrooms, the way Iranians count

1. **New: «تعداد اتاق خواب»** (bedrooms) as chips: «بدون اتاق خواب (استودیو)»، ۱، ۲، ۳، ۴، «۵ یا بیشتر», as on Divar.
   - Required for flats and houses, to rent and to buy.
   - Optional for short lets.
   - The card shows «۲ خوابه», and the filter uses the same chips.
2. **The German count stays, but optional and renamed:** «تعداد اتاق به حساب آلمانی (Zimmer)».
   - Hint: «در آگهی‌های آلمانی اتاق نشیمن هم شمرده می‌شود؛ ۳ Zimmer یعنی ۲ خوابه».
   - It shows on the listing page, not the card. Sellers copying from ImmoScout and German readers still find it.
   - Other countries get their own word or nothing (item 5).
3. **The area hint fits each category:**
   - flats and houses: none;
   - shared room: «متراژ خود اتاق»;
   - land: «متراژ زمین».

WBS and the Anmeldung chip stay as they are: right in Germany, the only open country. Their country rules come with items 5–6.

### 3. No post for animals; no exchange for services

1. **«ارسال پستی ممکن است» removed** (form and filter) for dogs, cats, birds, small animals, pet care and boats.
   - Kept for fish & aquariums: tanks and equipment are posted there and can be shipped.
2. **«معاوضه» (exchange) removed as a price kind** for:
   - all services;
   - all lessons;
   - pet care;
   - rideshare;
   - dogs and cats.
   - Goods keep it.
3. **Listings already live are never taken down.** An edit asks for another price kind.

### 4. Room in a shared flat (WG)

1. **«نوع جا»:** only «اتاق خصوصی» and «اتاق مشترک» («کل واحد» removed).
2. **New: «قبوض داخل اجاره»** (bills included): «همه (گرمایش، برق، اینترنت)» / «بخشی» / «هیچ‌کدام».
   - Can be filtered on.
   - The card shows «با همهٔ قبوض» when all are included, as SpareRoom and Flatmates show it.
3. **New: «حداقل مدت اجاره»** (minimum stay): بدون حداقل، ۱ ماه، ۳ ماه، ۶ ماه، ۱۲ ماه.
4. **New: «حمام اختصاصی»** (private bathroom) and **«مناسب زوج‌ها»** (couples OK), both yes/no.

### How it will be built and checked

**Where.** A separate worktree, because the Turkey session works in the main checkout.

**Code changes:**
- the category list (`seed/categories.ts`);
- the posting form, card, listing page and filters;
- the Persian texts (`src/messages/fa.ts`);
- tests for the price label, shipping and exchange rules.

**On staging:**
- deploy and run the seed;
- one test ad again in each changed category;
- every changed form, card, listing page and open filter panel checked on phone and computer, light and dark;
- pictures kept in `/root/peydoo-media/wave2/field-fixes/`.

**Production:** only when the owner says so.

---

## 20. Items 5–9: plan (approved by the owner on Nov 5, 2026; Parts A, B and C built Nov 5–6, see `docs/progress.md`)

**Corrections after the owner's question "are you sure about everything?" (Nov 5, 2026).** Every legal claim in this plan was checked again against the law texts and official pages:
- **Energy (the big one).** The first version called the German energy data a "legal fix", with the fields required. That was wrong for private landlords. §87 applies only when a certificate already exists and the ad is commercial; free private ads are not covered (Haus & Grund, July 2026). Kleinanzeigen has the fields, all optional. Now: optional everywhere (section 1, item 4).
- **The law's name and dates.** The GModG replaced the GEG on July 29, 2026. Its new ad data (issue date, primary energy) starts on Jan 1, 2027.
- **Salary.** It is required in Austria only. US states and Ontario require it only above a staff size, which the form can't know, so the plan gives a hint there.
- **UK.**
  - The council-tax band is guidance, not law, so the field is optional.
  - No ULEZ field (AutoTrader has none).
  - The 5-week deposit cap is England's.
- **Australia:** "rego expiry" (a date), not "months left".
- **Sweden:** energy class in ads (Boverket); first written as "none".
- **Austria:** energy data is HWB + EEB + class since July 2026.
- **France:** the ad rules cover private landlords since 2022.
- **Confirmed true:** Austria's salary rule, Ontario's last-month deposit, the short-let registration numbers (Berlin, Amsterdam, Paris, Italy's CIN, New York; EU rules since May 20, 2026), AU weekly rent, the rideshare cost-only rule (PBefG §1), the end of R44 car-seat sales (Sept 2024), and the €603 Minijob limit.
- **Not checked live** (the sites blocked automated visits; known from practice and secondary sources): how willhaben, Pararius and Immobiliare show rent.

**The goal.** Every country gets its own words, fields and units in the posting form, on cards, on listing pages and in filters. Today only the currency changes (section 17).

**For Germany, almost nothing changes.** It keeps today's words. The few changes that do reach Germany are marked **(DE too)** below.

**Countries covered.** The 11 researched countries: DE, AT, NL, UK, FR, IT, SE, US, CA, AU and TR.
- Every other country gets **neutral** forms: Persian words with no local term in brackets, and no country-only fields (WBS, Anmeldung, council tax…).
- Opening any other country later then needs one short step: fill in its line. That step goes into the "Countries" opening checklist in `docs/setup.md`.

**Where the choice was open, the plan picks what the big local sites and the law do.** The reason is given each time.

It is built in **three parts**. Each part is tested, put on staging and checked on phone and computer, light and dark, before the next one starts. Austria comes first in every part, because it is the next country to open.

### Part A. The building block, housing and the Anmeldung chip (items 5 and 6)

*Built Nov 5, 2026 and on staging. Differences from the text below:*
- **NL and IT cards:** the base rent says «بدون شارژ، ماهانه», like Germany's «سرد، ماهانه», instead of «+ ۸۰ € شارژ». The listing page shows the total («با شارژ …»).
- **Areas in sq ft** (UK, US, CA) are stored as typed, in square feet. A listing never changes country, and each browse page shows one country. The listing page adds «(حدود … متر مربع)».
- **Energy hint:** shown to every poster in Germany, worded for commercial ads, instead of to businesses only.
- **Not checked live:** cards and listing pages outside Germany. A listing can only be published in an open country, so the tests cover them.

**A1. The building block (item 5).** Each field in the category list can now say, per country:
- **shown or hidden.** For example, WBS appears in Germany only.
- **its own label and hint.** For example, «امکان ثبت آدرس (Meldezettel)» in Austria.
- **its own options.** For example, the job contract types.
- **required or optional.** For example, salary is required in Austria.
- **its own unit.** For example, miles, sq ft or rent per week.

How it reaches the screens:
- The form, card, listing page, filters and search all read the field list through one function, which now also receives the listing's country.
- A listing always has a country, and a browse page always has one, so nothing has to be guessed.
- Values are stored as today; only what people see changes.
- No database change is needed: the rules live in the category list (the seed), like the hints added in items 1–4.
- A seed check makes sure every country rule names a real country and a real option.

**A2. Rent block per country (item 6).** The long-term rent form (flats and houses, and commercial rent):

| Country | What the landlord fills in | What the card shows | Why |
| --- | --- | --- | --- |
| DE | Kaltmiete + Nebenkosten (as today) | «۹۰۰ € سرد، ماهانه» (as today) | German ads and the law lead with cold rent |
| AT | Hauptmietzins + Betriebskosten | the total: «۱٬۱۰۰ € کل، ماهانه» | Austrian sites (willhaben) lead with the gross rent |
| NL | kale huur + servicekosten | rent + «+ ۸۰ € شارژ» | Pararius and Funda show both |
| FR | loyer hors charges + charges | the total, «با شارژ» | the law requires "charges comprises" in every ad, private ones too (since 2022) |
| IT | canone + spese condominiali | rent + «+ شارژ» | Immobiliare.it shows both |
| SE | one rent | «… ماهانه» | heating is usually included |
| UK, US, CA | one rent + «قبوض داخل اجاره: همه / بعضی / هیچ» | «… ماهانه» | Rightmove, Zillow and Kijiji show one rent; the bills question is the same as in the WG form |
| AU | one rent **per week** | «… هر هفته» | Domain and realestate.com.au show weekly rent only |

- **Deposit.** Each country has its own name and legal cap as a hint, e.g. «دیپازیت (bond)، معمولاً ۴ هفته» in Australia (table in section 3). In Ontario: «اجارهٔ ماه آخر». Where the cap differs by region, the hint says "usually".
- **WG rooms.** The UK and AU let the poster choose per week or per month, as SpareRoom and Flatmates.com.au do.
- **Filters.** These follow the same rules: total rent in AT and FR, weekly rent in AU.

**A3. Anmeldung, the field and the chip on the photo (item 6, the owner's request).**
- **Where it exists, it gets the local word,** in the form, on the photo chip, in its tooltip and in the filter:
  - DE: Anmeldung
  - AT: Meldezettel
  - NL: inschrijving
  - SE: folkbokföring
  - IT: residenza
- **Where there is no such duty, it is hidden everywhere,** chip included: UK, FR, US, CA, AU and every country without a line.
- **Hints.** The hint names the local office: Bürgeramt (DE), Meldeamt (AT), gemeente (NL), Skatteverket (SE), Comune (IT).

**A4. Other housing fields by country.**
- **WBS:** Germany only. «فقط آلمان» is removed from its label.
- **Energy:**
  - **Optional everywhere, never required,** as on Kleinanzeigen. The law asks for the data only when a certificate already exists and the ad is commercial (section 1, item 4).
  - **DE too.** Next to the class (already there), add the rest of Kleinanzeigen's set, all optional:
    - certificate type: Verbrauch or Bedarf;
    - the value in kWh/(m²·a);
    - the main energy source: gas, district heating, heat pump, oil, …;
    - the issue date.
    Verified businesses (agents) see a one-line hint: «اگر گواهی انرژی دارید، قانون می‌خواهد این‌ها در آگهی باشد».
  - **AT:** HWB, EEB and the class.
  - **UK:** EPC A–G.
  - **FR:** DPE A–G, plus GES.
  - **IT:** APE A4–G.
  - **NL:** label A++++–G.
  - **SE:** energiklass A–G.
  - **US, CA, AU:** no energy field (not asked in ads).
- **Area.** UK, US and CA sellers can enter sq ft. It is stored in m², and both units are shown, as on Rightmove.
- **Bathrooms:** a new optional field in UK, US, CA and AU, where every site asks it.
- **Local room count.** Zimmer is already there for DE and AT. NL: kamers; FR: pièces; IT: locali; SE: rum. It is hidden in UK, US, CA and AU, which count bedrooms only.
- **UK council-tax band** (A–H), optional. Trading Standards' guidance expects it on rent ads, and Rightmove shows it.
- **Owner costs on sale ads.**
  - The local name: Hausgeld (DE), Betriebskosten (AT), service charge (UK), charges de copropriété (FR), spese condominiali (IT), HOA fee (US/CA), strata (AU).
  - UK sales also get tenure (freehold / leasehold).
  - «provisionsfrei» is shown only where buyers may pay the agent: DE, AT and NL.
- **Short-let registration number.** Required for whole-flat nightly lets where the law requires it in every ad: Berlin, Amsterdam, Paris, New York and all of Italy (CIN). Optional everywhere else.
- **Type lists.** The German words in brackets (Etagenwohnung…) stay in DE and AT only.
- **Commercial rent:** «با مالیات بر ارزش افزوده / بدون آن» (with or without VAT), in all countries **(DE too)**.

### Part B. Jobs and vehicles (items 7 and 8)

*Built Nov 5, 2026 and on staging. Differences from the text below:*
- **One value per kind of work.** Contract types share values across countries, named the local way: Germany's Ausbildung is Austria's Lehre and the UK's apprenticeship, and Germany's Minijob is Austria's geringfügig. A filter or a moved business keeps its meaning. FR, IT and SE use permanent / fixed-term (CDI / CDD, indeterminato / determinato, tillsvidare / visstid).
- **The salary ceiling's key** is `salary_ceiling`. Keys ending in `_max` are taken by the browse filters' ranges; a seed check caught it.
- **Miles (UK, US) and kW (AU)** are stored as typed, like sq ft. PS, bhp and hp are within 2%.
- **Category names per country** (apprenticeships, mini-jobs, care, shared rooms) come through `countryCatalog()`. The page address stays the same.

**B1. Jobs.**
- **Language level.** «سطح زبان آلمانی» becomes the country's own language:
  - German: DE, AT
  - Dutch: NL
  - French: FR
  - Italian: IT
  - Swedish: SE
  - English: UK, US, AU, and CA (English or French)
  - Turkish: TR
  - Neutral elsewhere: «سطح زبان محلی»
  - Ads already saved keep their value.
- **Contract types per country** (full list in section 13): Minijob and Werkstudent only in DE; geringfügig and Lehre in AT; CDI and CDD in FR; casual in AU; and so on. Full-time, part-time, internship and freelance stay everywhere.
- **Subcategory names.** «آوسبیلدونگ» is shown as «کارآموزی حرفه‌ای (Lehre)» in AT and as «کارآموزی حرفه‌ای (apprenticeship)» in English-speaking countries. The address of the page does not change.
- **Salary.**
  - **DE too:** a from–to range («از … تا …»), as on Indeed and StepStone. It is still optional.
  - **Required in Austria only:** GlBG §9(2) asks every job ad for Austria to state the minimum pay, with no size limit.
  - **US and Canada: optional, with a hint.** Many US states (CA, CO, NY, WA, IL, MA and others) and Ontario require a range, but only above a staff size (from 1 to 30 depending on the state; 25 in Ontario). The form can't know a poster's staff size, so it says «در بسیاری از ایالت‌ها نوشتن بازهٔ حقوق اجباری است» instead of forcing it, as Indeed does.
  - The hint shows the local word: Brutto, gross, brut, lordo, brutto.
- **(m/w/d).** A hint under the title for DE and AT job ads: «عنوان باید برای همهٔ جنسیت‌ها باشد، مثلاً (m/w/d)». Neutral wording is the law there (AGG §11, GlBG §9); "(m/w/d)" is the usual way to show it.

**B2. Vehicles (cars, motorbikes, campers, commercial vehicles).**
- **Inspection** gets the local name:

  | DE | AT | NL | UK | FR | IT | SE | AU |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | TÜV/HU | Pickerl | APK | MOT | contrôle technique | revisione | besiktning | rego expiry |

  - It is hidden in the US and CA, where it depends on the state.
- **Mileage.** Entered and shown in miles in the UK and US. It is stored in km, so filters and sorting keep working.
- **Power.** PS in DE and AT; bhp in the UK; hp in the US and CA; kW in AU. One stored value; only the unit shown changes.
- **Euro emission class:** Europe only. No separate ULEZ field for the UK: AutoTrader has none, and it follows from the Euro class.
- **Service book.** «Scheckheft» becomes «دفترچه سرویس کامل» everywhere **(DE too)**. The German word stays in brackets in DE and AT.
- **Motorbike licence classes** (AM/A1/A2/A): hidden in the US, CA and AU.

### Part C. Sizes, exams, languages and service units (item 9)

*Built Nov 5–6, 2026 and on staging. Differences from the text below:*
- **Shoe sizes** in the UK, US and Canada are typed and stored in the local size, like sq ft. Australia keeps EU sizes, as the plan says.
- **Kids' sizes by age** are a separate choice («سایز (سن)», 0–3 months to 14+), offered only in the UK, US, CA and AU; the height field is hidden there.
- **Service price units per category** need a second building block: `options_in` gives a category its own options. Per m² is offered for cleaning and repairs, per page for translation, and the rest get per hour, per job or per day.
- **Event languages:** migration 0048 widens the list to Persian, German, Dutch, French, Italian, Swedish, Turkish, English and other. Each country's form and filter show Persian, its own language and English.
- **Rideshare** lost «توافقی», and «هر نفر» follows the price on cards and the listing page.

- **Clothes.** The letter (XS…XL) stays and is stored as today. The number in brackets follows the country:
  - EU numbers in Europe;
  - UK numbers in the UK and AU;
  - US numbers in the US and CA.
- **Shoes.** UK sizes in the UK, US sizes in the US and CA, EU sizes elsewhere, as Vinted does.
- **Kids' clothes.**
  - By height in cm in Europe.
  - By age («۵–۶ سال») in the UK, US, CA and AU.
  - «سایز آلمانی» becomes a neutral hint **(DE too)**.
- **Car seats.** Add «i-Size (بر اساس قد)» next to groups 0+/1/2/3 **(DE too)**. New seats are sold that way since 2024.
- **Exam names.**
  - Language exams follow the country (Goethe/telc in DE and AT, IELTS in UK/US/CA/AU, DELF in FR, NT2 in NL, CELI in IT, SFI in SE).
  - The school leaving exam too: Abitur/Matura, A-levels, bac, maturità, eindexamen, HSC/VCE.
  - «آلمانی (درسی)» becomes the country's language.
- **Language lists** (books, translation, language courses, events) **(DE too):**
  - Add Dutch, Italian, Swedish and Spanish.
  - The country's own language moves to the top after Persian.
  - Event languages use the country's language instead of German.
- **German service words in brackets** (Entrümpelung, Endreinigung, beglaubigt): the local word per country (section 11), or none.
- **Service price units per subcategory** **(DE too):**
  - Cleaning, painting and tiling keep "per m²".
  - Hairdressing, translation and IT drop it.
  - Translation gets "per page".
- **Rideshare** **(DE too):**
  - One price, «سهم هزینهٔ هر نفر» (cost per seat). No "negotiable" (exchange was already removed).
  - New fields: departure time, and one way or return.
  - Reason: in Germany a ride may only share costs, and BlaBlaCar works the same way.

### What stays out (for later, or not at all)

- **France CAF/APL:** a yes/no can be added when France opens.
- **Optional extras:** the EU pet passport, appliance energy labels, inches for carpets, and steering side for car imports.
- **Turkey phones:** an IMEI-registered field waits for the Turkey session, which owns Turkey's rules.

### How it will be built and checked

- **Where.** A separate worktree, one part at a time. Each part ends in a commit, a staging deploy and a seed run.
- **Tests.**
  - For each country rule: a field shown or hidden, the label, a required salary, miles stored as km, the rent total.
  - Plus a seed check that every rule names a real country and option.
- **On staging.** Each changed form, card, listing page and open filter panel is opened:
  - in **Germany** (to prove nothing changed there except the marked items);
  - in **Austria, the UK and Australia**, each opened for posting for a minute, as in the audit, and put back to waitlist.
  - Pictures go to `/root/peydoo-media/wave2/country-fields/`.
  - The test ads in other countries are kept as test data.
- **Production:** only when the owner says so (`peydoo-promote` plus the seed run).

---

## Appendix: one test ad in every subcategory (owner's request, Nov 5, 2026)

One published test ad in each of the 119 subcategories and 9 event types (128 in all), in Berlin (10999 Kreuzberg).
- **Fields:** every field is filled with a sample value; there are no photos.
- **Titles** start with «آگهی نمونه:» (sample ad) or «رویداد نمونه:» (sample event).
- **Who can see them:** test-account content is hidden from the public. To open these links, sign in as staff or as a test account.
- **Posters.** Most come from the Germany test account. The site's own limits meant a few came from other test accounts:
  - **Free business limit.** A business without Pro may have 3 live ads, and an account at most 3 businesses. So jobs and licensed services came from 8 verified test businesses («کسب‌وکار نمونه…»):
    - Germany test account: 3
    - Austria test account: 3
    - Netherlands test account: 2
  - **Private seller limits.** Homes and property for sale or rent came from the Netherlands, UK, France and Italy test accounts, posting in Germany.
  - **Event limit.** 5 events a day per account, so some events came from the Austria test account.
- **Shared-room link.** The shared-room ad is an older Germany test sample.

**تجهیزات و صنعتی** (`business-equipment`)

- مصالح ساختمانی (`building-materials`): https://staging.peydoo.com/v/x/5ddqg1ytsv
- ماشین‌آلات و ابزار صنعتی (`machinery`): https://staging.peydoo.com/v/x/hkh5gv53dv
- تجهیزات اداری (`office-equipment`): https://staging.peydoo.com/v/x/33qaxsgae5
- تجهیزات فروشگاه و رستوران (`shop-equipment`): https://staging.peydoo.com/v/x/6qz6ry4bvr

**اجتماعی** (`community`)

- گمشده‌ها (اشیا و حیوانات) (`lost-found`): https://staging.peydoo.com/v/x/kmhg886f95
- همسفری (`rideshare`): https://staging.peydoo.com/v/x/ye8af4b5vp
- کمک همسایگی و داوطلبانه (`volunteering`): https://staging.peydoo.com/v/x/4chkpdj72c

**کالای دیجیتال** (`electronics`)

- صوتی و هدفون (`audio`): https://staging.peydoo.com/v/x/91s81d5kts
- دوربین عکاسی و فیلم‌برداری (`cameras`): https://staging.peydoo.com/v/x/h5p2284cm4
- پرینتر، شبکه و لوازم جانبی (`computer-accessories`): https://staging.peydoo.com/v/x/hwrwgedjyz
- قطعات رایانه (`computer-parts`): https://staging.peydoo.com/v/x/7jghx8ybzz
- رایانه رومیزی (`desktop-computers`): https://staging.peydoo.com/v/x/wtr070aycs
- کنسول و بازی ویدیویی (`gaming`): https://staging.peydoo.com/v/x/2drtctsyet
- لپ‌تاپ (`laptops`): https://staging.peydoo.com/v/x/nmzwnm6wn4
- گوشی موبایل (`mobile-phones`): https://staging.peydoo.com/v/x/p9d8z4ezdy
- سایر کالای دیجیتال (`other-electronics`): https://staging.peydoo.com/v/x/9e1rbt2mn5
- لوازم جانبی موبایل (`phone-accessories`): https://staging.peydoo.com/v/x/4mh0m1stck
- تبلت و کتاب‌خوان (`tablets`): https://staging.peydoo.com/v/x/mabaedm0km
- تلویزیون و پروژکتور (`tv-video`): https://staging.peydoo.com/v/x/yr62rymtpp
- ساعت هوشمند و پوشیدنی (`wearables`): https://staging.peydoo.com/v/x/5qkkca3ynz

**رویدادها** (`events-calendar`)

- کنسرت (`event-concerts`): https://staging.peydoo.com/e/x/fm5hsj3cnq
- کودکان (`event-family`): https://staging.peydoo.com/e/x/jeycrb0qw4 (from the Austria test account)
- دورهمی (`event-meetups`): https://staging.peydoo.com/e/x/c35tqyhvx5
- یادبود و همبستگی (`event-memorials`): https://staging.peydoo.com/e/x/zx4g05r3z8 (from the Austria test account)
- سایر رویدادها (`event-other`): https://staging.peydoo.com/e/x/7ttcm5asce (from the Austria test account)
- مهمانی (`event-parties`): https://staging.peydoo.com/e/x/cbbks6jd8p
- فرهنگی و ادبی (`event-readings`): https://staging.peydoo.com/e/x/nxmbytj56n
- ورزش (`event-sports`): https://staging.peydoo.com/e/x/5n41j0rbkn (from the Austria test account)
- کارگاه و کلاس (`event-workshops`): https://staging.peydoo.com/e/x/dr4mwsw63b

**پوشاک و آرایشی** (`fashion-beauty`)

- کیف و اکسسوری (`bags-accessories`): https://staging.peydoo.com/v/x/c75eh6nk8j
- آرایشی و بهداشتی (`beauty-care`): https://staging.peydoo.com/v/x/r0psjvwap5
- زیورآلات و ساعت (`jewelry-watches`): https://staging.peydoo.com/v/x/m4m3fcj5ax
- لباس مردانه (`men-clothing`): https://staging.peydoo.com/v/x/azh2s9qrpd
- کفش (`shoes`): https://staging.peydoo.com/v/x/47qvq3vd5s
- لباس زنانه (`women-clothing`): https://staging.peydoo.com/v/x/0n8hdevby9

**خانه و آشپزخانه** (`home-garden`)

- اتاق خواب، تخت و کمد (`bedroom`): https://staging.peydoo.com/v/x/8fc02j4emp
- فرش، گلیم و تابلوفرش (`carpets-rugs`): https://staging.peydoo.com/v/x/p23qatdg4m
- ظروف و لوازم آشپزخانه (`cookware`): https://staging.peydoo.com/v/x/eewnkxs569
- دکوراسیون (`decor`): https://staging.peydoo.com/v/x/h2fzaaxn1a
- ابزار و تعمیرات (`diy-tools`): https://staging.peydoo.com/v/x/qhkyz44v5y
- خوراکی و نوشیدنی (`food-drinks`): https://staging.peydoo.com/v/x/jwm91414zk
- باغ، گل و گیاه (`garden-plants`): https://staging.peydoo.com/v/x/w5t0047hnw
- لوازم خانگی برقی (`home-appliances`): https://staging.peydoo.com/v/x/jb0bh2wkyt
- پرده و منسوجات خانگی (`home-textiles`): https://staging.peydoo.com/v/x/9mt1dh3rm1
- آشپزخانه و ناهارخوری (`kitchen-dining`): https://staging.peydoo.com/v/x/ms6zbnrb15
- روشنایی (`lighting`): https://staging.peydoo.com/v/x/fke3tqx6e9
- مبلمان پذیرایی و نشیمن (`living-room`): https://staging.peydoo.com/v/x/d45tkjryhm
- سایر لوازم خانه (`other-home`): https://staging.peydoo.com/v/x/9fmacmd80q

**استخدام و کاریابی** (`jobs`)

- آوسبیلدونگ (Ausbildung) (`apprenticeships`): https://staging.peydoo.com/v/x/h7fv6cjryg (from the Austria test account)
- آرایشگری و زیبایی (`beauty-jobs`): https://staging.peydoo.com/v/x/raqs0n11az (from the Austria test account)
- نظافت و خدمات (`cleaning-jobs`): https://staging.peydoo.com/v/x/4pa6v5nb32 (from the Austria test account)
- ساختمان و فنی (`construction-trades`): https://staging.peydoo.com/v/x/see32s9hp9
- آموزشی (`education-jobs`): https://staging.peydoo.com/v/x/stz6cpbh0b (from the Austria test account)
- درمانی و مراقبتی (Pflege) (`healthcare-care`): https://staging.peydoo.com/v/x/f76skk43f3
- رستوران و هتلداری (`hospitality`): https://staging.peydoo.com/v/x/asjcsvamen
- کارآموزی (`internships`): https://staging.peydoo.com/v/x/0nmg7exexz (from the Austria test account)
- فناوری اطلاعات (`it-jobs`): https://staging.peydoo.com/v/x/ktdb92x4sw
- حمل‌ونقل و انبار (`logistics`): https://staging.peydoo.com/v/x/8qfmraehe5
- مینی‌جاب و پاره‌وقت (`mini-jobs`): https://staging.peydoo.com/v/x/z2r5yxwf0a (from the Austria test account)
- اداری و دفتری (`office-admin`): https://staging.peydoo.com/v/x/7v7ytszy1n
- سایر مشاغل (`other-jobs`): https://staging.peydoo.com/v/x/dgs8p7hpsc (from the Austria test account)
- فروش و خرده‌فروشی (`retail-sales`): https://staging.peydoo.com/v/x/negaa9gkv6

**کودک و نوزاد** (`kids-baby`)

- سایر لوازم نوزاد (`baby-gear`): https://staging.peydoo.com/v/x/m7gw46bm6y
- صندلی ماشین کودک (`car-seats`): https://staging.peydoo.com/v/x/6aejvw6gnb
- لباس و کفش کودک (`kids-clothing`): https://staging.peydoo.com/v/x/k6tmt5n8sv
- سرویس خواب و مبلمان کودک (`kids-furniture`): https://staging.peydoo.com/v/x/gk92s39eha
- کالسکه و کریر (`strollers`): https://staging.peydoo.com/v/x/4ytb7hknw7
- اسباب‌بازی (`toys`): https://staging.peydoo.com/v/x/rqp3tc3k7y

**سرگرمی و فراغت** (`leisure-hobbies`)

- هنر و صنایع دستی (`art-handicrafts`): https://staging.peydoo.com/v/x/m6dxexp0z2
- کتاب و مجله (`books`): https://staging.peydoo.com/v/x/7a5ksyh1v8
- کلکسیون و عتیقه (`collectibles`): https://staging.peydoo.com/v/x/nsj4g4f6dj
- فیلم و موسیقی (`music-movies`): https://staging.peydoo.com/v/x/eqg24s0tff
- آلات موسیقی (`musical-instruments`): https://staging.peydoo.com/v/x/vt7g5946ep
- کوهنوردی و کمپینگ (`outdoor-camping`): https://staging.peydoo.com/v/x/2hswsdr23d
- ورزش و تناسب اندام (`sports`): https://staging.peydoo.com/v/x/t9ea3gky60
- بلیت کنسرت و رویداد (`tickets`): https://staging.peydoo.com/v/x/909zqpzq5d

**آموزش و کلاس** (`lessons-courses`)

- هنر و صنایع دستی (`art-courses`): https://staging.peydoo.com/v/x/mgaw6wzgy0
- کامپیوتر و برنامه‌نویسی (`computer-courses`): https://staging.peydoo.com/v/x/vkkaymrw1d
- آموزشگاه رانندگی (`driving-school`): https://staging.peydoo.com/v/x/a1ffnqeks5 (from the Austria test account)
- زبان (`language-courses`): https://staging.peydoo.com/v/x/t7z5fdg83v
- آموزش موسیقی (`music-lessons`): https://staging.peydoo.com/v/x/ysshkq54a3
- سایر کلاس‌ها (`other-courses`): https://staging.peydoo.com/v/x/wc2r4pkn6w
- کلاس ورزشی (`sports-courses`): https://staging.peydoo.com/v/x/10m454dh56
- تدریس خصوصی دروس (`tutoring`): https://staging.peydoo.com/v/x/r3vf1atmtp

**حیوانات** (`pets`)

- پرنده (`birds`): https://staging.peydoo.com/v/x/v70134744f
- گربه (`cats`): https://staging.peydoo.com/v/x/b0e0qgm7fm
- سگ (`dogs`): https://staging.peydoo.com/v/x/4rpxaqenaq
- ماهی و آکواریوم (`fish-aquariums`): https://staging.peydoo.com/v/x/7d90a7hefe
- نگهداری و آموزش حیوانات (`pet-care`): https://staging.peydoo.com/v/x/bn5kxjw9vb
- لوازم حیوانات (`pet-supplies`): https://staging.peydoo.com/v/x/cdes35aw3e
- حیوانات کوچک (`small-animals`): https://staging.peydoo.com/v/x/qbjewez357

**املاک** (`real-estate`)

- اجاره آپارتمان (`apartments-rent`): https://staging.peydoo.com/v/x/9xzre2zgas
- فروش آپارتمان (`apartments-sale`): https://staging.peydoo.com/v/x/tgjkcd9gyk (from the Netherlands test account)
- اجاره ملک تجاری و اداری (`commercial-rent`): https://staging.peydoo.com/v/x/3kt082a7zh (from the UK test account)
- فروش ملک تجاری و اداری (`commercial-sale`): https://staging.peydoo.com/v/x/jy2pnkzz06 (from the France test account)
- اجاره خانه (`houses-rent`): https://staging.peydoo.com/v/x/txnq5tc2w8
- فروش خانه (`houses-sale`): https://staging.peydoo.com/v/x/9ptggvcv96 (from the Netherlands test account)
- زمین و باغچه (`land-gardens`): https://staging.peydoo.com/v/x/mtgd2td5qh
- گاراژ و جای پارک (`parking-garages`): https://staging.peydoo.com/v/x/y9j1ax87zn (from the Italy test account)
- اتاق و خانه اشتراکی (WG) (`shared-rooms`): https://staging.peydoo.com/v/x/pk4ad1xyzq
- اجاره موقت و کوتاه‌مدت (`short-term-rent`): https://staging.peydoo.com/v/x/2dns52ss4z

**خدمات** (`services`)

- آرایشگری و زیبایی (`beauty-services`): https://staging.peydoo.com/v/x/a2wczy36cp
- خدمات خودرو (`car-services`): https://staging.peydoo.com/v/x/2arz5dt1r0
- پذیرایی و مراسم (`catering-events`): https://staging.peydoo.com/v/x/5n47r3ee6s
- مراقبت از کودک (`childcare`): https://staging.peydoo.com/v/x/wdebgw3eq2
- نظافت (`cleaning`): https://staging.peydoo.com/v/x/tkk30x3fp0
- مراقبت از سالمند (`elderly-care`): https://staging.peydoo.com/v/x/9kgb3q08sv
- مالی و بیمه (`finance-insurance`): https://staging.peydoo.com/v/x/267z29q8zy (from the Netherlands test account)
- پزشکی و درمان (`health-services`): https://staging.peydoo.com/v/x/43kvk7ac6j (from the Netherlands test account)
- تعمیرات و خدمات ساختمانی (`home-repairs`): https://staging.peydoo.com/v/x/wv7xwq103x
- خدمات رایانه و موبایل (`it-services`): https://staging.peydoo.com/v/x/x0p1385hez
- مشاورهٔ حقوقی و مهاجرت (`legal-immigration`): https://staging.peydoo.com/v/x/7tcmddwcxa (from the Netherlands test account)
- اسباب‌کشی و حمل‌ونقل (`moving-transport`): https://staging.peydoo.com/v/x/jwzmgnpbbd
- سایر خدمات (`other-services`): https://staging.peydoo.com/v/x/r22n65sv4q
- کمک در کارهای اداری و فرم‌ها (`paperwork-help`): https://staging.peydoo.com/v/x/7f53evr45y
- عکاسی و فیلم‌برداری (`photography`): https://staging.peydoo.com/v/x/emjc7c0vjc
- مشاور املاک (`real-estate-agents`): https://staging.peydoo.com/v/x/ytzjntrkze (from the Netherlands test account)
- مالیات و حسابداری (`tax-accounting`): https://staging.peydoo.com/v/x/j86h7v1059 (from the Netherlands test account)
- ترجمه (`translation`): https://staging.peydoo.com/v/x/edcxngh20n (from the Austria test account)

**وسایل نقلیه** (`vehicles`)

- دوچرخه و اسکوتر برقی (`bicycles`): https://staging.peydoo.com/v/x/pfyrvndh5n
- قایق (`boats`): https://staging.peydoo.com/v/x/rhrxc7f79f
- کاروان و کمپر (`campers`): https://staging.peydoo.com/v/x/5fb00nm2e9
- قطعات و لوازم خودرو (`car-parts`): https://staging.peydoo.com/v/x/vww11ach7m
- خودرو (`cars`): https://staging.peydoo.com/v/x/9esqnyc41p
- خودروی تجاری و تریلر (`commercial-vehicles`): https://staging.peydoo.com/v/x/j6texhyspr
- قطعات و لوازم موتورسیکلت (`motorcycle-parts`): https://staging.peydoo.com/v/x/zvjb32091m
- موتورسیکلت و اسکوتر (`motorcycles`): https://staging.peydoo.com/v/x/j29ck9tgsp
- لاستیک و رینگ (`tires-rims`): https://staging.peydoo.com/v/x/95sw86aabs
