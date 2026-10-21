// Who runs Peydoo: the Impressum (§5 DDG), the controller in the privacy policy and §1 of the terms.
// Given by the owner on Oct 21, 2026. Kept here, not in .env: the details are public, the same in
// every environment and part of legal text, and each change should be a commit with history.
// Never fill a field with a guess; leave the optional ones null.

export const operator = {
  /** Full name of the private person (or company name and legal form) */
  name: 'Reza Khodamehri Sheijani',
  street: 'Cornelius-Fredericks-Str. 14',
  postalCode: '13351',
  city: 'Berlin',
  countryDe: 'Deutschland',
  countryFa: 'آلمان',
  email: 'support@peydoo.com',
  phone: null as string | null,
  vatId: null as string | null,
  /** Register court and number, for a company */
  register: null as string | null,
  /** Data protection supervisory authority of the operator's Land (Berlin) */
  authority: {
    name: 'Berliner Beauftragte für Datenschutz und Informationsfreiheit',
    address: 'Alt-Moabit 59–61, 10555 Berlin',
    url: 'https://www.datenschutz-berlin.de',
  },
} as const;
