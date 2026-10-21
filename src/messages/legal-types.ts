// The shape of a legal text (terms of use, privacy policy), shared by the Persian version in fa.ts
// and the binding German one in legal-de.ts, and rendered by src/components/legal-doc.tsx.
// Section ids are the numbers people cite («بند ۵.۲», „Ziffer 5.2“) and the anchors (#s5-2); both
// versions must have the same ids in the same order (tests/legal.test.ts).

/** A paragraph, a bulleted list, or the operator's details from operator.ts */
export type LegalBlock = string | { readonly list: readonly string[] } | { readonly operator: true };

/** `id` without a dot is a main section (h2), with a dot a subsection (h3) */
export type LegalSection = { readonly id: string; readonly heading: string; readonly body: readonly LegalBlock[] };

export type LegalDoc = {
  readonly title: string;
  readonly updated: string;
  /** Shows the draft banner until a lawyer has checked the text (before launch) */
  readonly draft: boolean;
  readonly intro: readonly string[];
  readonly sections: readonly LegalSection[];
};

/** The anchor of a section: 5.2 → s5-2 */
export const sectionAnchor = (id: string) => `s${id.replace(/\./g, '-')}`;
