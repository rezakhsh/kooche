# Seed data

Reference data that every environment starts with: currencies, countries, regions and cities,
and the category tree with its attributes and options. Production starts from migrations plus
these files; local test data is never copied.

```bash
npm run db:seed   # as classifieds_owner (MIGRATION_DATABASE_URL)
```

The loader (`src/db/seed.ts`) runs in one transaction and can be run again at any time:

- Rows are matched by their natural key (currency and country code, location and category slug,
  attribute key per category, option value per attribute) and updated in place.
- A category, attribute, option or location removed from these files is set inactive, not
  deleted, because listings may still point at it.
- The seed checks (`src/db/seed-checks.ts`) run before the commit. If one fails, nothing is
  written.

| File | Contents |
| --- | --- |
| `currencies.ts` | ISO 4217 currencies with Persian names |
| `countries.ts` | EU, EEA, Switzerland, UK, Turkey, US, Canada, Australia, Malaysia, each with its web address (`slug`). Germany and Austria are open (`isActive`); Turkey is listed but closed. |
| `locations/de.ts` | The 16 German Länder and the first set of German cities |
| `locations/at.ts` | The 9 Austrian Bundesländer and 29 cities (the largest and every state capital) |
| `postal/<cc>.tsv` | Postal codes and their places (code, place, latitude, longitude) for DE, AT and the 9 planned countries (GB, FR, TR, CA, US, NL, IT, SE, AU; Nov 4, 2026), written by `scripts/import-postal-codes.mjs` with a rule per country (codes in the form `src/modules/listings/postal-code.ts` reads; never a street-level code); never edit by hand |
| `categories.ts` | 14 root categories, 128 leaf categories (119 for listings and the events section's 9 event types), 304 attributes and their options (Persian); fields per category as approved Oct 18, 2026, changed by the field audit on Nov 5, 2026 (bedrooms, the short let's price per night, week or month, the WG room's bills and stay; `docs/research/field-audit.md`) |
| `postal-areas/` | Postal code areas for the street map: `<cc>.json` (polylines; never edit by hand), `index.ts` decodes them. DE, AT, FR, TR from OpenStreetMap (`scripts/import-postal-areas.mjs`); US, CA, NL, AU from official files (`scripts/import-official-postal-areas.py`, Nov 4, 2026). GB, IT and SE have none (circles) |
| `neighbourhoods/` | City districts, names as written locally (owner, Nov 3, 2026): `index.ts` lists the cities and sources, `<cc>-<city>.json` the boundaries (never edit by hand). Berlin: 97 Ortsteile from the Geoportal Berlin (Datenlizenz Deutschland Zero 2.0, `scripts/import-neighbourhoods.mjs`); 45 other cities of about 200,000 people or more from OpenStreetMap (`scripts/import-osm-neighbourhoods.mjs`) |
| `car-models.ts` | 45 car makes and their models for the car `brand` and `model` selects |

To open a country, follow the checklist in `docs/setup.md`, "Countries, places and the map".

## Sources

City and region coordinates, population, time zones and IDs (`geonamesId`) come from
[GeoNames](https://www.geonames.org/) (`cities15000`, `DE` and `AT` dumps, downloaded Oct 16–17, 2026; for GB, FR,
TR, CA, US, NL, IT, SE and AU `cities15000` and the country dumps' regions, Nov 4, 2026; postal codes from
`export/zip/DE.zip` and `AT.zip`, Oct 17, 2026, and `GB.zip`, `FR.zip`, `TR.zip`, `CA.zip`, `US.zip`, `NL.zip`,
`IT.zip`, `SE.zip`, `AU.zip`, Nov 4, 2026),
licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The slugs are our own. The Persian
names of Germany's and Austria's places are our own; those of the other countries' places are
[Wikidata](https://www.wikidata.org/)'s Persian labels (CC0, found by GeoNames ID or the English Wikipedia
article, Nov 4, 2026), checked, with wrong or missing ones written by hand.

Postal code areas (`postal-areas/`) come from [OpenStreetMap](https://www.openstreetmap.org/copyright)
(`boundary=postal_code` relations through the Overpass API, Oct 28, 2026), © OpenStreetMap
contributors, licensed under the [ODbL](https://opendatacommons.org/licenses/odbl/). The street map
shows «© OpenStreetMap» on every map. France's and Turkey's areas came the same way on Nov 4, 2026.

Official postal code areas (`postal-areas/us.json`, `ca.json`, `nl.json`, `au.json`, Nov 4, 2026, by
`scripts/import-official-postal-areas.py`; the map's corner names the source while its area is shown):

- **US:** U.S. Census Bureau, 2020 ZIP Code Tabulation Areas, cartographic boundary file 1:500,000
  (`cb_2020_us_zcta520_500k`), public domain. ZCTAs approximate ZIP delivery areas; PO-box and
  single-company ZIPs have none.
- **CA:** Statistics Canada, 2021 Census Forward Sortation Area Boundary File, cartographic
  (`lfsa000b21a_e`, read from StatCan's map service `geo.statcan.gc.ca`). Contains information
  licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
- **NL:** © CBS (Statistics Netherlands), postcode4 (PC4) 2024, from PDOK
  (`api.pdok.nl/cbs/postcode4`), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **AU:** © Australian Bureau of Statistics, ASGS Edition 3, Postal Areas 2021 (GDA2020),
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Postal areas approximate postcodes;
  PO-box codes have none.

All are simplified (Douglas-Peucker, about 15–20 m, more for big areas in proportion to their size). The districts of the cities other than Berlin
(`neighbourhoods/`) come from OpenStreetMap the same way (`boundary=administrative` relations,
Nov 3, 2026), under the same licence.
