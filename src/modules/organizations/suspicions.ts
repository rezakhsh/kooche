import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { businessSuspicions, outboxEvents, users, type SuspicionReason } from '../../db/schema';
import { staffAudit, type StaffContext } from '../admin/audit';
import { ancestry, type Catalog } from '../listings/catalog';

// «احتمالاً کسب‌وکار» (wave 2 part 4; round 9: "a probably-a-business queue, about 3–10 cases a
// week; a nudge, then 14 days to answer, then a restriction in those categories; never for volume
// alone"). Selling regularly as a private person is unfair to businesses and against the law
// (UWG Anhang Nr. 22), but Peydoo only asks; it never decides that someone is a business.
// - The worker checks once a day (findSuspicions): private accounts with live offers that look
//   commercial. Reasons are rules, not a model: many live offers, the same thing listed again and
//   again, business words in several listings, a company-like name. Staff and test accounts,
//   members of a business, and anyone dismissed in the last 180 days are left out.
// - Staff ask («پرسیدن»): the person gets an email with 14 days to open a business page (and
//   move their listings to it) or say they are private. «کسب‌وکار نیست» closes the case.
// - After the deadline an admin may restrict («محدود کردن»): private offers in the case's top
//   categories are refused (`business_required`) until they open a business. Live listings stay.
// - Opening (or joining) a business closes the case by itself (closeSwitched).
// Every step is in audit_log, and the person is emailed when asked, restricted, or cleared after
// being asked (owner's rule: every staff change to an account is told).

export const ASK_DAYS = 14;
const DISMISSED_QUIET_DAYS = 180;
const MANY_LIVE = 20;
const SAME_TITLE = 4;
const WORD_LISTINGS = 2;

/** Business words in a listing or a name (normalized text: Persian folded, Latin lower case) */
const BUSINESS_WORDS = String.raw`(\mgmbh\M|\me\.k\.|\mltd\M|\mfirma\M|großhandel|grosshandel|شرکت|فروشگاه|مغازه|عمده|نمایندگی|تعمیرگاه|آموزشگاه)`;
const COMPANY_NAME = String.raw`(\mgmbh\M|\mug\M|\me\.k\.|\mltd\M|\minc\M|شرکت|فروشگاه|گالری|رستوران|آموزشگاه|تعمیرگاه|نمایندگی)`;

export type FoundCase = { userId: string; reasons: SuspicionReason[]; rootSlugs: string[] };

/** The first three words of a normalized title: the same thing listed again */
const titleKey = (t: string) => t.split(/\s+/).filter(Boolean).slice(0, 3).join(' ');

/** Worker, daily: new cases, written as `open` (existing live cases and quiet ones are left alone) */
export async function findSuspicions(db: Queryable, catalog: Catalog, now = new Date()): Promise<FoundCase[]> {
  const rows = await db.execute<{ user_id: string; category_id: string; title: string; words: boolean; company: boolean }>(sql`
    SELECT l.user_id, l.category_id, l.title_normalized AS title,
      (l.title_normalized || ' ' || l.description_normalized) ~* ${BUSINESS_WORDS} AS words,
      u.display_name_normalized ~* ${COMPANY_NAME} AS company
    FROM listings l
    JOIN users u ON u.id = l.user_id
    WHERE l.status = 'active' AND l.organization_id IS NULL AND l.kind = 'offer' AND l.category_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM event_details e WHERE e.listing_id = l.id)
      AND u.status = 'active' AND u.staff_role IS NULL AND u.test_account IS NULL
      AND NOT EXISTS (SELECT 1 FROM organization_members m JOIN organizations o ON o.id = m.organization_id
        WHERE m.user_id = u.id AND o.status = 'active')
      AND NOT EXISTS (SELECT 1 FROM business_suspicions s WHERE s.user_id = u.id
        AND (s.status IN ('open', 'asked', 'restricted')
          OR (s.status = 'dismissed' AND s.decided_at > ${new Date(now.getTime() - DISMISSED_QUIET_DAYS * 86_400_000).toISOString()}::timestamptz)))`);

  type Row = (typeof rows)[number];
  const byUser = new Map<string, Row[]>();
  for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
  const found: FoundCase[] = [];
  for (const [userId, list] of byUser) {
    const reasons: SuspicionReason[] = [];
    if (list.length >= MANY_LIVE) reasons.push({ code: 'many_listings', n: list.length });
    const keys = new Map<string, number>();
    for (const l of list) if (titleKey(l.title)) keys.set(titleKey(l.title), (keys.get(titleKey(l.title)) ?? 0) + 1);
    const same = Math.max(0, ...keys.values());
    if (same >= SAME_TITLE) reasons.push({ code: 'similar_titles', n: same });
    const words = list.filter((l) => l.words).length;
    if (words >= WORD_LISTINGS) reasons.push({ code: 'business_words', n: words });
    if (list[0]!.company) reasons.push({ code: 'company_name' });
    // Never for volume alone (round 9, Kamenova): a big clear-out isn't a business
    if (reasons.length === 0 || (reasons.length === 1 && reasons[0]!.code === 'many_listings')) continue;
    const rootSlugs = [...new Set(list.map((l) => ancestry(catalog, l.category_id)[0]?.slug).filter((s): s is string => !!s))].sort();
    found.push({ userId, reasons, rootSlugs });
  }
  for (const c of found) {
    await db.insert(businessSuspicions).values({ userId: c.userId, reasons: c.reasons, rootSlugs: c.rootSlugs }).onConflictDoNothing();
  }
  return found;
}

/** Worker, daily: cases of people who opened or joined a business since are closed */
export async function closeSwitched(db: Queryable, now = new Date()): Promise<number> {
  const rows = await db.execute(sql`
    UPDATE business_suspicions s SET status = 'switched', decided_at = ${now.toISOString()}::timestamptz
    WHERE s.status IN ('open', 'asked', 'restricted')
      AND EXISTS (SELECT 1 FROM organization_members m JOIN organizations o ON o.id = m.organization_id
        WHERE m.user_id = s.user_id AND o.status = 'active')
    RETURNING s.id`);
  return rows.length;
}

/** Top categories in which this person may not post private offers (a restricted case) */
export async function restrictedRoots(db: Queryable, userId: string): Promise<string[]> {
  const [row] = await db
    .select({ roots: businessSuspicions.rootSlugs })
    .from(businessSuspicions)
    .where(and(eq(businessSuspicions.userId, userId), eq(businessSuspicions.status, 'restricted')));
  return row?.roots ?? [];
}

export type SuspicionCase = {
  id: string;
  createdAt: Date;
  status: 'open' | 'asked';
  reasons: SuspicionReason[];
  rootSlugs: string[];
  askedAt: Date | null;
  deadlineAt: Date | null;
  user: { id: string; publicToken: string; displayName: string };
  listings: { title: string; publicToken: string }[];
};

/** Admin: the open and asked cases, the asked ones past their deadline first, then the oldest */
export async function suspicionQueue(db: Queryable, now = new Date()): Promise<SuspicionCase[]> {
  const rows = await db
    .select({
      id: businessSuspicions.id,
      createdAt: businessSuspicions.createdAt,
      status: businessSuspicions.status,
      reasons: businessSuspicions.reasons,
      rootSlugs: businessSuspicions.rootSlugs,
      askedAt: businessSuspicions.askedAt,
      deadlineAt: businessSuspicions.deadlineAt,
      userId: users.id,
      publicToken: users.publicToken,
      displayName: users.displayName,
    })
    .from(businessSuspicions)
    .innerJoin(users, eq(users.id, businessSuspicions.userId))
    .where(inArray(businessSuspicions.status, ['open', 'asked']))
    .orderBy(sql`(${businessSuspicions.deadlineAt} IS NOT NULL AND ${businessSuspicions.deadlineAt} < ${now.toISOString()}::timestamptz) DESC`, businessSuspicions.createdAt)
    .limit(50);
  const out: SuspicionCase[] = [];
  for (const r of rows) {
    const listings = await db.execute<{ title: string; public_token: string }>(sql`
      SELECT title, public_token FROM listings
      WHERE user_id = ${r.userId} AND organization_id IS NULL AND status = 'active' AND kind = 'offer'
      ORDER BY published_at DESC NULLS LAST LIMIT 6`);
    out.push({
      id: r.id,
      createdAt: r.createdAt,
      status: r.status as 'open' | 'asked',
      reasons: r.reasons,
      rootSlugs: r.rootSlugs,
      askedAt: r.askedAt,
      deadlineAt: r.deadlineAt,
      user: { id: r.userId, publicToken: r.publicToken, displayName: r.displayName },
      listings: listings.map((l) => ({ title: l.title, publicToken: l.public_token })),
    });
  }
  return out;
}

/** How many cases wait for staff (the admin menu's badge): open ones and asked ones past the deadline */
export async function suspicionsWaiting(db: Queryable, now = new Date()): Promise<number> {
  const [row] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM business_suspicions
    WHERE status = 'open' OR (status = 'asked' AND deadline_at < ${now.toISOString()}::timestamptz)`);
  return row?.n ?? 0;
}

export type SuspicionDecision = 'ask' | 'dismiss' | 'restrict';

/**
 * Staff decide on a case. `ask` only an open one; `dismiss` an open or asked one; `restrict` only
 * an asked one past its deadline. Returns false when the case isn't in that state.
 */
export async function decideSuspicion(tx: Queryable, ctx: StaffContext, id: string, decision: SuspicionDecision, now = new Date()): Promise<boolean> {
  const [c] = await tx.select().from(businessSuspicions).where(eq(businessSuspicions.id, id)).for('update');
  if (!c) return false;
  const deadline = new Date(now.getTime() + ASK_DAYS * 86_400_000);
  let set: Partial<typeof businessSuspicions.$inferInsert>;
  let mail: string | null;
  if (decision === 'ask' && c.status === 'open') {
    set = { status: 'asked', askedAt: now, deadlineAt: deadline };
    mail = 'user.business_asked';
  } else if (decision === 'dismiss' && (c.status === 'open' || c.status === 'asked')) {
    set = { status: 'dismissed', decidedAt: now, decidedByUserId: ctx.userId };
    // Only someone who was asked hears that it is closed
    mail = c.status === 'asked' ? 'user.business_cleared' : null;
  } else if (decision === 'restrict' && c.status === 'asked' && c.deadlineAt && c.deadlineAt < now) {
    set = { status: 'restricted', decidedAt: now, decidedByUserId: ctx.userId };
    mail = 'user.business_restricted';
  } else return false;
  await tx.update(businessSuspicions).set(set).where(eq(businessSuspicions.id, id));
  await staffAudit(tx, ctx, `business_suspicion.${decision}`, { type: 'user', id: c.userId }, { case: id, roots: c.rootSlugs });
  if (mail) await tx.insert(outboxEvents).values({ eventType: mail, aggregateType: 'user', aggregateId: c.userId, payload: { case: id } });
  return true;
}

/** The person's last case, newest first (their admin page) */
export async function suspicionsOf(db: Queryable, userId: string) {
  return db.select().from(businessSuspicions).where(eq(businessSuspicions.userId, userId)).orderBy(desc(businessSuspicions.createdAt)).limit(5);
}
