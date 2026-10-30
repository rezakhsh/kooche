import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/drizzle';
import { listings, messages as chatMessages, moderationDecisions, organizationMembers, organizations, reports, users } from '../../db/schema';
import { admin, faDigits, messages } from '../../messages/fa';
import { reportMailDe } from '../../messages/legal-de';
import { operator } from '../../messages/operator';
import { emailHtml, escapeHtml, type Mail } from '../notifications/mailer';
import { isUnreachableMarked } from '../notifications/telegram-reach';
import type { Redis } from 'ioredis';

// What people hear about moderation (roadmap step 8), built by the worker from the database:
// - the person a decision is about gets its statement of reasons by email, and a short Telegram
//   notice with a link when the bot can reach them (`moderation.decided`);
// - whoever reported gets a receipt (`report.created`) and later the outcome
//   (`moderation.decided`), in Persian with a short German version (DSA art. 16(4), (5)).
// Nothing here is written into the outbox: the jobs carry ids only and re-read everything.

const RESTRICTING = new Set(['reject', 'remove', 'hide', 'warn', 'sanction']);

export type TelegramNotice = { telegramUserId: number; text: string; replyMarkup: { inline_keyboard: Array<Array<{ text: string; url: string }>> } };
export type DecisionNotices = { user: { mail: Mail; telegram: TelegramNotice | null } | null; reporters: Mail[] };

function html(paragraphs: string[], link?: { url: string; label: string }, german?: string[]): string {
  return emailHtml(
    paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.7">${escapeHtml(p)}</p>`).join('') +
      (link ? `<p style="margin:0 0 16px"><a href="${escapeHtml(link.url)}" style="display:inline-block;background:#0b6e77;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(link.label)}</a></p>` : '') +
      (german?.length ? `<div dir="ltr" lang="de" style="margin-top:20px;padding-top:12px;border-top:1px solid #e5e5e5;text-align:left;font-size:13px;color:#525252">${german.map((p) => `<p style="margin:0 0 8px">${escapeHtml(p)}</p>`).join('')}</div>` : ''),
  );
}

type Subject = { kind: 'listing'; title: string; code: number; ownerId: string } | { kind: 'user'; userId: string } | { kind: 'business'; name: string; orgId: string } | { kind: 'message'; senderId: string };

async function subjectOf(db: Queryable, d: typeof moderationDecisions.$inferSelect): Promise<Subject | null> {
  if (d.listingId) {
    const [l] = await db.select({ title: listings.title, code: listings.refNumber, ownerId: listings.userId }).from(listings).where(eq(listings.id, d.listingId));
    return l ? { kind: 'listing', ...l } : null;
  }
  if (d.userId) return { kind: 'user', userId: d.userId };
  if (d.organizationId) {
    const [o] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, d.organizationId));
    return o ? { kind: 'business', name: o.name, orgId: d.organizationId } : null;
  }
  if (d.messageId) {
    const [m] = await db.select({ senderId: chatMessages.senderUserId }).from(chatMessages).where(eq(chatMessages.id, d.messageId));
    return m?.senderId ? { kind: 'message', senderId: m.senderId } : null;
  }
  return null;
}

/** What a reporter knows the thing as */
function labelOf(s: Subject): { fa: string; de: string } {
  if (s.kind === 'listing') return { fa: s.title, de: s.title };
  if (s.kind === 'business') return { fa: s.name, de: s.name };
  if (s.kind === 'message') return { fa: messages.moderationMail.message, de: reportMailDe.message };
  return { fa: messages.report.heading.user, de: 'Nutzerkonto' };
}

/** Active accounts a decision is addressed to: the seller, the account, the sender, a business's owners */
async function recipients(db: Queryable, s: Subject): Promise<Array<{ email: string; telegramUserId: number | null }>> {
  let ids: string[] = [];
  if (s.kind === 'listing') ids = [s.ownerId];
  else if (s.kind === 'user') ids = [s.userId];
  else if (s.kind === 'message') ids = [s.senderId];
  else ids = (await db.select({ id: organizationMembers.userId }).from(organizationMembers).where(and(eq(organizationMembers.organizationId, s.orgId), eq(organizationMembers.role, 'owner')))).map((r) => r.id);
  if (ids.length === 0) return [];
  // A suspended account is still active (it can read why); a deleted one gets nothing
  return db.select({ email: users.email, telegramUserId: users.telegramUserId }).from(users).where(and(inArray(users.id, ids), sql`${users.status} <> 'deleted'`));
}

/** The emails and the Telegram notice for one decision */
export async function decisionNotices(db: Queryable, redis: Redis, decisionId: string, appUrl: string, notifyUser: boolean): Promise<DecisionNotices> {
  const [d] = await db.select().from(moderationDecisions).where(eq(moderationDecisions.id, decisionId));
  if (!d) return { user: null, reporters: [] };
  const subject = await subjectOf(db, d);
  if (!subject) return { user: null, reporters: [] };
  const t = messages.moderationMail;
  const noticesUrl = `${appUrl}/account/notices`;

  let user: DecisionNotices['user'] = null;
  if (notifyUser && d.statementFa) {
    const [to] = await recipients(db, subject);
    if (to) {
      const about =
        subject.kind === 'listing' ? t.about.listing(subject.title) : subject.kind === 'business' ? t.about.business(subject.name) : subject.kind === 'message' ? t.about.message : t.about.user;
      const kind = d.appealOfDecisionId ? 'appeal' : RESTRICTING.has(d.decision) ? 'restricted' : 'restored';
      const paragraphs = [about, ...(subject.kind === 'listing' ? [t.code(faDigits(String(subject.code)))] : []), d.statementFa];
      const mail: Mail = {
        to: to.email,
        subject: t.subject[kind],
        text: `${paragraphs.join('\n\n')}\n\n${t.notices}: ${noticesUrl}`,
        html: html(paragraphs, { url: noticesUrl, label: t.notices }),
      };
      const telegram =
        to.telegramUserId !== null && !(await isUnreachableMarked(redis, to.telegramUserId))
          ? { telegramUserId: to.telegramUserId, text: t.telegram(about), replyMarkup: { inline_keyboard: [[{ text: t.notices, url: noticesUrl }]] } }
          : null;
      // Only the first owner of a business gets Telegram; every owner gets the email
      user = { mail, telegram };
    }
  }

  // Reporters: one email each, whatever number of their reports this decision closed
  const rows = await db
    .select({ email: sql<string | null>`coalesce(${reports.reporterEmail}, ${users.email})` })
    .from(reports)
    .leftJoin(users, and(eq(users.id, reports.reporterUserId), eq(users.status, 'active')))
    .where(eq(reports.moderationDecisionId, d.id));
  const emails = [...new Set(rows.map((r) => r.email).filter((e): e is string => !!e))];
  const label = labelOf(subject);
  const removed = RESTRICTING.has(d.decision);
  const reporters = emails.map((email) => {
    const fa = [removed ? t.removed(label.fa) : t.kept(label.fa), t.redress(operator.email)];
    const de = [removed ? reportMailDe.removed(label.de) : reportMailDe.kept(label.de), reportMailDe.redress(operator.email)];
    return {
      to: email,
      subject: `${t.outcomeSubject} · ${reportMailDe.outcomeSubject}`,
      text: `${fa.join('\n\n')}\n\n${t.germanBelow}\n${de.join('\n')}`,
      html: html(fa, undefined, de),
    };
  });
  return { user, reporters };
}

/** The receipt for a new report */
export async function reportReceipt(db: Queryable, reportId: string): Promise<Mail | null> {
  const [r] = await db
    .select({
      email: sql<string | null>`coalesce(${reports.reporterEmail}, ${users.email})`,
      listingTitle: listings.title,
      orgName: organizations.name,
      reportedUser: reports.reportedUserId,
      messageId: reports.messageId,
    })
    .from(reports)
    .leftJoin(users, and(eq(users.id, reports.reporterUserId), eq(users.status, 'active')))
    .leftJoin(listings, eq(listings.id, reports.listingId))
    .leftJoin(organizations, eq(organizations.id, reports.organizationId))
    .where(eq(reports.id, reportId));
  if (!r?.email) return null;
  const t = messages.moderationMail;
  const label = r.listingTitle
    ? { fa: r.listingTitle, de: r.listingTitle }
    : r.orgName
      ? { fa: r.orgName, de: r.orgName }
      : r.messageId
        ? { fa: t.message, de: reportMailDe.message }
        : { fa: messages.report.heading.user, de: 'Nutzerkonto' };
  return {
    to: r.email,
    subject: `${t.receivedSubject} · ${reportMailDe.receivedSubject}`,
    text: `${t.received(label.fa)}\n\n${t.germanBelow}\n${reportMailDe.received(label.de)}`,
    html: html([t.received(label.fa)], undefined, [reportMailDe.received(label.de)]),
  };
}

/** The email after support released the account's phone number */
export async function phoneReleasedMail(db: Queryable, userId: string, appUrl: string): Promise<Mail | null> {
  const [u] = await db.select({ email: users.email, status: users.status }).from(users).where(eq(users.id, userId));
  if (!u || u.status === 'deleted') return null;
  const t = messages.moderationMail;
  const url = `${appUrl}/account/phone`;
  return { to: u.email, subject: t.phoneReleasedSubject, text: `${t.phoneReleased}\n\n${t.phoneLink}: ${url}`, html: html([t.phoneReleased], { url, label: t.phoneLink }) };
}

/**
 * The email after an admin signed in as the person with changes allowed and pressed «پایان»
 * (src/modules/admin/acting.ts; the owner's rule: staff changes are always told)
 */
export async function staffActedMail(db: Queryable, userId: string, appUrl: string): Promise<Mail | null> {
  const [u] = await db.select({ email: users.email, status: users.status, test: users.testAccount }).from(users).where(eq(users.id, userId));
  if (!u || u.status === 'deleted' || u.test) return null;
  const t = messages.moderationMail;
  const url = `${appUrl}/contact`;
  return { to: u.email, subject: t.staffActedSubject, text: `${t.staffActed}\n\n${t.staffActedLink}: ${url}`, html: html([t.staffActed], { url, label: t.staffActedLink }) };
}

/** A staff role given or taken away (src/modules/admin/staff.ts) */
export async function staffRoleMail(db: Queryable, userId: string, change: { from: string | null; to: string | null }, appUrl: string): Promise<Mail | null> {
  const [u] = await db.select({ email: users.email, status: users.status, test: users.testAccount }).from(users).where(eq(users.id, userId));
  if (!u || u.status === 'deleted' || u.test) return null;
  const t = messages.moderationMail;
  const role = (r: string | null) => (r ? (admin.roles[r as 'moderator' | 'admin'] ?? r) : '');
  const url = `${appUrl}/contact`;
  const [subject, body] = change.to ? [t.staffRoleGivenSubject(role(change.to)), t.staffRoleGiven(role(change.to))] : [t.staffRoleRemovedSubject(role(change.from)), t.staffRoleRemoved(role(change.from))];
  return { to: u.email, subject, text: `${body}\n\n${t.staffActedLink}: ${url}`, html: html([body], { url, label: t.staffActedLink }) };
}

/** Support signed the person out on every device (src/modules/admin/users.ts) */
export async function signedOutMail(db: Queryable, userId: string, appUrl: string): Promise<Mail | null> {
  const [u] = await db.select({ email: users.email, status: users.status, test: users.testAccount }).from(users).where(eq(users.id, userId));
  if (!u || u.status === 'deleted' || u.test) return null;
  const t = messages.moderationMail;
  const url = `${appUrl}/login`;
  return { to: u.email, subject: t.signedOutSubject, text: `${t.signedOut}\n\n${t.signedOutLink}: ${url}`, html: html([t.signedOut], { url, label: t.signedOutLink }) };
}

/** «احتمالاً کسب‌وکار» (src/modules/organizations/suspicions.ts): asked, restricted, or cleared after being asked */
export async function businessCaseMail(db: Queryable, userId: string, kind: 'asked' | 'restricted' | 'cleared', appUrl: string): Promise<Mail | null> {
  const [u] = await db.select({ email: users.email, status: users.status, test: users.testAccount }).from(users).where(eq(users.id, userId));
  if (!u || u.status === 'deleted' || u.test) return null;
  const t = messages.moderationMail.businessCase[kind];
  const url = `${appUrl}${kind === 'cleared' ? '/my/listings' : '/business/compare'}`;
  return { to: u.email, subject: t.subject, text: `${t.body}\n\n${t.link}: ${url}`, html: html([t.body], { url, label: t.link }) };
}
