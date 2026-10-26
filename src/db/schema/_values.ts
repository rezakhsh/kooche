// Value lists used by more than one table. Each one is both the TypeScript type
// (text({ enum })) and the CHECK constraint, so the two can't drift (docs/schema.md, decision 2).

export const LISTING_STATUSES = [
  'draft',
  'pending_review',
  'active',
  'paused',
  'sold',
  'expired',
  'rejected',
  'deleted',
] as const;

/** Shared by reports and moderation decisions (docs/schema.md, section 11) */
export const REASON_CODES = [
  'scam',
  'prohibited',
  'counterfeit',
  'wrong_category',
  'duplicate',
  'misleading',
  'offensive',
  'harassment',
  'spam',
  'illegal',
  'personal_data',
  'other',
] as const;

export const ENTITLEMENT_TYPES = [
  'pro_plan',
  'featured',
  'top_of_category',
  'homepage',
  'highlight',
  'bump',
  'extended_radius',
] as const;

/** telegram: the bot; telegram_oidc: "Log in with Telegram" with the phone scope (migration 0018) */
export const PHONE_VERIFICATION_METHODS = ['telegram', 'telegram_oidc', 'sms'] as const;

export const ORGANIZATION_ROLES = ['owner', 'manager', 'staff'] as const;
