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
| `countries.ts` | EU, EEA, Switzerland, UK, US, Canada, Australia, Malaysia. Only Germany is open (`isActive`). |
| `locations/de.ts` | The 16 German Länder and the first set of German cities |
| `categories.ts` | 13 root categories, 115 leaf categories, attributes and options (Persian) |

To open a country: add `seed/locations/<code>.ts`, list it in `index.ts`, set `isActive` in
`countries.ts`, and run the seed.

## Sources

City and region coordinates, population, time zones and IDs (`geonamesId`) come from
[GeoNames](https://www.geonames.org/) (`cities15000` and `DE` dumps, downloaded Oct 16, 2026),
licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The Persian names and
the slugs are our own.
