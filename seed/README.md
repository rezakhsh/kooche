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
| `postal/de.tsv`, `postal/at.tsv` | Postal codes and their places (code, place, latitude, longitude), written by `scripts/import-postal-codes.mjs`; never edit by hand |
| `categories.ts` | 14 root categories, 127 leaf categories (with the events section's 13 event types, Oct 18, 2026), 289 attributes and their options (Persian), fields per category as approved Oct 18, 2026 |
| `neighbourhoods/` | City neighbourhoods with Persian names (wave 1): `index.ts` holds the Persian names and sources, `<cc>-<city>.json` the official boundaries written by `scripts/import-neighbourhoods.mjs` (never edit by hand). Berlin: 97 Ortsteile from the Geoportal Berlin (Datenlizenz Deutschland Zero 2.0) |
| `car-models.ts` | 45 car makes and their models for the car `brand` and `model` selects |

To open a country, follow the checklist in `docs/setup.md`, "Countries, places and the map".

## Sources

City and region coordinates, population, time zones and IDs (`geonamesId`) come from
[GeoNames](https://www.geonames.org/) (`cities15000`, `DE` and `AT` dumps, downloaded Oct 16–17, 2026; postal codes from
`export/zip/DE.zip` and `AT.zip`, Oct 17, 2026),
licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The Persian names and
the slugs are our own.
