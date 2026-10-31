// Legal forms whose Impressum names the authorised representative (§ 5 DDG: the managing director
// of a GmbH or UG, the board of an AG or e.V., the partners of a KG or OHG; design check, Oct 31,
// 2026: the form marked it optional). Shared by the business form and the server checks.

export const REPRESENTED_FORMS = ['GmbH', 'UG (haftungsbeschränkt)', 'AG', 'GmbH & Co. KG', 'KG', 'OHG', 'OG', 'e.V.'] as const;

export function needsRepresentative(legalForm: string | null | undefined): boolean {
  return !!legalForm && (REPRESENTED_FORMS as readonly string[]).includes(legalForm.trim());
}
