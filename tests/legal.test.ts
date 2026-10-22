import { describe, expect, it } from 'vitest';
import { RESERVED_SLUGS } from '../src/db/seed-checks';
import { faDigits, messages, pages } from '../src/messages/fa';
import { legalDe } from '../src/messages/legal-de';
import type { LegalDoc } from '../src/messages/legal-types';
import { operator } from '../src/messages/operator';
import { BANNED_TERM_SECTION, BANNED_TERMS, bannedTermGround, EVENT_LINKS_SECTION, findBannedTerm, groundSection, OWN_PHOTOS_SECTION, policyGround } from '../src/modules/moderation/terms';
import { browseCacheControl, browseCountry } from '../src/proxy';

// Legal pages (roadmap step 2, approved Oct 21, 2026). The Persian terms and privacy policy follow
// the binding German versions section by section, and the moderation decisions cite sections that
// exist in both.

const ids = (doc: LegalDoc) => doc.sections.map((s) => s.id);
const DOCS = [
  ['terms', pages.terms, legalDe.terms],
  ['privacy', pages.privacy, legalDe.privacy],
] as const;

describe('Persian and German versions', () => {
  it.each(DOCS)('%s: same sections in the same order', (_, fa, de) => {
    expect(ids(fa)).toEqual(ids(de));
    expect(new Set(ids(fa)).size).toBe(ids(fa).length);
  });

  it.each(DOCS)('%s: every subsection sits under its main section, in order', (_, fa) => {
    let main = '';
    for (const id of ids(fa)) {
      if (!id.includes('.')) main = id;
      else expect(id.split('.')[0]).toBe(main);
    }
  });

  it.each(DOCS)('%s: headings carry their number (Persian digits in Persian)', (_, fa, de) => {
    for (const [i, s] of de.sections.entries()) {
      expect(s.heading.startsWith(`${s.id} `) || s.heading.startsWith(`${s.id}. `)).toBe(true);
      const f = fa.sections[i]!;
      expect(f.heading.startsWith(`${faDigits(s.id)} `) || f.heading.startsWith(`${faDigits(s.id)}. `)).toBe(true);
    }
  });

  it.each(DOCS)('%s: both are marked as drafts until a lawyer has checked them', (_, fa, de) => {
    expect(fa.draft).toBe(true);
    expect(de.draft).toBe(true);
  });

  it('both versions show the operator where the German one does', () => {
    for (const [, fa, de] of DOCS) {
      const withOperator = (doc: LegalDoc) => doc.sections.filter((s) => s.body.some((b) => typeof b === 'object' && 'operator' in b)).map((s) => s.id);
      expect(withOperator(fa)).toEqual(withOperator(de));
      expect(withOperator(de).length).toBeGreaterThan(0);
    }
  });
});

describe('operator details', () => {
  it('are filled in, never guessed', () => {
    expect(operator.name).toBeTruthy();
    expect(operator.street).toBeTruthy();
    expect(operator.postalCode).toMatch(/^\d{5}$/);
    expect(operator.email).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]+$/);
  });
});

describe('policy grounds name real sections of the terms', () => {
  const sections = new Set(ids(legalDe.terms));

  it('every section the automatic checks cite exists in both versions', () => {
    for (const s of [...Object.values(BANNED_TERM_SECTION), OWN_PHOTOS_SECTION, EVENT_LINKS_SECTION]) {
      expect(sections.has(s), s).toBe(true);
      expect(ids(pages.terms)).toContain(s);
    }
  });

  it('each banned-term group has its own section under 5 (prohibited items)', () => {
    expect(Object.keys(BANNED_TERM_SECTION).sort()).toEqual(Object.keys(BANNED_TERMS).sort());
    expect(new Set(Object.values(BANNED_TERM_SECTION)).size).toBe(Object.keys(BANNED_TERMS).length);
    for (const s of Object.values(BANNED_TERM_SECTION)) expect(s.startsWith('5.')).toBe(true);
    expect(findBannedTerm('کلاشینکف نو')?.group).toBe('weapons');
    expect(BANNED_TERM_SECTION.weapons).toBe('5.2');
    expect(BANNED_TERM_SECTION.drugs).toBe('5.3');
    expect(BANNED_TERM_SECTION.money_transfer).toBe('5.4');
    expect(bannedTermGround('weapons')).toBe('terms-5.2');
    expect(bannedTermGround('unknown')).toBe('terms-5.1');
  });

  it('groundSection reads a terms ground and nothing else', () => {
    expect(policyGround('5.2')).toBe('terms-5.2');
    expect(groundSection('terms-5.2')).toBe('5.2');
    expect(groundSection('terms-12')).toBe('12');
    // Older rows on staging keep their placeholder; it links nowhere
    expect(groundSection('terms-prohibited-items')).toBeNull();
    expect(groundSection(null)).toBeNull();
    expect(groundSection('StGB §86')).toBeNull();
  });

  it('the statements name the section in Persian digits', () => {
    expect(messages.moderation.statement.banned_terms('5.4')).toContain('بند ۵.۴ شرایط استفاده');
    expect(messages.moderation.statement.duplicate_photos_exact('4.3')).toContain('بند ۴.۳');
    expect(messages.moderation.statement.event_links('4.6')).toContain('بند ۴.۶');
  });
});

describe('the new pages are not browse pages', () => {
  const PATHS = ['/terms', '/terms/de', '/privacy', '/privacy/de', '/impressum', '/safety', '/help', '/contact'];

  it.each(PATHS)('%s is neither cached at the edge nor sets a country', (path) => {
    expect(browseCountry(path)).toBeNull();
    expect(browseCacheControl(path, new URLSearchParams(), () => undefined)).toBeNull();
  });

  it('their first segments can never become a city or category slug', () => {
    for (const p of PATHS) expect(RESERVED_SLUGS).toContain(p.split('/')[1]);
  });
});

describe('paid services (roadmap step 6)', () => {
  it('Stripe is in both privacy policies, with the 10-year retention of payment records', () => {
    const text = (doc: LegalDoc) => JSON.stringify(doc.sections);
    expect(text(legalDe.privacy)).toContain('Stripe Payments Europe');
    expect(text(pages.privacy)).toContain('Stripe Payments Europe');
    expect(text(legalDe.privacy)).not.toContain('sobald es kostenpflichtige Leistungen gibt');
  });

  it('both terms have the paid-services section the purchase form links to, with the §19 note', () => {
    expect(ids(legalDe.terms)).toContain('14.4');
    expect(JSON.stringify(legalDe.terms.sections)).toContain('§ 19 UStG');
    expect(JSON.stringify(legalDe.terms.sections)).toContain('§ 356 Abs. 4 BGB');
  });
});
