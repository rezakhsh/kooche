import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

// Rules about seeded reference data that the database can't express with constraints
// (docs/schema.md, sections 4 and 5). The seed runs them before it commits, and
// tests/seed.test.ts runs them against the seeded test database.

type Db = PgDatabase<PgQueryResultHKT, any>;

export type SeedCheck = { name: string; query: ReturnType<typeof sql> };

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
    name: 'selects have options and other types have none',
    query: sql`
      SELECT a.key || ' in ' || c.slug || ' (' || a.type || ')' AS problem
      FROM category_attributes a
      JOIN categories c ON c.id = a.category_id
      WHERE a.is_active
        AND (a.type IN ('select', 'multi_select')) <> EXISTS (
          SELECT 1 FROM category_attribute_options o WHERE o.attribute_id = a.id AND o.is_active)`,
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
