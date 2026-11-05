import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { RANGE_SUFFIXES, RESERVED_PARAMS } from '../modules/search/filters';

// Rules about seeded reference data that the database can't express with constraints
// (docs/schema.md, sections 4 and 5). The seed runs them before it commits, and
// tests/seed.test.ts runs them against the seeded test database.

type Db = PgDatabase<PgQueryResultHKT, any>;

export type SeedCheck = { name: string; query: ReturnType<typeof sql> };

/** A list of text parameters for IN (…) or VALUES */
const textList = (xs: string[]) => sql.join(xs.map((x) => sql`${x}::text`), sql`, `);

/** First path segments the app uses itself, so no country may take them as its slug */
export const RESERVED_SLUGS = ['account', 'api', 'health', 'login', 'my', 'new', 'v', 'b', 'admin', 'search', 'e', 'events', 'chat', 'favorites', 'sitemaps', 'u', 'contact', 'help', 'impressum', 'privacy', 'safety', 'terms', 'alerts', 'business', 'pro', 'waitlist', 'map'];

export const SEED_CHECKS: SeedCheck[] = [
  {
    // A child can't redefine its parent's attribute (e.g. a second `condition` under electronics)
    name: 'attribute keys are unique along each category path',
    query: sql`
      SELECT a2.key || ' in ' || c2.slug || ' repeats ' || c1.slug AS problem
      FROM category_attributes a1
      JOIN categories c1 ON c1.id = a1.category_id
      JOIN category_attributes a2 ON a2.key = a1.key AND a2.id <> a1.id
      JOIN categories c2 ON c2.id = a2.category_id
      WHERE c1.path @> c2.path AND c1.id <> c2.id`,
  },
  {
    name: "a city's parent is a region",
    query: sql`
      SELECT c.slug || ' has parent ' || p.slug || ' (' || p.kind || ')' AS problem
      FROM locations c
      JOIN locations p ON p.id = c.parent_id
      WHERE c.kind = 'city' AND p.kind <> 'region'`,
  },
  {
    // An open country needs places to post in: cities, and postal codes that lead to them
    name: 'an active country has a web address, active cities and postal codes',
    query: sql`
      SELECT c.code || CASE
               WHEN c.slug IS NULL THEN ' has no slug'
               WHEN NOT EXISTS (SELECT 1 FROM locations l
                                WHERE l.country_code = c.code AND l.kind = 'city' AND l.is_active)
                 THEN ' has no active city'
               ELSE ' has no postal codes' END AS problem
      FROM countries c
      WHERE c.is_active AND (
        c.slug IS NULL
        OR NOT EXISTS (SELECT 1 FROM locations l
                       WHERE l.country_code = c.code AND l.kind = 'city' AND l.is_active)
        OR NOT EXISTS (SELECT 1 FROM postal_places p WHERE p.country_code = c.code AND p.is_active))`,
  },
  {
    // Country pages live at /{slug} next to the app's own routes (src/app/)
    name: 'country slugs are not route names',
    query: sql`
      SELECT c.code || ' has the reserved slug ' || c.slug AS problem
      FROM countries c
      WHERE c.slug IN (${sql.join(RESERVED_SLUGS.map((r) => sql`${r}`), sql`, `)})`,
  },
  {
    name: 'every active postal code leads to an active city of its country',
    query: sql`
      SELECT p.country_code || ' ' || p.postal_code || ' ' || p.place_name || ' has no city' AS problem
      FROM postal_places p
      LEFT JOIN locations l ON l.id = p.location_id
      WHERE p.is_active AND (l.id IS NULL OR NOT l.is_active OR l.kind <> 'city')
      LIMIT 20`,
  },
  {
    // allows_listings is true exactly for leaves
    name: 'only leaf categories allow listings',
    query: sql`
      SELECT c.slug || CASE WHEN c.allows_listings THEN ' has children but allows listings'
                            ELSE ' is a leaf but does not allow listings' END AS problem
      FROM categories c
      WHERE c.is_active
        AND c.allows_listings = EXISTS (
          SELECT 1 FROM categories ch WHERE ch.parent_id = c.id AND ch.is_active)`,
  },
  {
    name: 'listings are only in leaf categories',
    query: sql`
      SELECT 'listing ' || l.id || ' is in ' || c.slug AS problem
      FROM listings l
      JOIN categories c ON c.id = l.category_id
      WHERE NOT c.allows_listings`,
  },
  {
    name: 'category paths follow the parent chain',
    query: sql`
      SELECT c.slug || ' has path ' || c.path::text AS problem
      FROM categories c
      LEFT JOIN categories p ON p.id = c.parent_id
      WHERE c.path <> CASE WHEN p.id IS NULL THEN text2ltree(c.slug)
                           ELSE p.path || text2ltree(c.slug) END`,
  },
  {
    name: 'a dependent attribute depends on a select on the same path',
    query: sql`
      SELECT a.key || ' in ' || c.slug || ' depends on ' || d.key || ' in ' || dc.slug AS problem
      FROM category_attributes a
      JOIN categories c ON c.id = a.category_id
      JOIN category_attributes d ON d.id = a.depends_on_attribute_id
      JOIN categories dc ON dc.id = d.category_id
      WHERE NOT dc.path @> c.path OR d.type NOT IN ('select', 'multi_select')
         OR a.type NOT IN ('select', 'multi_select')`,
  },
  {
    name: "an option's parent belongs to the attribute it depends on",
    query: sql`
      SELECT a.key || '=' || o.value || ' has parent ' || p.value AS problem
      FROM category_attribute_options o
      JOIN category_attributes a ON a.id = o.attribute_id
      JOIN category_attribute_options p ON p.id = o.parent_option_id
      WHERE a.depends_on_attribute_id IS DISTINCT FROM p.attribute_id`,
  },
  {
    // money is for numbers, month for dates; optional_in names categories under the definition's own
    name: 'validation settings fit the attribute',
    query: sql`
      SELECT a.key || ' in ' || c.slug || CASE
               WHEN a.validation ? 'money' AND a.type <> 'number' THEN ' has money but is ' || a.type
               WHEN a.validation ? 'month' AND a.type <> 'date' THEN ' has month but is ' || a.type
               ELSE ' is optional in ' || s.slug || ', which is not below it' END AS problem
      FROM category_attributes a
      JOIN categories c ON c.id = a.category_id
      LEFT JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(a.validation -> 'optional_in') = 'array' THEN a.validation -> 'optional_in' ELSE '[]' END
      ) AS s(slug) ON true
      WHERE a.is_active AND (
        (a.validation ? 'money' AND a.type <> 'number')
        OR (a.validation ? 'month' AND a.type <> 'date')
        OR (s.slug IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM categories x WHERE x.slug = s.slug AND x.path <@ c.path AND x.id <> c.id)))`,
  },
  {
    // help_in, like optional_in, names categories under the definition's own, each with a hint
    name: 'category hints belong to categories below the field',
    query: sql`
      SELECT a.key || ' in ' || c.slug || ' has a hint for ' || h.slug || CASE WHEN jsonb_typeof(h.hint) <> 'string' THEN ' that is not text' ELSE ', which is not below it' END AS problem
      FROM category_attributes a
      JOIN categories c ON c.id = a.category_id
      CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(a.validation -> 'help_in') = 'object' THEN a.validation -> 'help_in' ELSE '{}' END) AS h(slug, hint)
      WHERE a.is_active AND (
        jsonb_typeof(h.hint) <> 'string'
        OR NOT EXISTS (SELECT 1 FROM categories x WHERE x.slug = h.slug AND x.path <@ c.path AND x.id <> c.id))`,
  },
  {
    name: 'selects have options and other types have none',
    query: sql`
      SELECT a.key || ' in ' || c.slug || ' (' || a.type || ')' AS problem
      FROM category_attributes a
      JOIN categories c ON c.id = a.category_id
      WHERE a.is_active
        AND (a.type IN ('select', 'multi_select')) <> EXISTS (
          SELECT 1 FROM category_attribute_options o WHERE o.attribute_id = a.id AND o.is_active)`,
  },
  {
    // /germany/{city or category}: one path segment means either, and /germany/berlin/events is
    // the city's events page; /germany/online is «آنلاین از همه‌جا» (wave 2 part 6). Retired rows
    // (the old `community › events`) are never shown.
    name: 'city slugs, category slugs and events stay apart in browse addresses',
    query: sql`
      SELECT 'city ' || l.slug || ' (' || l.country_code || ') ' ||
             CASE WHEN l.slug IN ('events', 'online') THEN 'is named ' || l.slug ELSE 'has the slug of a category' END AS problem
      FROM locations l
      WHERE l.kind = 'city' AND l.is_active
        AND (l.slug IN ('events', 'online') OR EXISTS (SELECT 1 FROM categories c WHERE c.slug = l.slug AND c.is_active))
      UNION ALL
      SELECT 'category ' || slug FROM categories WHERE slug IN ('events', 'online') AND is_active`,
  },
  {
    name: 'free-text fields are not filters',
    query: sql`
      SELECT a.key || ' in ' || c.slug AS problem
      FROM category_attributes a
      JOIN categories c ON c.id = a.category_id
      WHERE a.is_active AND a.is_filterable AND a.type = 'text'`,
  },
  {
    // A filter is ?<key>=…; the form's ranges are <key>_min, <key>_max, <key>_from, <key>_to. So
    // no key may be a parameter of the page, or another key (or price) plus such a suffix.
    name: 'attribute keys stay clear of the browse parameters',
    query: sql`
      SELECT a.key || ' in ' || c.slug AS problem
      FROM category_attributes a
      JOIN categories c ON c.id = a.category_id
      WHERE a.key IN (${textList(RESERVED_PARAMS)})
         OR EXISTS (
           SELECT 1 FROM (VALUES ${sql.join(RANGE_SUFFIXES.map((x) => sql`(${x}::text)`), sql`, `)}) AS s(suffix)
           WHERE a.key = 'price' || s.suffix
              OR EXISTS (SELECT 1 FROM category_attributes b WHERE a.key = b.key || s.suffix))`,
  },
  {
    name: "a match-all filter is only on a filterable multi-select",
    query: sql`
      SELECT a.key || ' in ' || c.slug AS problem
      FROM category_attributes a
      JOIN categories c ON c.id = a.category_id
      WHERE a.validation ? 'filter'
        AND (a.validation ->> 'filter' IS DISTINCT FROM 'all' OR a.type <> 'multi_select' OR NOT a.is_filterable)`,
  },
  {
    // Field audit item 5: countries, hidden_in and by_country name real countries (or `*`), and a
    // rule's options and option labels are the field's own options
    name: 'country rules name real countries and the field\'s own options',
    query: sql`
      WITH codes AS (
        SELECT a.id, a.key, c.slug, x.code
        FROM category_attributes a
        JOIN categories c ON c.id = a.category_id
        CROSS JOIN LATERAL (
          SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(a.validation -> 'countries') = 'array' THEN a.validation -> 'countries' ELSE '[]' END)
          UNION ALL SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(a.validation -> 'hidden_in') = 'array' THEN a.validation -> 'hidden_in' ELSE '[]' END)
          UNION ALL SELECT jsonb_object_keys(CASE WHEN jsonb_typeof(a.validation -> 'by_country') = 'object' THEN a.validation -> 'by_country' ELSE '{}' END)
        ) AS x(code)
        WHERE a.is_active
      ),
      rule_options AS (
        SELECT a.id, a.key, c.slug, r.code, o.value
        FROM category_attributes a
        JOIN categories c ON c.id = a.category_id
        CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(a.validation -> 'by_country') = 'object' THEN a.validation -> 'by_country' ELSE '{}' END) AS r(code, rule)
        CROSS JOIN LATERAL (
          SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(r.rule -> 'options') = 'array' THEN r.rule -> 'options' ELSE '[]' END)
          UNION ALL SELECT jsonb_object_keys(CASE WHEN jsonb_typeof(r.rule -> 'option_labels') = 'object' THEN r.rule -> 'option_labels' ELSE '{}' END)
        ) AS o(value)
        WHERE a.is_active
      )
      SELECT key || ' in ' || slug || ' names the country ' || code AS problem
      FROM codes WHERE code <> '*' AND NOT EXISTS (SELECT 1 FROM countries k WHERE k.code = codes.code)
      UNION ALL
      SELECT key || ' in ' || slug || ' gives ' || code || ' the option ' || value || ', which it does not have'
      FROM rule_options r
      WHERE NOT EXISTS (SELECT 1 FROM category_attribute_options o WHERE o.attribute_id = r.id AND o.value = r.value AND o.is_active)`,
  },
];

export type SeedCheckFailure = { name: string; problems: string[] };

export async function runSeedChecks(db: Db): Promise<SeedCheckFailure[]> {
  const failures: SeedCheckFailure[] = [];
  for (const check of SEED_CHECKS) {
    const rows = (await db.execute(check.query)) as unknown as { problem: string }[];
    if (rows.length > 0) failures.push({ name: check.name, problems: rows.map((r) => r.problem) });
  }
  return failures;
}
