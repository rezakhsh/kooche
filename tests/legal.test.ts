import { describe, expect, it } from 'vitest';
import { RESERVED_SLUGS } from '../src/db/seed-checks';
import { faDigits, messages, pages } from '../src/messages/fa';
import { legalDe } from '../src/messages/legal-de';
import type { LegalDoc } from '../src/messages/legal-types';
import { operator } from '../src/messages/operator';
import { REASON_SECTIONS } from '../src/modules/moderation/reasons';
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

  // The site is live; the owner has the lawyer check done separately and asked for the banner to go (Nov 2, 2026)
  it.each(DOCS)('%s: no draft banner on either version', (_, fa, de) => {
    expect(fa.draft).toBe(false);
    expect(de.draft).toBe(false);
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

  it('every section a report or decision reason can name exists in both versions', () => {
    for (const s of new Set(Object.values(REASON_SECTIONS).flat())) {
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
  it('Stripe is in both privacy policies', () => {
    const text = (doc: LegalDoc) => JSON.stringify(doc.sections);
    expect(text(legalDe.privacy)).toContain('Stripe Payments Europe');
    expect(text(pages.privacy)).toContain('Stripe Payments Europe');
    expect(text(legalDe.privacy)).not.toContain('sobald es kostenpflichtige Leistungen gibt');
  });

  it('both terms have the paid-services section the purchase form links to, with the §19 note', () => {
    expect(ids(legalDe.terms)).toContain('14.4');
    expect(JSON.stringify(legalDe.terms.sections)).toContain('§ 19 UStG');
    expect(JSON.stringify(legalDe.terms.sections)).toContain('§ 356 Abs. 5 Nr. 2 BGB');
    expect(JSON.stringify(legalDe.terms.sections)).toContain('§ 357a Abs. 2 BGB');
  });

  it('terms 14.4 carries the statutory model withdrawal notice and form, with the operator filled in', () => {
    const de = JSON.stringify(legalDe.terms.sections.find((s) => s.id === '14.4'));
    expect(de).toContain('Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.');
    expect(de).toContain('Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.');
    expect(de).toContain('Muster-Widerrufsformular');
    expect(de).toContain(operator.street);
    expect(de).toContain(operator.email);
    expect(JSON.stringify(pages.terms.sections.find((s) => s.id === '14.4'))).toContain(operator.street);
  });
});

describe('legal rewrite (Nov 2, 2026, docs/legal-review.md)', () => {
  const text = (doc: LegalDoc) => JSON.stringify(doc.sections);

  it('both versions are binding; the labels no longer say only the German one is', () => {
    expect(text(legalDe.terms)).toContain('beide Fassungen sind verbindlich');
    expect(legalDe.binding).not.toContain('Diese deutsche Fassung ist rechtlich maßgeblich');
    expect(pages.legal.germanBinding).not.toContain('برای راحتی شماست');
  });

  it('the terms have the blocking procedure, the ranking, the contract formation and the promotion conditions', () => {
    for (const id of ['7.6', '13.4', '14.7', '14.8', '15', '15.1', '15.2', '15.3', '15.4', '16', '16.1', '16.2', '5.10', '5.11']) {
      expect(ids(legalDe.terms), id).toContain(id);
    }
    expect(text(legalDe.terms)).toContain('30 Tagen');
    expect(text(pages.terms)).toContain('/help#ranking');
  });

  it('the privacy policy shows the right to object separately and names the real recipients', () => {
    expect(legalDe.privacy.sections.find((s) => s.id === '10.1')?.heading).toContain('Widerspruchsrecht');
    expect(text(legalDe.privacy)).toContain('Telegram Messenger Inc.');
    expect(text(legalDe.privacy)).not.toContain('Telegram FZ-LLC, Dubai, Vereinigte');
    expect(text(legalDe.privacy)).toContain('Google Ireland Limited');
    expect(text(legalDe.privacy)).toContain('legal_seen');
    expect(text(legalDe.privacy)).not.toContain('§ 257 HGB');
    expect(text(pages.privacy)).not.toContain('§ ۲۵۷ HGB');
  });
});
