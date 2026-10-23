import type { REASON_CODES } from '../../db/schema/_values';

// Report and decision reasons (docs/schema.md, section 11) and the sections of the terms of use
// they fall under (src/messages/fa.ts and legal-de.ts, `terms`). The first section is the default
// a moderator starts from; they can pick another. tests/legal.test.ts checks that each exists.

export type ReasonCode = (typeof REASON_CODES)[number];

export const REASON_SECTIONS: Record<ReasonCode, readonly string[]> = {
  scam: ['6.1', '4.1', '4.4'],
  prohibited: ['5.2', '5.3', '5.4', '5.5', '5.9', '5.1'],
  counterfeit: ['5.6'],
  wrong_category: ['4.2'],
  duplicate: ['4.2', '4.3'],
  misleading: ['4.1', '4.4'],
  offensive: ['5.7', '4.5'],
  harassment: ['6.1', '5.7'],
  spam: ['6.1', '4.2'],
  illegal: ['5.1'],
  personal_data: ['5.8'],
  other: ['4.1', '4.5', '4.6', '4.7', '5.1', '6.1', '9.2'],
};

/** What a visitor can choose when reporting each kind of thing (order as shown) */
export const PUBLIC_REASONS = {
  listing: ['scam', 'prohibited', 'counterfeit', 'misleading', 'wrong_category', 'duplicate', 'spam', 'offensive', 'personal_data', 'illegal', 'other'],
  user: ['scam', 'harassment', 'spam', 'offensive', 'personal_data', 'illegal', 'other'],
  business: ['scam', 'misleading', 'offensive', 'illegal', 'other'],
} as const satisfies Record<string, readonly ReasonCode[]>;

export type ReportTargetKind = keyof typeof PUBLIC_REASONS;
