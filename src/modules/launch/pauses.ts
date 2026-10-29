import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { categories, categoryPauses, locations } from '../../db/schema';
import { staffAudit, type StaffContext } from '../admin/audit';

// Emergency pause (wave 2 part 2, owner Oct 29, 2026; docs/setup.md, "Country modes"): no new
// listings in a category and its subcategories, in a whole country or one city, until a set time.
// Publishing refuses with a clear line (`paused` from saveListing); the draft stays and what is
// already live stays visible. Set and lifted by the owner on admin › countries and cities.

export const PAUSE_MAX_DAYS = 30;

export type Pause = { id: string; categoryId: string; categoryName: string; city: string | null; locationId: string | null; reason: string; until: Date };

/** The pause that stops a new listing in this category and place now, if any (the one that lasts longest) */
export async function pauseFor(db: Queryable, input: { categoryId: string; countryCode: string; locationId: string | null }, now = new Date()): Promise<{ until: Date } | null> {
  const [p] = await db
    .select({ until: categoryPauses.until })
    .from(categoryPauses)
    .innerJoin(categories, eq(categories.id, categoryPauses.categoryId))
    .where(
      and(
        eq(categoryPauses.countryCode, input.countryCode),
        isNull(categoryPauses.liftedAt),
        gt(categoryPauses.until, now),
        // The paused category or one above the listing's
        sql`${categories.path} @> (SELECT c.path FROM categories c WHERE c.id = ${input.categoryId})`,
        // The whole country, or the listing's city (a city that launches with another counts as that one)
        input.locationId
          ? sql`(${categoryPauses.locationId} IS NULL OR ${categoryPauses.locationId} IN (
              SELECT coalesce(l.launch_with_id, l.id) FROM locations l WHERE l.id = ${input.locationId}
              UNION SELECT ${input.locationId}::uuid))`
          : isNull(categoryPauses.locationId),
      ),
    )
    .orderBy(desc(categoryPauses.until))
    .limit(1);
  return p ?? null;
}

/** A country's pauses still running, for admin */
export async function activePauses(db: Queryable, countryCode: string, now = new Date()): Promise<Pause[]> {
  return db
    .select({
      id: categoryPauses.id,
      categoryId: categoryPauses.categoryId,
      categoryName: categories.nameFa,
      city: locations.nameFa,
      locationId: categoryPauses.locationId,
      reason: categoryPauses.reason,
      until: categoryPauses.until,
    })
    .from(categoryPauses)
    .innerJoin(categories, eq(categories.id, categoryPauses.categoryId))
    .leftJoin(locations, eq(locations.id, categoryPauses.locationId))
    .where(and(eq(categoryPauses.countryCode, countryCode), isNull(categoryPauses.liftedAt), gt(categoryPauses.until, now)))
    .orderBy(categoryPauses.until);
}

export type PauseInput = { categoryId: string; countryCode: string; locationId: string | null; days: number; reason: string };

/** Admin: pauses a category in a country or city for 1–30 days, with a reason; in audit_log */
export async function pauseCategory(tx: Queryable, ctx: StaffContext, input: PauseInput, now = new Date()): Promise<'ok' | 'invalid'> {
  const reason = input.reason.trim().slice(0, 500);
  const days = Math.round(input.days);
  if (reason.length < 3 || !(days >= 1 && days <= PAUSE_MAX_DAYS)) return 'invalid';
  const [cat] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.id, input.categoryId));
  if (!cat) return 'invalid';
  if (input.locationId) {
    const [city] = await tx.select({ id: locations.id }).from(locations).where(and(eq(locations.id, input.locationId), eq(locations.countryCode, input.countryCode)));
    if (!city) return 'invalid';
  }
  const until = new Date(now.getTime() + days * 86_400_000);
  const [p] = await tx
    .insert(categoryPauses)
    .values({ categoryId: input.categoryId, countryCode: input.countryCode, locationId: input.locationId, reason, until, createdByUserId: ctx.userId })
    .returning({ id: categoryPauses.id });
  await staffAudit(tx, ctx, 'category.paused', { type: 'category', id: input.categoryId }, { pause: p!.id, country: input.countryCode, city: input.locationId, days, reason });
  return 'ok';
}

/** Admin: ends a pause early; in audit_log */
export async function liftPause(tx: Queryable, ctx: StaffContext, pauseId: string): Promise<boolean> {
  const [p] = await tx
    .update(categoryPauses)
    .set({ liftedAt: sql`now()`, liftedByUserId: ctx.userId })
    .where(and(eq(categoryPauses.id, pauseId), isNull(categoryPauses.liftedAt)))
    .returning({ categoryId: categoryPauses.categoryId, country: categoryPauses.countryCode });
  if (!p) return false;
  await staffAudit(tx, ctx, 'category.pause_lifted', { type: 'category', id: p.categoryId }, { pause: pauseId, country: p.country });
  return true;
}
